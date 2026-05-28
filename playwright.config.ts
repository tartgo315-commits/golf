import path from 'node:path';

import { chromium, defineConfig, devices } from '@playwright/test';

/** 浏览器装到仓库内，避免沙箱/多环境下去用户目录找错路径 */
process.env.PLAYWRIGHT_BROWSERS_PATH ??= path.join(
  process.cwd(),
  'node_modules',
  '.playwright-browsers',
);

const expoWeb =
  process.platform === 'win32'
    ? (port: number, bypass: boolean) =>
        bypass
          ? `cmd /c "set EXPO_PUBLIC_E2E_AUTH_BYPASS=1&& npx expo start --web --port ${port}"`
          : `npx expo start --web --port ${port}`
    : (port: number, bypass: boolean) =>
        bypass
          ? `EXPO_PUBLIC_E2E_AUTH_BYPASS=1 npx expo start --web --port ${port}`
          : `npx expo start --web --port ${port}`;

/**
 * E2E：8100 带鉴权绕过 + 模拟 Session；8101 无绕过（测登录门禁）。
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
    trace: 'on-first-retry',
    launchOptions: { executablePath: chromium.executablePath() },
  },
  projects: [
    {
      name: 'auth-gate',
      testMatch: /auth-gate\.spec\.ts$/,
      use: { baseURL: 'http://localhost:8101' },
    },
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts$/,
      timeout: 120_000,
      use: { baseURL: 'http://localhost:8101' },
    },
    {
      name: 'logged-in',
      testMatch: /logged-in-smoke\.spec\.ts$/,
      dependencies: ['setup'],
      use: {
        baseURL: 'http://localhost:8101',
        storageState: 'e2e/.auth/user.json',
      },
    },
    {
      name: 'auth-login',
      testMatch: /auth-login-real\.spec\.ts$/,
      use: { baseURL: 'http://localhost:8101' },
      fullyParallel: false,
    },
    {
      name: 'app',
      testMatch: /^(?!.*(auth-gate|auth-login-real|logged-in-smoke|auth\.setup)).*\.spec\.ts$/,
      use: { baseURL: 'http://localhost:8100' },
    },
  ],
  webServer: [
    {
      command: expoWeb(8100, true),
      url: 'http://localhost:8100',
      reuseExistingServer: false,
      timeout: 180_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: expoWeb(8101, false),
      url: 'http://localhost:8101',
      reuseExistingServer: false,
      timeout: 180_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});
