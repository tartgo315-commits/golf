import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  buildHandicapTrend,
  compareHandicapRecordsChronologicalAsc,
  type HandicapRecord,
} from '@/lib/handicap';

/** 与产品约定一致，单独存目标差点数值 */
export const HANDICAP_GOAL_STORAGE_KEY = 'handicap_goal';

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function clampStoredGoal(v: number): number {
  return round1(Math.min(54, Math.max(0, v)));
}

export async function getHandicapGoal(): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(HANDICAP_GOAL_STORAGE_KEY);
    if (raw == null || raw === '') return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'number' && Number.isFinite(parsed)) {
      return clampStoredGoal(parsed);
    }
    if (parsed && typeof parsed === 'object' && 'v' in parsed) {
      const v = (parsed as { v: unknown }).v;
      if (typeof v === 'number' && Number.isFinite(v)) return clampStoredGoal(v);
    }
  } catch {
    /* ignore */
  }
  return null;
}

export async function setHandicapGoal(value: number): Promise<void> {
  const v = clampStoredGoal(value);
  await AsyncStorage.setItem(HANDICAP_GOAL_STORAGE_KEY, JSON.stringify(v));
}

export async function clearHandicapGoal(): Promise<void> {
  await AsyncStorage.removeItem(HANDICAP_GOAL_STORAGE_KEY);
}

/** 历史趋势里最早出现的有效差点；若无则回退为当前差点（与「无起点」说明一致） */
export function computeGoalStartHi(
  records: HandicapRecord[],
  currentHi: number | null,
): number | null {
  const asc = [...records].sort(compareHandicapRecordsChronologicalAsc);
  if (asc.length === 0) return currentHi;
  const trend = buildHandicapTrend(asc);
  for (const t of trend) {
    if (typeof t.index === 'number' && Number.isFinite(t.index)) return t.index;
  }
  return currentHi;
}

export function computeGoalProgressPercent(start: number, current: number, target: number): number {
  if (current <= target) return 100;
  const denom = start - target;
  if (!(denom > 0)) return 0;
  const num = start - current;
  const pct = (num / denom) * 100;
  return Math.min(100, Math.max(0, round1(pct)));
}

export function isGoalAchieved(current: number | null, target: number): boolean {
  return typeof current === 'number' && Number.isFinite(current) && current <= target;
}

function linearRegressionSlope(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < n; i += 1) {
    const x = xs[i]!;
    const y = ys[i]!;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }
  const denom = n * sumXX - sumX * sumX;
  if (Math.abs(denom) < 1e-9) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}

const MS_PER_DAY = 86400000;
const NINETY_DAYS_MS = 90 * MS_PER_DAY;

function recordDateMs(r: HandicapRecord): number {
  const t = Date.parse(r.date);
  return Number.isFinite(t) ? t : 0;
}

/** 近 90 天平均每天场次；无数据时用全历史跨度估算 */
export function estimateRoundsPerDay(records: HandicapRecord[]): number {
  const now = Date.now();
  const in90 = records.filter((r) => {
    const t = recordDateMs(r);
    return t > 0 && now - t >= 0 && now - t <= NINETY_DAYS_MS;
  });
  if (in90.length > 0) return in90.length / 90;
  const asc = [...records].sort(compareHandicapRecordsChronologicalAsc);
  if (asc.length === 0) return 0;
  const t0 = recordDateMs(asc[0]!);
  const t1 = recordDateMs(asc[asc.length - 1]!);
  const spanMs = Math.max(30 * MS_PER_DAY, Math.abs(t1 - t0) || 30 * MS_PER_DAY);
  const days = spanMs / MS_PER_DAY;
  return asc.length / Math.max(days, 1);
}

export type GoalPredictionResult =
  | { kind: 'insufficient' }
  | { kind: 'flat' }
  | { kind: 'months'; months: number };

/**
 * 近 5 个有效差点点的线性回归斜率（每场趋势步长上的平均变化），
 * 结合与目标的杆差及打球频率估算达成月数。
 */
export function predictGoalMonths(params: {
  records: HandicapRecord[];
  currentHi: number;
  targetHi: number;
}): GoalPredictionResult {
  const { records, currentHi, targetHi } = params;
  if (currentHi <= targetHi) return { kind: 'insufficient' };

  const asc = [...records].sort(compareHandicapRecordsChronologicalAsc);
  const trend = buildHandicapTrend(asc);
  const valid = trend
    .map((t) => t.index)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const last5 = valid.slice(-5);
  if (last5.length < 3) return { kind: 'insufficient' };

  const xs = last5.map((_, i) => i);
  const slope = linearRegressionSlope(xs, last5);
  if (!(slope < -1e-6)) return { kind: 'flat' };

  const gap = currentHi - targetHi;
  const roundsNeeded = gap / -slope;
  if (!Number.isFinite(roundsNeeded) || roundsNeeded <= 0) return { kind: 'flat' };

  const rpd = estimateRoundsPerDay(records);
  if (!(rpd > 1e-6)) return { kind: 'flat' };

  const daysNeeded = roundsNeeded / rpd;
  const months = daysNeeded / 30;
  if (!Number.isFinite(months) || months <= 0) return { kind: 'flat' };
  return { kind: 'months', months: round1(months) };
}
