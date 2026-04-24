/**
 * 好友关系
 *
 * - POST /api/friend  { op:'add', myUserId, inviteCode }
 * - POST /api/friend  { op:'respond', myUserId, requestId, action:'accept'|'reject' }
 * - GET /api/friend?list=1&userId=xxx
 * - GET /api/friend?requests=1&userId=xxx
 * - DELETE /api/friend?userId=my&friendId=other
 */

import { pairKey, withSocialState, type SocialUser } from './_socialPersistence';

type Req = { method?: string; query?: Record<string, string | string[] | undefined>; body?: string };
type Res = {
  setHeader(n: string, v: string): void;
  status(c: number): { json(o: unknown): void; end(): void };
};

function setCors(res: Res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function qOne(q: Record<string, string | string[] | undefined> | undefined, key: string): string | undefined {
  if (!q) return undefined;
  const v = q[key];
  if (Array.isArray(v)) return v[0];
  return typeof v === 'string' ? v : undefined;
}

function publicFriend(u: SocialUser) {
  return {
    userId: u.userId,
    name: u.name,
    handicap: u.handicap,
    roundsCount: u.roundsCount,
    joinedAt: u.joinedAt,
    trendHi: u.trendHi ?? [],
    trendPoints: u.trendPoints ?? [],
    recentRounds: u.recentRounds ?? [],
  };
}

export default function handler(req: Req, res: Res): void {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  void (async () => {
    try {
      if (req.method === 'GET') {
        const userId = (qOne(req.query, 'userId') ?? '').trim();
        if (!userId) return res.status(400).json({ error: 'userId required' });
        if (qOne(req.query, 'list') === '1') {
          const friends = await withSocialState((s) => {
            const pk = new Set(s.friendPairs);
            const others: string[] = [];
            for (const p of pk) {
              const [a, b] = p.split('|||');
              if (!a || !b) continue;
              if (a === userId) others.push(b);
              else if (b === userId) others.push(a);
            }
            return others.map((id) => s.users[id]).filter((u): u is SocialUser => Boolean(u));
          });
          return res.status(200).json({ friends: friends.map(publicFriend) });
        }
        if (qOne(req.query, 'requests') === '1') {
          const enriched = await withSocialState((s) => {
            const incoming = s.requests.filter((r) => r.toUserId === userId && r.status === 'pending');
            return incoming.map((r) => {
              const from = s.users[r.fromUserId];
              return {
                id: r.id,
                fromUserId: r.fromUserId,
                fromName: from?.name ?? '球友',
                createdAt: r.createdAt,
              };
            });
          });
          return res.status(200).json({ requests: enriched });
        }
        return res.status(400).json({ error: 'list=1 or requests=1 required' });
      }

      if (req.method === 'DELETE') {
        const userId = (qOne(req.query, 'userId') ?? '').trim();
        const friendId = (qOne(req.query, 'friendId') ?? '').trim();
        if (!userId || !friendId) return res.status(400).json({ error: 'userId and friendId required' });
        await withSocialState((s) => {
          const pk = pairKey(userId, friendId);
          s.friendPairs = s.friendPairs.filter((x) => x !== pk);
        });
        return res.status(200).json({ ok: true });
      }

      if (req.method === 'POST') {
        let body: Record<string, unknown> = {};
        if (req.body && typeof req.body === 'string' && req.body.trim()) {
          body = JSON.parse(req.body) as Record<string, unknown>;
        }
        const op = String(body.op ?? '').trim();
        const myUserId = String(body.myUserId ?? '').trim();

        if (op === 'respond') {
          const requestId = String(body.requestId ?? '').trim();
          const action = body.action === 'reject' ? 'reject' : 'accept';
          if (!myUserId || !requestId) return res.status(400).json({ error: 'myUserId and requestId required' });
          const out = await withSocialState((s) => {
            const r = s.requests.find((x) => x.id === requestId);
            if (!r || r.status !== 'pending') return { ok: false as const, reason: 'not found' };
            if (r.toUserId !== myUserId) return { ok: false as const, reason: 'forbidden' };
            if (action === 'reject') {
              r.status = 'rejected';
              return { ok: true as const, status: 'rejected' as const };
            }
            r.status = 'accepted';
            const pk = pairKey(r.fromUserId, r.toUserId);
            if (!s.friendPairs.includes(pk)) s.friendPairs.push(pk);
            return { ok: true as const, status: 'accepted' as const };
          });
          if (!out.ok) return res.status(out.reason === 'forbidden' ? 403 : 404).json({ error: out.reason });
          return res.status(200).json(out);
        }

        if (op === 'add' || body.inviteCode != null) {
          const inviteCode = String(body.inviteCode ?? '').trim().toUpperCase();
          if (!myUserId || inviteCode.length < 4) return res.status(400).json({ error: 'myUserId and inviteCode required' });
          const created = await withSocialState((s) => {
            if (!s.users[myUserId]) throw new Error('unknown user');
            const targetId = s.inviteToUserId[inviteCode];
            if (!targetId || !s.users[targetId]) throw new Error('invalid invite code');
            if (targetId === myUserId) throw new Error('cannot add self');
            const pk = pairKey(myUserId, targetId);
            if (s.friendPairs.includes(pk)) throw new Error('already friends');
            const dup = s.requests.some(
              (x) =>
                x.status === 'pending' &&
                ((x.fromUserId === myUserId && x.toUserId === targetId) ||
                  (x.fromUserId === targetId && x.toUserId === myUserId)),
            );
            if (dup) throw new Error('request pending');
            const id = `fr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            s.requests.push({
              id,
              fromUserId: myUserId,
              toUserId: targetId,
              status: 'pending',
              createdAt: Date.now(),
            });
            return { requestId: id };
          });
          return res.status(200).json(created);
        }

        return res.status(400).json({ error: 'unknown op' });
      }

      return res.status(405).json({ error: 'Method not allowed' });
    } catch (e) {
      return res.status(400).json({ error: e instanceof Error ? e.message : 'bad request' });
    }
  })();
}
