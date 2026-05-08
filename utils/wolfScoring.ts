export type WolfDecision = {
  hole: number;
  wolfIndex: number; // 该洞的 Wolf（0-3）
  partnerIndex: number | null; // null = Lone Wolf；否则为队友 playerIndex
};

/** 根据洞号计算 Wolf（0 起，4 人轮流） */
export function wolfIndexForHole(hole: number): number {
  return (hole - 1) % 4;
}

/**
 * 单洞 Wolf 结算（元，零和）
 * nets: 4 人本洞净杆，顺序与 players 对齐；null = 未录入（跳过）
 * decision: 该洞决策；若未决策则返回全 0
 * tieRule: 'void'|'carry'|'double'（carry/double 由调用方处理进位，这里只返回 void 或实际结果）
 */
export function wolfHolePayouts(
  nets: (number | null)[],
  decision: WolfDecision,
  unitAmount: number,
  _tieRule: 'void' | 'carry' | 'double' = 'void',
): number[] {
  const n = 4;
  const zero = Array.from({ length: n }, () => 0);
  if (nets.length < n) return zero;
  if (nets.some((v) => v == null)) return zero;
  const ns = nets as number[];
  const u = Math.max(0, Math.round(unitAmount));
  if (u <= 0) return zero;
  const wi = decision.wolfIndex;
  const pi = decision.partnerIndex;

  if (pi !== null) {
    // 2v2
    const wolfTeam = [wi, pi];
    const otherTeam = [0, 1, 2, 3].filter((i) => i !== wi && i !== pi);
    const wolfSum = wolfTeam.reduce((s, i) => s + ns[i]!, 0);
    const otherSum = otherTeam.reduce((s, i) => s + ns[i]!, 0);
    if (wolfSum === otherSum) return zero; // void/carry 由外层处理
    const wolfWins = wolfSum < otherSum;
    const out = Array.from({ length: n }, () => 0);
    if (wolfWins) {
      wolfTeam.forEach((i) => {
        out[i] = u;
      });
      otherTeam.forEach((i) => {
        out[i] = -u;
      });
    } else {
      wolfTeam.forEach((i) => {
        out[i] = -u;
      });
      otherTeam.forEach((i) => {
        out[i] = u;
      });
    }
    return out;
  }
  // Lone Wolf
  const othersNets = [0, 1, 2, 3]
    .filter((i) => i !== wi)
    .map((i) => ns[i]!);
  const wolfNet = ns[wi]!;
  const bestOther = Math.min(...othersNets);
  if (wolfNet === bestOther) return zero; // tie → void
  const wolfWins = wolfNet < bestOther;
  const out = Array.from({ length: n }, () => 0);
  if (wolfWins) {
    out[wi] = u * 3;
    [0, 1, 2, 3]
      .filter((i) => i !== wi)
      .forEach((i) => {
        out[i] = -u;
      });
  } else {
    out[wi] = -u * 3;
    [0, 1, 2, 3]
      .filter((i) => i !== wi)
      .forEach((i) => {
        out[i] = u;
      });
  }
  return out;
}

/** 累计所有洞的 Wolf 结算 */
export function cumulativeWolfPayouts(
  decisions: WolfDecision[],
  getNets: (hole: number) => (number | null)[],
  throughHole: number,
  unitAmount: number,
  tieRule: 'void' | 'carry' | 'double' = 'void',
): number[] {
  const totals = [0, 0, 0, 0];
  for (let h = 1; h <= throughHole; h += 1) {
    const dec = decisions.find((d) => d.hole === h);
    if (!dec) continue;
    const nets = getNets(h);
    const pay = wolfHolePayouts(nets, dec, unitAmount, tieRule);
    pay.forEach((v, i) => {
      totals[i] += v;
    });
  }
  return totals.map((x) => Math.round(x));
}
