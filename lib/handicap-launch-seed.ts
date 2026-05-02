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
 * 已不再由 `app/_layout` 在启动时调用，避免覆盖用户真实成绩。
 * 若需在脚本或临时调试中灌入，可手动 import 并调用；公测域名 / `EXPO_PUBLIC_DEMO_SEED_HANDICAP` 行为如下（均为**覆盖**写入）。
 */
export async function ensureHandicapSeedOnLaunch(): Promise<void> {
  if (demoSeedFromEnv() || isBundledPublicDemoWebHost()) {
    await replaceWithMockHandicapRounds(21);
    return;
  }
  if (!__DEV__) return;
  const records = await loadHandicapRecords();
  if (records.length > 0) return;
  await replaceWithMockHandicapRounds(21);
}
