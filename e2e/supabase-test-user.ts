import fs from 'node:fs';
import path from 'node:path';

import { E2E_MOCK_PROFILE, E2E_MOCK_USER_ID } from '../constants/e2e-mock-session';

const SUPABASE_URL = 'https://dijllaixwfoevnpwmcwd.supabase.co';
const ANON_KEY = 'sb_publishable_H-DyvobUmBBm0iMGsY6fEg_sZULm4r3';

const CREDENTIALS_PATH = path.join(process.cwd(), 'e2e', '.auth', 'credentials.json');

export type E2eCredentials = { email: string; password: string; userId: string };

const DEFAULT_EMAIL =
  process.env.E2E_TEST_EMAIL?.trim() || 'e2e.automation@golfclubadvisor.test';
const DEFAULT_PASSWORD = process.env.E2E_TEST_PASSWORD?.trim() || 'E2eAutomationPass123!';

type AuthResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
  msg?: string;
  user?: { id?: string };
};

async function authPost(
  pathSuffix: string,
  body: Record<string, unknown>,
): Promise<AuthResponse & { error_code?: string }> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1${pathSuffix}`, {
    method: 'POST',
    headers: {
      apikey: ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as AuthResponse & { error_code?: string };
  return json;
}

async function signIn(email: string, password: string): Promise<AuthResponse> {
  return authPost('/token?grant_type=password', { email, password });
}

async function signUp(email: string, password: string): Promise<AuthResponse> {
  return authPost('/signup', {
    email,
    password,
    data: { nickname: 'E2E Automation' },
  });
}

/** 确保存在可登录的 E2E 账号（先登录，失败则注册；已存在则再登录） */
export async function ensureE2eTestUser(): Promise<E2eCredentials> {
  const email = DEFAULT_EMAIL;
  const password = DEFAULT_PASSWORD;

  const inRes = await signIn(email, password);
  if (inRes.access_token) {
    const userId = inRes.user?.id ?? E2E_MOCK_USER_ID;
    writeCredentials({ email, password, userId });
    return { email, password, userId };
  }

  const upRes = await signUp(email, password);
  if (upRes.access_token) {
    const userId = upRes.user?.id ?? E2E_MOCK_USER_ID;
    writeCredentials({ email, password, userId });
    return { email, password, userId };
  }

  if (upRes.error_code === 'user_already_exists' || upRes.msg?.includes('already')) {
    const retry = await signIn(email, password);
    if (retry.access_token) {
      const userId = retry.user?.id ?? E2E_MOCK_USER_ID;
      writeCredentials({ email, password, userId });
      return { email, password, userId };
    }
  }

  throw new Error(
    `E2E 测试账号不可用: ${upRes.error_description ?? upRes.msg ?? upRes.error ?? 'unknown'}`,
  );
}

function writeCredentials(creds: E2eCredentials) {
  fs.mkdirSync(path.dirname(CREDENTIALS_PATH), { recursive: true });
  fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify(creds, null, 2), 'utf8');
}

export function readStoredCredentials(): E2eCredentials {
  return JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8')) as E2eCredentials;
}
