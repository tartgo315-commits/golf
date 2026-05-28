import { test, expect } from '@playwright/test';

import { gotoAndWait, seedHandicapRecords } from './helpers';

test.beforeEach(async ({ context }) => {
  await seedHandicapRecords(context);
});

test('球包编辑模式展示 AI 补全按钮', async ({ page }) => {
  await gotoAndWait(page, '/my-bag?from=fitting');
  await expect(page.getByText('我的球包', { exact: true })).toBeVisible();

  await page.getByText('编辑', { exact: true }).click();
  await page.getByText('木杆', { exact: true }).click();
  await page.getByText('1号木', { exact: true }).first().click();

  await expect(page.getByLabel('AI 补全出厂规格')).toBeVisible({ timeout: 10_000 });
});

test('AI 补全未配置 Key 时提示', async ({ page }) => {
  await gotoAndWait(page, '/my-bag?from=fitting');
  await page.getByText('编辑', { exact: true }).click();
  await page.getByText('木杆', { exact: true }).click();
  await page.getByText('1号木', { exact: true }).first().click();

  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toMatch(/DeepSeek API Key/);
    await dialog.accept();
  });

  await page.getByLabel('AI 补全出厂规格').click();
  await page.waitForTimeout(800);
});
