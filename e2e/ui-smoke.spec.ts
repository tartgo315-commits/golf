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

test.describe('底部 Tab', () => {
  test('五个 Tab 可切换且不跳登录', async ({ page }) => {
    const errors = attachErrorCollector(page);
    await gotoAndWait(page, '/');

    await expect(page.getByText(/近期动态/)).toBeVisible({ timeout: 30_000 });

    await page.getByRole('tab', { name: '统计' }).click();
    await expect(page.getByText('平均杆数', { exact: true })).toBeVisible({ timeout: 15_000 });

    await page.getByRole('tab', { name: '球包' }).click();
    await expect(page.getByText('AI 配杆顾问')).toBeVisible();

    await page.getByRole('tab', { name: 'AI' }).click();
    await expect(page.getByText('AI 助手', { exact: true })).toBeVisible();

    await page.getByLabel('开局').click();
    await expect(page.getByText('新建一局')).toBeVisible();
    await gotoAndWait(page, '/(tabs)');
    await expect(page.getByText(/近期动态/)).toBeVisible();

    assertNoCriticalConsoleErrors(errors);
  });
});

test.describe('首页', () => {
  test('刷新与均杆展示', async ({ page }) => {
    await gotoAndWait(page, '/');
    await expect(page.getByText('87.5', { exact: false }).first()).toBeVisible({ timeout: 30_000 });
    await page.getByText('刷新').click();
    await expect(page.getByText(/近期动态/)).toBeVisible();
    await page.getByText('去关注', { exact: false }).click();
    await expect(page).toHaveURL(/friends/);
  });
});

test.describe('统计页', () => {
  test('分析子 Tab 可切换', async ({ page }) => {
    await gotoAndWait(page, '/score');
    await expect(page.getByText('87.5', { exact: false }).first()).toBeVisible();

    for (const label of ['开球', '攻果岭', '短杆', '推杆']) {
      const tab = page.getByText(label, { exact: true }).first();
      if (await tab.isVisible().catch(() => false)) {
        await tab.click();
        await page.waitForTimeout(200);
      }
    }
  });
});

test.describe('开局向导', () => {
  test('Step1–3：球场、球友跳过、赌法即将推出', async ({ page }) => {
    await gotoAndWait(page, '/bet');

    const courseInput = page.getByPlaceholder('搜索球场名称');
    await courseInput.fill('E2E Test Course');
    await courseInput.press('Enter');
    await page.waitForTimeout(600);

    await page.getByText('下一步', { exact: false }).click();
    const skipSolo = page.getByText('只记自己，跳过', { exact: true });
    await expect(skipSolo).toBeVisible({ timeout: 10_000 });
    await skipSolo.click();

    await page.getByText('🎲 赌球', { exact: true }).click();
    await expect(page.getByText('即将推出').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Nassau', { exact: true })).toBeVisible();
    await expect(page.getByText('单挑', { exact: true })).toBeVisible();
  });
});

test.describe('球包与子页面', () => {
  test('核心入口可打开', async ({ page }) => {
    const errors = attachErrorCollector(page);
    await gotoAndWait(page, '/fitting');

    await page.getByText('我的球杆库').click();
    await expect(page.getByText('我的球包', { exact: true })).toBeVisible({ timeout: 15_000 });

    await page.goBack();
    await gotoAndWait(page, '/fitting');
    await page.getByText('球杆推荐测验').click();
    await expect(page.getByText('一号木问卷', { exact: true })).toBeVisible({ timeout: 15_000 });

    await gotoAndWait(page, '/tools/swing-weight');
    await expect(page.getByRole('heading', { name: '挥重计算器' })).toBeVisible({ timeout: 10_000 });

    await gotoAndWait(page, '/tools/grip');
    await expect(page.getByRole('heading', { name: '握把选择' })).toBeVisible({ timeout: 10_000 });

    await gotoAndWait(page, '/tools/distance-gap');
    await expect(page.getByText('距离间距检查', { exact: true }).first()).toBeVisible({
      timeout: 10_000,
    });

    await gotoAndWait(page, '/(tabs)/compare');
    await expect(page.getByText('对比', { exact: true }).first()).toBeVisible({ timeout: 10_000 });

    await gotoAndWait(page, '/(tabs)/products');
    await expect(page.getByText('装备库', { exact: true })).toBeVisible({ timeout: 10_000 });

    await gotoAndWait(page, '/(tabs)/favorites');
    await expect(page.getByText('我的收藏', { exact: true })).toBeVisible({ timeout: 10_000 });

    const critical = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('404') && !e.includes('Failed to load resource'),
    );
    expect(critical, critical.join('\n')).toEqual([]);
  });
});

test.describe('设置与法律页', () => {
  test('设置与隐私条款可打开', async ({ page }) => {
    await gotoAndWait(page, '/settings');
    await expect(page.getByText('设置', { exact: false }).first()).toBeVisible({ timeout: 15_000 });

    await gotoAndWait(page, '/legal/privacy');
    await expect(page.getByText('隐私政策', { exact: true })).toBeVisible({ timeout: 10_000 });

    await gotoAndWait(page, '/legal/terms');
    await expect(page.getByText('用户协议', { exact: true })).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('AI 子页', () => {
  test('AI 顾问与训练入口', async ({ page }) => {
    await gotoAndWait(page, '/ai-advisor');
    await expect(page.getByText('AI 配杆顾问', { exact: true })).toBeVisible({ timeout: 15_000 });

    await gotoAndWait(page, '/ai-training');
    await expect(page.getByText('练球分析', { exact: true })).toBeVisible({ timeout: 15_000 });
  });
});
