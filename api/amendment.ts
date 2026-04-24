/**
 * 成绩修改申请（创建 / 列表 / 待投票 / 投票 / 消费）
 *
 * 说明：Vercel 上每个 serverless 入口为独立进程，若拆成多个函数则无法共享内存；
 * 本文件合并「申请 + 投票」能力，通过 body.op / query 区分。
 */

import { notifyAmendmentRequest, notifyAmendmentResult } from './notifyCore';

type VoteState = 'pending' | 'approved' | 'rejected';

export type AmendmentRequest = {
  id: string;
  roundId: string;
  roundDate: string;
  requesterId: string;
  requesterName: string;
  originalValues: { totalScore: number; holes: number; course: string };
  proposedValues: { totalScore: number; holes: number; course: string };
  reason: string;
  voters: Array<{ userId: string; name: string; vote: VoteState; votedAt: number | null }>;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  createdAt: number;
  expiresAt: number;
  consumed?: boolean;
  rejectedByName?: string;
};

type Req = { method?: string; query?: Record<string, string | string[] | undefined>; body?: string };
type Res = {
  setHeader(n: string, v: string): void;
  status(c: number): { json(o: unknown): void; end(): void };
};

const requests = new Map<string, AmendmentRequest>();

function setCors(res: Res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function qOne(q: Record<string, string | string[] | undefined> | undefined, key: string): string | undefined {
  if (!q) return undefined;
  const v = q[key];
  if (Array.isArray(v)) return v[0];
  return typeof v === 'string' ? v : undefined;
}

function expireSweep(now: number) {
  for (const r of requests.values()) {
    if (r.status !== 'pending') continue;
    if (now <= r.expiresAt) continue;
    if (r.voters.length === 0) {
      r.status = 'approved';
      continue;
    }
    if (r.voters.every((v) => v.vote === 'approved')) {
      r.status = 'approved';
      continue;
    }
    r.status = 'expired';
  }
}

function listByRoundId(roundId: string, now: number): AmendmentRequest[] {
  expireSweep(now);
  return [...requests.values()].filter((r) => r.roundId === roundId).sort((a, b) => b.createdAt - a.createdAt);
}

function listPendingForUser(userId: string, now: number): AmendmentRequest[] {
  expireSweep(now);
  return [...requests.values()].filter(
    (r) =>
      r.status === 'pending' &&
      !r.consumed &&
      r.voters.some((v) => v.userId === userId && v.vote === 'pending'),
  );
}

function voteReturn(r: AmendmentRequest) {
  return {
    status: r.status,
    approvedCount: r.voters.filter((x) => x.vote === 'approved').length,
    totalCount: r.voters.length,
    roundId: r.roundId,
  };
}

function createRequest(body: Record<string, unknown>, now: number): { requestId: string; votersCount: number } {
  const roundId = String(body.roundId ?? '').trim();
  const roundDate = String(body.roundDate ?? '').trim();
  const requesterId = String(body.requesterId ?? '').trim();
  const requesterName = String(body.requesterName ?? '').trim() || '玩家';
  const reason = String(body.reason ?? '').trim();
  if (!roundId || !requesterId) throw new Error('roundId and requesterId required');
  if (!roundDate) throw new Error('roundDate required');
  if (!reason) throw new Error('reason required');
  const ov = body.originalValues as Record<string, unknown> | undefined;
  const pv = body.proposedValues as Record<string, unknown> | undefined;
  if (!ov || !pv) throw new Error('originalValues and proposedValues required');
  const originalValues = {
    totalScore: Math.round(Number(ov.totalScore)),
    holes: ov.holes === 9 ? 9 : 18,
    course: String(ov.course ?? '').trim(),
  };
  const proposedValues = {
    totalScore: Math.round(Number(pv.totalScore)),
    holes: pv.holes === 9 ? 9 : 18,
    course: String(pv.course ?? '').trim(),
  };
  const rawVoters = Array.isArray(body.voters) ? body.voters : [];
  const voters = rawVoters
    .map((x) => {
      if (!x || typeof x !== 'object') return null;
      const o = x as Record<string, unknown>;
      const uid = String(o.userId ?? '').trim();
      const name = String(o.name ?? '').trim() || '球友';
      if (!uid) return null;
      return { userId: uid, name, vote: 'pending' as const, votedAt: null as number | null };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  const id = `ar_${now}_${Math.random().toString(36).slice(2, 9)}`;
  const createdAt = now;
  const expiresAt = createdAt + 48 * 60 * 60 * 1000;
  const req: AmendmentRequest = {
    id,
    roundId,
    roundDate,
    requesterId,
    requesterName,
    originalValues,
    proposedValues,
    reason,
    voters,
    status: 'pending',
    createdAt,
    expiresAt,
    consumed: false,
  };
  requests.set(id, req);
  for (const v of voters) {
    void notifyAmendmentRequest(v.userId, requesterName, roundDate, id);
  }
  return { requestId: id, votersCount: voters.length };
}

function vote(body: Record<string, unknown>, now: number) {
  const requestId = String(body.requestId ?? '').trim();
  const userId = String(body.userId ?? '').trim();
  const voteVal = body.vote === 'rejected' ? 'rejected' : 'approved';
  if (!requestId || !userId) throw new Error('requestId and userId required');
  expireSweep(now);
  const r = requests.get(requestId);
  if (!r) throw new Error('request not found');
  if (r.status !== 'pending') return voteReturn(r);
  const voter = r.voters.find((v) => v.userId === userId);
  if (!voter) throw new Error('not a voter');
  if (voter.vote !== 'pending') return voteReturn(r);
  voter.vote = voteVal;
  voter.votedAt = now;
  if (voteVal === 'rejected') {
    r.status = 'rejected';
    r.rejectedByName = voter.name;
    void notifyAmendmentResult(r.requesterId, false, voter.name, r.roundId, r.id);
  } else if (r.voters.length > 0 && r.voters.every((x) => x.vote === 'approved')) {
    r.status = 'approved';
    void notifyAmendmentResult(r.requesterId, true, undefined, r.roundId, r.id);
  }
  return voteReturn(r);
}

function consumeRound(roundId: string) {
  for (const r of requests.values()) {
    if (r.roundId === roundId && r.status === 'approved' && !r.consumed) {
      r.consumed = true;
      return { ok: true as const, requestId: r.id };
    }
  }
  return { ok: false as const };
}

export default function handler(req: Req, res: Res): void {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  const now = Date.now();
  try {
    if (req.method === 'GET') {
      const requestId = qOne(req.query, 'requestId');
      const roundId = qOne(req.query, 'roundId');
      const pendingFor = qOne(req.query, 'pendingForUserId');
      if (requestId) {
        expireSweep(now);
        const r = requests.get(requestId) ?? null;
        return res.status(200).json({ request: r });
      }
      if (roundId) {
        const list = listByRoundId(roundId, now);
        return res.status(200).json({ requests: list });
      }
      if (pendingFor) {
        const list = listPendingForUser(pendingFor, now);
        return res.status(200).json({ requests: list });
      }
      return res.status(400).json({ error: 'requestId, roundId or pendingForUserId required' });
    }
    if (req.method === 'POST') {
      let body: Record<string, unknown> = {};
      if (req.body && typeof req.body === 'string' && req.body.trim()) {
        body = JSON.parse(req.body) as Record<string, unknown>;
      }
      const op = String(body.op ?? 'create');
      if (op === 'vote') {
        const out = vote(body, now);
        return res.status(200).json(out);
      }
      if (op === 'consume') {
        const rid = String(body.roundId ?? '').trim();
        if (!rid) return res.status(400).json({ error: 'roundId required' });
        const out = consumeRound(rid);
        return res.status(200).json(out);
      }
      const out = createRequest(body, now);
      return res.status(200).json(out);
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(400).json({ error: e instanceof Error ? e.message : 'bad request' });
  }
}
