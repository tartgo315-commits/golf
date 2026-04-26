import { loadHandicapRecords } from '@/lib/handicap';
import { replaceWithMockHandicapRounds } from '@/lib/mock-handicap-rounds';

function demoSeedFromEnv(): boolean {
  const v = process.env.EXPO_PUBLIC_DEMO_SEED_HANDICAP;
  return v === '1' || v === 'true';
}

/** Cloudflare Pages 等线上公测：固定域名下每次启动覆盖为 21 场，避免旧缓存只剩少数场次 */
function isBundledPublicDemoWebHost(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.location.hostname === 'golf-3c6.pages.dev';
  } catch {
    return false;
  }
}

/**
 * - 公测 / 演示：环境变量 `EXPO_PUBLIC_DEMO_SEED_HANDICAP=1`，或 Web 域名为 `golf-3c6.pages.dev` 时，
 *   每次冷启动用 21 场模拟成绩**覆盖**本地 `handicapRecords`（便于展示统计与计算逻辑）。
 * - 开发构建：否则若 `__DEV__` 且尚无记录，则写入 21 场（不覆盖 E2E / 手填数据）。
 */
export function ensureHandicapSeedOnLaunch(): void {
  if (demoSeedFromEnv() || isBundledPublicDemoWebHost()) {
    replaceWithMockHandicapRounds(21);
    return;
  }
  if (!__DEV__) return;
  if (loadHandicapRecords().length > 0) return;
  replaceWithMockHandicapRounds(21);
}
