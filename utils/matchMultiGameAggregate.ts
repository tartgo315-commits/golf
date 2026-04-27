/**
 * 多赌局并行：底部区文案、累计合并、总结算分块（不含货币符号输出）。
 */

import type { MatchSideGame } from '@/utils/matchGames.types';
import {
  cumulativePayoutsForGame,
  cumulativeTrumpetLasiOnly,
  cumulativeTrumpetPairOnly,
  endTotalSettlementPayouts,
  settlementModeLabel,
  singleHolePayoutsForGame,
  trumpetLasiOnlyHolePayoutsWithMatch,
  trumpetPairOnlyHolePayouts,
} from '@/utils/matchGameCalculations';
import { sideGameTypeShortLabel } from '@/utils/sideGameCatalog';
import {
  describeCurrentHoleMoney,
  formatSignedAmount,
  getGross,
  pairwiseDebtLines,
  type MatchRecord,
} from '@/utils/matchScoring';

export type LiveGamePanel = {
  key: string;
  title: string;
  settlementMode: import('@/utils/matchGames.types').SettlementMode;
  /** 一洞一算：本洞摘要；打完一起算：排名文案 */
  holeLine: string;
  /** 一洞一算：每人累计一行；打完一起算：总杆/积分排名 */
  detailLines: string[];
  /** 是否在本洞展示金额类累计（per_hole） */
  showMoneyCumulative: boolean;
  /** 每人累计金额（仅 per_hole 有效；与 detailLines 对齐） */
  cumulativeAmounts: number[];
};

function unitLabel(game: MatchSideGame): string {
  const u = Math.max(0, Math.round(game.unitAmount));
  const t = game.gameType;
  if (t === 'stableford' || t === 'points_8421' || t === 'landlord') return `${u}/分`;
  return `${u}/洞`;
}

function gamePanelTitle(game: MatchSideGame): string {
  const name = sideGameTypeShortLabel(game.gameType);
  return `${name} ${unitLabel(game)}`;
}

/** 总杆累计（用于 end_total 排名展示；compareGrossOnly 时 net 即 gross） */
export function totalGrossThroughPlayer(match: MatchRecord, playerIndex: number, throughHole: number): number {
  const pl = match.players[playerIndex];
  if (!pl) return 0;
  return pl.scores.filter((s) => s.hole <= throughHole).reduce((a, s) => a + s.gross, 0);
}

export function grossRankLines(match: MatchRecord, throughHole: number): string[] {
  const rows = match.players.map((pl, i) => ({
    i,
    name: pl.name.trim() || (i === 0 ? '我' : `玩家${i + 1}`),
    g: totalGrossThroughPlayer(match, i, throughHole),
  }));
  const sorted = [...rows].sort((a, b) => a.g - b.g);
  return sorted.map((r, idx) => `${idx + 1}. ${r.name} 总杆 ${r.g}`);
}

/** 含当前洞草稿的总杆（用于「打完一起算」实时排名） */
export function grossTotalsThroughCurrentDraft(
  match: MatchRecord,
  currentHole: number,
  grossDraft: number[],
): number[] {
  return match.players.map((pl, i) => {
    let t = 0;
    for (let h = 1; h < currentHole; h += 1) {
      const g = getGross(pl, h);
      if (g != null) t += g;
    }
    t += grossDraft[i] ?? 0;
    return t;
  });
}

export function grossRankLinesFromDraft(
  match: MatchRecord,
  currentHole: number,
  grossDraft: number[],
): string[] {
  const totals = grossTotalsThroughCurrentDraft(match, currentHole, grossDraft);
  const names = match.players.map((p, i) => p.name.trim() || (i === 0 ? '我' : `玩家${i + 1}`));
  const rows = names.map((name, i) => ({ name, g: totals[i] ?? 0 }));
  const sorted = [...rows].sort((a, b) => a.g - b.g);
  return sorted.map((r, idx) => `${idx + 1}. ${r.name} 总杆 ${r.g}`);
}

export function buildLiveGamePanels(
  match: MatchRecord,
  pars: number[],
  currentHole: number,
  grossDraft: number[],
  throughCommitted: number,
  /** 当前洞未写入连续完成区时，累计是否叠加本洞预览 */
  previewCurrentHoleInCumulative: boolean,
): LiveGamePanel[] {
  const games = match.games ?? [];
  if (games.length === 0) return [];

  const names = match.players.map((p, i) => p.name.trim() || (i === 0 ? '我' : `玩家${i + 1}`));
  const par = pars[currentHole - 1] ?? 4;
  const addPreview =
    previewCurrentHoleInCumulative && throughCommitted < currentHole && currentHole <= match.holes;

  const buildOne = (game: MatchSideGame): LiveGamePanel => {
    const payHole = singleHolePayoutsForGame(game, match, currentHole, grossDraft, par);
    const cum = cumulativePayoutsForGame(game, match, throughCommitted, pars);
    const cumDisplay =
      addPreview && game.settlementMode === 'per_hole'
        ? cum.map((c, i) => c + (payHole[i] ?? 0))
        : cum;

    let holeLine = '';
    const detailLines: string[] = [];

    if (game.settlementMode === 'per_hole') {
      holeLine =
        match.players.length >= 2 ? describeCurrentHoleMoney(names, payHole) : '—';
      for (let i = 0; i < match.players.length; i += 1) {
        detailLines.push(`${names[i]} ${formatSignedAmount(cumDisplay[i] ?? 0)}`);
      }
    } else {
      holeLine = `得分已记录 · ${settlementModeLabel(game.settlementMode)}（本场不按洞结算金额）`;
      grossRankLinesFromDraft(match, currentHole, grossDraft).forEach((ln) => detailLines.push(ln));
    }

    return {
      key: game.id,
      title: `${gamePanelTitle(game)}（${settlementModeLabel(game.settlementMode)}）`,
      settlementMode: game.settlementMode,
      holeLine: `本洞：${holeLine}`,
      detailLines,
      showMoneyCumulative: game.settlementMode === 'per_hole',
      cumulativeAmounts: cumDisplay,
    };
  };

  return games.flatMap((game) => {
    if (game.gameType !== 'trumpet') {
      return [buildOne(game)];
    }

    const u = Math.max(0, Math.round(game.unitAmount));
    const sec = Math.max(0, Math.round(game.secondaryUnitAmount ?? 0));

    const lasiHole = trumpetLasiOnlyHolePayoutsWithMatch(match, currentHole, grossDraft, u);
    const pairHole = trumpetPairOnlyHolePayouts(match, currentHole, grossDraft, sec);

    const cumLasi = cumulativeTrumpetLasiOnly(game, match, throughCommitted, pars);
    const cumPair = cumulativeTrumpetPairOnly(game, match, throughCommitted, pars);

    const lasiDisp =
      addPreview && game.settlementMode === 'per_hole'
        ? cumLasi.map((c, i) => c + (lasiHole[i] ?? 0))
        : cumLasi;
    const pairDisp =
      addPreview && game.settlementMode === 'per_hole'
        ? cumPair.map((c, i) => c + (pairHole[i] ?? 0))
        : cumPair;

    const lasiHoleLine =
      match.players.length >= 2 ? describeCurrentHoleMoney(names, lasiHole) : '—';
    const pairHoleLine =
      match.players.length >= 2 ? describeCurrentHoleMoney(names, pairHole) : '—';

    const lasiDetail = names.map((nm, i) => `${nm} ${formatSignedAmount(lasiDisp[i] ?? 0)}`);
    const pairDetail = names.map((nm, i) => `${nm} ${formatSignedAmount(pairDisp[i] ?? 0)}`);

    return [
      {
        key: `${game.id}-lasi`,
        title: `乱拉 ${u}/洞（${settlementModeLabel(game.settlementMode)}）`,
        settlementMode: game.settlementMode,
        holeLine: `本洞：${lasiHoleLine}`,
        detailLines: lasiDetail,
        showMoneyCumulative: game.settlementMode === 'per_hole',
        cumulativeAmounts: lasiDisp,
      },
      {
        key: `${game.id}-pair`,
        title: `喇叭花 ${sec}/人（${settlementModeLabel(game.settlementMode)}）`,
        settlementMode: game.settlementMode,
        holeLine: `本洞：${pairHoleLine}`,
        detailLines: pairDetail,
        showMoneyCumulative: game.settlementMode === 'per_hole',
        cumulativeAmounts: pairDisp,
      },
    ];
  });
}

/** 合并累计（进行中：仅一洞一算赌局相加） */
export function mergedRunningPayouts(
  match: MatchRecord,
  throughHole: number,
  pars: number[],
  currentHole: number,
  grossDraft: number[],
  previewCurrentHole: boolean,
): number[] {
  const n = match.players.length;
  const sum = Array.from({ length: n }, () => 0);
  const games = match.games ?? [];
  const par = pars[currentHole - 1] ?? 4;
  const addPreview = previewCurrentHole && throughHole < currentHole && currentHole <= match.holes;

  for (const g of games) {
    let part = cumulativePayoutsForGame(g, match, throughHole, pars);
    if (addPreview && g.settlementMode === 'per_hole') {
      const holePay = singleHolePayoutsForGame(g, match, currentHole, grossDraft, par);
      part = part.map((c, i) => c + (holePay[i] ?? 0));
    }
    for (let i = 0; i < n; i += 1) sum[i] += part[i] ?? 0;
  }
  return sum.map((x) => Math.round(x));
}

/** 总结算：每赌局一行块 + 合并 + 债务（传入的 throughHole 一般为已打完洞数） */
export function buildSettlementSections(
  match: MatchRecord,
  throughHole: number,
  pars: number[],
): {
  gameRows: Array<{ title: string; lines: string[] }>;
  merged: number[];
  debtLines: string[];
} {
  const n = match.players.length;
  const names = match.players.map((p, i) => p.name.trim() || (i === 0 ? '我' : `玩家${i + 1}`));
  const games = match.games ?? [];
  const gameRows: Array<{ title: string; lines: string[] }> = [];

  const merged = Array.from({ length: n }, () => 0);

  for (const g of games) {
    let payouts: number[];
    if (g.settlementMode === 'end_total') {
      payouts = endTotalSettlementPayouts(g, match, throughHole, pars);
    } else {
      payouts = cumulativePayoutsForGame(g, match, throughHole, pars);
    }
    for (let i = 0; i < n; i += 1) merged[i] += payouts[i] ?? 0;

    if (g.gameType === 'trumpet') {
      const u = Math.max(0, Math.round(g.unitAmount));
      const sec = Math.max(0, Math.round(g.secondaryUnitAmount ?? 0));
      const lasiP = cumulativeTrumpetLasiOnly(g, match, throughHole, pars);
      const pairP = cumulativeTrumpetPairOnly(g, match, throughHole, pars);
      gameRows.push({
        title: `「乱拉 ${u}/洞（${settlementModeLabel(g.settlementMode)}）」`,
        lines: names.map((nm, i) => `${nm} ${formatSignedAmount(lasiP[i] ?? 0)}`),
      });
      gameRows.push({
        title: `「喇叭花 ${sec}/人（${settlementModeLabel(g.settlementMode)}）」`,
        lines: names.map((nm, i) => `${nm} ${formatSignedAmount(pairP[i] ?? 0)}`),
      });
    } else {
      const title = `「${gamePanelTitle(g)}（${settlementModeLabel(g.settlementMode)}）」`;
      const lines = names.map((nm, i) => `${nm} ${formatSignedAmount(payouts[i] ?? 0)}`);
      gameRows.push({ title, lines });
    }
  }

  const debtLines = pairwiseDebtLines(names, merged);

  return {
    gameRows,
    merged: merged.map((x) => Math.round(x)),
    debtLines,
  };
}
