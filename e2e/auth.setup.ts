import { expect, test as setup } from '@playwright/test';

import { loginViaUi } from './auth-flow';
import { ensureE2eTestUser } from './supabase-test-user';

const AUTH_FILE = 'e2e/.auth/user.json';

setup.setTimeout(120_000);

/**
 * 真人式登录：打开登录页 → 填邮箱/密码 → 点登录 →（如需）资料页 → 保存 Cookie/localStorage
 */
setup('真人式登录并保存会话', async ({ page }) => {
  const { email, password, userId } = await ensureE2eTestUser();
  await loginViaUi(page, email, password, userId);
  await expect(page.getByText(/近期动态/)).toBeVisible({ timeout: 30_000 });
  await page.context().storageState({ path: AUTH_FILE });
});
