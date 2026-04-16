/**
 * 高尔夫成绩统计引擎：纯函数、无 UI。
 * 差点与调整后总杆与 lib/handicap 中 WHS 逻辑保持一致。
 */

import {
  calcAdjustedGrossFromHoles,
  calcDifferential,
  calcGIR,
  type HandicapRecord,
  type HoleDetail,
} from '@/lib/handicap';

// —— 与 lib/handicap.ts 中 WHS「用于 HI 的记分取量」表一致（最近 20 场内） ——
const BEST_COUNT_BY_TOTAL: Record<number, number> = {
  3: 1,
  4: 1,
  5: 1,
  6: 2,
  7: 2,
  8: 2,
  9: 3,
  10: 3,
  11: 3,
  12: 4,
  13: 4,
  14: 4,
  15: 5,
  16: 5,
  17: 6,
  18: 6,
  19: 7,
  20: 8,
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function toDateMs(date: string): number {
  return Number.isFinite(Date.parse(date)) ? Date.parse(date) : 0;
}

function mean(nums: number[]): number | null {
  if (!nums.length) return null;
  const s = nums.reduce((a, b) => a + b, 0);
  return s / nums.length;
}

/** 单洞原始数据（所有汇总均由 holes[] 派生） */
export type HoleShot = {
  holeNumber: number;
  par: number;
  score: number;
  putts: number;
  /** Par3 应为 null；Par4/5 为 boolean */
  fairwayHit: boolean | null;
  girHit: boolean;
  /** 未上果岭时是否 up-and-down；未知时可 null（引擎会按 score<=par 回推） */
  upAndDown: boolean | null;
  penalties: number;
  /** 预留：第二杆/攻果岭距离（码），用于分桶 */
  approachDistanceYds?: number | null;
};

/** 单场 Round（与存储层解耦的标准结构） */
export type RoundData = {
  roundId: string;
  date: string;
  courseName: string;
  courseRating: number;
  slopeRating: number;
  holeCount: 9 | 18;
  holes: HoleShot[];
  totalScore: number;
  totalPutts: number;
  /** 与 handicap 记录一致时传入，用于真实 NDB 封顶 */
  playingCourseHandicap?: number;
  strokeIndexMap?: number[];
};

export type ValidateRoundResult =
  | { ok: true }
  | {
      ok: false;
      errors: string[];
    };

export type HandicapIndexResult =
  | { ok: true; index: number; scoresUsed: number; bestDiffsUsed: number }
  | { ok: false; reason: '数据不足' | '无有效微差' };

export type FourDimensionStats = {
  driving: { firPct: number | null; fairwayOpportunities: number; fairwaysHit: number };
  approach: {
    girPct: number | null;
    girPar3Pct: number | null;
    girPar4Pct: number | null;
    girPar5Pct: number | null;
    holesPar3: number;
    holesPar4: number;
    holesPar5: number;
  };
  shortGame: { scramblingPct: number | null; missedGirHoles: number; scramblesMade: number };
  putting: {
    avgPuttsPerRound: number | null;
    avgPuttsPerHole: number | null;
    threePuttHolePct: number | null;
    onePuttHolePct: number | null;
    avgPuttsWhenGir: number | null;
    avgPuttsWhenMissGir: number | null;
  };
};

export type TrendMetric =
  | 'avgScore'
  | 'firPct'
  | 'girPct'
  | 'scramblingPct'
  | 'avgPutts'
  | 'threePuttPct'
  | 'onePuttPct';

export type TrendKind = 'improving' | 'declining' | 'stable';

export type TrendResult = {
  values: number[];
  trend: TrendKind;
};

export type DistanceBucketKey = '<100' | '100-125' | '125-150' | '150-175' | '175+';

export type GirDistanceBucketRow = {
  bucket: DistanceBucketKey;
  holes: number;
  gir: number;
  girPct: number | null;
};

// —— 基础派生 ——

export function sumHoleScores(holes: HoleShot[]): number {
  return holes.reduce((s, h) => s + h.score, 0);
}

export function sumHolePutts(holes: HoleShot[]): number {
  return holes.reduce((s, h) => s + h.putts, 0);
}

/** 由 holes 写回 totalScore / totalPutts（便于迁移后规范化） */
export function hydrateRoundTotals<T extends RoundData>(round: T): T {
  return {
    ...round,
    totalScore: sumHoleScores(round.holes),
    totalPutts: sumHolePutts(round.holes),
  };
}

export function holesToHoleDetails(holes: HoleShot[]): HoleDetail[] {
  return [...holes]
    .sort((a, b) => a.holeNumber - b.holeNumber)
    .map((h) => ({
      holeNumber: h.holeNumber,
      par: h.par,
      distanceM: null,
      strokes: h.score,
      putts: h.putts,
      fairwayHit: h.par === 3 ? null : h.fairwayHit,
      greenInRegulation: h.girHit,
    }));
}

/** 从逐洞计算 WHS 调整后总杆（与 lib/handicap 一致） */
export function calcAdjustedGrossForRound(round: RoundData): number {
  const details = holesToHoleDetails(round.holes);
  return calcAdjustedGrossFromHoles(
    details,
    round.holeCount,
    round.playingCourseHandicap,
    round.strokeIndexMap,
  );
}

/**
 * WHS 单场 Score Differential（需已按 NDB 封顶的 adjusted gross）。
 * 与 lib/handicap.calcDifferential 一致（9 洞会 ×2 归一）。
 */
export function calcScoreDifferential(
  adjustedGross: number,
  courseRating: number,
  slopeRating: number,
  holeCount: 9 | 18,
): number {
  return calcDifferential(adjustedGross, courseRating, slopeRating, holeCount);
}

/** 用户文档中的简化写法：默认 18 洞；9 洞请传 holeCount。 */
export function calcDifferentialRaw(
  score: number,
  courseRating: number,
  slopeRating: number,
  holeCount: 9 | 18 = 18,
): number {
  return calcDifferential(score, courseRating, slopeRating, holeCount);
}

export function calcPostingDifferentialForRound(round: RoundData): number | null {
  if (!round.holes.length || round.holes.length !== round.holeCount) return null;
  const adj = calcAdjustedGrossForRound(round);
  if (!Number.isFinite(adj) || !Number.isFinite(round.courseRating) || !Number.isFinite(round.slopeRating)) return null;
  if (round.slopeRating <= 0) return null;
  return calcScoreDifferential(adj, round.courseRating, round.slopeRating, round.holeCount);
}

function bestDiffCountFromSampleSize(n: number): number {
  if (n < 3) return 0;
  const safe = Math.min(n, 20);
  return BEST_COUNT_BY_TOTAL[safe] ?? 8;
}

/**
 * WHS Handicap Index：最近 20 场中取最好 k 场微差平均 ×0.96；有效微差不足 3 则不计算。
 * k 按「有效记分份数」查表（与 lib/handicap 一致）。
 */
export function calcHandicapIndexFromRounds(roundsNewestFirst: RoundData[]): HandicapIndexResult {
  const sorted = [...roundsNewestFirst].sort((a, b) => toDateMs(b.date) - toDateMs(a.date));
  const recent = sorted.slice(0, 20);
  const diffs: number[] = [];
  for (const r of recent) {
    const d = calcPostingDifferentialForRound(r);
    if (d != null && Number.isFinite(d)) diffs.push(d);
  }
  const m = diffs.length;
  if (m < 3) return { ok: false, reason: '数据不足' };
  const take = Math.min(bestDiffCountFromSampleSize(m), m);
  const best = [...diffs].sort((a, b) => a - b).slice(0, take);
  const avg = best.reduce((s, x) => s + x, 0) / best.length;
  return { ok: true, index: round1(avg * 0.96), scoresUsed: recent.length, bestDiffsUsed: take };
}

// —— 校验 ——

export function validateRound(round: RoundData): ValidateRoundResult {
  const errors: string[] = [];
  const sumS = sumHoleScores(round.holes);
  const sumP = sumHolePutts(round.holes);
  if (round.holes.length !== round.holeCount) {
    errors.push(`洞数 ${round.holes.length} 与 holeCount ${round.holeCount} 不一致`);
  }
  if (sumS !== round.totalScore) errors.push(`totalScore ${round.totalScore} ≠ 各洞 score 之和 ${sumS}`);
  if (sumP !== round.totalPutts) errors.push(`totalPutts ${round.totalPutts} ≠ 各洞 putts 之和 ${sumP}`);

  for (const h of round.holes) {
    if (h.par === 3 && h.fairwayHit !== null && h.fairwayHit !== undefined) {
      errors.push(`第 ${h.holeNumber} 洞 Par3 不应记录 fairwayHit`);
    }
    if (h.putts > h.score) {
      errors.push(`第 ${h.holeNumber} 洞推杆 ${h.putts} 大于总杆 ${h.score}`);
    }
    if (h.putts < 0 || h.score < 1) {
      errors.push(`第 ${h.holeNumber} 洞 score/putts 非法`);
    }
    const derivedGir = calcGIR(h.score, h.par, h.putts);
    if (h.girHit !== derivedGir) {
      errors.push(`第 ${h.holeNumber} 洞 girHit 与 score/putts 推导的 GIR 不一致`);
    }
  }

  return errors.length ? { ok: false, errors } : { ok: true };
}

// —— 四维 / 聚合 ——

function isScrambleSuccess(h: HoleShot): boolean {
  if (h.girHit) return false;
  if (h.upAndDown === true) return true;
  if (h.upAndDown === false) return false;
  return h.score <= h.par;
}

/** 单场 FIR%：仅 Par4+Par5，fairwayHit 为 boolean 的洞 */
export function calcRoundFirPct(round: RoundData): number | null {
  let opp = 0;
  let hit = 0;
  for (const h of round.holes) {
    if (h.par === 3) continue;
    if (h.fairwayHit === null || h.fairwayHit === undefined) continue;
    opp += 1;
    if (h.fairwayHit === true) hit += 1;
  }
  return opp > 0 ? (hit / opp) * 100 : null;
}

export function calcRoundGirPct(round: RoundData): number | null {
  if (!round.holes.length) return null;
  const g = round.holes.filter((h) => h.girHit).length;
  return (g / round.holes.length) * 100;
}

export function calcRoundScramblingPct(round: RoundData): number | null {
  let miss = 0;
  let ok = 0;
  for (const h of round.holes) {
    if (h.girHit) continue;
    miss += 1;
    if (isScrambleSuccess(h)) ok += 1;
  }
  return miss > 0 ? (ok / miss) * 100 : null;
}

export function calcRoundThreePuttPct(round: RoundData): number | null {
  if (!round.holes.length) return null;
  const t = round.holes.filter((h) => h.putts >= 3).length;
  return (t / round.holes.length) * 100;
}

export function calcRoundOnePuttPct(round: RoundData): number | null {
  if (!round.holes.length) return null;
  const t = round.holes.filter((h) => h.putts === 1).length;
  return (t / round.holes.length) * 100;
}

export function calcFourDimensionStatsFromRounds(rounds: RoundData[]): FourDimensionStats {
  let fwOpp = 0;
  let fwHit = 0;
  let holesAll = 0;
  let girAll = 0;
  let p3n = 0,
    p3g = 0,
    p4n = 0,
    p4g = 0,
    p5n = 0,
    p5g = 0;
  let missedGir = 0;
  let scrambleMade = 0;
  const puttsGir: number[] = [];
  const puttsMiss: number[] = [];
  let threePutt = 0;
  let onePutt = 0;
  const puttsPerRound: number[] = [];

  for (const r of rounds) {
    if (!r.holes.length) continue;
    puttsPerRound.push(r.totalPutts);
    for (const h of r.holes) {
      holesAll += 1;
      if (h.girHit) girAll += 1;
      if (h.par === 3) {
        p3n += 1;
        if (h.girHit) p3g += 1;
      } else if (h.par === 4) {
        p4n += 1;
        if (h.girHit) p4g += 1;
      } else if (h.par === 5) {
        p5n += 1;
        if (h.girHit) p5g += 1;
      }
      if (h.par !== 3 && h.fairwayHit !== null && h.fairwayHit !== undefined) {
        fwOpp += 1;
        if (h.fairwayHit === true) fwHit += 1;
      }
      if (h.girHit) {
        puttsGir.push(h.putts);
      } else {
        puttsMiss.push(h.putts);
        missedGir += 1;
        if (isScrambleSuccess(h)) scrambleMade += 1;
      }
      if (h.putts >= 3) threePutt += 1;
      if (h.putts === 1) onePutt += 1;
    }
  }

  return {
    driving: {
      firPct: fwOpp > 0 ? (fwHit / fwOpp) * 100 : null,
      fairwayOpportunities: fwOpp,
      fairwaysHit: fwHit,
    },
    approach: {
      girPct: holesAll > 0 ? (girAll / holesAll) * 100 : null,
      girPar3Pct: p3n > 0 ? (p3g / p3n) * 100 : null,
      girPar4Pct: p4n > 0 ? (p4g / p4n) * 100 : null,
      girPar5Pct: p5n > 0 ? (p5g / p5n) * 100 : null,
      holesPar3: p3n,
      holesPar4: p4n,
      holesPar5: p5n,
    },
    shortGame: {
      scramblingPct: missedGir > 0 ? (scrambleMade / missedGir) * 100 : null,
      missedGirHoles: missedGir,
      scramblesMade: scrambleMade,
    },
    putting: {
      avgPuttsPerRound: mean(puttsPerRound),
      avgPuttsPerHole:
        holesAll > 0 ? rounds.reduce((s, rr) => s + rr.totalPutts, 0) / holesAll : null,
      threePuttHolePct: holesAll > 0 ? (threePutt / holesAll) * 100 : null,
      onePuttHolePct: holesAll > 0 ? (onePutt / holesAll) * 100 : null,
      avgPuttsWhenGir: mean(puttsGir),
      avgPuttsWhenMissGir: mean(puttsMiss),
    },
  };
}

const TREND_EPS = 0.06;

function lowerIsBetter(metric: TrendMetric): boolean {
  return metric === 'avgScore' || metric === 'avgPutts' || metric === 'threePuttPct';
}

export function extractRoundMetric(round: RoundData, metric: TrendMetric): number | null {
  switch (metric) {
    case 'avgScore':
      return round.holes.length ? round.totalScore : null;
    case 'firPct':
      return calcRoundFirPct(round);
    case 'girPct':
      return calcRoundGirPct(round);
    case 'scramblingPct':
      return calcRoundScramblingPct(round);
    case 'avgPutts':
      return round.holes.length ? round.totalPutts : null;
    case 'threePuttPct':
      return calcRoundThreePuttPct(round);
    case 'onePuttPct':
      return calcRoundOnePuttPct(round);
    default:
      return null;
  }
}

/**
 * rounds 顺序：默认「最新在前」。
 * values：与 rounds 同序的每场指标值（含 null 时用 NaN 占位以便对齐长度）。
 * trend：比较最近 windowSize 场均值 vs 紧接着更早 windowSize 场均值。
 */
export function calcTrend(
  roundsNewestFirst: RoundData[],
  metric: TrendMetric,
  windowSize = 5,
): TrendResult {
  const values: number[] = roundsNewestFirst.map((r) => {
    const v = extractRoundMetric(r, metric);
    return v == null || !Number.isFinite(v) ? NaN : v;
  });

  if (windowSize < 1 || values.length < windowSize * 2) {
    return { values, trend: 'stable' };
  }

  const recent = values.slice(0, windowSize).filter((x) => Number.isFinite(x));
  const prior = values.slice(windowSize, windowSize * 2).filter((x) => Number.isFinite(x));
  if (recent.length < windowSize || prior.length < windowSize) {
    return { values, trend: 'stable' };
  }

  const mr = recent.reduce((a, b) => a + b, 0) / recent.length;
  const mp = prior.reduce((a, b) => a + b, 0) / prior.length;
  const diff = mr - mp;
  if (Math.abs(diff) < TREND_EPS) return { values, trend: 'stable' };
  const improving = lowerIsBetter(metric) ? diff < 0 : diff > 0;
  return { values, trend: improving ? 'improving' : 'declining' };
}

function bucketKeyForApproachYds(y: number): DistanceBucketKey | null {
  if (!Number.isFinite(y) || y < 0) return null;
  if (y < 100) return '<100';
  if (y < 125) return '100-125';
  if (y < 150) return '125-150';
  if (y < 175) return '150-175';
  return '175+';
}

/** 仅统计 holes[].approachDistanceYds 有值的洞；无数据时各桶 holes=0 */
export function calcGirByApproachDistanceBuckets(rounds: RoundData[]): GirDistanceBucketRow[] {
  const order: DistanceBucketKey[] = ['<100', '100-125', '125-150', '150-175', '175+'];
  const acc: Record<DistanceBucketKey, { holes: number; gir: number }> = {
    '<100': { holes: 0, gir: 0 },
    '100-125': { holes: 0, gir: 0 },
    '125-150': { holes: 0, gir: 0 },
    '150-175': { holes: 0, gir: 0 },
    '175+': { holes: 0, gir: 0 },
  };

  for (const r of rounds) {
    for (const h of r.holes) {
      const y = h.approachDistanceYds;
      if (y == null || !Number.isFinite(y)) continue;
      const key = bucketKeyForApproachYds(y);
      if (!key) continue;
      acc[key].holes += 1;
      if (h.girHit) acc[key].gir += 1;
    }
  }

  return order.map((bucket) => {
    const { holes, gir } = acc[bucket];
    return { bucket, holes, gir, girPct: holes > 0 ? (gir / holes) * 100 : null };
  });
}

/** 将 localStorage / HandicapRecord 旧结构转为 RoundData（无完整逐洞则跳过该场） */
export function migrateOldData(raw: unknown): RoundData[] {
  if (!Array.isArray(raw)) return [];
  const out: RoundData[] = [];
  for (const item of raw) {
    const r = migrateOneHandicapRecord(item);
    if (r) out.push(r);
  }
  return out;
}

function migrateOneHandicapRecord(raw: unknown): RoundData | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Partial<HandicapRecord>;
  const holeCount: 9 | 18 = rec.holes === 9 ? 9 : 18;
  const details = Array.isArray(rec.holeDetails) ? rec.holeDetails : [];
  if (details.length !== holeCount) return null;

  const holes: HoleShot[] = details.map((h, idx) => {
    const par = typeof h.par === 'number' && Number.isFinite(h.par) ? h.par : 4;
    const strokes = typeof h.strokes === 'number' && Number.isFinite(h.strokes) ? h.strokes : par;
    const putts =
      typeof h.putts === 'number' && Number.isFinite(h.putts) ? Math.max(0, Math.min(h.putts, strokes)) : 0;
    const gir =
      typeof h.greenInRegulation === 'boolean' ? h.greenInRegulation : calcGIR(strokes, par, putts);
    const fairwayHit: boolean | null = par === 3 ? null : typeof h.fairwayHit === 'boolean' ? h.fairwayHit : false;
    const missGir = !gir;
    const upAndDown: boolean | null = missGir ? strokes <= par : null;
    return {
      holeNumber: typeof h.holeNumber === 'number' && Number.isFinite(h.holeNumber) ? h.holeNumber : idx + 1,
      par,
      score: strokes,
      putts,
      fairwayHit,
      girHit: gir,
      upAndDown,
      penalties: 0,
      approachDistanceYds: undefined,
    };
  });

  const totalScore = sumHoleScores(holes);
  const totalPutts = sumHolePutts(holes);

  const courseRating = Number(rec.courseRating);
  const slopeRating = Number(rec.slopeRating);
  if (!Number.isFinite(courseRating) || !Number.isFinite(slopeRating)) return null;

  const round: RoundData = {
    roundId:
      typeof rec.id === 'string' && rec.id.length > 0
        ? rec.id
        : `mig-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date: typeof rec.date === 'string' ? rec.date : '',
    courseName: typeof rec.courseName === 'string' ? rec.courseName : '',
    courseRating,
    slopeRating,
    holeCount,
    holes,
    totalScore,
    totalPutts,
  };

  if (typeof rec.playingCourseHandicap === 'number' && Number.isFinite(rec.playingCourseHandicap)) {
    round.playingCourseHandicap = rec.playingCourseHandicap;
  }
  if (Array.isArray(rec.strokeIndexMap) && rec.strokeIndexMap.length === holeCount) {
    const nums = rec.strokeIndexMap.map((x) => Number(x));
    const max = holeCount;
    if (
      nums.every((v) => Number.isInteger(v) && v >= 1 && v <= max) &&
      new Set(nums).size === nums.length
    ) {
      round.strokeIndexMap = nums;
    }
  }

  return hydrateRoundTotals(round);
}