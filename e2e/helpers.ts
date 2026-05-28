import { expect, type BrowserContext, type Page } from '@playwright/test';

import { E2E_MOCK_PROFILE, E2E_MOCK_USER_ID } from '../constants/e2e-mock-session';

/** 与 `HANDICAP_RECORDS_KEY` 一致；Web 下 `loadHandicapRecords` 读 localStorage */
export const HANDICAP_STORAGE_KEY = 'handicapRecords';

export const HANDICAP_SEED = [
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
] as const;

const QUIZ_IRON_SEED = {
  category: 'iron',
  answers: { i1: 'often', i2: 'mid', i3: 'thin', i4: 'accurate' },
};

const USER_PROFILE_SEED = {
  swingSpeed: 95,
  handicap: 15,
  heightCm: 175,
  wristToFloor: 82,
  handCm: 18,
  yearsPlaying: 5,
  budget: 'mid',
  ballFlight: 'mid',
  shotShape: 'straight',
  tempo: 'mid',
  currentBrand: 'TaylorMade',
};

/** 仅预置本地差点/成绩（真人登录 E2E 用，不覆盖 profile） */
export async function seedHandicapRecordsOnly(context: BrowserContext) {
  await context.addInitScript(
    ([hcpKey, hcpData]) => {
      localStorage.setItem(hcpKey, JSON.stringify(hcpData));
    },
    [HANDICAP_STORAGE_KEY, HANDICAP_SEED] as const,
  );
}

export async function seedHandicapRecords(context: BrowserContext) {
  await context.addInitScript(
    ([hcpKey, hcpData, authProfileKey, authProfileData, quizKey, quizData, userProfileKey, userProfileData]) => {
      localStorage.setItem(hcpKey, JSON.stringify(hcpData));
      localStorage.setItem(authProfileKey, JSON.stringify(authProfileData));
      localStorage.setItem(quizKey, JSON.stringify(quizData));
      localStorage.setItem(userProfileKey, JSON.stringify(userProfileData));
    },
    [
      HANDICAP_STORAGE_KEY,
      HANDICAP_SEED,
      `@gca_profile_v1:${E2E_MOCK_USER_ID}`,
      E2E_MOCK_PROFILE,
      'last_quiz',
      QUIZ_IRON_SEED,
      'user_profile',
      USER_PROFILE_SEED,
    ] as const,
  );
}

/** 收集页面 console.error / pageerror，供冒烟报告 */
export function attachErrorCollector(page: Page) {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(`[console] ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => {
    errors.push(`[pageerror] ${err.message}`);
  });
  return errors;
}

export function assertNoCriticalConsoleErrors(errors: string[]) {
  const critical = errors.filter(
    (e) =>
      !e.includes('favicon') &&
      !e.includes('404') &&
      !e.includes('Failed to load resource') &&
      !e.includes('cannot be a descendant') &&
      !e.includes('cannot contain a nested'),
  );
  expect(critical, critical.join('\n')).toEqual([]);
}

export async function gotoAndWait(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
}
