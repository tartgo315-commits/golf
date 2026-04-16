/**
 * 专业成绩统计引擎（PGA / Arccos 风格分类）。
 * 纯函数、无 UI。时间窗口由 filterRounds 统一处理。
 */

import {
  calcAdjustedGrossFromHoles,
  calcDifferential,
  calcGIR,
  type HandicapRecord,
  type HoleDetail,
} from '@/lib/handicap';

// —— WHS：用于 HI 的记分取量（最近 20 场内） ——
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

export const SG_LOCKED_MESSAGE = '需要记录逐洞距离数据后解锁';

export type RoundWindow = 'all' | 'last5' | 'last10' | 'last20';

export type MissDirection = 'left' | 'right' | 'short' | 'long';

export type HoleData = {
  holeNumber: number;
  par: number;
  score: number;
  putts: number;
  fairwayHit: boolean | null;
  girHit: boolean;
  upAndDown: boolean | null;
  sandSave: boolean | null;
  penalties: number;
  driveDistance: number | null;
  approachDistance: number | null;
  puttsDistance: number[] | null;
  missDirection: MissDirection | null;
};

export type RoundData = {
  roundId: string;
  date: string;
  courseName: string;
  courseRating: number;
  slopeRating: number;
  teeColor?: string | null;
  totalScore: number;
  totalPutts: number;
  totalFairways: number;
  totalGIR: number;
  holes: HoleData[];
  holeCount: 9 | 18;
  playingCourseHandicap?: number;
  strokeIndexMap?: number[];
};

export type FilterRoundsResult = {
  rounds: RoundData[];
  /** 实际返回的场次数 */
  actualCount: number;
  /** 窗口期望的 N；'all' 时为 null */
  requestedCount: number | null;
  window: RoundWindow;
};

export type ValidateRoundResult = { ok: true } | { ok: false; errors: string[] };

export type HandicapIndexResult =
  | { ok: true; index: number; scoresUsed: number; bestDiffsUsed: number }
  | { ok: false; reason: '数据不足' | '无有效微差' };

export type TrendDirection = 'up' | 'down' | 'stable';

export type CalcTrendResult = {
  current: number | null;
  previous: number | null;
  direction: TrendDirection;
  changePercent: number | null;
};

export type ScoringStats = {
  avgScore: number | null;
  handicapIndex: HandicapIndexResult;
  avgDifferential: number | null;
  bestScore: number | null;
  worstScore: number | null;
  avgScoreByPar: { par3: number | null; par4: number | null; par5: number | null };
  avgFront9: number | null;
  avgBack9: number | null;
  scoringDistribution: {
    eaglePct: number | null;
    birdiePct: number | null;
    parPct: number | null;
    bogeyPct: number | null;
    doublePlusPct: number | null;
  };
  maxConsecutiveHolesUnderPar: number | null;
  maxConsecutiveHolesOverPar: number | null;
};

export type OffTheTeeStats = {
  firPct: number | null;
  avgDriveDistanceYds: number | null;
  missTendency: { leftPct: number | null; rightPct: number | null; fairwayPct: number | null } | null;
  avgPenaltiesPerRound: number | null;
};

export type ApproachStats = {
  girPct: number | null;
  girPar3Pct: number | null;
  girPar4Pct: number | null;
  girPar5Pct: number | null;
  girByApproachBucket: Record<string, { holes: number; gir: number; girPct: number | null }> | null;
  missGreenDirection: {
    leftPct: number | null;
    rightPct: number | null;
    shortPct: number | null;
    longPct: number | null;
  } | null;
  avgProximityFt: number | null;
};

export type AroundTheGreenStats = {
  scramblingPct: number | null;
  upAndDownPct: number | null;
  sandSavePct: number | null;
  avgMissGirHolesPerRound: number | null;
};

export type PuttingStats = {
  avgTotalPutts: number | null;
  avgPuttsPerHole: number | null;
  threePuttRatePct: number | null;
  onePuttRatePct: number | null;
  puttsWhenGIR: number | null;
  puttsWhenMiss: number | null;
  onePuttRateByFirstPuttBucket: Record<string, number | null> | null;
};

export type StrokesGainedStats = {
  unlocked: boolean;
  message: string | null;
  sgOTT: number | null;
  sgApproach: number | null;
  sgAroundGreen: number | null;
  sgPutting: number | null;
  sgTeeToGreen: number | null;
  sgTotal: number | null;
};

export type ComputeAllStatsResult = {
  scoring: ScoringStats;
  offTheTee: OffTheTeeStats;
  approach: ApproachStats;
  aroundTheGreen: AroundTheGreenStats;
  putting: PuttingStats;
  strokesGained: StrokesGainedStats;
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

function holesToHoleDetails(holes: HoleData[]): HoleDetail[] {
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

export function sumHoleScores(holes: HoleData[]): number {
  return holes.reduce((s, h) => s + h.score, 0);
}

export function sumHolePutts(holes: HoleData[]): number {
  return holes.reduce((s, h) => s + h.putts, 0);
}

/** 由 holes 汇总 totalScore / totalPutts / totalFairways / totalGIR */
export function hydrateRoundTotals<T extends RoundData>(round: T): T {
  let fwHit = 0;
  let gir = 0;
  for (const h of round.holes) {
    if (h.par !== 3 && h.fairwayHit === true) fwHit += 1;
    if (h.girHit) gir += 1;
  }
  return {
    ...round,
    totalScore: sumHoleScores(round.holes),
    totalPutts: sumHolePutts(round.holes),
    totalFairways: fwHit,
    totalGIR: gir,
  };
}

/** 按日期新→旧排序后取最近 N 场；不足则全返回并记录 actualCount */
export function filterRounds(allRounds: RoundData[], window: RoundWindow): FilterRoundsResult {
  const sorted = [...allRounds].sort((a, b) => toDateMs(b.date) - toDateMs(a.date));
  if (window === 'all') {
    return { rounds: sorted, actualCount: sorted.length, requestedCount: null, window };
  }
  const n = window === 'last5' ? 5 : window === 'last10' ? 10 : 20;
  const slice = sorted.slice(0, n);
  return {
    rounds: slice,
    actualCount: slice.length,
    requestedCount: n,
    window,
  };
}

export function calcAdjustedGrossForRound(round: RoundData): number {
  return calcAdjustedGrossFromHoles(
    holesToHoleDetails(round.holes),
    round.holeCount,
    round.playingCourseHandicap,
    round.strokeIndexMap,
  );
}

export function calcPostingDifferentialForRound(round: RoundData): number | null {
  if (!round.holes.length || round.holes.length !== round.holeCount) return null;
  const adj = calcAdjustedGrossForRound(round);
  if (!Number.isFinite(adj) || !Number.isFinite(round.courseRating) || round.slopeRating <= 0) return null;
  return calcDifferential(adj, round.courseRating, round.slopeRating, round.holeCount);
}

function bestDiffCount(n: number): number {
  if (n < 3) return 0;
  return BEST_COUNT_BY_TOTAL[Math.min(n, 20)] ?? 8;
}

export function calcHandicapIndexFromRounds(roundsNewestFirst: RoundData[]): HandicapIndexResult {
  const recent = [...roundsNewestFirst].sort((a, b) => toDateMs(b.date) - toDateMs(a.date)).slice(0, 20);
  const diffs: number[] = [];
  for (const r of recent) {
    const d = calcPostingDifferentialForRound(r);
    if (d != null && Number.isFinite(d)) diffs.push(d);
  }
  const m = diffs.length;
  if (m < 3) return { ok: false, reason: '数据不足' };
  const take = Math.min(bestDiffCount(m), m);
  const best = [...diffs].sort((a, b) => a - b).slice(0, take);
  const avg = best.reduce((s, x) => s + x, 0) / best.length;
  return { ok: true, index: round1(avg * 0.96), scoresUsed: recent.length, bestDiffsUsed: take };
}

export function validateRound(round: RoundData): ValidateRoundResult {
  const errors: string[] = [];
  const sumS = sumHoleScores(round.holes);
  const sumP = sumHolePutts(round.holes);
  if (round.holes.length !== round.holeCount) {
    errors.push(`洞数与 holeCount 不一致`);
  }
  if (sumS !== round.totalScore) errors.push(`totalScore 与各洞 score 之和不一致`);
  if (sumP !== round.totalPutts) errors.push(`totalPutts 与各洞 putts 之和不一致`);
  let fw = 0;
  let g = 0;
  for (const h of round.holes) {
    if (h.par === 3 && h.fairwayHit !== null && h.fairwayHit !== undefined) {
      errors.push(`Par3 洞 ${h.holeNumber} 不应记录 fairwayHit`);
    }
    if (h.putts > h.score) errors.push(`洞 ${h.holeNumber} 推杆大于总杆`);
    const gDer = calcGIR(h.score, h.par, h.putts);
    if (h.girHit !== gDer) errors.push(`洞 ${h.holeNumber} girHit 与杆数推导不一致`);
    if (h.par !== 3 && h.fairwayHit === true) fw += 1;
    if (h.girHit) g += 1;
  }
  if (round.totalFairways !== fw) errors.push(`totalFairways 与逐洞球道命中合计不一致`);
  if (round.totalGIR !== g) errors.push(`totalGIR 与逐洞 GIR 合计不一致`);
  return errors.length ? { ok: false, errors } : { ok: true };
}

/** values：时间正序（旧→新）。比较末尾两个连续 window 的均值。 */
export function calcTrend(values: number[], windowSize = 5): CalcTrendResult {
  if (!values.length || windowSize < 1) {
    return { current: null, previous: null, direction: 'stable', changePercent: null };
  }
  if (values.length < windowSize * 2) {
    const m = mean(values);
    return { current: m, previous: null, direction: 'stable', changePercent: null };
  }
  const prevSlice = values.slice(-windowSize * 2, -windowSize);
  const curSlice = values.slice(-windowSize);
  const previous = mean(prevSlice);
  const current = mean(curSlice);
  if (previous == null || current == null) {
    return { current, previous, direction: 'stable', changePercent: null };
  }
  const diff = current - previous;
  const eps = 1e-6;
  const changePercent = Math.abs(previous) < eps ? null : ((current - previous) / Math.abs(previous)) * 100;
  let direction: TrendDirection = 'stable';
  if (diff > eps) direction = 'up';
  else if (diff < -eps) direction = 'down';
  return { current, previous, direction, changePercent: changePercent != null ? round1(changePercent) : null };
}

/** 内置差点带基准（GIR% 示例）；返回近似百分位 0–100 */
export function calcPercentile(value: number, benchmarks: { handicap: number; value: number }[]): number | null {
  if (!benchmarks.length || !Number.isFinite(value)) return null;
  const sorted = [...benchmarks].sort((a, b) => a.value - b.value);
  let below = 0;
  for (const b of sorted) {
    if (value >= b.value) below += 1;
  }
  return round1((below / sorted.length) * 100);
}

/** 与 0–30 差点典型 GIR% 粗略对比（演示用基准） */
export const BENCHMARK_GIR_BY_HCP = [
  { handicap: 0, value: 67 },
  { handicap: 5, value: 55 },
  { handicap: 10, value: 45 },
  { handicap: 15, value: 36 },
  { handicap: 20, value: 28 },
  { handicap: 25, value: 22 },
  { handicap: 30, value: 17 },
];

function flattenHolesChronological(roundsNewestFirst: RoundData[]): HoleData[] {
  const asc = [...roundsNewestFirst].sort((a, b) => toDateMs(a.date) - toDateMs(b.date));
  const out: HoleData[] = [];
  for (const r of asc) {
    out.push(...[...r.holes].sort((a, b) => a.holeNumber - b.holeNumber));
  }
  return out;
}

function maxRun(holes: HoleData[], pred: (rel: number) => boolean): number {
  let m = 0;
  let c = 0;
  for (const h of holes) {
    const rel = h.score - h.par;
    if (pred(rel)) {
      c += 1;
      m = Math.max(m, c);
    } else {
      c = 0;
    }
  }
  return m;
}

function buildScoring(rounds: RoundData[]): ScoringStats {
  if (!rounds.length) {
    return {
      avgScore: null,
      handicapIndex: { ok: false, reason: '数据不足' },
      avgDifferential: null,
      bestScore: null,
      worstScore: null,
      avgScoreByPar: { par3: null, par4: null, par5: null },
      avgFront9: null,
      avgBack9: null,
      scoringDistribution: {
        eaglePct: null,
        birdiePct: null,
        parPct: null,
        bogeyPct: null,
        doublePlusPct: null,
      },
      maxConsecutiveHolesUnderPar: null,
      maxConsecutiveHolesOverPar: null,
    };
  }
  const scores = rounds.map((r) => r.totalScore);
  const diffs = rounds.map((r) => calcPostingDifferentialForRound(r)).filter((x): x is number => x != null && Number.isFinite(x));
  const flat = flattenHolesChronological(rounds);
  const nH = flat.length;
  let e = 0,
    b = 0,
    p = 0,
    bg = 0,
    dbl = 0;
  const s3: number[] = [];
  const s4: number[] = [];
  const s5: number[] = [];
  for (const h of flat) {
    const rel = h.score - h.par;
    if (rel <= -2) e += 1;
    else if (rel === -1) b += 1;
    else if (rel === 0) p += 1;
    else if (rel === 1) bg += 1;
    else if (rel >= 2) dbl += 1;
    if (h.par === 3) s3.push(h.score);
    else if (h.par === 4) s4.push(h.score);
    else if (h.par === 5) s5.push(h.score);
  }
  const f9: number[] = [];
  const b9: number[] = [];
  for (const r of rounds) {
    if (r.holeCount !== 18 || r.holes.length < 18) continue;
    const hs = [...r.holes].sort((a, b) => a.holeNumber - b.holeNumber);
    const f = hs.filter((h) => h.holeNumber <= 9).reduce((s, h) => s + h.score, 0);
    const bk = hs.filter((h) => h.holeNumber > 9).reduce((s, h) => s + h.score, 0);
    f9.push(f);
    b9.push(bk);
  }
  const hi = calcHandicapIndexFromRounds(rounds);
  const under = maxRun(flat, (rel) => rel < 0);
  const over = maxRun(flat, (rel) => rel > 0);
  return {
    avgScore: mean(scores),
    handicapIndex: hi,
    avgDifferential: mean(diffs),
    bestScore: scores.length ? Math.min(...scores) : null,
    worstScore: scores.length ? Math.max(...scores) : null,
    avgScoreByPar: { par3: mean(s3), par4: mean(s4), par5: mean(s5) },
    avgFront9: mean(f9),
    avgBack9: mean(b9),
    scoringDistribution: {
      eaglePct: nH ? (e / nH) * 100 : null,
      birdiePct: nH ? (b / nH) * 100 : null,
      parPct: nH ? (p / nH) * 100 : null,
      bogeyPct: nH ? (bg / nH) * 100 : null,
      doublePlusPct: nH ? (dbl / nH) * 100 : null,
    },
    maxConsecutiveHolesUnderPar: nH ? under : null,
    maxConsecutiveHolesOverPar: nH ? over : null,
  };
}

function buildOffTheTee(rounds: RoundData[]): OffTheTeeStats {
  let opp = 0;
  let hit = 0;
  const drives: number[] = [];
  let L = 0,
    R = 0,
    F = 0;
  let penSum = 0;
  for (const r of rounds) {
    penSum += r.holes.reduce((s, h) => s + (h.penalties || 0), 0);
    for (const h of r.holes) {
      if (h.par === 3) continue;
      if (h.fairwayHit === null || h.fairwayHit === undefined) continue;
      opp += 1;
      if (h.fairwayHit === true) {
        hit += 1;
        F += 1;
      } else {
        if (h.missDirection === 'left') L += 1;
        else if (h.missDirection === 'right') R += 1;
        else {
          L += 0.5;
          R += 0.5;
        }
      }
      if (h.driveDistance != null && Number.isFinite(h.driveDistance) && h.driveDistance > 0) {
        drives.push(h.driveDistance);
      }
    }
  }
  const denom = L + R + F;
  return {
    firPct: opp > 0 ? (hit / opp) * 100 : null,
    avgDriveDistanceYds: mean(drives),
    missTendency:
      denom > 0
        ? {
            leftPct: (L / denom) * 100,
            rightPct: (R / denom) * 100,
            fairwayPct: (F / denom) * 100,
          }
        : opp > 0
          ? { leftPct: null, rightPct: null, fairwayPct: hit > 0 ? (hit / opp) * 100 : null }
          : null,
    avgPenaltiesPerRound: rounds.length ? penSum / rounds.length : null,
  };
}

const APP_BUCKETS = ['<100', '100-125', '125-150', '150-175', '175-200', '200+'] as const;

function approachBucket(y: number): (typeof APP_BUCKETS)[number] | null {
  if (!Number.isFinite(y) || y < 0) return null;
  if (y < 100) return '<100';
  if (y < 125) return '100-125';
  if (y < 150) return '125-150';
  if (y < 175) return '150-175';
  if (y < 200) return '175-200';
  return '200+';
}

function buildApproach(rounds: RoundData[]): ApproachStats {
  let holes = 0;
  let gir = 0;
  let p3n = 0,
    p3g = 0,
    p4n = 0,
    p4g = 0,
    p5n = 0,
    p5g = 0;
  const buckets: Record<string, { holes: number; gir: number }> = {};
  for (const k of APP_BUCKETS) buckets[k] = { holes: 0, gir: 0 };
  let ml = 0,
    mr = 0,
    ms = 0,
    mlg = 0;
  let missGir = 0;
  const prox: number[] = [];
  for (const r of rounds) {
    for (const h of r.holes) {
      holes += 1;
      if (h.girHit) gir += 1;
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
      if (h.approachDistance != null && Number.isFinite(h.approachDistance)) {
        const b = approachBucket(h.approachDistance);
        if (b) {
          buckets[b]!.holes += 1;
          if (h.girHit) buckets[b]!.gir += 1;
        }
      }
      if (!h.girHit) {
        missGir += 1;
        if (h.missDirection === 'left') ml += 1;
        else if (h.missDirection === 'right') mr += 1;
        else if (h.missDirection === 'short') ms += 1;
        else if (h.missDirection === 'long') mlg += 1;
        const pd = h.puttsDistance?.[0];
        if (pd != null && Number.isFinite(pd) && h.putts > 0) prox.push(pd);
      }
    }
  }
  const md = ml + mr + ms + mlg;
  const hasAppDist = APP_BUCKETS.some((k) => buckets[k]!.holes > 0);
  const girByApproachBucket = hasAppDist
    ? Object.fromEntries(
        APP_BUCKETS.map((k) => {
          const { holes: hn, gir: g } = buckets[k]!;
          return [k, { holes: hn, gir: g, girPct: hn > 0 ? (g / hn) * 100 : null }];
        }),
      )
    : null;
  return {
    girPct: holes ? (gir / holes) * 100 : null,
    girPar3Pct: p3n ? (p3g / p3n) * 100 : null,
    girPar4Pct: p4n ? (p4g / p4n) * 100 : null,
    girPar5Pct: p5n ? (p5g / p5n) * 100 : null,
    girByApproachBucket,
    missGreenDirection:
      missGir > 0 && md > 0
        ? {
            leftPct: (ml / md) * 100,
            rightPct: (mr / md) * 100,
            shortPct: (ms / md) * 100,
            longPct: (mlg / md) * 100,
          }
        : null,
    avgProximityFt: mean(prox),
  };
}

function isScrambleSuccess(h: HoleData): boolean {
  if (h.girHit) return false;
  if (h.upAndDown === true) return true;
  if (h.upAndDown === false) return false;
  return h.score <= h.par;
}

function buildAroundTheGreen(rounds: RoundData[]): AroundTheGreenStats {
  let miss = 0;
  let scr = 0;
  let udN = 0;
  let udOk = 0;
  let sandAtt = 0;
  let sandOk = 0;
  let missCountSum = 0;
  for (const r of rounds) {
    let mr = 0;
    for (const h of r.holes) {
      if (!h.girHit) {
        miss += 1;
        mr += 1;
        if (isScrambleSuccess(h)) scr += 1;
        if (h.upAndDown !== null && h.upAndDown !== undefined) {
          udN += 1;
          if (h.upAndDown === true) udOk += 1;
        }
      }
      if (h.sandSave !== null && h.sandSave !== undefined) {
        sandAtt += 1;
        if (h.sandSave === true) sandOk += 1;
      }
    }
    missCountSum += mr;
  }
  return {
    scramblingPct: miss > 0 ? (scr / miss) * 100 : null,
    upAndDownPct: udN > 0 ? (udOk / udN) * 100 : null,
    sandSavePct: sandAtt > 0 ? (sandOk / sandAtt) * 100 : null,
    avgMissGirHolesPerRound: rounds.length ? missCountSum / rounds.length : null,
  };
}

const PUTT_BUCKETS = ['0-3ft', '3-6ft', '6-10ft', '10-20ft', '20ft+'] as const;

function firstPuttBucket(ft: number): (typeof PUTT_BUCKETS)[number] | null {
  if (!Number.isFinite(ft) || ft < 0) return null;
  if (ft < 3) return '0-3ft';
  if (ft < 6) return '3-6ft';
  if (ft < 10) return '6-10ft';
  if (ft < 20) return '10-20ft';
  return '20ft+';
}

function buildPutting(rounds: RoundData[]): PuttingStats {
  let holes = 0;
  let puttsSum = 0;
  let tp = 0;
  let three = 0;
  let one = 0;
  const pg: number[] = [];
  const pm: number[] = [];
  const bucketHoles: Record<string, { n: number; one: number }> = {};
  for (const k of PUTT_BUCKETS) bucketHoles[k] = { n: 0, one: 0 };

  for (const r of rounds) {
    tp += r.totalPutts;
    for (const h of r.holes) {
      holes += 1;
      puttsSum += h.putts;
      if (h.putts >= 3) three += 1;
      if (h.putts === 1) one += 1;
      if (h.girHit) pg.push(h.putts);
      else pm.push(h.putts);
      if (h.putts === 1 && h.puttsDistance?.[0] != null) {
        const bk = firstPuttBucket(h.puttsDistance[0]);
        if (bk) {
          bucketHoles[bk]!.n += 1;
          bucketHoles[bk]!.one += 1;
        }
      } else if (h.puttsDistance?.[0] != null) {
        const bk = firstPuttBucket(h.puttsDistance[0]);
        if (bk) bucketHoles[bk]!.n += 1;
      }
    }
  }
  const hasDist = PUTT_BUCKETS.some((k) => bucketHoles[k]!.n > 0);
  const onePuttRateByFirstPuttBucket = hasDist
    ? Object.fromEntries(
        PUTT_BUCKETS.map((k) => {
          const { n, one: o } = bucketHoles[k]!;
          return [k, n > 0 ? (o / n) * 100 : null];
        }),
      )
    : null;

  return {
    avgTotalPutts: rounds.length ? tp / rounds.length : null,
    avgPuttsPerHole: holes ? puttsSum / holes : null,
    threePuttRatePct: holes ? (three / holes) * 100 : null,
    onePuttRatePct: holes ? (one / holes) * 100 : null,
    puttsWhenGIR: mean(pg),
    puttsWhenMiss: mean(pm),
    onePuttRateByFirstPuttBucket,
  };
}

function hasSgDistanceData(rounds: RoundData[]): boolean {
  for (const r of rounds) {
    for (const h of r.holes) {
      if (h.approachDistance != null || h.driveDistance != null || (h.puttsDistance && h.puttsDistance.length > 0)) {
        return true;
      }
    }
  }
  return false;
}

function buildStrokesGained(rounds: RoundData[]): StrokesGainedStats {
  const unlocked = hasSgDistanceData(rounds);
  if (!unlocked) {
    return {
      unlocked: false,
      message: SG_LOCKED_MESSAGE,
      sgOTT: null,
      sgApproach: null,
      sgAroundGreen: null,
      sgPutting: null,
      sgTeeToGreen: null,
      sgTotal: null,
    };
  }
  // 预留：Mark Broadie 基准表接入后可在此汇总每洞期望杆差
  return {
    unlocked: true,
    message: null,
    sgOTT: null,
    sgApproach: null,
    sgAroundGreen: null,
    sgPutting: null,
    sgTeeToGreen: null,
    sgTotal: null,
  };
}

export function computeAllStats(rounds: RoundData[]): ComputeAllStatsResult {
  return {
    scoring: buildScoring(rounds),
    offTheTee: buildOffTheTee(rounds),
    approach: buildApproach(rounds),
    aroundTheGreen: buildAroundTheGreen(rounds),
    putting: buildPutting(rounds),
    strokesGained: buildStrokesGained(rounds),
  };
}

/** 单场 FIR%（Par4/5，有球道判定时） */
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
  let m = 0;
  let s = 0;
  for (const h of round.holes) {
    if (h.girHit) continue;
    m += 1;
    if (isScrambleSuccess(h)) s += 1;
  }
  return m > 0 ? (s / m) * 100 : null;
}

export function calcRoundThreePuttPct(round: RoundData): number | null {
  if (!round.holes.length) return null;
  const t = round.holes.filter((h) => h.putts >= 3).length;
  return (t / round.holes.length) * 100;
}

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

  const holes: HoleData[] = details.map((h, idx) => {
    const par = typeof h.par === 'number' && Number.isFinite(h.par) ? h.par : 4;
    const strokes = typeof h.strokes === 'number' && Number.isFinite(h.strokes) ? h.strokes : par;
    const putts =
      typeof h.putts === 'number' && Number.isFinite(h.putts) ? Math.max(0, Math.min(h.putts, strokes)) : 0;
    const gir = typeof h.greenInRegulation === 'boolean' ? h.greenInRegulation : calcGIR(strokes, par, putts);
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
      sandSave: null,
      penalties: 0,
      driveDistance: null,
      approachDistance: null,
      puttsDistance: null,
      missDirection: null,
    };
  });

  const courseRating = Number(rec.courseRating);
  const slopeRating = Number(rec.slopeRating);
  if (!Number.isFinite(courseRating) || !Number.isFinite(slopeRating)) return null;

  const partial: RoundData = {
    roundId:
      typeof rec.id === 'string' && rec.id.length > 0
        ? rec.id
        : `mig-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date: typeof rec.date === 'string' ? rec.date : '',
    courseName: typeof rec.courseName === 'string' ? rec.courseName : '',
    courseRating,
    slopeRating,
    teeColor: null,
    totalScore: 0,
    totalPutts: 0,
    totalFairways: 0,
    totalGIR: 0,
    holes,
    holeCount,
  };
  if (typeof rec.playingCourseHandicap === 'number' && Number.isFinite(rec.playingCourseHandicap)) {
    partial.playingCourseHandicap = rec.playingCourseHandicap;
  }
  if (Array.isArray(rec.strokeIndexMap) && rec.strokeIndexMap.length === holeCount) {
    const nums = rec.strokeIndexMap.map((x) => Number(x));
    const max = holeCount;
    if (nums.every((v) => Number.isInteger(v) && v >= 1 && v <= max) && new Set(nums).size === nums.length) {
      partial.strokeIndexMap = nums;
    }
  }
  return hydrateRoundTotals(partial);
}
