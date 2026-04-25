import path from 'node:path';

import { chromium, defineConfig, devices } from '@playwright/test';

/** 浏览器装到仓库内，避免沙箱/多环境下去用户目录找错路径 */
process.env.PLAYWRIGHT_BROWSERS_PATH ??= path.join(
  process.cwd(),
  'node_modules',
  '.playwright-browsers',
);

/**
 * E2E：启动 Expo Web（与开发时 `expo start --web` 一致）。
 * CI 中设置 `CI=1` 时不会复用已有进程，便于干净跑通。
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list']],
  timeout: 60_000,
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://localhost:8100',
    trace: 'on-first-retry',
    /** 使用已下载的完整 Chromium，避免依赖易下载失败的 headless-shell 包 */
    launchOptions: { executablePath: chromium.executablePath() },
  },
  webServer: {
    command: 'npx expo start --web --port 8100',
    url: 'http://localhost:8100',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
