import { expect, test } from '@playwright/test';

import { loginViaUi } from './auth-flow';
import { seedHandicapRecordsOnly } from './helpers';
import { ensureE2eTestUser } from './supabase-test-user';

test.describe.configure({ mode: 'serial' });

test.describe('真人式 UI 登录', () => {
  test.setTimeout(120_000);

  test('填表登录后进入首页', async ({ page }) => {
    const { email, password, userId } = await ensureE2eTestUser();
    await loginViaUi(page, email, password, userId);
    await expect(page.getByText(/近期动态/)).toBeVisible({ timeout: 30_000 });
  });

  test('登录后统计 Tab 可打开', async ({ page }) => {
    const { email, password, userId } = await ensureE2eTestUser();
    await seedHandicapRecordsOnly(page.context());
    await loginViaUi(page, email, password, userId);
    await page.getByRole('tab', { name: '统计' }).click();
    await expect(page.getByText('平均杆数', { exact: true })).toBeVisible({ timeout: 15_000 });
  });
});
