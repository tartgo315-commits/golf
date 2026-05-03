/**
 * 各玩法按「总杆 gross」逐洞/全场结算的独立算法（多赌局并行）。
 * 暂不扣差点：依赖 MatchRecord.compareGrossOnly 存分时 net=gross。
 */

import type {
  MatchSideGame,
  SettlementMode,
  SideGameType,
  TieRule,
  VegasTieRule,
} from '@/utils/matchGames.types';
import { mergeEventPayoutsIntoBase } from '@/utils/matchEventModifiers';
import {
  calcMoneyResult,
  calcStablefordPoints,
  getGross,
  matchPlayHolePayoutsYuan,
  nassauWithPressPayouts,
  type MatchRecord,
} from '@/utils/matchScoring';

/** 8421：相对标准杆的得分（老鹰 8…） */
export function points8421FromGross(gross: number, par: number): number {
  const rel = par - gross;
  if (rel >= 2) return 8;
  if (rel === 1) return 4;
  if (rel === 0) return 2;
  if (rel === -1) return 1;
  return 0;
}

function payoutsFromPointsMean(points: number[], unit: number): number[] {
  if (points.length === 0 || unit <= 0) return points.map(() => 0);
  const mean = points.reduce((a, b) => a + b, 0) / points.length;
  return points.map((p) => Math.round((p - mean) * unit));
}

function holeStablefordPointsGross(gross: number, par: number): number {
  /** gross-only 时 net 视作 gross，与 Par 差即 Stableford 输入 */
  return calcStablefordPoints(gross, par);
}

/**
 * 固拉：按第 1 洞出发顺位分组；4 人为顺位 1–2 vs 3–4，更多人为前半 vs 后半（全场不变）。
 * 返回的下标为 `grosses` / `players` 的全局球员下标。
 */
export function fixedLasiTeamSplit(holeOneRanks: number[]): {
  teamA: number[];
  teamB: number[];
} | null {
  const n = holeOneRanks.length;
  if (n < 4 || n % 2 !== 0) return null;
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => holeOneRanks[a]! - holeOneRanks[b]!);
  if (n === 4) {
    return { teamA: [order[0]!, order[1]!], teamB: [order[2]!, order[3]!] };
  }
  const half = n / 2;
  return { teamA: order.slice(0, half), teamB: order.slice(half) };
}

/**
 * 乱拉：第 h 洞二人组随洞轮换。4 人为「排头尾 vs 中间二人」经典乱拉；更多人为旋转顺位后前后半组对抗。
 * 下标与 `holeOneRanks` 同维度（全局球员下标或 4 人喇叭花子集内的 0..3 槽位，与调用方一致）。
 */
export function rotatingLasiTeams(
  holeOneRanks: number[],
  hole: number,
): { teamA: number[]; teamB: number[] } | null {
  const n = holeOneRanks.length;
  if (n < 4 || n % 2 !== 0) return null;
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => holeOneRanks[a]! - holeOneRanks[b]!);
  if (n === 4) {
    const shift = (hole - 1) % 4;
    const rot = [0, 1, 2, 3].map((k) => order[(k + shift) % 4]!);
    return { teamA: [rot[0]!, rot[3]!], teamB: [rot[1]!, rot[2]!] };
  }
  const shift = (hole - 1) % n;
  const rot = Array.from({ length: n }, (_, k) => order[(k + shift) % n]!);
  const half = n / 2;
  return { teamA: rot.slice(0, half), teamB: rot.slice(half) };
}

/**
 * Las Vegas（拉丝）单洞结算：拼接分、鸟/鹰翻转、鹰倍数、双柏忌翻倍、平局累积规则。
 * 低分在十位、高分在个位（4+5→45）；仅一方有鸟时对方拼接翻转；仅一方有鹰时乘 eagleMultiplier；双方同档鸟/鹰则顶穿不翻转不乘鹰倍。
 */
export function lasVegasHoleResult(
  grosses: number[],
  teamA: number[],
  teamB: number[],
  par: number,
  unit: number,
  carryMultiplier: number,
  eagleMultiplier = 2,
  doubleBogeyFlip = false,
  tieRule: VegasTieRule = 'carry',
): {
  payouts: number[];
  nextCarryMultiplier: number;
} {
  const n = grosses.length;
  const zero = Array.from({ length: n }, () => 0);
  const em = Math.max(1, Math.round(eagleMultiplier));

  const bestA = Math.min(...teamA.map((i) => grosses[i]!));
  const bestB = Math.min(...teamB.map((i) => grosses[i]!));
  const aHasBirdie = bestA <= par - 1;
  const bHasBirdie = bestB <= par - 1;
  const aHasEagle = bestA <= par - 2;
  const bHasEagle = bestB <= par - 2;

  const flipA = bHasBirdie && !aHasBirdie;
  const flipB = aHasBirdie && !bHasBirdie;

  const activeEagleMultiplier =
    (aHasEagle && !bHasEagle) || (bHasEagle && !aHasEagle) ? em : 1;

  const worstA = Math.max(...teamA.map((i) => grosses[i]!));
  const worstB = Math.max(...teamB.map((i) => grosses[i]!));
  const aHasDoubleBogey = doubleBogeyFlip && worstA >= par + 2;
  const bHasDoubleBogey = doubleBogeyFlip && worstB >= par + 2;
  const doubleBogeyMult =
    (aHasDoubleBogey && !bHasDoubleBogey) || (!aHasDoubleBogey && bHasDoubleBogey) ? 2 : 1;

  function teamConcatScore(idxs: number[], flipped: boolean): number {
    const scores = idxs.map((i) => grosses[i]!);
    const lo = Math.min(...scores);
    const hi = Math.max(...scores);
    if (hi >= 10) return flipped ? hi * 100 + lo : lo * 100 + hi;
    return flipped ? hi * 10 + lo : lo * 10 + hi;
  }

  const scoreA = teamConcatScore(teamA, flipA);
  const scoreB = teamConcatScore(teamB, flipB);

  if (scoreA === scoreB) {
    if (tieRule === 'void') {
      return { payouts: zero, nextCarryMultiplier: 1 };
    }
    if (tieRule === 'carry') {
      return { payouts: zero, nextCarryMultiplier: carryMultiplier + 1 };
    }
    return { payouts: zero, nextCarryMultiplier: carryMultiplier * 2 };
  }

  const diff = Math.abs(scoreA - scoreB);
  const uSafe = Math.max(0, Math.round(unit));
  const effectiveUnit =
    uSafe * carryMultiplier * activeEagleMultiplier * doubleBogeyMult;
  const totalPayout = diff * effectiveUnit;

  const winners = scoreA < scoreB ? teamA : teamB;
  const losers = scoreA < scoreB ? teamB : teamA;
  const out = Array.from({ length: n }, () => 0);
  const winShare = Math.round(totalPayout / winners.length);
  const loseShare = Math.round(totalPayout / losers.length);
  winners.forEach((i) => {
    out[i] = winShare;
  });
  losers.forEach((i) => {
    out[i] = -loseShare;
  });

  return { payouts: out, nextCarryMultiplier: 1 };
}

/** 四人二对二：组总杆低者赢整洞赌注，零和分配到人 */
export function teamVersusHolePayouts(
  grosses: number[],
  teamA: [number, number],
  teamB: [number, number],
  unit: number,
): number[] {
  const n = grosses.length;
  const out = Array.from({ length: n }, () => 0);
  if (unit <= 0 || n < 4) return out;
  const gA = grosses[teamA[0]]! + grosses[teamA[1]]!;
  const gB = grosses[teamB[0]]! + grosses[teamB[1]]!;
  if (gA < gB) {
    const half = unit / 2;
    out[teamA[0]] = Math.round(half);
    out[teamA[1]] = Math.round(half);
    out[teamB[0]] = Math.round(-half);
    out[teamB[1]] = Math.round(-half);
  } else if (gB < gA) {
    const half = unit / 2;
    out[teamB[0]] = Math.round(half);
    out[teamB[1]] = Math.round(half);
    out[teamA[0]] = Math.round(-half);
    out[teamA[1]] = Math.round(-half);
  }
  return out;
}

/** 多人分队比总杆：低总杆一队赢 unit，队内均分、队间零和 */
export function teamSumVersusPayouts(
  grosses: number[],
  teamA: number[],
  teamB: number[],
  unit: number,
): number[] {
  const n = grosses.length;
  const out = Array.from({ length: n }, () => 0);
  if (unit <= 0 || teamA.length === 0 || teamB.length === 0) return out;
  const sA = teamA.reduce((s, i) => s + grosses[i]!, 0);
  const sB = teamB.reduce((s, i) => s + grosses[i]!, 0);
  if (sA === sB) return out;
  const win = sA < sB ? teamA : teamB;
  const lose = sA < sB ? teamB : teamA;
  const winShare = unit / win.length;
  const loseShare = unit / lose.length;
  win.forEach((i) => {
    out[i] += Math.round(winShare);
  });
  lose.forEach((i) => {
    out[i] -= Math.round(loseShare);
  });
  return out;
}

/**
 * 固拉/乱拉三分制：头/尾/总三项，每项 unitAmount
 * teamA/teamB 是球员下标数组
 */
export function lasiThreePointPayouts(
  grosses: number[],
  teamA: number[],
  teamB: number[],
  unit: number,
  enableHead = true,
  enableTail = true,
  enableTotal = true,
): number[] {
  const n = grosses.length;
  const out = Array.from({ length: n }, () => 0);
  if (unit <= 0 || teamA.length === 0 || teamB.length === 0) return out;

  const bestA = Math.min(...teamA.map((i) => grosses[i]!));
  const bestB = Math.min(...teamB.map((i) => grosses[i]!));
  const worstA = Math.max(...teamA.map((i) => grosses[i]!));
  const worstB = Math.max(...teamB.map((i) => grosses[i]!));
  const totalA = teamA.reduce((s, i) => s + grosses[i]!, 0);
  const totalB = teamB.reduce((s, i) => s + grosses[i]!, 0);

  const applyResult = (valA: number, valB: number) => {
    if (valA === valB) return;
    const winners = valA < valB ? teamA : teamB;
    const losers = valA < valB ? teamB : teamA;
    const winShare = unit / winners.length;
    const loseShare = unit / losers.length;
    winners.forEach((i) => {
      out[i] += Math.round(winShare);
    });
    losers.forEach((i) => {
      out[i] -= Math.round(loseShare);
    });
  };

  if (enableHead) applyResult(bestA, bestB);
  if (enableTail) applyResult(worstA, worstB);
  if (enableTotal) applyResult(totalA, totalB);

  return out;
}

/** 三人比洞（斗地主）：总杆低者赢本洞 unit（与比洞相同零和） */
export function landlordHolePayoutsGross(grosses: number[], unit: number): number[] {
  return matchPlayHolePayoutsYuan(grosses, unit);
}

/**
 * 第 h 洞喇叭花人选：
 * - 第 1 洞：抓阄顺位名次 = (N+1)/2 的人（holeOneRanks[i] 为该名次）
 * - 第 2 洞起：上一洞总杆排名后的中间位（低杆靠前；并列按球员下标）
 */
export function trumpetPlayerIndexForHole(match: MatchRecord, hole: number): number | null {
  const n = match.players.length;
  if (n < 5 || n % 2 === 0) return null;
  const lottery = match.lotteryDraw?.holeOneRanks;
  if (!lottery || lottery.length !== n) return null;

  if (hole === 1) {
    const midRank = (n + 1) / 2;
    const idx = lottery.findIndex((r) => r === midRank);
    return idx >= 0 ? idx : null;
  }

  const grossPrev = match.players.map((p) => getGross(p, hole - 1));
  if (grossPrev.some((g) => g == null)) return null;

  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => {
    const ga = grossPrev[a]!;
    const gb = grossPrev[b]!;
    if (ga !== gb) return ga - gb;
    return a - b;
  });
  return order[(n - 1) >> 1]!;
}

/**
 * 喇叭花 vs 其余每人单挑：杆数低者赢该对决，±secondaryUnitAmount。
 */
export function trumpetPairwiseVersusPayouts(
  grosses: number[],
  trumpetIdx: number,
  unit: number,
): number[] {
  const n = grosses.length;
  const out = Array.from({ length: n }, () => 0);
  if (unit <= 0) return out;
  for (let j = 0; j < n; j += 1) {
    if (j === trumpetIdx) continue;
    const gt = grosses[trumpetIdx]!;
    const gj = grosses[j]!;
    if (gt < gj) {
      out[trumpetIdx] += unit;
      out[j] -= unit;
    } else if (gt > gj) {
      out[trumpetIdx] -= unit;
      out[j] += unit;
    }
  }
  return out.map((x) => Math.round(x));
}

/** 四人乱拉分队（本洞按总杆排序后做强弱配 + 随洞轮换）；返回全局球员下标 */
function trumpetFourPlayerLasiTeams(
  others: number[],
  grosses: number[],
  hole: number,
): { teamA: [number, number]; teamB: [number, number] } | null {
  if (others.length !== 4) return null;
  const localOrder = [...others].sort((a, b) => a - b);
  const sortedByGross = [...others].sort((a, b) => grosses[a]! - grosses[b]!);
  const rankOf = new Map<number, number>();
  sortedByGross.forEach((pi, idx) => rankOf.set(pi, idx + 1));
  const holeOneRanks = localOrder.map((pi) => rankOf.get(pi)!);
  const local = rotatingLasiTeams(holeOneRanks, hole);
  if (!local) return null;
  return {
    teamA: [localOrder[local.teamA[0]]!, localOrder[local.teamA[1]]!],
    teamB: [localOrder[local.teamB[0]]!, localOrder[local.teamB[1]]!],
  };
}

/** 乱拉部分：不含喇叭花玩家；N−1 为 4 → 2v2 轮换；6 → 3v3 总杆；8 → 4v4 总杆 */
export function trumpetLasiOnlyHolePayouts(
  grosses: number[],
  trumpetIdx: number,
  hole: number,
  unit: number,
): number[] {
  const n = grosses.length;
  const out = Array.from({ length: n }, () => 0);
  if (unit <= 0) return out;
  const others = Array.from({ length: n }, (_, i) => i).filter((i) => i !== trumpetIdx);
  const m = others.length;

  if (m === 4) {
    const teams = trumpetFourPlayerLasiTeams(others, grosses, hole);
    if (!teams) return out;
    return teamVersusHolePayouts(grosses, teams.teamA, teams.teamB, unit);
  }
  if (m === 6) {
    const sorted = [...others].sort((a, b) => grosses[a]! - grosses[b]!);
    const teamA = sorted.slice(0, 3);
    const teamB = sorted.slice(3, 6);
    return teamSumVersusPayouts(grosses, teamA, teamB, unit);
  }
  if (m === 8) {
    const sorted = [...others].sort((a, b) => grosses[a]! - grosses[b]!);
    const teamA = sorted.slice(0, 4);
    const teamB = sorted.slice(4, 8);
    return teamSumVersusPayouts(grosses, teamA, teamB, unit);
  }
  return out;
}

/** 顶部横幅：本洞乱拉分组文案（不含喇叭花） */
export function trumpetLasiGroupLabel(
  grosses: number[],
  trumpetIdx: number,
  hole: number,
  names: string[],
): string | null {
  const n = grosses.length;
  const others = Array.from({ length: n }, (_, i) => i).filter((i) => i !== trumpetIdx);
  const m = others.length;
  if (m === 4) {
    const teams = trumpetFourPlayerLasiTeams(others, grosses, hole);
    if (!teams) return null;
    return `${names[teams.teamA[0]]}·${names[teams.teamA[1]]} vs ${names[teams.teamB[0]]}·${names[teams.teamB[1]]}`;
  }
  if (m === 6) {
    const sorted = [...others].sort((a, b) => grosses[a]! - grosses[b]!);
    const a = sorted.slice(0, 3);
    const b = sorted.slice(3, 6);
    return `${a.map((i) => names[i]).join('·')} vs ${b.map((i) => names[i]).join('·')}`;
  }
  if (m === 8) {
    const sorted = [...others].sort((a, b) => grosses[a]! - grosses[b]!);
    const a = sorted.slice(0, 4);
    const b = sorted.slice(4, 8);
    return `${a.map((i) => names[i]).join('·')} vs ${b.map((i) => names[i]).join('·')}`;
  }
  return null;
}

export function trumpetPairOnlyHolePayouts(
  match: MatchRecord,
  hole: number,
  grosses: number[],
  unit: number,
): number[] {
  const T = trumpetPlayerIndexForHole(match, hole);
  if (T == null) return Array.from({ length: grosses.length }, () => 0);
  return trumpetPairwiseVersusPayouts(grosses, T, unit);
}

export function trumpetLasiOnlyHolePayoutsWithMatch(
  match: MatchRecord,
  hole: number,
  grosses: number[],
  unit: number,
): number[] {
  const T = trumpetPlayerIndexForHole(match, hole);
  if (T == null) return Array.from({ length: grosses.length }, () => 0);
  return trumpetLasiOnlyHolePayouts(grosses, T, hole, unit);
}

/**
 * 单洞金额变动（纯数字，元尺度与 unit 一致）。
 * grosses：当前洞每人总杆；par 当前洞 Par。
 */
export function singleHolePayoutsForGame(
  game: MatchSideGame,
  match: MatchRecord,
  hole: number,
  grosses: number[],
  par: number,
): number[] {
  const n = grosses.length;
  const u = Math.max(0, Math.round(game.unitAmount));
  const z = Array.from({ length: n }, () => 0);

  if (game.settlementMode === 'end_total') {
    return z;
  }

  const t: SideGameType = game.gameType;

  if (t === 'match_play' || t === 'stroke_play') {
    return matchPlayHolePayoutsYuan(grosses, u);
  }

  if (t === 'landlord') {
    return landlordHolePayoutsGross(grosses, u);
  }

  if (t === 'nassau_pack') {
    /** 简化：Nassau 按洞仍按比洞满额计入（三场独立累计在 cumulative 中拆段处理） */
    return matchPlayHolePayoutsYuan(grosses, u);
  }

  if (t === 'stableford') {
    const pts = grosses.map((g) => holeStablefordPointsGross(g, par));
    return payoutsFromPointsMean(pts, u);
  }

  if (t === 'points_8421') {
    const pts = grosses.map((g) => points8421FromGross(g, par));
    return payoutsFromPointsMean(pts, u);
  }

  if (t === 'skins') {
    return z;
  }

  const ranks = match.lotteryDraw?.holeOneRanks;
  if (t === 'fixed_lasi') {
    if (!ranks || ranks.length < 4 || ranks.length % 2 !== 0) return z;
    const teams = fixedLasiTeamSplit(ranks);
    if (!teams) return z;
    const carryMult = carryMultiplierBeforeHole(game, match, hole, pars);
    const eagleMult = Math.max(1, Math.round(game.eagleMultiplier ?? 2));
    const dbFlip = game.doubleBogeyFlip ?? false;
    const vegasTie: VegasTieRule = game.vegasTieRule ?? 'carry';
    return lasVegasHoleResult(
      grosses,
      [...teams.teamA],
      [...teams.teamB],
      par,
      u,
      carryMult,
      eagleMult,
      dbFlip,
      vegasTie,
    ).payouts;
  }

  if (t === 'rotating_lasi') {
    if (!ranks || ranks.length < 4 || ranks.length % 2 !== 0) return z;
    const teams = rotatingLasiTeams(ranks, hole);
    if (!teams) return z;
    const carryMult = carryMultiplierBeforeHole(game, match, hole, pars);
    const eagleMult = Math.max(1, Math.round(game.eagleMultiplier ?? 2));
    const dbFlip = game.doubleBogeyFlip ?? false;
    const vegasTie: VegasTieRule = game.vegasTieRule ?? 'carry';
    return lasVegasHoleResult(
      grosses,
      [...teams.teamA],
      [...teams.teamB],
      par,
      u,
      carryMult,
      eagleMult,
      dbFlip,
      vegasTie,
    ).payouts;
  }

  if (t === 'fixed_lasi_3pt') {
    if (!ranks || ranks.length < 4) return z;
    const teams = fixedLasiTeamSplit(ranks);
    if (!teams) return z;
    return lasiThreePointPayouts(grosses, [...teams.teamA], [...teams.teamB], u);
  }

  if (t === 'rotating_lasi_3pt') {
    if (!ranks || ranks.length < 4) return z;
    const teams = rotatingLasiTeams(ranks, hole);
    if (!teams) return z;
    return lasiThreePointPayouts(grosses, [...teams.teamA], [...teams.teamB], u);
  }

  if (t === 'trumpet') {
    const sec = Math.max(0, Math.round(game.secondaryUnitAmount ?? 0));
    const lasi = trumpetLasiOnlyHolePayoutsWithMatch(match, hole, grosses, u);
    const pair = trumpetPairOnlyHolePayouts(match, hole, grosses, sec);
    return lasi.map((x, i) => x + pair[i]!);
  }

  return z;
}

/** 从已保存记分读取某洞总杆向量 */
export function grossVectorSaved(match: MatchRecord, hole: number): (number | null)[] {
  return match.players.map((p) => getGross(p, hole));
}

function simulateLasVegasCarryMultiplierBeforeHole(
  game: MatchSideGame,
  match: MatchRecord,
  holeStart: number,
  pars: number[],
  fixedTeams: boolean,
): number {
  if (holeStart <= 1) return 1;
  const ranks = match.lotteryDraw?.holeOneRanks;
  if (!ranks || ranks.length < 4 || ranks.length % 2 !== 0) return 1;
  const teamsFixed = fixedTeams ? fixedLasiTeamSplit(ranks) : null;
  if (fixedTeams && !teamsFixed) return 1;

  const u = Math.max(0, Math.round(game.unitAmount));
  const eagleMult = Math.max(1, Math.round(game.eagleMultiplier ?? 2));
  const dbFlip = game.doubleBogeyFlip ?? false;
  const tieRule: VegasTieRule = game.vegasTieRule ?? 'carry';

  let carryMult = 1;
  for (let h = 1; h <= holeStart - 1; h += 1) {
    const gs = grossVectorSaved(match, h).map((x) => (x == null ? null : x));
    if (gs.some((x) => x == null)) continue;
    const par = pars[h - 1] ?? 4;
    const teams = fixedTeams ? teamsFixed! : rotatingLasiTeams(ranks, h);
    if (!teams) continue;
    const result = lasVegasHoleResult(
      gs as number[],
      [...teams.teamA],
      [...teams.teamB],
      par,
      u,
      carryMult,
      eagleMult,
      dbFlip,
      tieRule,
    );
    carryMult = result.nextCarryMultiplier;
  }
  return Math.max(1, carryMult);
}

/** 固拉 Las Vegas：全场累计到 throughHole（含） */
export function cumulativeLasVegasFixed(
  match: MatchRecord,
  throughHole: number,
  pars: number[],
  game: MatchSideGame,
): number[] {
  const n = match.players.length;
  const sum = Array.from({ length: n }, () => 0);
  const ranks = match.lotteryDraw?.holeOneRanks;
  if (!ranks) return sum;
  const teams = fixedLasiTeamSplit(ranks);
  if (!teams) return sum;

  const unit = Math.max(0, Math.round(game.unitAmount));
  const eagleMult = Math.max(1, Math.round(game.eagleMultiplier ?? 2));
  const dbFlip = game.doubleBogeyFlip ?? false;
  const tieRule: VegasTieRule = game.vegasTieRule ?? 'carry';

  let carryMult = 1;
  for (let h = 1; h <= Math.min(throughHole, match.holes); h += 1) {
    const gs = match.players.map((p) => getGross(p, h));
    if (gs.some((x) => x == null)) continue;
    const par = pars[h - 1] ?? 4;
    const result = lasVegasHoleResult(
      gs as number[],
      [...teams.teamA],
      [...teams.teamB],
      par,
      unit,
      carryMult,
      eagleMult,
      dbFlip,
      tieRule,
    );
    carryMult = result.nextCarryMultiplier;
    result.payouts.forEach((v, i) => {
      sum[i] += v;
    });
  }
  return sum.map((x) => Math.round(x));
}

/** 乱拉 Las Vegas：每洞 `rotatingLasiTeams`，全场累计到 throughHole（含） */
export function cumulativeLasVegasRotating(
  match: MatchRecord,
  throughHole: number,
  pars: number[],
  game: MatchSideGame,
): number[] {
  const n = match.players.length;
  const sum = Array.from({ length: n }, () => 0);
  const ranks = match.lotteryDraw?.holeOneRanks;
  if (!ranks) return sum;

  const unit = Math.max(0, Math.round(game.unitAmount));
  const eagleMult = Math.max(1, Math.round(game.eagleMultiplier ?? 2));
  const dbFlip = game.doubleBogeyFlip ?? false;
  const tieRule: VegasTieRule = game.vegasTieRule ?? 'carry';

  let carryMult = 1;
  for (let h = 1; h <= Math.min(throughHole, match.holes); h += 1) {
    const gs = match.players.map((p) => getGross(p, h));
    if (gs.some((x) => x == null)) continue;
    const par = pars[h - 1] ?? 4;
    const teams = rotatingLasiTeams(ranks, h);
    if (!teams) continue;
    const result = lasVegasHoleResult(
      gs as number[],
      [...teams.teamA],
      [...teams.teamB],
      par,
      unit,
      carryMult,
      eagleMult,
      dbFlip,
      tieRule,
    );
    carryMult = result.nextCarryMultiplier;
    result.payouts.forEach((v, i) => {
      sum[i] += v;
    });
  }
  return sum.map((x) => Math.round(x));
}

/**
 * Skins 全场结算（至 throughHole）
 * - 每洞皮值 = skinValue；唯一最低净杆赢走当前 pot；平局 pot += skinValue
 * - 未录齐成绩的洞：跳过且不改变 pot
 * - 打完全部洞次后若仍有累积 pot，按「currentPot − skinValue」均分（与开局页规格一致）
 * - 返回零和：每人减去均值
 */
export function skinsPayouts(match: MatchRecord, throughHole: number, skinValue: number): number[] {
  const n = match.players.length;
  const totals = Array.from({ length: n }, () => 0);
  if (n < 2 || throughHole < 1) return totals;

  const v = Math.max(0, Math.round(skinValue));
  let currentPot = v;

  const maxH = Math.min(throughHole, match.holes);
  for (let h = 1; h <= maxH; h += 1) {
    const nets = match.players.map((p) => {
      const r = p.scores.find((s) => s.hole === h);
      return r ? r.net : null;
    });
    if (nets.some((x) => x == null)) continue;

    const minNet = Math.min(...(nets as number[]));
    const winnerIdxs = (nets as number[])
      .map((val, i) => (val === minNet ? i : -1))
      .filter((i) => i >= 0);

    if (winnerIdxs.length === 1) {
      totals[winnerIdxs[0]!] += currentPot;
      currentPot = v;
    } else {
      currentPot += v;
    }
  }

  if (throughHole >= match.holes && currentPot > v) {
    const remaining = currentPot - v;
    const share = Math.round(remaining / n);
    for (let i = 0; i < n; i += 1) totals[i] += share;
  }

  const mean = totals.reduce((a, b) => a + b, 0) / n;
  return totals.map((t) => Math.round(t - mean));
}

/** match_play / 固拉 / 乱拉：逐洞累计支持平局赌注递进 */
export function usesPerHoleCarryGame(game: MatchSideGame): boolean {
  const t = game.gameType;
  return (
    game.settlementMode === 'per_hole' &&
    (t === 'match_play' || t === 'fixed_lasi' || t === 'rotating_lasi')
  );
}

/** 打第 holeStart 洞之前，累计赌注倍数（≥1），仅用于 per_hole 比洞/固拉/乱拉 */
export function carryMultiplierBeforeHole(
  game: MatchSideGame,
  match: MatchRecord,
  holeStart: number,
  pars: number[],
): number {
  if (!usesPerHoleCarryGame(game) || holeStart <= 1) return 1;
  const t = game.gameType;
  if (t === 'fixed_lasi') {
    return simulateLasVegasCarryMultiplierBeforeHole(game, match, holeStart, pars, true);
  }
  if (t === 'rotating_lasi') {
    return simulateLasVegasCarryMultiplierBeforeHole(game, match, holeStart, pars, false);
  }

  const tieRule: TieRule = game.tieRule ?? 'void';
  const uBase = Math.max(0, Math.round(game.unitAmount));
  let carryMult = 1;
  const end = holeStart - 1;
  for (let h = 1; h <= end; h += 1) {
    const gs = grossVectorSaved(match, h).map((x) => (x == null ? null : x));
    if (gs.some((x) => x == null)) continue;
    const par = pars[h - 1] ?? 4;
    const stake = Math.round(uBase * carryMult);
    const gPlay = { ...game, unitAmount: Math.max(0, stake) };
    const pay = singleHolePayoutsForGame(gPlay, match, h, gs as number[], par);
    const isTie = !pay.some((x) => Math.abs(x) >= 0.5);
    if (isTie) {
      if (tieRule === 'carry') carryMult += 1;
      else if (tieRule === 'double') carryMult *= 2;
    } else {
      carryMult = 1;
    }
  }
  return Math.max(1, carryMult);
}

/** 累计：一洞一算玩法从第 1 洞加到 throughHole（含）；end_total 返回 0（进行中不计洞金） */
export function cumulativePayoutsForGame(
  game: MatchSideGame,
  match: MatchRecord,
  throughHole: number,
  pars: number[],
): number[] {
  const n = match.players.length;
  const sum = Array.from({ length: n }, () => 0);
  const uStake = Math.max(0, Math.round(game.unitAmount));
  const secStake =
    game.gameType === 'trumpet' ? Math.max(0, Math.round(game.secondaryUnitAmount ?? 0)) : 0;
  const hasStake = game.gameType === 'trumpet' ? uStake > 0 || secStake > 0 : uStake > 0;
  if (throughHole < 1 || !hasStake) {
    return mergeEventPayoutsIntoBase(sum, game.events, throughHole, n, game.eventConfig);
  }

  if (game.settlementMode === 'end_total') {
    return mergeEventPayoutsIntoBase(sum, game.events, throughHole, n, game.eventConfig);
  }

  /** Nassau：三场叠加与 legacy 引擎一致（存 net=gross 时即总杆比洞）；含 Press 时叠加子赛 */
  if (game.gameType === 'nassau_pack') {
    const u = Math.max(0, Math.round(game.unitAmount));
    const hasPresses = (match.presses?.length ?? 0) > 0;
    if (hasPresses) {
      const pay = nassauWithPressPayouts(match, throughHole, u);
      const result = Array.from({ length: n }, (_, i) => pay[i] ?? 0);
      return mergeEventPayoutsIntoBase(result, game.events, throughHole, n, game.eventConfig);
    }
    const syn: MatchRecord = { ...match, mode: 'nassau', unit: u };
    return mergeEventPayoutsIntoBase(
      calcMoneyResult(syn, throughHole).payoutsYuan,
      game.events,
      throughHole,
      n,
      game.eventConfig,
    );
  }

  if (game.gameType === 'fixed_lasi') {
    return mergeEventPayoutsIntoBase(
      cumulativeLasVegasFixed(match, throughHole, pars, game),
      game.events,
      throughHole,
      n,
      game.eventConfig,
    );
  }
  if (game.gameType === 'rotating_lasi') {
    return mergeEventPayoutsIntoBase(
      cumulativeLasVegasRotating(match, throughHole, pars, game),
      game.events,
      throughHole,
      n,
      game.eventConfig,
    );
  }

  if (game.gameType === 'skins') {
    return mergeEventPayoutsIntoBase(
      skinsPayouts(match, throughHole, uStake),
      game.events,
      throughHole,
      n,
      game.eventConfig,
    );
  }

  const end = Math.min(throughHole, match.holes);
  let carryMult = 1;
  const tieRule: TieRule = game.tieRule ?? 'void';

  for (let h = 1; h <= end; h += 1) {
    const gs = grossVectorSaved(match, h).map((x) => (x == null ? null : x));
    if (gs.some((x) => x == null)) continue;
    const par = pars[h - 1] ?? 4;

    if (usesPerHoleCarryGame(game)) {
      const stake = Math.round(uStake * carryMult);
      const gPlay = { ...game, unitAmount: Math.max(0, stake) };
      const pay = singleHolePayoutsForGame(gPlay, match, h, gs as number[], par);
      const isTie = !pay.some((x) => Math.abs(x) >= 0.5);
      if (isTie) {
        if (tieRule === 'carry') carryMult += 1;
        else if (tieRule === 'double') carryMult *= 2;
      } else {
        for (let i = 0; i < n; i += 1) sum[i] += pay[i] ?? 0;
        carryMult = 1;
      }
    } else {
      const pay = singleHolePayoutsForGame(game, match, h, gs as number[], par);
      for (let i = 0; i < n; i += 1) sum[i] += pay[i] ?? 0;
    }
  }
  return mergeEventPayoutsIntoBase(sum, game.events, throughHole, n, game.eventConfig);
}

/** 喇叭花·乱拉部分累计（便于 UI 分栏） */
export function cumulativeTrumpetLasiOnly(
  game: MatchSideGame,
  match: MatchRecord,
  throughHole: number,
  pars: number[],
): number[] {
  const n = match.players.length;
  const sum = Array.from({ length: n }, () => 0);
  if (throughHole < 1 || game.gameType !== 'trumpet' || game.settlementMode === 'end_total') return sum;
  const u = Math.max(0, Math.round(game.unitAmount));
  const end = Math.min(throughHole, match.holes);
  for (let h = 1; h <= end; h += 1) {
    const gs = grossVectorSaved(match, h).map((x) => (x == null ? null : x));
    if (gs.some((x) => x == null)) continue;
    const pay = trumpetLasiOnlyHolePayoutsWithMatch(match, h, gs as number[], u);
    for (let i = 0; i < n; i += 1) sum[i] += pay[i] ?? 0;
  }
  return sum.map((x) => Math.round(x));
}

/** 喇叭花·单挑部分累计 */
export function cumulativeTrumpetPairOnly(
  game: MatchSideGame,
  match: MatchRecord,
  throughHole: number,
  pars: number[],
): number[] {
  const n = match.players.length;
  const sum = Array.from({ length: n }, () => 0);
  if (throughHole < 1 || game.gameType !== 'trumpet' || game.settlementMode === 'end_total') return sum;
  const sec = Math.max(0, Math.round(game.secondaryUnitAmount ?? 0));
  const end = Math.min(throughHole, match.holes);
  for (let h = 1; h <= end; h += 1) {
    const gs = grossVectorSaved(match, h).map((x) => (x == null ? null : x));
    if (gs.some((x) => x == null)) continue;
    const pay = trumpetPairOnlyHolePayouts(match, h, gs as number[], sec);
    for (let i = 0; i < n; i += 1) sum[i] += pay[i] ?? 0;
  }
  return sum.map((x) => Math.round(x));
}

/** end_total：全场结束后按累计点/杆差结算一次（仅在 throughHole===holes 时与非 0 预览） */
export function endTotalSettlementPayouts(
  game: MatchSideGame,
  match: MatchRecord,
  throughHole: number,
  pars: number[],
): number[] {
  const n = match.players.length;
  const z = Array.from({ length: n }, () => 0);
  if (game.settlementMode !== 'end_total' || throughHole < 1 || game.unitAmount <= 0) return z;

  const u = Math.max(0, Math.round(game.unitAmount));
  const end = Math.min(throughHole, match.holes);
  const t = game.gameType;

  if (t === 'skins') return z;

  if (t === 'stroke_play') {
    let totals: number[] = match.players.map((pl) => {
      let s = 0;
      let c = 0;
      for (const row of pl.scores) {
        if (row.hole <= end) {
          s += row.gross;
          c += 1;
        }
      }
      return c > 0 ? s : 1e9;
    });
    /** 总杆低者「得分高」→ 取负参与均值分配 */
    const pts = totals.map((g) => -g);
    return payoutsFromPointsMean(pts, u);
  }

  if (t === 'stableford') {
    const pts = match.players.map((pl) =>
      pl.scores.filter((s) => s.hole <= end).reduce((a, s) => a + s.stablefordPoints, 0),
    );
    return payoutsFromPointsMean(pts, u);
  }

  if (t === 'points_8421') {
    const pts = match.players.map((pl) => {
      let s = 0;
      for (const row of pl.scores) {
        if (row.hole <= end) s += points8421FromGross(row.gross, row.par);
      }
      return s;
    });
    return payoutsFromPointsMean(pts, u);
  }

  return z;
}

export function settlementModeLabel(mode: SettlementMode): string {
  return mode === 'per_hole' ? '一洞一算' : '打完一起算';
}
