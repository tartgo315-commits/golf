import { expect, type BrowserContext, type Page } from '@playwright/test';

import { E2E_MOCK_PROFILE } from '../constants/e2e-mock-session';

/** Web 端资料存 localStorage，预置后可跳过 profile-setup */
export async function seedProfileOnContext(context: BrowserContext, userId: string) {
  await context.addInitScript(
    ([profileKey, profileJson]) => {
      localStorage.setItem(profileKey, profileJson);
    },
    [`@gca_profile_v1:${userId}`, JSON.stringify(E2E_MOCK_PROFILE)] as const,
  );
}

export async function loginViaUi(
  page: Page,
  email: string,
  password: string,
  userId: string,
) {
  await seedProfileOnContext(page.context(), userId);
  await page.goto('/login');
  await expect(page.getByText('使用邮箱账号登录', { exact: true })).toBeVisible({ timeout: 30_000 });

  await page.getByPlaceholder('请输入邮箱').fill(email);
  await page.getByPlaceholder(/请输入密码/).fill(password);
  await page.getByText('登录', { exact: true }).click();

  await expect(page).toHaveURL(/login|profile-setup|\(tabs\)/, { timeout: 60_000 });

  if (page.url().includes('profile-setup')) {
    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByPlaceholder('e.g. 178').fill('175');
    await page.getByPlaceholder('e.g. 75').fill('72');
    await page.getByText('Save & continue', { exact: true }).click();
    await expect(page).not.toHaveURL(/profile-setup/, { timeout: 60_000 });
  }

  await expect(page).toHaveURL(/\/(\(tabs\)|$)/, { timeout: 60_000 });
}
