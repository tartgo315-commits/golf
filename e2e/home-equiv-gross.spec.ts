import { test, expect } from '@playwright/test';

/** 与 `HANDICAP_RECORDS_KEY` 一致；Web 下 `loadHandicapRecords` 读 localStorage */
const STORAGE_KEY = 'handicapRecords';

const SEED = [
  {
    id: 'e2e-nine',
    date: '2026-04-01',
    courseName: 'E2E 9',
    courseRating: 72,
    slopeRating: 113,
    adjustedGrossScore: 45,
    holes: 9,
    scoreDifferential: 10,
    notes: '',
    holeDetails: [],
    totalPutts: 16,
    fairwaysHit: null,
    fairwaysTotal: null,
    greensInRegulation: null,
    front9Strokes: 0,
    back9Strokes: 0,
    handicapProcessed: true,
    submittedAt: 1,
  },
  {
    id: 'e2e-eighteen',
    date: '2026-04-02',
    courseName: 'E2E 18',
    courseRating: 72,
    slopeRating: 113,
    adjustedGrossScore: 85,
    holes: 18,
    scoreDifferential: 12,
    notes: '',
    holeDetails: [],
    totalPutts: 32,
    fairwaysHit: 6,
    fairwaysTotal: 12,
    greensInRegulation: 9,
    front9Strokes: 0,
    back9Strokes: 0,
    handicapProcessed: true,
    submittedAt: 1,
  },
];

test.beforeEach(async ({ context }) => {
  await context.addInitScript(
    ([key, data]) => {
      localStorage.setItem(key, JSON.stringify(data));
    },
    [STORAGE_KEY, SEED] as const,
  );
});

test('首页近期均杆为等效18洞平均 (45×2+85)/2 = 87.5', async ({ page }) => {
  await page.goto('/(tabs)');
  await expect(page.getByText('87.5', { exact: false })).toBeVisible({ timeout: 60_000 });
});

test('统计分析页平均杆数与等效场均一致', async ({ page }) => {
  await page.goto('/score');
  await expect(page.getByText('87.5', { exact: false })).toBeVisible({ timeout: 60_000 });
});
