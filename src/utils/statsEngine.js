/**
 * 成绩分析纯计算模块（无 UI）。
 * 百分比为 0–100；数值保留 1 位小数；无数据用 null。
 */

/** @typedef {'all'|'last5'|'last10'|'last20'} RoundWindow */

/**
 * @param {number|null|undefined} x
 * @returns {number|null}
 */
export function r1(x) {
  if (x == null || !Number.isFinite(Number(x))) return null;
  return parseFloat(Number(x).toFixed(1));
}

/**
 * @param {string} date
 */
function dateMs(date) {
  const t = Date.parse(String(date));
  return Number.isFinite(t) ? t : 0;
}

/**
 * 等效 18 洞总杆（9 洞场次 totalScore×2），与 `lib/handicap` 场均口径一致。
 * @param {import('./statsEngine').RoundData} round
 */
function equivalent18TotalScore(round) {
  const s = Number(round?.totalScore);
  if (!Number.isFinite(s)) return NaN;
  const hc = Number(round?.holeCount);
  return hc === 9 ? s * 2 : s;
}

/**
 * @param {unknown[]} allRounds
 * @param {RoundWindow} window
 */
export function filterRounds(allRounds, window) {
  const list = Array.isArray(allRounds) ? [...allRounds] : [];
  list.sort((a, b) => dateMs(b?.date) - dateMs(a?.date));

  let n = list.length;
  let requestedCount = n;
  if (window === 'last5') {
    requestedCount = 5;
    n = Math.min(5, list.length);
  } else if (window === 'last10') {
    requestedCount = 10;
    n = Math.min(10, list.length);
  } else if (window === 'last20') {
    requestedCount = 20;
    n = Math.min(20, list.length);
  } else {
    requestedCount = list.length;
    n = list.length;
  }

  return {
    rounds: list.slice(0, n),
    actualCount: n,
    requestedCount,
  };
}

/**
 * @param {import('./statsEngine').RoundData} round
 */
function postingDifferential(round) {
  const slope = Number(round?.slopeRating);
  const cr = Number(round?.courseRating);
  const score = Number(round?.totalScore);
  /** 缺失或非正坡度/难度时该场不参与差点微差（仍可在页面展示其它统计） */
  if (!Number.isFinite(slope) || slope <= 0) return null;
  if (!Number.isFinite(cr) || cr <= 0) return null;
  if (!Number.isFinite(score)) return null;
  return r1(((score - cr) * 113) / slope);
}

/**
 * 与 `lib/handicap.calcHandicapIndex` 相同的「取最低 k 场微差」表（基于最近 20 场内的总场次数）。
 * @param {number} total 场次数（≤20）
 */
function bestCountForHandicapIndex(total) {
  const BEST_COUNT_BY_TOTAL = {
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
  if (total < 3) return 0;
  const safe = Math.min(total, 20);
  return BEST_COUNT_BY_TOTAL[safe] ?? 8;
}

/**
 * 差点展示用微差：优先存盘 `scoreDifferential`（WHS·与首页一致），否则用总杆推算。
 * @param {import('./statsEngine').RoundData} round
 */
function differentialForHandicapDisplay(round) {
  const sd = Number(round?.scoreDifferential);
  if (Number.isFinite(sd)) return r1(sd);
  return postingDifferential(round);
}

/**
 * @param {import('./statsEngine').RoundData[]} rounds
 */
export function computeScoring(rounds) {
  const list = Array.isArray(rounds) ? rounds : [];
  const roundCount = list.length;

  if (roundCount === 0) {
    return {
      roundCount: 0,
      avgScore: null,
      handicapIndex: null,
      avgDifferential: null,
      bestScore: null,
      worstScore: null,
      bestRound: null,
      worstRound: null,
      avgByPar: { par3: null, par4: null, par5: null },
      avgFront9: null,
      avgBack9: null,
      distribution: { eagle: 0, birdie: 0, par: 0, bogey: 0, doublePlus: 0 },
      distributionPct: { eagle: null, birdie: null, par: null, bogey: null, doublePlus: null },
      scoreTrend: [],
    };
  }

  const scores = list.map((r) => equivalent18TotalScore(r)).filter((s) => Number.isFinite(s));
  const avgScore = scores.length > 0 ? r1(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  /**
   * 成绩分析页展示用差点：算法与 `lib/handicap.calcHandicapIndex` 一致
   * （最近 20 场、取 k 个最低微差、均值×0.96）；微差优先用存盘 `scoreDifferential`，缺省再用总杆推算。
   */
  const recent = [...list].sort((a, b) => dateMs(b.date) - dateMs(a.date)).slice(0, 20);
  const totalRecent = recent.length;
  let handicapIndex = null;
  if (totalRecent >= 3) {
    const take = bestCountForHandicapIndex(totalRecent);
    const pool = recent
      .map((r) => ({ r, d: differentialForHandicapDisplay(r) }))
      .filter((x) => x.d != null && Number.isFinite(x.d));
    if (pool.length >= 3) {
      pool.sort((a, b) => a.d - b.d);
      const n = Math.min(take, pool.length);
      const slice = pool.slice(0, n);
      const avg = slice.reduce((s, x) => s + x.d, 0) / slice.length;
      handicapIndex = r1(avg * 0.96);
    }
  }

  const allDiffs = list
    .map((r) => postingDifferential(r))
    .filter((d) => d != null && Number.isFinite(d));
  const avgDifferential =
    allDiffs.length > 0 ? r1(allDiffs.reduce((a, b) => a + b, 0) / allDiffs.length) : null;

  let bestEq = Infinity;
  let worstEq = -Infinity;
  /** @type {import('./statsEngine').RoundData|null} */
  let bestR = null;
  /** @type {import('./statsEngine').RoundData|null} */
  let worstR = null;
  for (const r of list) {
    const eq = equivalent18TotalScore(r);
    if (!Number.isFinite(eq)) continue;
    if (eq < bestEq) {
      bestEq = eq;
      bestR = r;
    }
    if (eq > worstEq) {
      worstEq = eq;
      worstR = r;
    }
  }
  let bestScore = null;
  let worstScore = null;
  if (bestR != null) bestScore = r1(bestEq);
  if (worstR != null) worstScore = r1(worstEq);

  const bestRound =
    bestR != null
      ? {
          roundId: String(bestR.roundId ?? ''),
          score: bestScore != null ? bestScore : Number(bestR.totalScore),
          date: String(bestR.date ?? ''),
          course: String(bestR.courseName ?? ''),
        }
      : null;
  const worstRound =
    worstR != null
      ? {
          roundId: String(worstR.roundId ?? ''),
          score: worstScore != null ? worstScore : Number(worstR.totalScore),
          date: String(worstR.date ?? ''),
          course: String(worstR.courseName ?? ''),
        }
      : null;

  let c3 = 0,
    s3 = 0,
    c4 = 0,
    s4 = 0,
    c5 = 0,
    s5 = 0;
  let eagle = 0,
    birdie = 0,
    par = 0,
    bogey = 0,
    doublePlus = 0;
  let frontSum = 0,
    frontRounds = 0;
  let backSum = 0,
    backRounds = 0;
  /** 成绩分布百分比分母：所有场次洞数之和（与杆数分布计数独立，未计入的洞会稀释占比） */
  let totalHolesAll = 0;

  for (const r of list) {
    const holes = Array.isArray(r?.holes) ? r.holes : [];
    totalHolesAll += holes.length;
    let fNine = 0,
      fCnt = 0;
    let bNine = 0,
      bCnt = 0;
    for (let idx = 0; idx < holes.length; idx++) {
      const h = holes[idx];
      const p = Number(h?.par);
      const sc = Number(h?.score);
      if (!Number.isFinite(p) || !Number.isFinite(sc)) continue;
      const rel = sc - p;
      if (rel <= -2) eagle += 1;
      else if (rel === -1) birdie += 1;
      else if (rel === 0) par += 1;
      else if (rel === 1) bogey += 1;
      else doublePlus += 1;

      if (p === 3) {
        c3 += 1;
        s3 += sc;
      } else if (p === 4) {
        c4 += 1;
        s4 += sc;
      } else if (p === 5) {
        c5 += 1;
        s5 += sc;
      }

      /** 前/后半程：按当轮 holes 数组保存顺序（先记的 9 洞 vs 接着的 9 洞），不按洞号 1–9 / 10–18 */
      if (idx < 9) {
        fNine += sc;
        fCnt += 1;
      }
      if (idx >= 9 && idx < 18) {
        bNine += sc;
        bCnt += 1;
      }
    }
    if (fCnt > 0) {
      frontSum += fNine;
      frontRounds += 1;
    }
    if (bCnt > 0) {
      backSum += bNine;
      backRounds += 1;
    }
  }

  const avgByPar = {
    par3: c3 > 0 ? r1(s3 / c3) : null,
    par4: c4 > 0 ? r1(s4 / c4) : null,
    par5: c5 > 0 ? r1(s5 / c5) : null,
  };

  const holeTotal = eagle + birdie + par + bogey + doublePlus;
  const distribution = { eagle, birdie, par, bogey, doublePlus };
  const distributionDenom = totalHolesAll > 0 ? totalHolesAll : holeTotal;
  const distributionPct =
    distributionDenom > 0
      ? {
          eagle: r1((eagle / distributionDenom) * 100),
          birdie: r1((birdie / distributionDenom) * 100),
          par: r1((par / distributionDenom) * 100),
          bogey: r1((bogey / distributionDenom) * 100),
          doublePlus: r1((doublePlus / distributionDenom) * 100),
        }
      : { eagle: null, birdie: null, par: null, bogey: null, doublePlus: null };

  /** 每场「先记的 9 洞」总杆均值（holes 数组前 9 条，非洞号 1–9） */
  const avgFront9 = frontRounds > 0 ? r1(frontSum / frontRounds) : null;
  /** 每场「接着记的 9 洞」总杆均值（数组第 10–18 条）；不足 9 条后记洞或无后记洞时该场不参与 */
  const avgBack9 = backRounds > 0 ? r1(backSum / backRounds) : null;

  const chrono = [...list].sort((a, b) => dateMs(a.date) - dateMs(b.date));
  const scoreTrend = chrono.map((r) => ({
    date: String(r.date ?? ''),
    score: Number(r.totalScore),
  }));

  return {
    roundCount,
    avgScore,
    handicapIndex,
    avgDifferential,
    bestScore,
    worstScore,
    bestRound,
    worstRound,
    avgByPar,
    avgFront9,
    avgBack9,
    distribution,
    distributionPct,
    scoreTrend,
  };
}

/**
 * @param {import('./statsEngine').RoundData[]} rounds
 */
export function computeTee(rounds) {
  const list = Array.isArray(rounds) ? rounds : [];
  if (list.length === 0) {
    return {
      firPct: null,
      avgDriveDistance: null,
      avgPenalties: null,
      missTendency: null,
      firTrend: [],
    };
  }

  let opp = 0,
    hit = 0;
  let drvN = 0,
    drvSum = 0;
  let penSum = 0;
  let missL = 0,
    missR = 0,
    fairFw = 0,
    dirN = 0;

  for (const r of list) {
    for (const h of r.holes ?? []) {
      const par = Number(h?.par);
      /** FIR 仅 Par4/Par5（排除 Par3 及非常规标准杆洞） */
      if (par === 4 || par === 5) {
        opp += 1;
        if (h?.fairwayHit === true) hit += 1;
        const teeDir = normalizeMissDir(h?.missDirection ?? h?.teeMissDirection);
        if (h?.fairwayHit === true) {
          fairFw += 1;
          dirN += 1;
        } else if (h?.fairwayHit === false && (teeDir === 'left' || teeDir === 'right')) {
          if (teeDir === 'left') missL += 1;
          else missR += 1;
          dirN += 1;
        }
      }
      const dd = h?.driveDistance;
      if (dd != null && Number.isFinite(Number(dd))) {
        drvN += 1;
        drvSum += Number(dd);
      }
      const pen = Number(h?.penalties);
      if (Number.isFinite(pen)) penSum += pen;
    }
  }

  const firPct = opp > 0 ? r1((hit / opp) * 100) : null;
  const avgDriveDistance = drvN > 0 ? r1(drvSum / drvN) : null;
  const avgPenalties = r1(penSum / list.length);
  const missTendency =
    dirN > 0
      ? {
          left: r1((missL / dirN) * 100),
          right: r1((missR / dirN) * 100),
          fairway: r1((fairFw / dirN) * 100),
        }
      : null;

  const chrono = [...list].sort((a, b) => dateMs(a.date) - dateMs(b.date));
  const firTrend = chrono.map((r) => {
    const v = calcRoundFirPct(r);
    return { date: String(r.date ?? ''), value: v };
  });

  return { firPct, avgDriveDistance, avgPenalties, missTendency, firTrend };
}

/**
 * @param {unknown} d
 */
function normalizeMissDir(d) {
  if (d == null) return null;
  const s = String(d).toLowerCase();
  if (s === 'left' || s === 'right' || s === 'short' || s === 'long') return s;
  if (s === 'fairway' || s === 'center' || s === 'middle') return 'fairway';
  return null;
}

/**
 * @param {import('./statsEngine').RoundData[]} rounds
 */
export function computeApproach(rounds) {
  const list = Array.isArray(rounds) ? rounds : [];
  if (list.length === 0) {
    return {
      girPct: null,
      girByPar: { par3: null, par4: null, par5: null },
      girByDistance: null,
      missGreenDirection: null,
      avgProximity: null,
      girTrend: [],
    };
  }

  let gTot = 0,
    hTot = 0;
  const byPar = { 3: { g: 0, t: 0 }, 4: { g: 0, t: 0 }, 5: { g: 0, t: 0 } };
  const buckets = {
    under100: { g: 0, t: 0 },
    d100_125: { g: 0, t: 0 },
    d125_150: { g: 0, t: 0 },
    d150_175: { g: 0, t: 0 },
    d175_200: { g: 0, t: 0 },
    over200: { g: 0, t: 0 },
  };
  let missL = 0,
    missR = 0,
    missS = 0,
    missLo = 0,
    missN = 0;
  let proxN = 0,
    proxSum = 0;

  for (const r of list) {
    for (const h of r.holes ?? []) {
      const par = Number(h?.par);
      /** 总体 GIR% 与 Par3/4/5 分桶分母一致：仅标准三杆洞至五杆洞 */
      if (par === 3 || par === 4 || par === 5) {
        hTot += 1;
        if (h?.girHit === true) gTot += 1;
        byPar[par].t += 1;
        if (h?.girHit === true) byPar[par].g += 1;
      }
      const ad = h?.approachDistance;
      if (ad != null && Number.isFinite(Number(ad))) {
        const y = Number(ad);
        const key = approachBucketKey(y);
        if (key) {
          buckets[key].t += 1;
          if (h?.girHit === true) buckets[key].g += 1;
        }
      }
      if (h?.girHit === false) {
        const md = normalizeMissDir(h?.missGreenDirection ?? h?.missDirection);
        if (md === 'left') missL += 1;
        else if (md === 'right') missR += 1;
        else if (md === 'short') missS += 1;
        else if (md === 'long') missLo += 1;
        if (md === 'left' || md === 'right' || md === 'short' || md === 'long') missN += 1;
      }
      const fp = h?.firstPuttDistance;
      if (fp != null && Number.isFinite(Number(fp))) {
        proxN += 1;
        proxSum += Number(fp);
      }
    }
  }

  const girPct = hTot > 0 ? r1((gTot / hTot) * 100) : null;
  const girByPar = {
    par3: byPar[3].t > 0 ? r1((byPar[3].g / byPar[3].t) * 100) : null,
    par4: byPar[4].t > 0 ? r1((byPar[4].g / byPar[4].t) * 100) : null,
    par5: byPar[5].t > 0 ? r1((byPar[5].g / byPar[5].t) * 100) : null,
  };

  const hasDist = Object.values(buckets).some((b) => b.t > 0);
  const girByDistance = hasDist
    ? {
        under100:
          buckets.under100.t > 0 ? r1((buckets.under100.g / buckets.under100.t) * 100) : null,
        d100_125:
          buckets.d100_125.t > 0 ? r1((buckets.d100_125.g / buckets.d100_125.t) * 100) : null,
        d125_150:
          buckets.d125_150.t > 0 ? r1((buckets.d125_150.g / buckets.d125_150.t) * 100) : null,
        d150_175:
          buckets.d150_175.t > 0 ? r1((buckets.d150_175.g / buckets.d150_175.t) * 100) : null,
        d175_200:
          buckets.d175_200.t > 0 ? r1((buckets.d175_200.g / buckets.d175_200.t) * 100) : null,
        over200: buckets.over200.t > 0 ? r1((buckets.over200.g / buckets.over200.t) * 100) : null,
      }
    : null;

  const missGreenDirection =
    missN > 0
      ? {
          left: r1((missL / missN) * 100),
          right: r1((missR / missN) * 100),
          short: r1((missS / missN) * 100),
          long: r1((missLo / missN) * 100),
        }
      : null;

  const avgProximity = proxN > 0 ? r1(proxSum / proxN) : null;

  const chrono = [...list].sort((a, b) => dateMs(a.date) - dateMs(b.date));
  const girTrend = chrono.map((r) => ({
    date: String(r.date ?? ''),
    value: calcRoundGirPct(r),
  }));

  return {
    girPct,
    girByPar,
    girByDistance,
    missGreenDirection,
    avgProximity,
    girTrend,
  };
}

/**
 * @param {number} yards
 */
function approachBucketKey(yards) {
  if (yards < 100) return 'under100';
  if (yards < 125) return 'd100_125';
  if (yards < 150) return 'd125_150';
  if (yards < 175) return 'd150_175';
  if (yards < 200) return 'd175_200';
  return 'over200';
}

/** 第一推距离（英尺）分桶，用于一推率 */
function puttBucketKey(ft) {
  if (!Number.isFinite(ft) || ft < 0) return null;
  if (ft <= 3) return 'ft0_3';
  if (ft <= 6) return 'ft3_6';
  if (ft <= 10) return 'ft6_10';
  if (ft <= 20) return 'ft10_20';
  return 'ft20plus';
}

/**
 * @param {import('./statsEngine').RoundData[]} rounds
 */
export function computeShortGame(rounds) {
  const list = Array.isArray(rounds) ? rounds : [];
  if (list.length === 0) {
    return {
      scramblingPct: null,
      upAndDownPct: null,
      sandSavePct: null,
      avgMissGIRPerRound: null,
      scramblingTrend: [],
    };
  }

  /** Scrambling% 分母：未上 GIR 的洞数之和（含 Par3/4/5 等所有洞） */
  let missGir = 0,
    scrOk = 0;
  let uadAtt = 0,
    uadOk = 0;
  let sandAtt = 0,
    sandOk = 0;
  let missPerRoundSum = 0;

  for (const r of list) {
    let mr = 0;
    for (const h of r.holes ?? []) {
      if (h?.girHit !== true) {
        missGir += 1;
        mr += 1;
        const sc = Number(h?.score);
        const par = Number(h?.par);
        if (Number.isFinite(sc) && Number.isFinite(par) && sc <= par) scrOk += 1;
      }
      if (h?.girHit !== true && (h?.upAndDown === true || h?.upAndDown === false)) {
        uadAtt += 1;
        if (h.upAndDown === true) uadOk += 1;
      }
      if (h?.sandSave === true || h?.sandSave === false) {
        sandAtt += 1;
        const sc = Number(h?.score);
        const par = Number(h?.par);
        if (Number.isFinite(sc) && Number.isFinite(par) && sc <= par) sandOk += 1;
      }
    }
    missPerRoundSum += mr;
  }

  const scramblingPct = missGir > 0 ? r1((scrOk / missGir) * 100) : null;
  const upAndDownPct = uadAtt > 0 ? r1((uadOk / uadAtt) * 100) : null;
  const sandSavePct = sandAtt > 0 ? r1((sandOk / sandAtt) * 100) : null;
  const avgMissGIRPerRound = r1(missPerRoundSum / list.length);

  const chrono = [...list].sort((a, b) => dateMs(a.date) - dateMs(b.date));
  const scramblingTrend = chrono.map((r) => ({
    date: String(r.date ?? ''),
    value: calcRoundScramblingPct(r),
  }));

  return { scramblingPct, upAndDownPct, sandSavePct, avgMissGIRPerRound, scramblingTrend };
}

/**
 * @param {import('./statsEngine').RoundData[]} rounds
 */
export function computePutting(rounds) {
  const list = Array.isArray(rounds) ? rounds : [];
  if (list.length === 0) {
    return {
      avgTotalPutts: null,
      avgPuttsPerHole: null,
      threePuttPct: null,
      onePuttPct: null,
      puttsWhenGIR: null,
      puttsWhenMiss: null,
      puttsByDistance: null,
      puttsTrend: [],
    };
  }

  let holes = 0,
    puttsSum = 0;
  let three = 0,
    one = 0;
  let girPutts = 0,
    girN = 0,
    missPutts = 0,
    missN = 0;

  const distBuckets = {
    ft0_3: { one: 0, t: 0 },
    ft3_6: { one: 0, t: 0 },
    ft6_10: { one: 0, t: 0 },
    ft10_20: { one: 0, t: 0 },
    ft20plus: { one: 0, t: 0 },
  };

  for (const r of list) {
    const hs = r.holes ?? [];
    holes += hs.length;
    let holePutts = 0;
    for (const h of hs) holePutts += Number.isFinite(Number(h?.putts)) ? Number(h.putts) : 0;
    const tp = Number(r.totalPutts);
    puttsSum += Number.isFinite(tp) ? tp : holePutts;
    for (const h of hs) {
      const pt = Number(h?.putts);
      if (!Number.isFinite(pt)) continue;
      if (pt >= 3) three += 1;
      if (pt === 1) one += 1;
      if (h?.girHit === true) {
        girN += 1;
        girPutts += pt;
      } else if (h?.girHit === false) {
        missN += 1;
        missPutts += pt;
      }
      const fd = h?.firstPuttDistance;
      if (fd != null && Number.isFinite(Number(fd))) {
        const ft = Number(fd);
        const bk = puttBucketKey(ft);
        if (bk) {
          distBuckets[bk].t += 1;
          if (pt === 1) distBuckets[bk].one += 1;
        }
      }
    }
  }

  const avgTotalPutts = r1(puttsSum / list.length);
  const avgPuttsPerHole = holes > 0 ? r1(puttsSum / holes) : null;
  const threePuttPct = holes > 0 ? r1((three / holes) * 100) : null;
  const onePuttPct = holes > 0 ? r1((one / holes) * 100) : null;
  const puttsWhenGIR = girN > 0 ? r1(girPutts / girN) : null;
  const puttsWhenMiss = missN > 0 ? r1(missPutts / missN) : null;

  const hasPuttDist = Object.values(distBuckets).some((b) => b.t > 0);
  const puttsByDistance = hasPuttDist
    ? {
        ft0_3:
          distBuckets.ft0_3.t > 0 ? r1((distBuckets.ft0_3.one / distBuckets.ft0_3.t) * 100) : null,
        ft3_6:
          distBuckets.ft3_6.t > 0 ? r1((distBuckets.ft3_6.one / distBuckets.ft3_6.t) * 100) : null,
        ft6_10:
          distBuckets.ft6_10.t > 0
            ? r1((distBuckets.ft6_10.one / distBuckets.ft6_10.t) * 100)
            : null,
        ft10_20:
          distBuckets.ft10_20.t > 0
            ? r1((distBuckets.ft10_20.one / distBuckets.ft10_20.t) * 100)
            : null,
        ft20plus:
          distBuckets.ft20plus.t > 0
            ? r1((distBuckets.ft20plus.one / distBuckets.ft20plus.t) * 100)
            : null,
      }
    : null;

  const chrono = [...list].sort((a, b) => dateMs(a.date) - dateMs(b.date));
  const puttsTrend = chrono.map((r) => {
    const hs = r.holes ?? [];
    const th = hs.length;
    const tp = Number(r.totalPutts);
    const v = th > 0 && Number.isFinite(tp) ? r1(tp / th) : null;
    return { date: String(r.date ?? ''), value: v };
  });

  return {
    avgTotalPutts,
    avgPuttsPerHole,
    threePuttPct,
    onePuttPct,
    puttsWhenGIR,
    puttsWhenMiss,
    puttsByDistance,
    puttsTrend,
  };
}

/**
 * @param {unknown[]} allRounds
 * @param {RoundWindow} window
 */
export function computeAllStats(allRounds, window) {
  const filter = filterRounds(allRounds, window);
  const rounds = filter.rounds;
  return {
    filter,
    scoring: computeScoring(rounds),
    tee: computeTee(rounds),
    approach: computeApproach(rounds),
    shortGame: computeShortGame(rounds),
    putting: computePutting(rounds),
  };
}

/**
 * @param {import('./statsEngine').RoundData} round
 */
export function calcRoundFirPct(round) {
  const holes = round?.holes ?? [];
  let opp = 0,
    hit = 0;
  for (const h of holes) {
    const par = Number(h?.par);
    if (par !== 4 && par !== 5) continue;
    opp += 1;
    if (h?.fairwayHit === true) hit += 1;
  }
  if (opp === 0) return null;
  return r1((hit / opp) * 100);
}

/**
 * @param {import('./statsEngine').RoundData} round
 */
export function calcRoundGirPct(round) {
  const holes = round?.holes ?? [];
  let g = 0,
    n = 0;
  for (const h of holes) {
    const par = Number(h?.par);
    if (par !== 3 && par !== 4 && par !== 5) continue;
    n += 1;
    if (h?.girHit === true) g += 1;
  }
  if (n === 0) return null;
  return r1((g / n) * 100);
}

/**
 * @param {import('./statsEngine').RoundData} round
 */
export function calcRoundScramblingPct(round) {
  const holes = round?.holes ?? [];
  let m = 0,
    ok = 0;
  for (const h of holes) {
    if (h?.girHit !== true) {
      m += 1;
      const sc = Number(h?.score);
      const par = Number(h?.par);
      if (Number.isFinite(sc) && Number.isFinite(par) && sc <= par) ok += 1;
    }
  }
  if (m === 0) return null;
  return r1((ok / m) * 100);
}

/**
 * @param {import('./statsEngine').RoundData} round
 */
export function calcRoundThreePuttPct(round) {
  const holes = round?.holes ?? [];
  if (holes.length === 0) return null;
  let t = 0;
  for (const h of holes) {
    const p = Number(h?.putts);
    if (Number.isFinite(p) && p >= 3) t += 1;
  }
  return r1((t / holes.length) * 100);
}

/**
 * @param {import('./statsEngine').RoundData} round
 */
export function validateRound(round) {
  if (!round || typeof round !== 'object') return { ok: false, errors: ['invalid'] };
  const errors = [];
  if (!Array.isArray(round.holes)) errors.push('holes');
  const holes = round.holes ?? [];
  const declared = Number(round.holeCount);
  if (holes.length === 0) {
    if (declared !== 9 && declared !== 18) errors.push('holes_length');
  } else if (holes.length < 9) {
    errors.push('holes_length');
  }
  const slope = Number(round.slopeRating);
  const cr = Number(round.courseRating);
  /** 坡度/难度缺失不阻止保存与展示，仅该场 postingDifferential 为 null、不参与差点池 */
  if (Number.isFinite(slope) && slope <= 0) errors.push('slopeRating_invalid');
  if (Number.isFinite(cr) && cr <= 0) errors.push('courseRating_invalid');
  const ts = Number(round.totalScore);
  if (!Number.isFinite(ts) || ts <= 0) errors.push('totalScore');

  let sumScore = 0,
    sumPutts = 0;
  for (const h of holes) {
    const sc = Number(h?.score);
    const pt = Number(h?.putts);
    if (!Number.isFinite(sc) || sc < 1) errors.push('hole_score');
    if (!Number.isFinite(pt) || pt < 0) errors.push('hole_putts');
    if (Number.isFinite(sc)) sumScore += sc;
    if (Number.isFinite(pt)) sumPutts += pt;
  }
  if (holes.length >= 9 && Number.isFinite(ts) && Math.abs(ts - sumScore) > 2)
    errors.push('totalScore_mismatch');
  const tp = Number(round.totalPutts);
  if (
    holes.length >= 9 &&
    Number.isFinite(tp) &&
    Number.isFinite(sumPutts) &&
    Math.abs(tp - sumPutts) > 2
  ) {
    errors.push('totalPutts_mismatch');
  }
  return { ok: errors.length === 0, errors };
}

/**
 * @param {unknown} h
 * @param {number} idx
 */
function normalizeHole(h, idx) {
  const raw = h && typeof h === 'object' ? h : {};
  const par = Number(raw.par ?? 4);
  const score = Number(raw.score ?? raw.strokes ?? 0);
  const putts = Number(raw.putts ?? 0);
  const isPar3 = par === 3;
  let fairwayHit = raw.fairwayHit;
  if (isPar3) fairwayHit = null;
  else if (fairwayHit !== true && fairwayHit !== false) fairwayHit = null;

  let girHit = raw.girHit;
  if (typeof raw.greenInRegulation === 'boolean') girHit = raw.greenInRegulation;
  if (typeof girHit !== 'boolean') {
    const nonPutt = score - putts;
    girHit = Number.isFinite(nonPutt) && Number.isFinite(par) && nonPutt <= par - 2;
  }

  let upAndDown = raw.upAndDown;
  if (upAndDown !== true && upAndDown !== false) upAndDown = null;

  let sandSave = raw.sandSave;
  if (sandSave !== true && sandSave !== false) sandSave = null;

  const penalties = Number.isFinite(Number(raw.penalties)) ? Number(raw.penalties) : 0;

  let driveDistance = raw.driveDistance;
  if (driveDistance != null && !Number.isFinite(Number(driveDistance))) driveDistance = null;
  else if (driveDistance != null) driveDistance = Number(driveDistance);

  let approachDistance = null;
  if (raw.approachDistance != null && Number.isFinite(Number(raw.approachDistance))) {
    approachDistance = Number(raw.approachDistance);
  } else if (raw.distanceM != null && Number.isFinite(Number(raw.distanceM))) {
    approachDistance = r1(Number(raw.distanceM) * 1.09361);
  }

  let firstPuttDistance = raw.firstPuttDistance;
  if (firstPuttDistance != null && !Number.isFinite(Number(firstPuttDistance)))
    firstPuttDistance = null;
  else if (firstPuttDistance != null) firstPuttDistance = Number(firstPuttDistance);

  const missDirection = raw.missDirection ?? raw.missGreenDirection ?? null;

  return {
    holeNumber: Number.isFinite(Number(raw.holeNumber)) ? Number(raw.holeNumber) : idx + 1,
    par,
    score,
    putts,
    fairwayHit,
    girHit,
    upAndDown,
    sandSave,
    penalties,
    driveDistance,
    approachDistance,
    firstPuttDistance,
    missDirection,
    missGreenDirection: raw.missGreenDirection ?? null,
    teeMissDirection: raw.teeMissDirection ?? null,
  };
}

/**
 * @param {unknown} raw
 * @param {number} index
 */
function normalizeRoundFromUnknown(raw, index = 0) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const holeSource = Array.isArray(r.holeDetails)
    ? r.holeDetails
    : Array.isArray(r.holes)
      ? r.holes
      : [];
  const holes = holeSource.map((h, i) => normalizeHole(h, i));

  const holeCount = holes.length;
  const declaredRoundHoles = r.holes === 9 || r.holes === 18 ? r.holes : null;

  let sumS = 0,
    sumP = 0;
  for (const h of holes) {
    sumS += h.score;
    sumP += h.putts;
  }

  let totalScore = Number(r.totalScore);
  let totalPutts = Number(r.totalPutts);
  if (holeCount > 0) {
    totalScore = sumS;
    totalPutts = sumP;
  } else {
    if (!Number.isFinite(totalScore) || totalScore <= 0)
      totalScore = Number(r.adjustedGrossScore) || 0;
    if (r.totalPutts === null || r.totalPutts === undefined) totalPutts = 0;
    else if (!Number.isFinite(totalPutts) || totalPutts < 0) totalPutts = 0;
  }

  const roundId =
    typeof r.roundId === 'string' && r.roundId
      ? r.roundId
      : typeof r.id === 'string' && r.id
        ? r.id
        : `m-${Date.now()}-${index}`;

  let scoreDifferential = null;
  const sdRaw = Number(r.scoreDifferential);
  if (Number.isFinite(sdRaw)) scoreDifferential = r1(sdRaw);

  const weatherRaw = typeof r.weather === 'string' ? r.weather.trim() : '';
  const weather = weatherRaw.length > 0 ? weatherRaw : undefined;

  /** @type {{ userId: string; name: string }[]|undefined} */
  let playingPartners;
  if (Array.isArray(r.playingPartners)) {
    const pp = [];
    for (const p of r.playingPartners) {
      if (!p || typeof p !== 'object') continue;
      const uid = typeof p.userId === 'string' ? p.userId.trim() : '';
      const nm = typeof p.name === 'string' ? p.name.trim() : '';
      if (!uid) continue;
      pp.push({ userId: uid, name: nm || '球友' });
    }
    if (pp.length > 0) playingPartners = pp;
  }

  return {
    roundId,
    date: String(r.date ?? ''),
    courseName: String(r.courseName ?? ''),
    courseRating: Number(r.courseRating),
    slopeRating: Number(r.slopeRating),
    totalScore,
    totalPutts,
    holes,
    holeCount: holeCount > 0 ? holeCount : (declaredRoundHoles ?? 0),
    ...(scoreDifferential != null ? { scoreDifferential } : {}),
    ...(weather ? { weather } : {}),
    ...(playingPartners ? { playingPartners } : {}),
  };
}

/**
 * 兼容旧版 HandicapRecord（lib/handicap）及残缺逐洞对象。
 * @param {unknown[]} oldRounds
 * @returns {import('./statsEngine').RoundData[]}
 */
export function migrateOldData(oldRounds) {
  if (!Array.isArray(oldRounds)) return [];
  return oldRounds.map((x, i) => normalizeRoundFromUnknown(x, i));
}
