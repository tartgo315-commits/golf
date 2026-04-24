import type { AmendmentRequest } from '@/utils/amendmentTypes';

export type { AmendmentRequest } from '@/utils/amendmentTypes';

import { clearRoundAmendmentUnlock, markRoundAmendmentUnlocked } from '@/utils/amendmentUnlockStorage';

function amendmentApiUrl(): string | null {
  const raw = typeof process !== 'undefined' ? process.env.EXPO_PUBLIC_AMENDMENT_API_URL : undefined;
  const a = typeof raw === 'string' ? raw.trim().replace(/\/$/, '') : '';
  if (a.length > 0) return a.endsWith('/api/amendment') ? a : `${a}/api/amendment`;
  const ts = typeof process !== 'undefined' ? process.env.EXPO_PUBLIC_TIMESTAMP_URL : undefined;
  const t = typeof ts === 'string' ? ts.trim().replace(/\/$/, '') : '';
  if (t.length > 0) {
    if (t.endsWith('/api/timestamp')) return `${t.slice(0, -'/api/timestamp'.length)}/api/amendment`;
    return `${t}/api/amendment`;
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api/amendment`;
  }
  return null;
}

async function parseJson(res: Response): Promise<unknown> {
  const t = await res.text();
  try {
    return JSON.parse(t) as unknown;
  } catch {
    return null;
  }
}

async function maybeMarkUnlockFromList(roundId: string, list: AmendmentRequest[]) {
  if (list.some((r) => r.status === 'approved' && !r.consumed)) {
    await markRoundAmendmentUnlocked(roundId);
  }
}

export async function getAmendmentRequests(roundId: string): Promise<AmendmentRequest[]> {
  const base = amendmentApiUrl();
  if (!base) return [];
  try {
    const res = await fetch(`${base}?roundId=${encodeURIComponent(roundId)}`);
    if (!res.ok) return [];
    const j = (await parseJson(res)) as { requests?: AmendmentRequest[] } | null;
    const list = Array.isArray(j?.requests) ? j!.requests! : [];
    await maybeMarkUnlockFromList(roundId, list);
    return list;
  } catch {
    return [];
  }
}

export async function getAmendmentRequestById(requestId: string): Promise<AmendmentRequest | null> {
  const base = amendmentApiUrl();
  if (!base) return null;
  try {
    const res = await fetch(`${base}?requestId=${encodeURIComponent(requestId)}`);
    if (!res.ok) return null;
    const j = (await parseJson(res)) as { request?: AmendmentRequest | null } | null;
    const r = j?.request ?? null;
    if (r?.roundId && r.status === 'approved' && !r.consumed) await markRoundAmendmentUnlocked(r.roundId);
    return r;
  } catch {
    return null;
  }
}

export async function getPendingVotes(userId: string): Promise<AmendmentRequest[]> {
  const base = amendmentApiUrl();
  if (!base) return [];
  try {
    const res = await fetch(`${base}?pendingForUserId=${encodeURIComponent(userId)}`);
    if (!res.ok) return [];
    const j = (await parseJson(res)) as { requests?: AmendmentRequest[] } | null;
    return Array.isArray(j?.requests) ? j!.requests! : [];
  } catch {
    return [];
  }
}

export type CreateAmendmentInput = {
  roundId: string;
  roundDate: string;
  requesterId: string;
  requesterName: string;
  originalValues: AmendmentRequest['originalValues'];
  proposedValues: AmendmentRequest['proposedValues'];
  reason: string;
  voters: { userId: string; name: string }[];
};

export async function createAmendmentRequest(
  input: CreateAmendmentInput,
): Promise<{ ok: true; requestId: string; votersCount: number } | { ok: false; message: string }> {
  const base = amendmentApiUrl();
  if (!base) return { ok: false, message: '未配置成绩修改 API 地址' };
  try {
    const res = await fetch(base, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...input,
        voters: input.voters.map((v) => ({ userId: v.userId, name: v.name })),
      }),
    });
    const j = (await parseJson(res)) as { requestId?: string; votersCount?: number; error?: string } | null;
    if (!res.ok) return { ok: false, message: typeof j?.error === 'string' ? j.error : '创建失败' };
    const requestId = typeof j?.requestId === 'string' ? j.requestId : '';
    const votersCount = typeof j?.votersCount === 'number' ? j.votersCount : 0;
    if (!requestId) return { ok: false, message: '无效响应' };
    return { ok: true, requestId, votersCount };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : '网络错误' };
  }
}

export async function submitVote(
  requestId: string,
  userId: string,
  vote: 'approved' | 'rejected',
): Promise<{ status: AmendmentRequest['status']; approvedCount: number; totalCount: number; roundId: string } | null> {
  const base = amendmentApiUrl();
  if (!base) return null;
  try {
    const res = await fetch(base, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'vote', requestId, userId, vote }),
    });
    const j = (await parseJson(res)) as {
      status?: AmendmentRequest['status'];
      approvedCount?: number;
      totalCount?: number;
      roundId?: string;
    } | null;
    if (!res.ok || !j) return null;
    const out = {
      status: j.status ?? 'pending',
      approvedCount: Number(j.approvedCount) || 0,
      totalCount: Number(j.totalCount) || 0,
      roundId: typeof j.roundId === 'string' ? j.roundId : '',
    };
    if (out.status === 'approved' && out.roundId) await markRoundAmendmentUnlocked(out.roundId);
    return out;
  } catch {
    return null;
  }
}

export async function consumeAmendmentForRound(roundId: string): Promise<void> {
  const base = amendmentApiUrl();
  if (!base) {
    await clearRoundAmendmentUnlock(roundId);
    return;
  }
  try {
    await fetch(base, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'consume', roundId }),
    });
  } catch {
    /* ignore */
  }
  await clearRoundAmendmentUnlock(roundId);
}
