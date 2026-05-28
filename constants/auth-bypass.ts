/**
 * 为 false 时：未登录进 /login，与网页版账号一致（Supabase session）。
 * 仅本地调试若需跳过登录，可临时改为 true（勿提交）。
 * Playwright E2E 通过 `EXPO_PUBLIC_E2E_AUTH_BYPASS=1` 启用（见 playwright.config.ts）。
 */
export const AUTH_GATE_BYPASSED =
  process.env.EXPO_PUBLIC_E2E_AUTH_BYPASS === '1' || false;
