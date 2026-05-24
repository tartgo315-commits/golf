/**
 * 把 Supabase rounds/scores 数据适配成 HandicapRecord 格式
 * 让统计页可以同时展示本地成绩和云端成绩
 */
import { supabase } from '@/lib/supabase';
import type { HandicapRecord } from '@/lib/handicap';

type SupabaseRound = {
  id: string;
  course_name: string;
  played_at: string;
  holes: number;
  par_setting: number;
  weather: string | null;
  status: string;
  scores: {
    hole_number: number;
    strokes: number;
    par: number;
    putts: number | null;
  }[];
};

/** 从 Supabase 加载当前用户的成绩并转成 HandicapRecord[] */
export async function loadSupabaseHandicapRecords(): Promise<HandicapRecord[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const roundIds = new Set<string>();

    const { data: createdRows } = await supabase
      .from('rounds')
      .select('id')
      .eq('created_by', user.id);
    (createdRows ?? []).forEach((r: { id: string }) => {
      if (r.id) roundIds.add(r.id);
    });

    const { data: participantRows } = await supabase
      .from('round_players')
      .select('round_id')
      .eq('user_id', user.id);
    (participantRows ?? []).forEach((r: { round_id: string }) => {
      if (r.round_id) roundIds.add(r.round_id);
    });

    if (roundIds.size === 0) return [];

    const { data, error } = await supabase
      .from('rounds')
      .select(`
        id, course_name, played_at, holes, par_setting, weather, status,
        scores!inner(hole_number, strokes, par, putts, user_id)
      `)
      .in('id', Array.from(roundIds))
      .eq('status', 'completed')
      .order('played_at', { ascending: false })
      .limit(50);

    if (error || !data) return [];

    return data
      .map((round: any) => convertToHandicapRecord(round, user.id))
      .filter((r): r is HandicapRecord => r !== null);
  } catch {
    return [];
  }
}

function convertToHandicapRecord(round: SupabaseRound & { scores: any[] }, userId: string): HandicapRecord | null {
  // 只取当前用户的分数
  const myScores = round.scores.filter((s: any) => s.user_id === userId);
  if (myScores.length === 0) return null;

  const totalStrokes = myScores.reduce((sum: number, s: any) => sum + (s.strokes ?? 0), 0);
  if (totalStrokes === 0) return null;

  const totalPutts = myScores.some((s: any) => s.putts != null)
    ? myScores.reduce((sum: number, s: any) => sum + (s.putts ?? 0), 0)
    : null;

  // GIR：杆数 <= par - 1 即上果岭
  const girCount = myScores.filter((s: any) => s.strokes <= (s.par - 1)).length;

  // 按洞数比例折算 18 洞等效总杆
  const equivalent18 = round.holes === 9 ? totalStrokes * 2 : totalStrokes;

  // courseRating 用 par_setting，slopeRating 用标准 113
  const courseRating = round.par_setting ?? 72;
  const slopeRating = 113;
  const scoreDifferential = Math.round(((113 / slopeRating) * (equivalent18 - courseRating)) * 10) / 10;

  const holeDetails = [...myScores]
    .sort((a: any, b: any) => (a.hole_number ?? 0) - (b.hole_number ?? 0))
    .map((s: any) => ({
      holeNumber: s.hole_number,
      par: s.par ?? 4,
      strokes: s.strokes,
      putts: typeof s.putts === 'number' && Number.isFinite(s.putts) ? s.putts : 2,
      fairwayHit: null,
      greenInRegulation: s.strokes <= (s.par - 1),
      distanceM: null,
    }));

  const front9 = myScores.filter((s: any) => s.hole_number <= 9).reduce((sum: number, s: any) => sum + (s.strokes ?? 0), 0);
  const back9 = myScores.filter((s: any) => s.hole_number > 9).reduce((sum: number, s: any) => sum + (s.strokes ?? 0), 0);

  return {
    id: `supabase_${round.id}`,
    date: round.played_at,
    courseName: round.course_name || '未命名球场',
    courseRating,
    slopeRating,
    adjustedGrossScore: equivalent18,
    holes: round.holes === 9 ? 9 : 18,
    scoreDifferential,
    notes: '',
    holeDetails,
    totalPutts,
    fairwaysHit: null,
    fairwaysTotal: null,
    greensInRegulation: girCount > 0 ? girCount : null,
    front9Strokes: front9,
    back9Strokes: back9,
    weather: round.weather ?? undefined,
    handicapProcessed: true,
    submittedAt: new Date(round.played_at).getTime(),
  } as HandicapRecord;
}
