/**
 * 好友 / 用户公开数据的持久化。
 *
 * - 优先：Vercel KV（Upstash REST，无需 @vercel/kv 包），环境变量 KV_REST_API_URL + KV_REST_API_TOKEN
 * - 否则：进程内内存（冷启动丢失，仅本地/单实例调试）
 *
 * TODO: 若需跨多函数/多区域强一致，可迁移至 Vercel Blob 存单一 JSON（或引入 @vercel/kv 官方 SDK）。
 */

export type SocialUser = {
  userId: string;
  deviceId: string;
  name: string;
  inviteCode: string;
  joinedAt: number;
  handicap: number | null;
  roundsCount: number;
  trendHi: number[];
  /** 用于走势对比的 (日期, 差点指数) */
  trendPoints: { date: string; hi: number }[];
  recentRounds: { date: string; gross: number; holes: 9 | 18 }[];
  /** Expo Push Token，仅服务端存储 */
  pushToken?: string | null;
};

export type FriendRequestRow = {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: number;
};

export type SocialState = {
  users: Record<string, SocialUser>;
  deviceToUserId: Record<string, string>;
  inviteToUserId: Record<string, string>;
  friendPairs: string[];
  requests: FriendRequestRow[];
};

const STATE_KEY = 'gca_social_state_v1';

let memFallback: SocialState | null = null;
let chain: Promise<unknown> = Promise.resolve();

function emptyState(): SocialState {
  return {
    users: {},
    deviceToUserId: {},
    inviteToUserId: {},
    friendPairs: [],
    requests: [],
  };
}

function getKvConfig(): { url: string; token: string } | null {
  const url = typeof process !== 'undefined' ? process.env.KV_REST_API_URL?.trim() : '';
  const token = typeof process !== 'undefined' ? process.env.KV_REST_API_TOKEN?.trim() : '';
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ''), token };
}

async function upstash(cmd: (string | number)[]): Promise<unknown> {
  const c = getKvConfig();
  if (!c) return null;
  const res = await fetch(c.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${c.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { result?: unknown };
  return j.result ?? null;
}

async function loadFromKv(): Promise<SocialState | null> {
  const raw = await upstash(['GET', STATE_KEY]);
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const o = JSON.parse(raw) as SocialState;
    if (!o || typeof o !== 'object' || !o.users) return null;
    return {
      users: o.users ?? {},
      deviceToUserId: o.deviceToUserId ?? {},
      inviteToUserId: o.inviteToUserId ?? {},
      friendPairs: Array.isArray(o.friendPairs) ? o.friendPairs : [],
      requests: Array.isArray(o.requests) ? o.requests : [],
    };
  } catch {
    return null;
  }
}

async function saveToKv(state: SocialState): Promise<void> {
  if (!getKvConfig()) return;
  const payload = JSON.stringify(state);
  await upstash(['SET', STATE_KEY, payload]);
}

async function loadState(): Promise<SocialState> {
  const fromKv = await loadFromKv();
  if (fromKv) return fromKv;
  if (memFallback) return memFallback;
  return emptyState();
}

async function saveState(s: SocialState): Promise<void> {
  memFallback = s;
  await saveToKv(s);
}

export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|||${b}` : `${b}|||${a}`;
}

/** 只读加载（不写入 KV），供推送等读取 pushToken */
export async function readSocialState(): Promise<SocialState> {
  return loadState();
}

export function withSocialState<T>(fn: (s: SocialState) => T | Promise<T>): Promise<T> {
  const run = async (): Promise<T> => {
    const s = await loadState();
    const out = await fn(s);
    await saveState(s);
    return out;
  };
  const p = chain.then(run, run) as Promise<T>;
  chain = p.then(
    () => undefined,
    () => undefined,
  );
  return p;
}
