import {
  equivalent18AdjustedGross,
  equivalent18FromGrossAndHoles,
  type HandicapRecord,
} from '@/lib/handicap';

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

/**
 * 用于场均/最佳总杆等跨场次汇总：统一为等效 18 洞总杆。
 * 仅当逐洞条数与本场洞数一致时才用「逐洞杆数求和 → equivalent18FromGrossAndHoles」；
 * 否则逐洞总杆不参与（避免 9 洞只录 5 洞时被误当成满洞缩放），回退到记录的 adjustedGross。
 */
function roundGrossEquiv18(r: HandicapRecord): number {
  if (r.holeDetails.length > 0 && r.holeDetails.length === r.holes) {
    const sum = r.holeDetails.reduce((s, h) => s + h.strokes, 0);
    return equivalent18FromGrossAndHoles(sum, r.holes);
  }
  return equivalent18AdjustedGross(r);
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

  const grosses = slice.map(roundGrossEquiv18).filter((x) => Number.isFinite(x));
  const diffs = slice.map((r) => r.scoreDifferential).filter((x) => Number.isFinite(x));

  const puttEligible = slice.filter(
    (r) => r.holes > 0 && r.totalPutts != null && Number.isFinite(r.totalPutts),
  );
  const puttsRound = mean(puttEligible.map((r) => r.totalPutts as number));
  const puttsPerHoleVals = puttEligible
    .map((r) => (r.totalPutts as number) / r.holes)
    .filter((x) => Number.isFinite(x));

  const girVals = slice
    .filter(
      (r) => r.holes > 0 && r.greensInRegulation != null && Number.isFinite(r.greensInRegulation),
    )
    .map((r) => ((r.greensInRegulation as number) / r.holes) * 100);

  const fwVals = slice
    .filter(
      (r) =>
        (r.fairwaysTotal ?? 0) > 0 &&
        r.fairwaysHit != null &&
        r.fairwaysTotal != null &&
        Number.isFinite(r.fairwaysHit) &&
        Number.isFinite(r.fairwaysTotal),
    )
    .map((r) => ((r.fairwaysHit as number) / (r.fairwaysTotal as number)) * 100);

  /** 至少有一条逐洞数据的场次数（含未录满的场；与 roundGrossEquiv18 是否采用逐洞求和不一致，见单测） */
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
    const hd = r.holeDetails;
    let front9Strokes = 0;
    let back9Strokes = 0;
    for (let i = 0; i < 9; i++) front9Strokes += hd[i]!.strokes;
    for (let i = 9; i < 18; i++) back9Strokes += hd[i]!.strokes;
    fronts.push(front9Strokes);
    backs.push(back9Strokes);
  }
  return {
    rounds: fronts.length,
    avgFront9: mean(fronts),
    avgBack9: mean(backs),
  };
}

/** 基于逐洞样本的实战衍生指标（与记分卡字段一致） */
export type HoleDerivedStats = {
  holesCounted: number;
  /** 未上果岭洞上仍保帕或更好 / 未上果岭洞数，% */
  scramblingPct: number | null;
  /** 单洞推杆 ≥3 的洞数占比 % */
  threePuttHolePct: number | null;
  /** 单洞恰好 1 推的洞数占比 % */
  onePuttHolePct: number | null;
  avgPuttsWhenGir: number | null;
  avgPuttsWhenNotGir: number | null;
  par3GirPct: number | null;
  par4GirPct: number | null;
  par5GirPct: number | null;
};

function round1n(n: number): number {
  return Math.round(n * 10) / 10;
}

function subNullable(a: number | null, b: number | null): number | null {
  if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b)) return null;
  return round1n(a - b);
}

/** 汇总切片内全部逐洞记录 */
export function buildHoleDerivedStats(slice: HandicapRecord[]): HoleDerivedStats {
  let holesCounted = 0;
  let missedGir = 0;
  let scrambleHits = 0;
  let threePutt = 0;
  let onePutt = 0;
  const puttsGir: number[] = [];
  const puttsNotGir: number[] = [];
  let p3n = 0;
  let p3g = 0;
  let p4n = 0;
  let p4g = 0;
  let p5n = 0;
  let p5g = 0;

  for (const r of slice) {
    for (const h of r.holeDetails) {
      holesCounted += 1;
      const rawPutts =
        typeof h.putts === 'number' && Number.isFinite(h.putts) ? Math.max(0, h.putts) : 0;
      const strk = Number.isFinite(h.strokes) ? Math.max(0, h.strokes) : 0;
      const pt = Math.min(rawPutts, strk);
      if (pt >= 3) threePutt += 1;
      if (pt === 1) onePutt += 1;
      const gir = h.greenInRegulation;
      if (gir) {
        puttsGir.push(pt);
      } else {
        puttsNotGir.push(pt);
        missedGir += 1;
        if (h.strokes <= h.par) scrambleHits += 1;
      }
      if (h.par === 3) {
        p3n += 1;
        if (gir) p3g += 1;
      } else if (h.par === 4) {
        p4n += 1;
        if (gir) p4g += 1;
      } else if (h.par === 5) {
        p5n += 1;
        if (gir) p5g += 1;
      }
    }
  }

  if (!holesCounted) {
    return {
      holesCounted: 0,
      scramblingPct: null,
      threePuttHolePct: null,
      onePuttHolePct: null,
      avgPuttsWhenGir: null,
      avgPuttsWhenNotGir: null,
      par3GirPct: null,
      par4GirPct: null,
      par5GirPct: null,
    };
  }

  return {
    holesCounted,
    scramblingPct: missedGir > 0 ? (scrambleHits / missedGir) * 100 : null,
    threePuttHolePct: (threePutt / holesCounted) * 100,
    onePuttHolePct: (onePutt / holesCounted) * 100,
    avgPuttsWhenGir: puttsGir.length ? mean(puttsGir) : null,
    avgPuttsWhenNotGir: puttsNotGir.length ? mean(puttsNotGir) : null,
    par3GirPct: p3n > 0 ? (p3g / p3n) * 100 : null,
    par4GirPct: p4n > 0 ? (p4g / p4n) * 100 : null,
    par5GirPct: p5n > 0 ? (p5g / p5n) * 100 : null,
  };
}

/** 最近 recentN 场 vs 其余更早场次（records 须为从新到旧） */
export type TrendVsEarlier = {
  recentRounds: number;
  priorRounds: number;
  /** 百分点，正 = 最近更高 */
  deltaGirPctPts: number | null;
  deltaThreePuttHolePctPts: number | null;
  /** 场均总杆之差（杆），正 = 最近更高杆 */
  deltaAvgGross: number | null;
  deltaScramblingPctPts: number | null;
  deltaAvgPuttsRound: number | null;
};

export function buildTrendVsEarlier(
  recordsNewestFirst: HandicapRecord[],
  recentN: number,
): TrendVsEarlier | null {
  if (recordsNewestFirst.length <= recentN) return null;
  const recent = recordsNewestFirst.slice(0, recentN);
  const prior = recordsNewestFirst.slice(recentN);
  const sr = buildSliceStats(recent);
  const sp = buildSliceStats(prior);
  const dr = buildHoleDerivedStats(recent);
  const dp = buildHoleDerivedStats(prior);
  return {
    recentRounds: recent.length,
    priorRounds: prior.length,
    deltaGirPctPts: subNullable(sr.avgGirPct, sp.avgGirPct),
    deltaThreePuttHolePctPts: subNullable(dr.threePuttHolePct, dp.threePuttHolePct),
    deltaAvgGross: subNullable(sr.avgGross, sp.avgGross),
    deltaScramblingPctPts: subNullable(dr.scramblingPct, dp.scramblingPct),
    deltaAvgPuttsRound: subNullable(sr.avgPuttsRound, sp.avgPuttsRound),
  };
}

/** 从趋势与整体指标提炼简短实操建议（最多 5 条） */
export function buildPracticeInsightLines(args: {
  trend: TrendVsEarlier | null;
  derived: HoleDerivedStats;
  slice: SliceStats;
}): string[] {
  const lines: string[] = [];
  const { trend, derived, slice } = args;
  const gir = slice.avgGirPct;
  const tp = derived.threePuttHolePct;

  if (gir != null && tp != null && gir < 40 && tp > 12) {
    lines.push(
      '大样本下「平均 GIR」偏低且「三推洞占比」偏高：减杆通常优先抓「铁杆进攻果岭」与「长距推杆节奏」。',
    );
  } else if (gir != null && tp != null && gir >= 42 && tp <= 10) {
    lines.push('GIR 与三推结构较为健康，这两项最能预判成绩走向的指标目前整体平衡。');
  }

  if (trend) {
    const n = trend.recentRounds;
    if (trend.deltaThreePuttHolePctPts != null && trend.deltaThreePuttHolePctPts > 1.5) {
      lines.push(
        `最近 ${n} 场较更早：三推洞占比上升 ${trend.deltaThreePuttHolePctPts.toFixed(1)} 个百分点，可重点复盘长推策略与果岭阅读。`,
      );
    }
    if (trend.deltaThreePuttHolePctPts != null && trend.deltaThreePuttHolePctPts < -1.5) {
      lines.push(
        `最近 ${n} 场较更早：三推洞占比下降 ${Math.abs(trend.deltaThreePuttHolePctPts).toFixed(1)} 个百分点，长推控制多半在改善。`,
      );
    }
    if (trend.deltaGirPctPts != null && trend.deltaGirPctPts < -1.5) {
      lines.push(
        `最近 ${n} 场较更早：平均 GIR 下滑约 ${Math.abs(trend.deltaGirPctPts).toFixed(1)} 个百分点，可对照杆组/动作或样本球场难度变化。`,
      );
    }
    if (trend.deltaGirPctPts != null && trend.deltaGirPctPts > 1.5) {
      lines.push(
        `最近 ${n} 场较更早：平均 GIR 回升约 ${trend.deltaGirPctPts.toFixed(1)} 个百分点，若场均杆同步下降则攻果岭效率正兑现为成绩。`,
      );
    }
    if (trend.deltaAvgGross != null && Math.abs(trend.deltaAvgGross) >= 1) {
      lines.push(
        trend.deltaAvgGross < 0
          ? `最近 ${n} 场场均总杆较更早低约 ${Math.abs(trend.deltaAvgGross).toFixed(1)} 杆。`
          : `最近 ${n} 场场均总杆较更早高约 ${trend.deltaAvgGross.toFixed(1)} 杆。`,
      );
    }
  }

  if (
    derived.scramblingPct != null &&
    slice.avgGirPct != null &&
    derived.scramblingPct >= 36 &&
    slice.avgGirPct < 42
  ) {
    lines.push('救帕率（Scrambling）相对突出而 GIR 一般：偏「救球型」，短板多在铁杆与攻果岭决策。');
  }

  if (lines.length < 2) {
    lines.push(
      '建议整场保留逐洞记录，便于拆分 Par3/4/5 上果岭率与推杆结构；样本越大，趋势对比越有说服力。',
    );
  }
  if (lines.length < 4) {
    lines.push(
      '当前未覆盖：开球偏离、木杆实战距离、非上果岭失误位置、关键铁杆标签、沙坑救球、切杆留洞距离、3–6 英尺一推、罚杆明细；可在后续记分表单中扩展后纳入同一模型。',
    );
  }

  return lines.slice(0, 5);
}

export { fmt0, fmt1 };
