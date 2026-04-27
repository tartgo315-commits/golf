/**
 * 抓阄：斗地主选地主、乱拉/喇叭花第 1 洞顺位。
 */

import type { MatchRecord } from '@/utils/matchScoring';

export type LotteryScenario = 'landlord' | 'ranks';

/** 是否包含需要抓阄的玩法 */
export function lotteryScenario(match: MatchRecord): LotteryScenario | null {
  const types = new Set(match.games?.map((g) => g.gameType) ?? []);
  if (types.has('landlord')) return 'landlord';
  if (types.has('rotating_lasi') || types.has('trumpet')) return 'ranks';
  return null;
}

function isPermutationOneToN(ranks: number[], n: number): boolean {
  if (ranks.length !== n) return false;
  const seen = new Set<number>();
  for (const x of ranks) {
    if (!Number.isFinite(x) || x < 1 || x > n || seen.has(x)) return false;
    seen.add(x);
  }
  return seen.size === n;
}

/** 抓阄结果是否已写入且有效 */
export function isLotteryComplete(match: MatchRecord): boolean {
  const scenario = lotteryScenario(match);
  if (!scenario) return true;
  const d = match.lotteryDraw;
  if (!d) return false;
  const n = match.players.length;
  if (scenario === 'landlord') {
    return (
      typeof d.landlordPlayerIndex === 'number' &&
      d.landlordPlayerIndex >= 0 &&
      d.landlordPlayerIndex < n
    );
  }
  const ranks = d.holeOneRanks;
  return Array.isArray(ranks) && isPermutationOneToN(ranks, n);
}

/** 是否必须先完成抓阄才能记分 */
export function matchNeedsLottery(match: MatchRecord): boolean {
  return lotteryScenario(match) !== null && !isLotteryComplete(match);
}

export function shuffleHoleOneRanks(n: number): number[] {
  const arr = Array.from({ length: n }, (_, i) => i + 1);
  for (let i = n - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = t;
  }
  return arr;
}

export function randomLandlordIndex(n: number): number {
  return Math.floor(Math.random() * n);
}
