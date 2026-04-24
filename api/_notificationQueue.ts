/**
 * 离线推送队列（Vercel KV；无 KV 时进程内 Map，冷启动丢失）。
 * 规则：同一 toUserId + type 仅保留最新一条；超过 7 天丢弃。
 */

export type QueuedPush = {
  type: string;
  title: string;
  body: string;
  data: Record<string, string>;
  createdAt: number;
};

/** userId -> type -> payload */
export type OfflineQueueRoot = Record<string, Record<string, QueuedPush>>;

const QUEUE_KEY = 'gca_notify_offline_v1';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

let memQueue: OfflineQueueRoot = {};

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

async function loadQueue(): Promise<OfflineQueueRoot> {
  const raw = await upstash(['GET', QUEUE_KEY]);
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const o = JSON.parse(raw) as OfflineQueueRoot;
      return o && typeof o === 'object' ? o : {};
    } catch {
      return {};
    }
  }
  return memQueue;
}

async function saveQueue(q: OfflineQueueRoot): Promise<void> {
  memQueue = q;
  if (!getKvConfig()) return;
  await upstash(['SET', QUEUE_KEY, JSON.stringify(q)]);
}

function pruneUserMap(m: Record<string, QueuedPush>, now: number): Record<string, QueuedPush> {
  const out: Record<string, QueuedPush> = {};
  for (const [k, v] of Object.entries(m)) {
    if (now - v.createdAt <= MAX_AGE_MS) out[k] = v;
  }
  return out;
}

export async function enqueueOffline(toUserId: string, item: Omit<QueuedPush, 'createdAt'>): Promise<void> {
  const now = Date.now();
  const q = await loadQueue();
  const prev = q[toUserId] ?? {};
  const pruned = pruneUserMap(prev, now);
  pruned[item.type] = { ...item, createdAt: now };
  q[toUserId] = pruned;
  await saveQueue(q);
}

/** 取出该用户全部待发送并清空；返回前按 7 天过滤 */
export async function drainQueueForUser(toUserId: string): Promise<QueuedPush[]> {
  const now = Date.now();
  const q = await loadQueue();
  const raw = q[toUserId] ?? {};
  const pruned = pruneUserMap(raw, now);
  const list = Object.values(pruned);
  const next = { ...q };
  delete next[toUserId];
  await saveQueue(next);
  return list;
}
