import { calcStats, type HandicapRecord } from '@/lib/handicap';

export type SliceStats = {
  rounds: number;
  /** 总杆（有逐洞则求和杆数，否则用本场 adjusted 总杆） */
  avgGross: number | null;
  bestGross: number | null;
  worstGross: number | null;
  /** 样本标准差，至少 2 场 */
  stdGross: number | null;
  avgDiff: number | null;
  /** 每场总推杆平均 */
  avgPuttsRound: number | null;
  /** 每洞推杆平均（按各场洞数归一后取平均） */
  avgPuttsPerHole: number | null;
  /** 每洞 GIR 比例平均（%） */
  avgGirPct: number | null;
  /** 球道命中率平均（%），仅统计有球道数据的场 */
  avgFwPct: number | null;
  /** 有逐洞数据的场次数 */
  roundsWithHoles: number;
};

export type HoleShapeStats = {
  holesCounted: number;
  /** 相对标准杆 ≤ -1 的洞占比 % */
  birdieOrBetterPct: number | null;
  /** 标准杆洞占比 % */
  parPct: number | null;
  /** ≥ +2 的洞占比 % */
  doubleOrWorsePct: number | null;
};

export type NineSplitStats = {
  rounds: number;
  avgFront9: number | null;
  avgBack9: number | null;
};

function roundGross(r: HandicapRecord): number {
  if (r.holeDetails.length > 0) {
    return r.holeDetails.reduce((s, h) => s + h.strokes, 0);
  }
  return r.adjustedGrossScore;
}

function mean(nums: number[]): number | null {
  if (!nums.length) return null;
  const s = nums.reduce((a, b) => a + b, 0);
  return s / nums.length;
}

function sampleStd(nums: number[]): number | null {
  if (nums.length < 2) return null;
  const m = mean(nums)!;
  const v = nums.reduce((acc, x) => acc + (x - m) ** 2, 0) / (nums.length - 1);
  return Math.sqrt(v);
}

function fmt1(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return (Math.round(n * 10) / 10).toFixed(1);
}

function fmt0(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return String(Math.round(n));
}

/** 首页用：整体 / 近期等切片统计 */
export function buildSliceStats(slice: HandicapRecord[]): SliceStats {
  const rounds = slice.length;
  if (!rounds) {
    return {
      rounds: 0,
      avgGross: null,
      bestGross: null,
      worstGross: null,
      stdGross: null,
      avgDiff: null,
      avgPuttsRound: null,
      avgPuttsPerHole: null,
      avgGirPct: null,
      avgFwPct: null,
      roundsWithHoles: 0,
    };
  }

  const grosses = slice.map(roundGross).filter((x) => Number.isFinite(x));
  const diffs = slice.map((r) => r.scoreDifferential).filter((x) => Number.isFinite(x));

  const puttEligible = slice.filter((r) => r.holes > 0 && Number.isFinite(r.totalPutts));
  const puttsRound = mean(puttEligible.map((r) => r.totalPutts));
  const puttsPerHoleVals = puttEligible.map((r) => r.totalPutts / r.holes).filter((x) => Number.isFinite(x));

  const girVals = slice
    .filter((r) => r.holes > 0 && Number.isFinite(r.greensInRegulation))
    .map((r) => (r.greensInRegulation / r.holes) * 100);

  const fwVals = slice
    .filter((r) => r.fairwaysTotal > 0 && Number.isFinite(r.fairwaysHit))
    .map((r) => (r.fairwaysHit / r.fairwaysTotal) * 100);

  const roundsWithHoles = slice.filter((r) => r.holeDetails.length > 0).length;

  return {
    rounds,
    avgGross: mean(grosses),
    bestGross: grosses.length ? Math.min(...grosses) : null,
    worstGross: grosses.length ? Math.max(...grosses) : null,
    stdGross: sampleStd(grosses),
    avgDiff: mean(diffs),
    avgPuttsRound: puttsRound,
    avgPuttsPerHole: mean(puttsPerHoleVals),
    avgGirPct: mean(girVals),
    avgFwPct: mean(fwVals),
    roundsWithHoles,
  };
}

export function buildHoleShapeStats(slice: HandicapRecord[]): HoleShapeStats {
  let bird = 0;
  let par = 0;
  let dbl = 0;
  let n = 0;
  for (const r of slice) {
    for (const h of r.holeDetails) {
      n += 1;
      const rel = h.strokes - h.par;
      if (rel <= -1) bird += 1;
      else if (rel === 0) par += 1;
      else if (rel >= 2) dbl += 1;
    }
  }
  if (!n) {
    return { holesCounted: 0, birdieOrBetterPct: null, parPct: null, doubleOrWorsePct: null };
  }
  return {
    holesCounted: n,
    birdieOrBetterPct: (bird / n) * 100,
    parPct: (par / n) * 100,
    doubleOrWorsePct: (dbl / n) * 100,
  };
}

export function buildNineSplit(slice: HandicapRecord[]): NineSplitStats {
  const fronts: number[] = [];
  const backs: number[] = [];
  for (const r of slice) {
    if (r.holes !== 18 || r.holeDetails.length < 18) continue;
    const st = calcStats(r.holeDetails, 18);
    fronts.push(st.front9Strokes);
    backs.push(st.back9Strokes);
  }
  return {
    rounds: fronts.length,
    avgFront9: mean(fronts),
    avgBack9: mean(backs),
  };
}

export { fmt0, fmt1 };
