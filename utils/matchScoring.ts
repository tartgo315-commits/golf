/**
 * 实时比赛记分：让杆分配、比洞/Nassau/积分赛/比杆与金额结算（与比赛设置页逻辑对齐）。
 */

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

export type MatchRecord = {
  id: string;
  createdAt: number;
  course: string;
  holes: 9 | 18;
  mode: MatchMode;
  unit: number;
  players: MatchPlayer[];
  status: 'active' | 'finished';
};

/** WHS：无球场 SI 时以洞号近似（1 最难，与 lib/handicap 一致） */
export function strokesAllocatedOnHole(courseHandicap: number, strokeIndex: number, holeCount: 9 | 18): number {
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

export function holeNetGross(player: MatchPlayer, hole: number, holes: 9 | 18, par: number, gross: number): number {
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
  const net = holeNetGross(p, hole, match.holes, par, gross);
  const sf = calcStablefordPoints(net, par);
  const row: HoleScoreRow = { hole, par, gross, net, stablefordPoints: sf };
  const nextScores = [...p.scores.filter((s) => s.hole !== hole), row].sort((a, b) => a.hole - b.hole);
  const players = match.players.map((pl, i) => (i === playerIndex ? { ...pl, scores: nextScores } : pl));
  return { ...match, players };
}

function getNet(player: MatchPlayer, hole: number): number | null {
  const r = player.scores.find((s) => s.hole === hole);
  return r ? r.net : null;
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

export function calcNassauResult(player1: MatchPlayer, player2: MatchPlayer, holes: 9 | 18): NassauLines {
  const frontEnd = Math.min(9, holes);
  const f = calcSegment(player1, player2, 1, frontEnd, holes);
  const b =
    holes === 18
      ? calcSegment(player1, player2, 10, 18, holes)
      : { text: '—', diff: 0 };
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

function holePointsFromNets(nets: number[]): number[] {
  const min = Math.min(...nets);
  const winCount = nets.filter((v) => v === min).length;
  return nets.map((v) => (v === min ? 1 / winCount : 0));
}

function sumPointsForHoles(
  netByHole: number[][],
  holeFrom: number,
  holeToInclusive: number,
): number[] {
  const n = netByHole.length;
  const totals = Array.from({ length: n }, () => 0);
  for (let h = holeFrom; h <= holeToInclusive; h += 1) {
    const nets = netByHole.map((row) => row[h - 1] ?? NaN);
    if (nets.some((x) => !Number.isFinite(x))) continue;
    const pts = holePointsFromNets(nets as number[]);
    for (let p = 0; p < n; p += 1) totals[p] += pts[p]!;
  }
  return totals;
}

function nassauPayoutsYuan(match: MatchRecord, throughHole: number, u: number): number[] {
  const { holes, players } = match;
  const n = players.length;
  const netM = buildNetMatrix(match, throughHole);
  const sum = Array.from({ length: n }, () => 0);
  const frontEnd = Math.min(9, holes, throughHole);
  const frontPts = sumPointsForHoles(netM, 1, frontEnd);
  const pf = payoutsFromPoints(frontPts, u);
  for (let i = 0; i < n; i += 1) sum[i] += pf[i]!;
  if (holes === 18 && throughHole > 9) {
    const backPts = sumPointsForHoles(netM, 10, Math.min(18, throughHole));
    const pb = payoutsFromPoints(backPts, u);
    for (let i = 0; i < n; i += 1) sum[i] += pb[i]!;
  }
  const fullPts = sumPointsForHoles(netM, 1, Math.min(holes, throughHole));
  const pFull = payoutsFromPoints(fullPts, u);
  for (let i = 0; i < n; i += 1) sum[i] += pFull[i]!;
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
    return { deltas: Array.from({ length: n }, () => 0), payoutsYuan: Array.from({ length: n }, () => 0) };
  }
  const u = Math.max(0, Math.round(unit));
  let points: number[] = [];

  if (mode === 'matchplay') {
    const netM = buildNetMatrix(match, throughHole);
    const pts = sumPointsForHoles(netM, 1, throughHole);
    points = pts;
  } else if (mode === 'nassau') {
    const payouts = nassauPayoutsYuan(match, throughHole, u);
    return { deltas: payouts, payoutsYuan: payouts };
  } else if (mode === 'stableford') {
    points = players.map((pl) => pl.scores.filter((s) => s.hole <= throughHole).reduce((a, s) => a + s.stablefordPoints, 0));
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
      const t = pl.scores.filter((s) => s.hole <= throughHole).reduce((a, s) => a + s.stablefordPoints, 0);
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
        const winners = nets
          .map((v, j) => (v === min ? j : -1))
          .filter((j) => j >= 0);
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
