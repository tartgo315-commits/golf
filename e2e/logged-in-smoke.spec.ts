import { test, expect } from '@playwright/test';

import { gotoAndWait } from './helpers';

/**
 * 使用 auth.setup 保存的真实 Supabase 会话（storageState），无 AUTH_GATE_BYPASSED。
 */
test.describe('已登录态冒烟', () => {
  test('首页与球包 Tab', async ({ page }) => {
    await gotoAndWait(page, '/(tabs)');
    await expect(page.getByText(/近期动态/)).toBeVisible({ timeout: 30_000 });

    await page.getByRole('tab', { name: '球包' }).click();
    await expect(page.getByText('AI 配杆顾问')).toBeVisible();
  });

  test('开局 Tab 可打开新建一局', async ({ page }) => {
    await gotoAndWait(page, '/(tabs)');
    await page.getByLabel('开局').click();
    await expect(page.getByText('新建一局')).toBeVisible();
  });

  test('设置页可打开', async ({ page }) => {
    await gotoAndWait(page, '/settings');
    await expect(page.getByText('设置', { exact: false }).first()).toBeVisible({ timeout: 15_000 });
  });
});
