/**
 * 各玩法按「总杆 gross」逐洞/全场结算的独立算法（多赌局并行）。
 * 暂不扣差点：依赖 MatchRecord.compareGrossOnly 存分时 net=gross。
 */

import type { MatchSideGame, SettlementMode, SideGameType } from '@/utils/matchGames.types';
import {
  calcMoneyResult,
  calcStablefordPoints,
  getGross,
  matchPlayHolePayoutsYuan,
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
 * 固拉：按第 1 洞顺位固定搭档 (顺位1–2 vs 3–4)，全场不变。
 */
export function fixedLasiTeamSplit(holeOneRanks: number[]): {
  teamA: [number, number];
  teamB: [number, number];
} | null {
  const n = holeOneRanks.length;
  if (n !== 4) return null;
  const order = [0, 1, 2, 3].sort((a, b) => holeOneRanks[a]! - holeOneRanks[b]!);
  return { teamA: [order[0]!, order[1]!], teamB: [order[2]!, order[3]!] };
}

/**
 * 乱拉：第 h 洞二人组随洞轮换（排头尾 vs 中间二人）。
 */
export function rotatingLasiTeams(
  holeOneRanks: number[],
  hole: number,
): { teamA: [number, number]; teamB: [number, number] } | null {
  const n = holeOneRanks.length;
  if (n !== 4) return null;
  const order = [0, 1, 2, 3].sort((a, b) => holeOneRanks[a]! - holeOneRanks[b]!);
  const shift = (hole - 1) % 4;
  const rot = [0, 1, 2, 3].map((k) => order[(k + shift) % 4]!);
  return { teamA: [rot[0]!, rot[3]!], teamB: [rot[1]!, rot[2]!] };
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

/** 三人比洞（斗地主）：总杆低者赢本洞 unit（与比洞相同零和） */
export function landlordHolePayoutsGross(grosses: number[], unit: number): number[] {
  return matchPlayHolePayoutsYuan(grosses, unit);
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

  const ranks = match.lotteryDraw?.holeOneRanks;
  if (t === 'fixed_lasi') {
    if (!ranks || ranks.length !== 4) return z;
    const teams = fixedLasiTeamSplit(ranks);
    if (!teams) return z;
    return teamVersusHolePayouts(grosses, teams.teamA, teams.teamB, u);
  }

  if (t === 'rotating_lasi' || t === 'trumpet') {
    if (!ranks || ranks.length !== 4) return z;
    const teams = rotatingLasiTeams(ranks, hole);
    if (!teams) return z;
    let pay = teamVersusHolePayouts(grosses, teams.teamA, teams.teamB, u);
    /** 喇叭花：叠加「每人」 secondary 的占位（完整规则接入前为 0） */
    if (t === 'trumpet' && game.secondaryUnitAmount && game.secondaryUnitAmount > 0) {
      /** 占位：不因 secondary 变动金额，避免误导 */
    }
    return pay;
  }

  return z;
}

/** 从已保存记分读取某洞总杆向量 */
export function grossVectorSaved(match: MatchRecord, hole: number): (number | null)[] {
  return match.players.map((p) => getGross(p, hole));
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
  if (throughHole < 1 || game.unitAmount <= 0) return sum;

  if (game.settlementMode === 'end_total') {
    return sum;
  }

  /** Nassau：三场叠加与 legacy 引擎一致（存 net=gross 时即总杆比洞） */
  if (game.gameType === 'nassau_pack') {
    const u = Math.max(0, Math.round(game.unitAmount));
    const syn: MatchRecord = { ...match, mode: 'nassau', unit: u };
    return calcMoneyResult(syn, throughHole).payoutsYuan;
  }

  const end = Math.min(throughHole, match.holes);
  for (let h = 1; h <= end; h += 1) {
    const gs = grossVectorSaved(match, h).map((x) => (x == null ? null : x));
    if (gs.some((x) => x == null)) continue;
    const par = pars[h - 1] ?? 4;
    const pay = singleHolePayoutsForGame(game, match, h, gs as number[], par);
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
