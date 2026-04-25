import type { HandicapRecord, HoleDetail } from './handicap';

export type RoundScoreDistribution = {
  eagle: number;
  birdie: number;
  par: number;
  bogey: number;
  doublePlus: number;
};

export type RoundDeepStatsModel = {
  hasFullHoles: boolean;
  holeCount: number;
  totalPar: number | null;
  totalStrokesFromHoles: number | null;
  /** 全场相对标准杆 */
  vsParTotal: number | null;
  vsParFront9: number | null;
  vsParBack9: number | null;
  front9Strokes: number | null;
  back9Strokes: number | null;
  distribution: RoundScoreDistribution | null;
  threePuttCount: number | null;
  threePuttPct: number | null;
  avgPar3: number | null;
  avgPar4: number | null;
  avgPar5: number | null;
  penaltyStrokesTotal: number | null;
  /** 连续 Par 或更好 */
  streakParOrBetter: number | null;
  /** 连续柏忌或更差 */
  streakBogeyPlus: number | null;
  firPct: number | null;
  girCountFromHoles: number | null;
  girPct: number | null;
  puttsTotal: number | null;
};

function r1(x: number): number {
  return Math.round(x * 10) / 10;
}

function sortedHoles(r: HandicapRecord): HoleDetail[] {
  return [...r.holeDetails].sort((a, b) => a.holeNumber - b.holeNumber);
}

/** 从单场 HandicapRecord 计算深度统计（与成绩分析逐洞口径一致） */
export function computeRoundDeepStats(r: HandicapRecord): RoundDeepStatsModel {
  const sorted = sortedHoles(r);
  const n = sorted.length;
  const full = n > 0 && n === r.holes;

  if (!full) {
    let fir: number | null = null;
    const ft = r.fairwaysTotal;
    const fh = r.fairwaysHit;
    if (typeof ft === 'number' && ft > 0 && typeof fh === 'number' && Number.isFinite(fh)) {
      fir = r1((Math.min(fh, ft) / ft) * 100);
    }
    let putts: number | null = null;
    if (typeof r.totalPutts === 'number' && Number.isFinite(r.totalPutts)) putts = Math.round(r.totalPutts);
    return {
      hasFullHoles: false,
      holeCount: n,
      totalPar: null,
      totalStrokesFromHoles: null,
      vsParTotal: null,
      vsParFront9: null,
      vsParBack9: null,
      front9Strokes: null,
      back9Strokes: null,
      distribution: null,
      threePuttCount: null,
      threePuttPct: null,
      avgPar3: null,
      avgPar4: null,
      avgPar5: null,
      penaltyStrokesTotal: null,
      streakParOrBetter: null,
      streakBogeyPlus: null,
      firPct: fir,
      girCountFromHoles: typeof r.greensInRegulation === 'number' ? Math.round(r.greensInRegulation) : null,
      girPct: null,
      puttsTotal: putts,
    };
  }

  let totalPar = 0;
  let totalStrokes = 0;
  let parFront = 0,
    strFront = 0;
  let parBack = 0,
    strBack = 0;
  const dist: RoundScoreDistribution = { eagle: 0, birdie: 0, par: 0, bogey: 0, doublePlus: 0 };
  let threePutt = 0;
  const byPar: Record<3 | 4 | 5, { sum: number; n: number }> = {
    3: { sum: 0, n: 0 },
    4: { sum: 0, n: 0 },
    5: { sum: 0, n: 0 },
  };
  let girCount = 0;
  let penaltySum: number | null = null;
  if (r.holeData && r.holeData.length === r.holes) {
    penaltySum = 0;
    for (const row of r.holeData) {
      const p = Number(row.penalty);
      if (Number.isFinite(p) && p > 0) penaltySum += p;
    }
  }

  let streakGood = 0,
    bestGood = 0;
  let streakBad = 0,
    bestBad = 0;

  for (const h of sorted) {
    const par = h.par;
    const st = h.strokes;
    const pt = h.putts;
    totalPar += par;
    totalStrokes += st;
    const diff = st - par;
    if (diff <= -2) dist.eagle += 1;
    else if (diff === -1) dist.birdie += 1;
    else if (diff === 0) dist.par += 1;
    else if (diff === 1) dist.bogey += 1;
    else dist.doublePlus += 1;

    if (pt >= 3) threePutt += 1;
    if (par === 3 || par === 4 || par === 5) {
      byPar[par].sum += st;
      byPar[par].n += 1;
    }
    if (h.greenInRegulation) girCount += 1;

    if (st <= par) {
      streakGood += 1;
      bestGood = Math.max(bestGood, streakGood);
      streakBad = 0;
    } else {
      streakBad += 1;
      bestBad = Math.max(bestBad, streakBad);
      streakGood = 0;
    }

    const hn = h.holeNumber;
    if (r.holes === 18) {
      if (hn <= 9) {
        parFront += par;
        strFront += st;
      } else {
        parBack += par;
        strBack += st;
      }
    } else {
      parFront += par;
      strFront += st;
    }
  }

  const vsTotal = totalStrokes - totalPar;
  let vsFront: number | null = null;
  let vsBack: number | null = null;
  let f9: number | null = null;
  let b9: number | null = null;
  if (r.holes === 18) {
    vsFront = strFront - parFront;
    vsBack = strBack - parBack;
    f9 = strFront;
    b9 = strBack;
  } else {
    vsFront = strFront - parFront;
    vsBack = null;
    f9 = strFront;
    b9 = null;
  }

  const threePct = n > 0 ? r1((threePutt / n) * 100) : null;
  const avg3 = byPar[3].n > 0 ? r1(byPar[3].sum / byPar[3].n) : null;
  const avg4 = byPar[4].n > 0 ? r1(byPar[4].sum / byPar[4].n) : null;
  const avg5 = byPar[5].n > 0 ? r1(byPar[5].sum / byPar[5].n) : null;

  let fir: number | null = null;
  const ft = r.fairwaysTotal;
  const fh = r.fairwaysHit;
  if (typeof ft === 'number' && ft > 0 && typeof fh === 'number' && Number.isFinite(fh)) {
    fir = r1((Math.min(fh, ft) / ft) * 100);
  }

  const puttsSum = sorted.reduce((s, h) => s + h.putts, 0);
  const girPct = n > 0 ? r1((girCount / n) * 100) : null;

  return {
    hasFullHoles: true,
    holeCount: n,
    totalPar,
    totalStrokesFromHoles: totalStrokes,
    vsParTotal: vsTotal,
    vsParFront9: vsFront,
    vsParBack9: vsBack,
    front9Strokes: f9,
    back9Strokes: b9,
    distribution: dist,
    threePuttCount: threePutt,
    threePuttPct: threePct,
    avgPar3: avg3,
    avgPar4: avg4,
    avgPar5: avg5,
    penaltyStrokesTotal: penaltySum,
    streakParOrBetter: bestGood > 0 ? bestGood : null,
    streakBogeyPlus: bestBad > 0 ? bestBad : null,
    firPct: fir,
    girCountFromHoles: girCount,
    girPct,
    puttsTotal: puttsSum,
  };
}

export function fmtVsPar(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—';
  if (v === 0) return 'E';
  return v > 0 ? `+${r1(v)}` : `${r1(v)}`;
}
