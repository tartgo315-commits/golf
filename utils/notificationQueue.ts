/**
 * 客户端触发服务端 flush 离线推送队列（与 PATCH user pushToken 内 flush 互补）。
 */

export function socialApiOrigin(): string | null {
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

/** App 回到前台时可调用，尝试把离线期间积压的推送发出 */
export async function requestNotificationFlush(deviceId: string): Promise<void> {
  const o = socialApiOrigin();
  if (!o || !deviceId.trim()) return;
  try {
    await fetch(`${o}/api/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'flush', deviceId: deviceId.trim() }),
    });
  } catch {
    /* ignore */
  }
}
