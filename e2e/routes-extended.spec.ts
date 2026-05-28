import { test, expect } from '@playwright/test';

import {
  attachErrorCollector,
  assertNoCriticalConsoleErrors,
  gotoAndWait,
  seedHandicapRecords,
} from './helpers';

test.beforeEach(async ({ context }) => {
  await seedHandicapRecords(context);
});

test.describe('差点与记分', () => {
  test('差点首页与历史、详情', async ({ page }) => {
    await gotoAndWait(page, '/handicap');
    await expect(page.getByText('差点', { exact: true }).first()).toBeVisible();

    await gotoAndWait(page, '/handicap/history?from=score');
    await expect(page.getByText('全部场次', { exact: true })).toBeVisible();

    await gotoAndWait(page, '/handicap/e2e-eighteen?from=score');
    await expect(page.getByText('成绩详情', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('E2E 18', { exact: true })).toBeVisible();
  });

  test('手动记分入口', async ({ page }) => {
    await gotoAndWait(page, '/scorecard');
    await expect(page.getByText('我的记录', { exact: true })).toBeVisible();
  });

  test('统计页场次记录进详情', async ({ page }) => {
    await gotoAndWait(page, '/score');
    await page.getByText('E2E 18', { exact: true }).click();
    await expect(page.getByText('成绩详情', { exact: true }).first()).toBeVisible({
      timeout: 15_000,
    });
  });
});

test.describe('训练与策略', () => {
  test('训练计划与球场策略', async ({ page }) => {
    await gotoAndWait(page, '/training');
    await expect(page.getByText('训练计划', { exact: true })).toBeVisible();

    await gotoAndWait(page, '/course-strategy');
    await expect(page.getByText('下场策略', { exact: true })).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('社交与对局', () => {
  test('球友与对局历史', async ({ page }) => {
    const errors = attachErrorCollector(page);
    await gotoAndWait(page, '/friends');
    await expect(page.getByText('球友', { exact: true })).toBeVisible();

    await gotoAndWait(page, '/match/history');
    await expect(page.getByText('历史比赛', { exact: true })).toBeVisible({ timeout: 10_000 });

    assertNoCriticalConsoleErrors(errors);
  });
});

test.describe('问卷结果页', () => {
  test('铁杆问卷与结果路由', async ({ page }) => {
    await gotoAndWait(page, '/quiz/iron');
    await expect(page.getByText('铁杆问卷', { exact: true })).toBeVisible({ timeout: 10_000 });

    await gotoAndWait(page, '/result/iron');
    await expect(page.getByText('铁杆推荐结果', { exact: true })).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('设置子页', () => {
  test('个人资料设置', async ({ page }) => {
    await gotoAndWait(page, '/settings/profile');
    await expect(page.getByText('个人档案', { exact: true })).toBeVisible({ timeout: 10_000 });
  });
});
