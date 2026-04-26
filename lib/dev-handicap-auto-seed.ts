import { loadHandicapRecords } from '@/lib/handicap';
import { replaceWithMockHandicapRounds } from '@/lib/mock-handicap-rounds';

/**
 * 开发构建：若本机尚无差点记录，自动写入 21 场随机 18 洞模拟成绩，
 * 便于测平均杆、微差、趋势等逻辑，无需手点「导入模拟数据」。
 *
 * 有任意已有记录时不动（含 E2E 预置数据、真机手填）。
 * 生产构建 `__DEV__ === false` 时不执行。
 */
export function ensureDevHandicapMock21IfEmpty(): void {
  if (!__DEV__) return;
  if (loadHandicapRecords().length > 0) return;
  replaceWithMockHandicapRounds(21);
}
