import { supabase } from '@/lib/supabase';
import type {
  BetRow,
  ProfileRow,
  RoundPlayerRow,
  RoundRow,
  ScoreRow,
  TeeColor,
} from '@/lib/scorecard-types';
import type { EventModifierConfig, HoleEventRecord } from '@/utils/matchEventModifiers';
import type { WolfDecision } from '@/utils/wolfScoring';

/** 开局「邀请球友」：已注册用户或访客（不含创建者本人） */
export type RoundCompanionInput =
  | { type: 'registered'; userId: string; name: string; groupNumber?: number }
  | { type: 'guest'; id: string; name: string; groupNumber?: number };

export type RoundBundlePlayer = {
  userId: string;
  username: string;
  isGuest: boolean;
  groupNumber: number;
};

export async function getAuthedUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const id = data.user?.id;
  if (!id) throw new Error('未登录，请先登录');
  return id;
}

export async function listMyRounds(): Promise<RoundRow[]> {
  const userId = await getAuthedUserId();
  const { data, error } = await supabase
    .from('rounds')
    .select('*')
    .eq('created_by', userId)
    .order('played_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as RoundRow[];
}

function normalizeGroupNumber(n: unknown): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : 1;
  return Math.max(1, v);
}

export async function getRoundBundle(roundId: string): Promise<{
  round: RoundRow;
  players: RoundBundlePlayer[];
  scores: ScoreRow[];
}> {
  const { data: round, error: rErr } = await supabase.from('rounds').select('*').eq('id', roundId).single();
  if (rErr) throw rErr;

  const { data: rps, error: rpErr } = await supabase
    .from('round_players')
    .select('*')
    .eq('round_id', roundId);
  if (rpErr) throw rpErr;
  const roundRow = round as RoundRow;
  let playerRows = (rps ?? []) as RoundPlayerRow[];

  // 老局可能无 round_players 行：用创建者作为唯一参与者
  if (playerRows.length === 0 && roundRow.created_by) {
    playerRows = [
      {
        id: '',
        round_id: roundId,
        user_id: roundRow.created_by,
        handicap: null,
        group_number: 1,
      },
    ];
  }

  const userIds = playerRows.map((p) => p.user_id);

  const profMap = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles, error: pErr } = await supabase
      .from('profiles')
      .select('id,username')
      .in('id', userIds);
    if (pErr) throw pErr;
    (profiles ?? []).forEach((p: { id: string; username?: string | null }) => {
      profMap.set(p.id, (p.username as string) || '');
    });
  }

  const groupByUser = new Map<string, number>();
  playerRows.forEach((rp) => {
    groupByUser.set(rp.user_id, normalizeGroupNumber(rp.group_number));
  });

  const list: RoundBundlePlayer[] = userIds.map((uid) => ({
    userId: uid,
    username: profMap.get(uid) || uid.slice(0, 6),
    isGuest: false,
    groupNumber: groupByUser.get(uid) ?? 1,
  }));

  const rawGuests = (round as RoundRow).guest_companions;
  const guestRows: RoundBundlePlayer[] = Array.isArray(rawGuests)
    ? rawGuests
        .filter((g): g is { type: 'guest'; id: string; name: string; group_number?: number } =>
          g?.type === 'guest' && typeof g.id === 'string',
        )
        .map((g) => ({
          userId: g.id,
          username: typeof g.name === 'string' && g.name.trim() ? g.name.trim() : '访客',
          isGuest: true,
          groupNumber: normalizeGroupNumber(g.group_number),
        }))
    : [];

  const { data: scores, error: sErr } = await supabase
    .from('scores')
    .select('*')
    .eq('round_id', roundId);
  if (sErr) throw sErr;

  return {
    round: round as RoundRow,
    players: [...list, ...guestRows],
    scores: (scores ?? []) as ScoreRow[],
  };
}

export async function searchFriendsByEmailOrUsername(q: string): Promise<Array<{ userId: string; username: string }>> {
  const query = q.trim();
  if (!query) return [];

  // Primary: search profiles.username
  const { data, error } = await supabase
    .from('profiles')
    .select('id,username')
    .ilike('username', `%${query}%`)
    .limit(10);
  if (!error) {
    const rows = (data ?? []) as ProfileRow[];
    return rows.map((r) => ({ userId: r.id, username: r.username?.trim() || r.id.slice(0, 6) }));
  }

  // Fallback: if profiles has an email column (optional), try it.
  const { data: data2, error: error2 } = await supabase
    .from('profiles')
    .select('id,username')
    .ilike('email', `%${query}%`)
    .limit(10);
  if (error2) return [];
  const rows2 = (data2 ?? []) as ProfileRow[];
  return rows2.map((r) => ({ userId: r.id, username: r.username?.trim() || r.id.slice(0, 6) }));
}

export async function createRound(input: {
  courseName: string;
  teeColor: TeeColor;
  playedAt: string; // ISO date
  holes: 9 | 18;
  starting_hole?: number;
  /** 同行球友：注册用户 + 访客（不含本人） */
  players: RoundCompanionInput[];
  weather?: string;
  teeTime?: string;
  durationMinutes?: number | null;
  front9Minutes?: number | null;
  back9Minutes?: number | null;
  parSetting?: number;
  visibility?: 'public' | 'friends' | 'private';
  latitude?: number | null;
  longitude?: number | null;
  /** 果岭 Stimp，6–15 */
  greenSpeed?: number | null;
  /** 创建者所在组（默认 1） */
  creatorGroupNumber?: number;
}): Promise<{ roundId: string }> {
  const createdBy = await getAuthedUserId();
  const creatorGroup = normalizeGroupNumber(input.creatorGroupNumber ?? 1);
  const companions = input.players ?? [];
  const registeredIds = companions
    .filter((p): p is Extract<RoundCompanionInput, { type: 'registered' }> => p.type === 'registered')
    .map((p) => p.userId);
  const guests = companions.filter((p): p is Extract<RoundCompanionInput, { type: 'guest' }> => p.type === 'guest');
  const uniq = Array.from(new Set([createdBy, ...registeredIds]));

  const companionGroup = new Map<string, number>();
  companions.forEach((c) => {
    const key = c.type === 'registered' ? c.userId : c.id;
    companionGroup.set(key, normalizeGroupNumber(c.groupNumber));
  });

  const guestJson =
    guests.length > 0
      ? guests.map((g) => ({
          type: 'guest' as const,
          id: g.id,
          name: g.name.trim() || '访客',
          group_number: companionGroup.get(g.id) ?? 1,
        }))
      : null;

  const { data: inserted, error: rErr } = await supabase
    .from('rounds')
    .insert({
      created_by: createdBy,
      course_name: input.courseName.trim(),
      tee_color: input.teeColor,
      played_at: input.playedAt,
      holes: input.holes,
      starting_hole: input.starting_hole ?? 1,
      status: 'in_progress',
      weather: input.weather?.trim() || null,
      tee_time: input.teeTime?.trim() || null,
      duration_minutes:
        typeof input.durationMinutes === 'number' && Number.isFinite(input.durationMinutes)
          ? Math.max(0, Math.round(input.durationMinutes))
          : null,
      front9_minutes:
        typeof input.front9Minutes === 'number' && Number.isFinite(input.front9Minutes)
          ? Math.max(0, Math.round(input.front9Minutes))
          : null,
      back9_minutes:
        typeof input.back9Minutes === 'number' && Number.isFinite(input.back9Minutes)
          ? Math.max(0, Math.round(input.back9Minutes))
          : null,
      par_setting:
        typeof input.parSetting === 'number' && Number.isFinite(input.parSetting)
          ? Math.round(input.parSetting)
          : 72,
      visibility: input.visibility ?? 'public',
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      green_speed:
        typeof input.greenSpeed === 'number' && Number.isFinite(input.greenSpeed)
          ? Math.max(6, Math.min(15, Math.round(input.greenSpeed)))
          : null,
      ...(guestJson != null ? { guest_companions: guestJson } : {}),
    })
    .select('id')
    .single();
  if (rErr) throw rErr;

  const roundId = (inserted as any).id as string;

  const { error: rpErr } = await supabase.from('round_players').insert(
    uniq.map((uid) => ({
      round_id: roundId,
      user_id: uid,
      handicap: null,
      group_number: uid === createdBy ? creatorGroup : (companionGroup.get(uid) ?? 1),
    })),
  );
  if (rpErr) throw rpErr;

  return { roundId };
}

export async function upsertScoreCell(input: {
  roundId: string;
  userId: string;
  holeNumber: number;
  strokes: number;
  par: number;
  putts?: number | null;
  gir?: boolean | null;
  fir?: 'hit' | 'left' | 'right' | null;
  sand?: boolean | null;
  penalty?: 'none' | 'water' | 'ob' | null;
}): Promise<void> {
  const par = input.par;
  const firOut =
    par >= 4 && (input.fir === 'hit' || input.fir === 'left' || input.fir === 'right')
      ? input.fir
      : null;
  const { error } = await supabase.from('scores').upsert({
    round_id: input.roundId,
    user_id: input.userId,
    hole_number: input.holeNumber,
    strokes: input.strokes,
    par: input.par,
    putts:
      typeof input.putts === 'number' && Number.isFinite(input.putts)
        ? Math.max(0, Math.round(input.putts))
        : null,
    gir: typeof input.gir === 'boolean' ? input.gir : null,
    fir: firOut,
    sand: typeof input.sand === 'boolean' ? input.sand : null,
    penalty:
      input.penalty === 'water' || input.penalty === 'ob' ? input.penalty : null,
  });
  if (error) throw error;
}

export async function setRoundStatus(
  roundId: string,
  status: 'in_progress' | 'completed' | 'locked',
): Promise<void> {
  const { error } = await supabase.from('rounds').update({ status }).eq('id', roundId);
  if (error) throw error;
}

export async function listBetsForRound(roundId: string): Promise<BetRow[]> {
  const { data, error } = await supabase
    .from('bets')
    .select('*')
    .eq('round_id', roundId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as BetRow[];
}

export async function createBetsForRound(
  roundId: string,
  bets: Array<{
    betType: string;
    unitAmount: number;
    settlementTiming: 'per_hole' | 'end_total';
    sortOrder: number;
    isPublic: boolean;
    tieRule?: 'void' | 'carry' | 'double' | null;
    vegasTieRule?: 'void' | 'carry' | 'double' | null;
    eagleMultiplier?: number | null;
    doubleBogeyFlip?: boolean | null;
    events?: unknown[] | null;
    eventConfig?: EventModifierConfig | null;
  }>,
): Promise<void> {
  if (!bets.length) return;
  const payload = bets.map((b) => {
    const isVegasLasi = b.betType === 'fixed_lasi' || b.betType === 'rotating_lasi';
    return {
      round_id: roundId,
      bet_type: b.betType,
      unit_amount: Math.max(0, Math.round(b.unitAmount)),
      settlement_timing: b.settlementTiming,
      is_public: Boolean(b.isPublic),
      sort_order: Math.max(0, Math.round(b.sortOrder)),
      tie_rule:
        b.tieRule === 'carry' || b.tieRule === 'double' || b.tieRule === 'void' ? b.tieRule : null,
      vegas_tie_rule: isVegasLasi
        ? b.vegasTieRule === 'carry' || b.vegasTieRule === 'double' || b.vegasTieRule === 'void'
          ? b.vegasTieRule
          : null
        : null,
      eagle_multiplier: isVegasLasi
        ? typeof b.eagleMultiplier === 'number' && Number.isFinite(b.eagleMultiplier)
          ? Math.max(1, Math.min(3, Math.round(b.eagleMultiplier)))
          : null
        : null,
      double_bogey_flip: isVegasLasi ? Boolean(b.doubleBogeyFlip) : null,
      events: Array.isArray(b.events) ? b.events : [],
      event_config: b.eventConfig ?? null,
    };
  });
  const { error } = await supabase.from('bets').insert(payload);
  if (error) throw error;
}

export async function upsertBetResults(
  betId: string,
  rows: Array<{ userId: string; netAmount: number; resultDetail: any }>,
): Promise<void> {
  if (!rows.length) return;
  const payload = rows.map((r) => ({
    bet_id: betId,
    user_id: r.userId,
    net_amount: Math.round(r.netAmount),
    result_detail: r.resultDetail ?? {},
  }));
  const { error } = await supabase
    .from('bet_results')
    .upsert(payload, { onConflict: 'bet_id,user_id' });
  if (error) throw error;
}

export async function patchBetEvents(betId: string, events: HoleEventRecord[]): Promise<void> {
  const { error } = await supabase.from('bets').update({ events }).eq('id', betId);
  if (error) throw error;
}

export async function patchBetWolfDecisions(betId: string, wolfDecisions: WolfDecision[]): Promise<void> {
  const { error } = await supabase.from('bets').update({ wolf_decisions: wolfDecisions }).eq('id', betId);
  if (error) throw error;
}

/** 向同场球友发起成绩确认请求（幂等，重复发送忽略） */
export async function requestScoreConfirmation(roundId: string, confirmerIds: string[]): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');
  const rows = confirmerIds.map((cid) => ({
    round_id: roundId,
    requester_id: user.id,
    confirmer_id: cid,
    status: 'pending',
  }));
  const { error } = await supabase.from('round_confirmations').upsert(rows, {
    onConflict: 'round_id,confirmer_id',
    ignoreDuplicates: true,
  });
  if (error) throw error;
}

/** 确认某场成绩（当前用户作为 confirmer） */
export async function confirmRoundScore(roundId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');
  const { error } = await supabase
    .from('round_confirmations')
    .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
    .eq('round_id', roundId)
    .eq('confirmer_id', user.id);
  if (error) throw error;
}

/** 获取某局所有球友的确认状态 */
export async function getRoundConfirmations(roundId: string): Promise<
  Array<{
    confirmerId: string;
    confirmerName: string;
    status: 'pending' | 'confirmed' | 'disputed';
    confirmedAt: string | null;
  }>
> {
  const { data, error } = await supabase
    .from('round_confirmations')
    .select(
      'confirmer_id, status, confirmed_at, profiles!round_confirmations_confirmer_id_fkey(username)',
    )
    .eq('round_id', roundId);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    confirmerId: r.confirmer_id,
    confirmerName: r.profiles?.username ?? '球友',
    status: r.status,
    confirmedAt: r.confirmed_at ?? null,
  }));
}

/** 获取我需要确认的成绩列表（首页/通知用） */
export async function getPendingConfirmations(): Promise<
  Array<{
    roundId: string;
    courseName: string;
    playedAt: string;
    requesterName: string;
  }>
> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('round_confirmations')
    .select(
      'round_id, rounds(course_name, played_at, profiles!rounds_created_by_fkey(username))',
    )
    .eq('confirmer_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    roundId: r.round_id,
    courseName: r.rounds?.course_name ?? '球场',
    playedAt: r.rounds?.played_at ?? '',
    requesterName: r.rounds?.profiles?.username ?? '球友',
  }));
}

