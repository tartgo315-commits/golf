import { supabase } from '@/lib/supabase';
import type { ProfileRow, RoundPlayerRow, RoundRow, ScoreRow, TeeColor } from '@/lib/scorecard-types';

export async function getAuthedUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const id = data.user?.id;
  if (!id) throw new Error('未登录，请先登录');
  return id;
}

export async function listMyRounds(): Promise<RoundRow[]> {
  const userId = await getAuthedUserId();
  const { data: memberships, error: mErr } = await supabase
    .from('round_players')
    .select('round_id')
    .eq('user_id', userId);
  if (mErr) throw mErr;
  const ids = (memberships ?? []).map((x: any) => x.round_id).filter(Boolean);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('rounds')
    .select('*')
    .in('id', ids)
    .order('played_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as RoundRow[];
}

export async function getRoundBundle(roundId: string): Promise<{
  round: RoundRow;
  players: Array<{ userId: string; username: string }>;
  scores: ScoreRow[];
}> {
  const { data: round, error: rErr } = await supabase.from('rounds').select('*').eq('id', roundId).single();
  if (rErr) throw rErr;

  const { data: rps, error: rpErr } = await supabase
    .from('round_players')
    .select('*')
    .eq('round_id', roundId);
  if (rpErr) throw rpErr;
  const players = (rps ?? []) as RoundPlayerRow[];
  const userIds = players.map((p) => p.user_id);

  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('id,username')
    .in('id', userIds);
  if (pErr) throw pErr;
  const profMap = new Map<string, string>();
  (profiles ?? []).forEach((p: any) => {
    profMap.set(p.id, (p.username as string) || '');
  });

  const list = userIds.map((uid) => ({
    userId: uid,
    username: profMap.get(uid) || uid.slice(0, 6),
  }));

  const { data: scores, error: sErr } = await supabase
    .from('scores')
    .select('*')
    .eq('round_id', roundId);
  if (sErr) throw sErr;

  return { round: round as RoundRow, players: list, scores: (scores ?? []) as ScoreRow[] };
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
  playerUserIds: string[];
}): Promise<{ roundId: string }> {
  const createdBy = await getAuthedUserId();
  const uniq = Array.from(new Set([createdBy, ...input.playerUserIds]));

  const { data: inserted, error: rErr } = await supabase
    .from('rounds')
    .insert({
      created_by: createdBy,
      course_name: input.courseName.trim(),
      tee_color: input.teeColor,
      played_at: input.playedAt,
      holes: input.holes,
      status: 'in_progress',
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
}): Promise<void> {
  const { error } = await supabase.from('scores').upsert({
    round_id: input.roundId,
    user_id: input.userId,
    hole_number: input.holeNumber,
    strokes: input.strokes,
    par: input.par,
  });
  if (error) throw error;
}

export async function setRoundStatus(roundId: string, status: 'in_progress' | 'completed'): Promise<void> {
  const { error } = await supabase.from('rounds').update({ status }).eq('id', roundId);
  if (error) throw error;
}

