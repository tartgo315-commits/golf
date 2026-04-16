/**
 * 成绩分析顶栏与首页（index）对齐的汇总口径说明与纯函数。
 *
 * - 差点指数：与首页相同，对窗口内 HandicapRecord 调用 `calcHandicapIndex`（内部取最近 20 场微差 + ×0.96）。
 * - 均杆 / 最佳 / 最差（顶栏）：使用每场 **adjustedGrossScore**（WHS 封顶杆），不用逐洞 gross 总杆。
 * - 「全部」窗口下，均杆与极值与首页一致：只取 **时间倒序下最近 20 场**（与首页 `recent20` 一致）。
 * - 「近5/10/20」：取当前窗口内场次做均杆与极值；Tab 内详细统计仍由 `computeAllStats` 基于 RoundData。
 */
import type { HandicapRecord } from '@/lib/handicap';
import type { RoundWindow } from '@/src/utils/statsEngine';

function toDateMs(date: string): number {
  const t = Date.parse(date);
  return Number.isFinite(t) ? t : 0;
}

/**
 * 顶栏「Avg Score / Best-Worst」所用切片（新→旧）。
 * window=all 时固定最多 20 场，与 `app/(tabs)/index.tsx` 的 recent20 一致。
 */
export function summaryBarAdjustedSlice(recs: HandicapRecord[], windowKey: RoundWindow): HandicapRecord[] {
  const sorted = [...recs].sort((a, b) => toDateMs(b.date) - toDateMs(a.date));
  if (windowKey === 'all') {
    return sorted.slice(0, 20);
  }
  const lim = windowKey === 'last5' ? 5 : windowKey === 'last10' ? 10 : 20;
  return sorted.slice(0, Math.min(lim, sorted.length));
}

/** 基于 adjusted gross 的整数均杆与极值（与首页卡片一致） */
export function adjustedGrossCoreSummary(recs: HandicapRecord[]): {
  avg: number | null;
  best: number | null;
  worst: number | null;
} {
  if (!recs.length) return { avg: null, best: null, worst: null };
  const nums = recs.map((r) => r.adjustedGrossScore).filter((x) => Number.isFinite(x) && x > 0);
  if (!nums.length) return { avg: null, best: null, worst: null };
  return {
    avg: Math.round(nums.reduce((a, b) => a + b, 0) / nums.length),
    best: Math.min(...nums),
    worst: Math.max(...nums),
  };
}
