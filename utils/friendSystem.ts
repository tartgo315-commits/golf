import AsyncStorage from '@react-native-async-storage/async-storage';

import { buildHandicapTrend, calcHandicapIndex, loadHandicapRecords } from '@/lib/handicap';
import { getOrCreateDeviceUserId } from '@/utils/userIdentity';

const KEY_USER_ID = '@gca_social_user_id_v1';
const KEY_INVITE = '@gca_social_invite_code_v1';
const KEY_DISPLAY_NAME = '@gca_social_display_name_v1';
const KEY_FRIENDS_CACHE = '@gca_friends_cache_v1';
const CACHE_MS = 5 * 60 * 1000;

export type PublicUserProfile = {
  userId: string;
  name: string;
  handicap: number | null;
  roundsCount: number;
  joinedAt: number;
  trendHi: number[];
  trendPoints: { date: string; hi: number }[];
  recentRounds: { date: string; gross: number; holes: 9 | 18 }[];
};

export type FriendListItem = PublicUserProfile;

export type FriendRequestIncoming = {
  id: string;
  fromUserId: string;
  fromName: string;
  createdAt: number;
};

function apiOrigin(): string | null {
  const raw = typeof process !== 'undefined' ? process.env.EXPO_PUBLIC_SOCIAL_API_URL : undefined;
  const a = typeof raw === 'string' ? raw.trim().replace(/\/$/, '') : '';
  if (a.length > 0) return a;
  const ts = typeof process !== 'undefined' ? process.env.EXPO_PUBLIC_TIMESTAMP_URL : undefined;
  const t = typeof ts === 'string' ? ts.trim().replace(/\/$/, '') : '';
  if (t.length > 0) {
    if (t.endsWith('/api/timestamp')) return t.slice(0, -'/api/timestamp'.length);
    return t.replace(/\/api\/[^/]+$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
  return null;
}

function userUrl(): string | null {
  const o = apiOrigin();
  return o ? `${o}/api/user` : null;
}

function friendUrl(): string | null {
  const o = apiOrigin();
  return o ? `${o}/api/friend` : null;
}

async function parseJson(res: Response): Promise<unknown> {
  const t = await res.text();
  try {
    return JSON.parse(t) as unknown;
  } catch {
    return null;
  }
}

/** 设备级 ID（与 userIdentity 共用存储） */
export async function getMyUserId(): Promise<string> {
  const existing = await AsyncStorage.getItem(KEY_USER_ID);
  if (existing && existing.trim()) return existing.trim();
  await ensureRegisteredOnServer();
  const again = await AsyncStorage.getItem(KEY_USER_ID);
  return again?.trim() ?? '';
}

export async function getMyInviteCode(): Promise<string> {
  const c = await AsyncStorage.getItem(KEY_INVITE);
  if (c && c.trim().length === 6) return c.trim().toUpperCase();
  await ensureRegisteredOnServer();
  const again = await AsyncStorage.getItem(KEY_INVITE);
  return again?.trim().toUpperCase() ?? '------';
}

export async function setSocialDisplayName(name: string): Promise<void> {
  const n = name.trim() || '球友';
  await AsyncStorage.setItem(KEY_DISPLAY_NAME, n);
}

async function readDisplayName(): Promise<string> {
  const n = await AsyncStorage.getItem(KEY_DISPLAY_NAME);
  return n?.trim() || '球友';
}

export async function ensureRegisteredOnServer(): Promise<{ userId: string; inviteCode: string } | null> {
  const base = userUrl();
  if (!base) return null;
  const deviceId = await getOrCreateDeviceUserId();
  const name = await readDisplayName();
  try {
    const res = await fetch(base, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, deviceId }),
    });
    const j = (await parseJson(res)) as { userId?: string; inviteCode?: string; error?: string } | null;
    if (!res.ok || !j?.userId || !j?.inviteCode) return null;
    await AsyncStorage.setItem(KEY_USER_ID, j.userId);
    await AsyncStorage.setItem(KEY_INVITE, j.inviteCode);
    return { userId: j.userId, inviteCode: j.inviteCode };
  } catch {
    return null;
  }
}

/** 上传公开差点摘要（不含逐洞），供好友对比 */
export async function syncPublicHandicapToServer(): Promise<boolean> {
  const base = userUrl();
  if (!base) return false;
  const deviceId = await getOrCreateDeviceUserId();
  const registered = await AsyncStorage.getItem(KEY_USER_ID);
  if (!registered) await ensureRegisteredOnServer();
  const records = loadHandicapRecords();
  const handicap = calcHandicapIndex(records);
  const trend = buildHandicapTrend(records);
  const trendPoints = trend
    .filter((x): x is { date: string; index: number } => typeof x.index === 'number')
    .map((x) => ({ date: x.date, hi: x.index }));
  const trendHi = trendPoints.map((p) => p.hi);
  const recentRounds = [...records]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, 24)
    .map((r) => ({
      date: r.date,
      gross: r.adjustedGrossScore,
      holes: r.holes as 9 | 18,
    }));
  try {
    const res = await fetch(base, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        op: 'syncPublic',
        deviceId,
        handicap,
        roundsCount: records.length,
        trendHi,
        trendPoints,
        recentRounds,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

type FriendsCache = { at: number; friends: FriendListItem[] };

async function readFriendsCache(): Promise<FriendListItem[] | null> {
  const raw = await AsyncStorage.getItem(KEY_FRIENDS_CACHE);
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as FriendsCache;
    if (!o || typeof o.at !== 'number' || !Array.isArray(o.friends)) return null;
    if (Date.now() - o.at > CACHE_MS) return null;
    return o.friends;
  } catch {
    return null;
  }
}

async function writeFriendsCache(friends: FriendListItem[]): Promise<void> {
  const payload: FriendsCache = { at: Date.now(), friends };
  await AsyncStorage.setItem(KEY_FRIENDS_CACHE, JSON.stringify(payload));
}

export function invalidateFriendsCache(): void {
  void AsyncStorage.removeItem(KEY_FRIENDS_CACHE);
}

export async function getFriendList(force = false): Promise<FriendListItem[]> {
  if (!force) {
    const c = await readFriendsCache();
    if (c) return c;
  }
  const base = friendUrl();
  const myId = await getMyUserId();
  if (!base || !myId) return [];
  try {
    const res = await fetch(`${base}?list=1&userId=${encodeURIComponent(myId)}`);
    const j = (await parseJson(res)) as { friends?: FriendListItem[] } | null;
    const friends = Array.isArray(j?.friends) ? j!.friends! : [];
    await writeFriendsCache(friends);
    return friends;
  } catch {
    return [];
  }
}

export async function getFriendRequests(): Promise<FriendRequestIncoming[]> {
  const base = friendUrl();
  const myId = await getMyUserId();
  if (!base || !myId) return [];
  try {
    const res = await fetch(`${base}?requests=1&userId=${encodeURIComponent(myId)}`);
    const j = (await parseJson(res)) as { requests?: FriendRequestIncoming[] } | null;
    return Array.isArray(j?.requests) ? j!.requests! : [];
  } catch {
    return [];
  }
}

export async function previewUserByInviteCode(inviteCode: string): Promise<PublicUserProfile | null> {
  const base = userUrl();
  if (!base) return null;
  const code = inviteCode.trim().toUpperCase();
  if (code.length !== 6) return null;
  try {
    const res = await fetch(`${base}?inviteCode=${encodeURIComponent(code)}`);
    if (!res.ok) return null;
    const j = (await parseJson(res)) as PublicUserProfile | null;
    if (!j || typeof j.userId !== 'string') return null;
    return j;
  } catch {
    return null;
  }
}

export async function addFriendByCode(inviteCode: string): Promise<{ ok: true; requestId: string } | { ok: false; message: string }> {
  const base = friendUrl();
  const myId = await getMyUserId();
  if (!base || !myId) return { ok: false, message: '未配置社交 API' };
  try {
    const res = await fetch(base, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'add', myUserId: myId, inviteCode: inviteCode.trim().toUpperCase() }),
    });
    const j = (await parseJson(res)) as { requestId?: string; error?: string } | null;
    if (!res.ok) return { ok: false, message: typeof j?.error === 'string' ? j.error : '添加失败' };
    const requestId = typeof j?.requestId === 'string' ? j.requestId : '';
    if (!requestId) return { ok: false, message: '无效响应' };
    invalidateFriendsCache();
    return { ok: true, requestId };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : '网络错误' };
  }
}

export async function respondFriendRequest(
  requestId: string,
  action: 'accept' | 'reject',
): Promise<boolean> {
  const base = friendUrl();
  const myId = await getMyUserId();
  if (!base || !myId) return false;
  try {
    const res = await fetch(base, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'respond', myUserId: myId, requestId, action }),
    });
    if (res.ok) invalidateFriendsCache();
    return res.ok;
  } catch {
    return false;
  }
}

export async function removeFriend(friendUserId: string): Promise<boolean> {
  const base = friendUrl();
  const myId = await getMyUserId();
  if (!base || !myId) return false;
  try {
    const res = await fetch(
      `${base}?userId=${encodeURIComponent(myId)}&friendId=${encodeURIComponent(friendUserId)}`,
      { method: 'DELETE' },
    );
    if (res.ok) invalidateFriendsCache();
    return res.ok;
  } catch {
    return false;
  }
}

export async function getFriendPublicProfile(friendId: string): Promise<PublicUserProfile | null> {
  const base = userUrl();
  if (!base) return null;
  try {
    const res = await fetch(`${base}?id=${encodeURIComponent(friendId)}`);
    if (!res.ok) return null;
    const j = (await parseJson(res)) as PublicUserProfile | null;
    if (!j || typeof j.userId !== 'string') return null;
    return j;
  } catch {
    return null;
  }
}

/** 好友差点历史（仅服务端存的公开摘要） */
export async function getFriendHandicapHistory(friendId: string): Promise<{ trendPoints: { date: string; hi: number }[]; recentRounds: PublicUserProfile['recentRounds'] }> {
  const p = await getFriendPublicProfile(friendId);
  if (!p) return { trendPoints: [], recentRounds: [] };
  return { trendPoints: p.trendPoints ?? [], recentRounds: p.recentRounds ?? [] };
}

export async function patchMyProfileName(name: string): Promise<boolean> {
  const base = userUrl();
  if (!base) return false;
  const deviceId = await getOrCreateDeviceUserId();
  try {
    const res = await fetch(base, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, name: name.trim() || '球友' }),
    });
    if (res.ok) await setSocialDisplayName(name);
    return res.ok;
  } catch {
    return false;
  }
}
