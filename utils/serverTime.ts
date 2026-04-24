const CACHE_MS = 10 * 60 * 1000;
const TAMPER_MS = 5 * 60 * 1000;

type CacheBag = { serverTs: number; localAtFetch: number; expiresAt: number };

let bag: CacheBag | null = null;
let inflight: Promise<void> | null = null;

function getTimestampRequestUrl(): string | null {
  const raw = typeof process !== 'undefined' ? process.env.EXPO_PUBLIC_TIMESTAMP_URL : undefined;
  const u = typeof raw === 'string' ? raw.trim().replace(/\/$/, '') : '';
  if (u.length > 0) {
    return u.endsWith('/api/timestamp') ? u : `${u}/api/timestamp`;
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api/timestamp`;
  }
  return null;
}

async function fetchServerTimestampOnce(): Promise<number> {
  const pathOrUrl = getTimestampRequestUrl();
  if (!pathOrUrl) throw new Error('no timestamp url');
  const url =
    pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')
      ? pathOrUrl
      : `https://${pathOrUrl}`;
  const r = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`timestamp http ${r.status}`);
  const j: unknown = await r.json();
  if (!j || typeof j !== 'object') throw new Error('timestamp bad json');
  const ts = Number((j as { ts?: unknown }).ts);
  if (!Number.isFinite(ts) || ts <= 0) throw new Error('timestamp bad ts');
  return Math.round(ts);
}

/** 当前推算的服务端「现在」毫秒；缓存过期或从未成功时返回 null */
export function getCachedServerNowMs(): number | null {
  if (!bag) return null;
  if (Date.now() > bag.expiresAt) return null;
  return bag.serverTs + (Date.now() - bag.localAtFetch);
}

async function pullFromServer(): Promise<void> {
  try {
    const serverTs = await fetchServerTimestampOnce();
    const localAtFetch = Date.now();
    bag = { serverTs, localAtFetch, expiresAt: localAtFetch + CACHE_MS };
  } catch {
    console.warn('[serverTime] 服务端时间获取失败，使用本地时间');
  }
}

/**
 * 获取当前服务端时间（毫秒）：优先缓存 + 本地单调推算；过期则请求。
 * 失败时回落为 Date.now()（不抛错）。
 */
export async function getServerTime(): Promise<number> {
  const hit = getCachedServerNowMs();
  if (hit != null) return hit;

  if (!inflight) {
    inflight = pullFromServer().finally(() => {
      inflight = null;
    });
  }
  await inflight;
  return getCachedServerNowMs() ?? Date.now();
}

/** 丢弃缓存并重新拉取（前后台切换、提交成绩等） */
export async function refreshServerTime(): Promise<number> {
  bag = null;
  return getServerTime();
}

/** App 启动预热，不阻塞 UI */
export function warmServerTime(): void {
  void getServerTime();
}

/** 设备时间与服务端相差超过 5 分钟 → true（仅提示，不强制锁） */
export async function isTimeTampered(): Promise<boolean> {
  const server = await getServerTime();
  const local = Date.now();
  return Math.abs(server - local) > TAMPER_MS;
}
