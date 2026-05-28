import { test, expect } from '@playwright/test';

import { gotoAndWait } from './helpers';

test.describe('未登录门禁', () => {
  test('根路径跳转登录页', async ({ page }) => {
    await gotoAndWait(page, '/');
    await expect(page).toHaveURL(/login/);
    await expect(page.getByText('使用邮箱账号登录', { exact: true })).toBeVisible();
    await expect(page.getByPlaceholder('请输入邮箱')).toBeVisible();
  });

  test('注册页表单', async ({ page }) => {
    await gotoAndWait(page, '/register');
    await expect(page.getByText('注册账号', { exact: true })).toBeVisible();
    await expect(page.getByPlaceholder('请输入昵称')).toBeVisible();
  });

  test('登录页可进注册', async ({ page }) => {
    await gotoAndWait(page, '/login');
    await page.getByText('去注册', { exact: true }).click();
    await expect(page).toHaveURL(/register/);
  });
});

