/**
 * 实时比赛记分：让杆分配、比洞/Nassau/积分赛/比杆与金额结算（与比赛设置页逻辑对齐）。
 */

import type { MatchSideGame, SettlementMode } from '@/utils/matchGames.types';

export type MatchMode = 'matchplay' | 'nassau' | 'stableford' | 'stroke';

export type HoleScoreRow = {
  hole: number;
  par: number;
  gross: number;
  net: number;
  stablefordPoints: number;
};

export type MatchPlayer = {
  name: string;
  handicap: number;
  scores: HoleScoreRow[];
};

/** 开局抓阄结果（斗地主 / 乱拉·喇叭花第 1 洞顺位） */
export type LotteryDraw = {
  /** 斗地主：地主在 players 中的下标 */
  landlordPlayerIndex?: number;
  /** 乱拉/喇叭花：每名玩家翻开数字 = 第 1 洞出发顺位 1…n */
  holeOneRanks?: number[];
};

export type MatchRecord = {
  id: string;
  createdAt: number;
  course: string;
  holes: 9 | 18;
  mode: MatchMode;
  unit: number;
  players: MatchPlayer[];
  status: 'active' | 'finished';
  /** 未设置时由 defaultSettlementMode(mode) 推导 */
  settlementMode?: SettlementMode;
  /** 多赌局并行（逐步接入）；与 legacy mode 可并存，总结算时合并 */
  games?: MatchSideGame[];
  /** 需要抓阄的玩法完成后写入 */
  lotteryDraw?: LotteryDraw;
  /** 多赌局场：逐洞比较一律用总杆（net=gross），暂不使用差点 */
  compareGrossOnly?: boolean;
};

/** WHS：无球场 SI 时以洞号近似（1 最难，与 lib/handicap 一致） */
export function strokesAllocatedOnHole(
  courseHandicap: number,
  strokeIndex: number,
  holeCount: 9 | 18,
): number {
  if (!Number.isFinite(courseHandicap) || courseHandicap <= 0) return 0;
  const n = holeCount === 9 ? 9 : 18;
  const ch = Math.min(Math.max(Math.round(courseHandicap), 0), 54);
  const base = Math.floor(ch / n);
  const rem = ch % n;
  return base + (strokeIndex <= rem ? 1 : 0);
}

/** 各洞让杆分配数组（下标 0 = 第 1 洞） */
export function calcHandicapStrokes(handicap: number, holes: 9 | 18): number[] {
  return Array.from({ length: holes }, (_, i) => strokesAllocatedOnHole(handicap, i + 1, holes));
}

/** 老鹰4 / 小鸟3 / 标准2 / 柏忌1 / 双柏忌+0（按 net 相对 par） */
export function calcStablefordPoints(net: number, par: number): number {
  const rel = par - net;
  if (rel >= 2) return 4;
  if (rel === 1) return 3;
  if (rel === 0) return 2;
  if (rel === -1) return 1;
  return 0;
}

export function holeNetGross(
  player: MatchPlayer,
  hole: number,
  holes: 9 | 18,
  par: number,
  gross: number,
): number {
  const recv = strokesAllocatedOnHole(player.handicap, hole, holes);
  return gross - recv;
}

export function upsertPlayerHole(
  match: MatchRecord,
  playerIndex: number,
  hole: number,
  par: number,
  gross: number,
): MatchRecord {
  const p = match.players[playerIndex];
  if (!p) return match;
  /** 多赌局场：比较与 Stableford 均按总杆相对 Par（暂不扣差点） */
  const net = match.compareGrossOnly ? gross : holeNetGross(p, hole, match.holes, par, gross);
  const sf = calcStablefordPoints(net, par);
  const row: HoleScoreRow = { hole, par, gross, net, stablefordPoints: sf };
  const nextScores = [...p.scores.filter((s) => s.hole !== hole), row].sort(
    (a, b) => a.hole - b.hole,
  );
  const players = match.players.map((pl, i) =>
    i === playerIndex ? { ...pl, scores: nextScores } : pl,
  );
  return { ...match, players };
}

function getNet(player: MatchPlayer, hole: number): number | null {
  const r = player.scores.find((s) => s.hole === hole);
  return r ? r.net : null;
}

/** 读取某洞总杆（已保存的记分） */
export function getGross(player: MatchPlayer, hole: number): number | null {
  const r = player.scores.find((s) => s.hole === hole);
  return r ? r.gross : null;
}

/** 未配置时的默认结算模式 */
export function defaultSettlementMode(mode: MatchMode): SettlementMode {
  if (mode === 'stroke' || mode === 'stableford') return 'end_total';
  return 'per_hole';
}

/** 金额展示：纯数字，正数带 +，负数带 − 号，无货币单位 */
export function formatSignedAmount(n: number): string {
  const r = Math.round(n);
  if (r > 0) return `+${r}`;
  if (r < 0) return `${r}`;
  return '0';
}

/**
 * 单洞比洞现金结算：本洞总赌金 = unit（零和）。
 * 净杆最低者赢；并列最低则平分 +unit，其余每人平均摊付。
 */
export function matchPlayHolePayoutsYuan(nets: number[], unit: number): number[] {
  const n = nets.length;
  if (n < 2 || unit <= 0) return Array.from({ length: n }, () => 0);
  const min = Math.min(...nets);
  const winIdx: number[] = [];
  const loseIdx: number[] = [];
  nets.forEach((v, i) => {
    if (v === min) winIdx.push(i);
    else if (v > min) loseIdx.push(i);
  });
  if (loseIdx.length === 0) return Array.from({ length: n }, () => 0);
  const W = winIdx.length;
  const L = loseIdx.length;
  const out = Array.from({ length: n }, () => 0);
  const winEach = unit / W;
  const loseEach = -unit / L;
  winIdx.forEach((i) => {
    out[i] += winEach;
  });
  loseIdx.forEach((i) => {
    out[i] += loseEach;
  });
  return out.map((x) => Math.round(x));
}

/** 比洞：截至 throughHole，player1 相对 player2 的文本（p1 视角） */
export function calcMatchPlayResult(
  player1: MatchPlayer,
  player2: MatchPlayer,
  throughHole: number,
  holes: 9 | 18,
): { text: string; diff: number } {
  let w1 = 0;
  let w2 = 0;
  for (let h = 1; h <= Math.min(throughHole, holes); h += 1) {
    const n1 = getNet(player1, h);
    const n2 = getNet(player2, h);
    if (n1 == null || n2 == null) continue;
    if (n1 < n2) w1 += 1;
    else if (n2 < n1) w2 += 1;
  }
  const d = w1 - w2;
  if (d === 0) return { text: 'AS', diff: 0 };
  if (d > 0) return { text: `${d} Up`, diff: d };
  return { text: `${-d} Down`, diff: d };
}

export type NassauLines = { front: string; back: string; total: string };

export function calcNassauResult(
  player1: MatchPlayer,
  player2: MatchPlayer,
  holes: 9 | 18,
): NassauLines {
  const frontEnd = Math.min(9, holes);
  const f = calcSegment(player1, player2, 1, frontEnd, holes);
  const b = holes === 18 ? calcSegment(player1, player2, 10, 18, holes) : { text: '—', diff: 0 };
  const t = calcSegment(player1, player2, 1, holes, holes);
  return { front: f.text, back: b.text, total: t.text };
}

function calcSegment(
  player1: MatchPlayer,
  player2: MatchPlayer,
  from: number,
  to: number,
  holes: 9 | 18,
): { text: string; diff: number } {
  let w1 = 0;
  let w2 = 0;
  for (let h = from; h <= to; h += 1) {
    if (h > holes) break;
    const n1 = getNet(player1, h);
    const n2 = getNet(player2, h);
    if (n1 == null || n2 == null) continue;
    if (n1 < n2) w1 += 1;
    else if (n2 < n1) w2 += 1;
  }
  const d = w1 - w2;
  if (d === 0) return { text: 'AS', diff: 0 };
  if (d > 0) return { text: `${d} Up`, diff: d };
  return { text: `${-d} Down`, diff: d };
}

function payoutsFromPoints(points: number[], unit: number): number[] {
  if (points.length === 0) return [];
  const mean = points.reduce((a, b) => a + b, 0) / points.length;
  return points.map((p) => Math.round((p - mean) * unit));
}

/**
 * 当前洞每人现金变动（纯数字）。
 * 比洞 / Nassau（按洞）：用满额 unit；积分赛等仍用洞分均值化（后续可切换到专项算法）。
 */
export function payoutsYuanSingleHole(nets: number[], unit: number, mode: MatchMode): number[] {
  if (unit <= 0) return nets.map(() => 0);
  if (mode === 'matchplay' || mode === 'nassau') {
    return matchPlayHolePayoutsYuan(nets, unit);
  }
  const pts = holePointsFromNets(nets);
  return payoutsFromPoints(pts, unit);
}

/** 当前洞输赢摘要（不含货币符号） */
export function describeCurrentHoleMoney(names: string[], payoutsYuan: number[]): string {
  const eps = 1;
  const hi = payoutsYuan
    .map((v, i) => ({ v, i }))
    .filter((x) => x.v > eps);
  if (hi.length === 0) return '平局';
  const maxVal = Math.max(...hi.map((x) => x.v));
  const tops = hi
    .filter((x) => Math.abs(x.v - maxVal) < 0.01)
    .map((x) => names[x.i]?.trim() || `玩家${x.i + 1}`);
  const amt = Math.round(maxVal);
  if (tops.length === 1) return `${tops[0]} +${amt}`;
  return `${tops.join('、')} +${amt}`;
}

/** 将每人净应收拆成「谁欠谁」（纯数字） */
export function pairwiseDebtLines(names: string[], netPayoutsYuan: number[]): string[] {
  type E = { i: number; amt: number };
  const debtors: E[] = [];
  const creditors: E[] = [];
  netPayoutsYuan.forEach((a, i) => {
    const r = Math.round(a);
    if (r > 0) creditors.push({ i, amt: r });
    else if (r < 0) debtors.push({ i, amt: -r });
  });
  const lines: string[] = [];
  let ci = 0;
  let di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const c = creditors[ci]!;
    const d = debtors[di]!;
    const pay = Math.min(c.amt, d.amt);
    if (pay > 0) {
      lines.push(
        `${names[d.i]?.trim() || `玩家${d.i + 1}`} 欠 ${names[c.i]?.trim() || `玩家${c.i + 1}`} ${pay}`,
      );
    }
    c.amt -= pay;
    d.amt -= pay;
    if (c.amt <= 0) ci += 1;
    if (d.amt <= 0) di += 1;
  }
  return lines;
}

function holePointsFromNets(nets: number[]): number[] {
  const min = Math.min(...nets);
  const winCount = nets.filter((v) => v === min).length;
  return nets.map((v) => (v === min ? 1 / winCount : 0));
}

/** 连续洞上按「单洞满额 unit」比洞累加（用于 Nassau 三场叠加） */
function sumMatchPlaySegmentYuan(
  match: MatchRecord,
  holeFrom: number,
  holeToInclusive: number,
  throughHole: number,
  u: number,
): number[] {
  const n = match.players.length;
  const totals = Array.from({ length: n }, () => 0);
  const end = Math.min(holeToInclusive, throughHole, match.holes);
  for (let h = holeFrom; h <= end; h += 1) {
    const nets = match.players.map((p) => getNet(p, h));
    if (nets.some((x) => x == null)) continue;
    const pay = matchPlayHolePayoutsYuan(nets as number[], u);
    for (let i = 0; i < n; i += 1) totals[i] += pay[i]!;
  }
  return totals;
}

/** Nassau：前九、后九、全场三场各按比洞满额逐洞累加后相加 */
function nassauPayoutsYuan(match: MatchRecord, throughHole: number, u: number): number[] {
  const { holes, players } = match;
  const n = players.length;
  const sum = Array.from({ length: n }, () => 0);
  const frontEnd = Math.min(9, holes);
  const front = sumMatchPlaySegmentYuan(match, 1, frontEnd, throughHole, u);
  for (let i = 0; i < n; i += 1) sum[i] += front[i]!;
  if (holes === 18) {
    const back = sumMatchPlaySegmentYuan(match, 10, 18, throughHole, u);
    for (let i = 0; i < n; i += 1) sum[i] += back[i]!;
  }
  const full = sumMatchPlaySegmentYuan(match, 1, holes, throughHole, u);
  for (let i = 0; i < n; i += 1) sum[i] += full[i]!;
  return sum;
}

/** 构建 [player][hole-1] = net，仅已打洞填数 */
export function buildNetMatrix(match: MatchRecord, throughHole: number): number[][] {
  const { holes, players } = match;
  const maxH = Math.min(throughHole, holes);
  return players.map((pl) =>
    Array.from({ length: holes }, (_, i) => {
      const h = i + 1;
      if (h > maxH) return NaN;
      const n = getNet(pl, h);
      return n == null ? NaN : n;
    }),
  );
}

export type MoneyResult = { deltas: number[]; payoutsYuan: number[] };

/** 根据当前已录入洞计算每人盈亏（元，四舍五入）；单人返回全 0 */
export function calcMoneyResult(match: MatchRecord, throughHole: number): MoneyResult {
  const { players, mode, unit, holes } = match;
  const n = players.length;
  if (n <= 1 || unit <= 0) {
    return {
      deltas: Array.from({ length: n }, () => 0),
      payoutsYuan: Array.from({ length: n }, () => 0),
    };
  }
  const u = Math.max(0, Math.round(unit));
  let points: number[] = [];

  if (mode === 'matchplay') {
    const totals = Array.from({ length: n }, () => 0);
    for (let h = 1; h <= throughHole; h += 1) {
      const nets = players.map((p) => getNet(p, h));
      if (nets.some((x) => x == null)) continue;
      const pay = matchPlayHolePayoutsYuan(nets as number[], u);
      for (let i = 0; i < n; i += 1) totals[i] += pay[i]!;
    }
    return { deltas: totals, payoutsYuan: totals };
  } else if (mode === 'nassau') {
    const payouts = nassauPayoutsYuan(match, throughHole, u);
    return { deltas: payouts, payoutsYuan: payouts };
  } else if (mode === 'stableford') {
    points = players.map((pl) =>
      pl.scores.filter((s) => s.hole <= throughHole).reduce((a, s) => a + s.stablefordPoints, 0),
    );
  } else {
    // stroke：总净杆越低越好 → 取负作为「高分」参与均值分配
    points = players.map((pl) => {
      let t = 0;
      let c = 0;
      for (const s of pl.scores) {
        if (s.hole <= throughHole) {
          t += s.net;
          c += 1;
        }
      }
      return c > 0 ? -t : 0;
    });
  }

  const payouts = payoutsFromPoints(points, u);
  return { deltas: payouts, payoutsYuan: payouts };
}

export function totalNetThrough(player: MatchPlayer, throughHole: number): number {
  return player.scores.filter((s) => s.hole <= throughHole).reduce((a, s) => a + s.net, 0);
}

export function totalParThrough(pars: number[], throughHole: number): number {
  let s = 0;
  for (let i = 0; i < Math.min(throughHole, pars.length); i += 1) s += pars[i] ?? 4;
  return s;
}

export function vsParLabel(netTotal: number, parTotal: number): string {
  const d = netTotal - parTotal;
  if (d === 0) return 'E';
  return d > 0 ? `+${d}` : `${d}`;
}

/** 从第 1 洞起连续「每位玩家都已录入」的洞数 */
export function countConsecutiveHolesComplete(match: MatchRecord): number {
  let h = 1;
  while (h <= match.holes) {
    const ok = match.players.every((p) => p.scores.some((s) => s.hole === h));
    if (!ok) break;
    h += 1;
  }
  return h - 1;
}

/** MVP：比洞赢洞最多或积分赛总分最高 */
export function pickMvpPlayerIndex(match: MatchRecord, throughHole: number): number {
  const { players, mode } = match;
  if (players.length === 0) return 0;
  if (players.length === 1) return 0;
  if (mode === 'stableford') {
    let best = -1;
    let idx = 0;
    players.forEach((pl, i) => {
      const t = pl.scores
        .filter((s) => s.hole <= throughHole)
        .reduce((a, s) => a + s.stablefordPoints, 0);
      if (t > best) {
        best = t;
        idx = i;
      }
    });
    return idx;
  }
  if (mode === 'matchplay' || mode === 'nassau') {
    if (players.length === 2) {
      const { diff } = calcMatchPlayResult(players[0]!, players[1]!, throughHole, match.holes);
      return diff >= 0 ? 0 : 1;
    }
    let bestW = -1;
    let idx = 0;
    for (let i = 0; i < players.length; i += 1) {
      let w = 0;
      for (let h = 1; h <= throughHole; h += 1) {
        const nets = players.map((pl) => getNet(pl, h));
        if (nets.some((x) => x == null)) continue;
        const min = Math.min(...(nets as number[]));
        const winners = nets.map((v, j) => (v === min ? j : -1)).filter((j) => j >= 0);
        if (winners.length === 1 && winners[0] === i) w += 1;
      }
      if (w > bestW) {
        bestW = w;
        idx = i;
      }
    }
    return idx;
  }
  // stroke：净杆最低
  let best = 1e9;
  let idx = 0;
  players.forEach((pl, i) => {
    const t = totalNetThrough(pl, throughHole);
    if (t < best) {
      best = t;
      idx = i;
    }
  });
  return idx;
}
