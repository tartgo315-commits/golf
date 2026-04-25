/**
 * 用户：注册 / 公开资料 / 同步公开差点摘要 / 改名
 *
 * 路由（单文件，避免多函数无法共享 KV）：
 * - POST /api/user  body: { name, deviceId } → 注册或幂等返回
 * - POST /api/user  body: { op:'syncPublic', deviceId, handicap, roundsCount, trendHi?, recentRounds? }
 * - GET /api/user?id=xxx  公开信息
 * - GET /api/user?inviteCode=XXX  按邀请码预览（添加好友前）
 * - PATCH /api/user  body: { deviceId, name?, pushToken? }（至少一项；更新 pushToken 后会尝试 flush 离线通知队列）
 */

import { flushQueuedNotificationsForUser } from './notifyCore';
import { withSocialState, type SocialState, type SocialUser } from './_socialPersistence';

type Req = {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
  body?: string;
};
type Res = {
  setHeader(n: string, v: string): void;
  status(c: number): { json(o: unknown): void; end(): void };
};

const INVITE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function setCors(res: Res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function qOne(
  q: Record<string, string | string[] | undefined> | undefined,
  key: string,
): string | undefined {
  if (!q) return undefined;
  const v = q[key];
  if (Array.isArray(v)) return v[0];
  return typeof v === 'string' ? v : undefined;
}

function randomInviteCode(): string {
  let s = '';
  for (let i = 0; i < 6; i += 1) {
    s += INVITE_CHARS[Math.floor(Math.random() * INVITE_CHARS.length)]!;
  }
  return s;
}

function newUserId(): string {
  return `usr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function pickInviteCode(s: SocialState): string {
  for (let t = 0; t < 24; t += 1) {
    const c = randomInviteCode();
    if (!s.inviteToUserId[c]) return c;
  }
  return randomInviteCode() + randomInviteCode().slice(0, 2);
}

function publicPayload(u: SocialUser) {
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
        const id = qOne(req.query, 'id');
        const inviteCode = (qOne(req.query, 'inviteCode') ?? '').trim().toUpperCase();
        if (inviteCode.length === 6) {
          const out = await withSocialState((s) => {
            const uid = s.inviteToUserId[inviteCode];
            if (!uid || !s.users[uid]) return { ok: false as const };
            return { ok: true as const, user: publicPayload(s.users[uid]!) };
          });
          if (!out.ok) return res.status(404).json({ error: 'not found' });
          return res.status(200).json(out.user);
        }
        if (!id) return res.status(400).json({ error: 'id or inviteCode required' });
        const out = await withSocialState((s) => {
          const u = s.users[id];
          if (!u) return null;
          return publicPayload(u);
        });
        if (!out) return res.status(404).json({ error: 'not found' });
        return res.status(200).json(out);
      }

      let body: Record<string, unknown> = {};
      if (req.body && typeof req.body === 'string' && req.body.trim()) {
        body = JSON.parse(req.body) as Record<string, unknown>;
      }

      if (req.method === 'PATCH') {
        const deviceId = String(body.deviceId ?? '').trim();
        const name = String(body.name ?? '').trim();
        const pushToken = String(body.pushToken ?? '').trim();
        if (!deviceId) return res.status(400).json({ error: 'deviceId required' });
        if (!name && !pushToken)
          return res.status(400).json({ error: 'name or pushToken required' });
        const uid = await withSocialState((s) => {
          const id = s.deviceToUserId[deviceId];
          if (!id || !s.users[id]) return '';
          const u = s.users[id]!;
          if (name) u.name = name;
          if (pushToken) u.pushToken = pushToken;
          return id;
        });
        if (!uid) return res.status(403).json({ error: 'invalid device' });
        if (pushToken) {
          const flushed = await flushQueuedNotificationsForUser(uid);
          return res.status(200).json({ ok: true, flushed });
        }
        return res.status(200).json({ ok: true });
      }

      if (req.method === 'POST') {
        const op = String(body.op ?? '').trim();
        if (op === 'syncPublic') {
          const deviceId = String(body.deviceId ?? '').trim();
          if (!deviceId) return res.status(400).json({ error: 'deviceId required' });
          const handicap = body.handicap == null ? null : Number(body.handicap);
          const roundsCount = Math.max(0, Math.round(Number(body.roundsCount) || 0));
          const trendHi = Array.isArray(body.trendHi)
            ? body.trendHi.map((x) => Number(x)).filter((n) => Number.isFinite(n))
            : [];
          const trendPoints = Array.isArray(body.trendPoints)
            ? body.trendPoints
                .map((x) => {
                  if (!x || typeof x !== 'object') return null;
                  const o = x as Record<string, unknown>;
                  const date = String(o.date ?? '').trim();
                  const hi = Number(o.hi);
                  if (!date || !Number.isFinite(hi)) return null;
                  return { date, hi: Math.round(hi * 10) / 10 };
                })
                .filter((x): x is { date: string; hi: number } => Boolean(x))
            : [];
          const recentRounds = Array.isArray(body.recentRounds)
            ? body.recentRounds
                .map((x) => {
                  if (!x || typeof x !== 'object') return null;
                  const o = x as Record<string, unknown>;
                  const date = String(o.date ?? '').trim();
                  const gross = Math.round(Number(o.gross));
                  const holes = o.holes === 9 ? 9 : 18;
                  if (!date || !Number.isFinite(gross)) return null;
                  return { date, gross, holes };
                })
                .filter((x): x is { date: string; gross: number; holes: 9 | 18 } => Boolean(x))
            : [];
          const okSync = await withSocialState((s) => {
            const uid = s.deviceToUserId[deviceId];
            if (!uid || !s.users[uid]) return false;
            const u = s.users[uid]!;
            if (!u.trendHi) u.trendHi = [];
            if (!u.trendPoints) u.trendPoints = [];
            u.handicap =
              handicap != null && Number.isFinite(handicap) ? Math.round(handicap * 10) / 10 : null;
            u.roundsCount = roundsCount;
            u.trendHi = trendHi.slice(-40);
            u.trendPoints = trendPoints.slice(-40);
            u.recentRounds = recentRounds.slice(0, 30);
            return true;
          });
          if (!okSync) return res.status(403).json({ error: 'not registered' });
          return res.status(200).json({ ok: true });
        }

        const name = String(body.name ?? '').trim() || '球友';
        const deviceId = String(body.deviceId ?? '').trim();
        if (!deviceId) return res.status(400).json({ error: 'deviceId required' });
        const reg = await withSocialState((s) => {
          const existingUid = s.deviceToUserId[deviceId];
          if (existingUid && s.users[existingUid]) {
            const u = s.users[existingUid]!;
            return { userId: u.userId, name: u.name, inviteCode: u.inviteCode };
          }
          const userId = newUserId();
          const inviteCode = pickInviteCode(s);
          const u: SocialUser = {
            userId,
            deviceId,
            name,
            inviteCode,
            joinedAt: Date.now(),
            handicap: null,
            roundsCount: 0,
            trendHi: [],
            trendPoints: [],
            recentRounds: [],
            pushToken: null,
          };
          s.users[userId] = u;
          s.deviceToUserId[deviceId] = userId;
          s.inviteToUserId[inviteCode] = userId;
          return { userId, name, inviteCode };
        });
        return res.status(200).json(reg);
      }

      return res.status(405).json({ error: 'Method not allowed' });
    } catch (e) {
      return res.status(400).json({ error: e instanceof Error ? e.message : 'bad request' });
    }
  })();
}
