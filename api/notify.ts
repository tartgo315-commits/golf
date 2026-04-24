/**
 * POST /api/notify
 * - 默认：{ toUserId, type, title, body, data } 发送或入队
 * - { op: 'flush', deviceId } 用户上线清空离线队列（与 PATCH user pushToken 配合）
 *
 * TODO: 生产环境应校验调用方身份（如内部 Secret），避免被滥用。
 */

import type { NotificationType } from './notifyCore';
import { flushQueuedByDeviceId, sendOrEnqueueNotification } from './notifyCore';

type Req = { method?: string; body?: string };
type Res = {
  setHeader(n: string, v: string): void;
  status(c: number): { json(o: unknown): void; end(): void };
};

function setCors(res: Res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default function handler(req: Req, res: Res): void {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  void (async () => {
    try {
      let body: Record<string, unknown> = {};
      if (req.body && typeof req.body === 'string' && req.body.trim()) {
        body = JSON.parse(req.body) as Record<string, unknown>;
      }
      const op = String(body.op ?? '').trim();
      if (op === 'flush') {
        const deviceId = String(body.deviceId ?? '').trim();
        if (!deviceId) return res.status(400).json({ error: 'deviceId required' });
        const flushed = await flushQueuedByDeviceId(deviceId);
        return res.status(200).json({ success: true, flushed });
      }

      const toUserId = String(body.toUserId ?? '').trim();
      const type = String(body.type ?? '').trim() as NotificationType;
      const title = String(body.title ?? '').trim();
      const msgBody = String(body.body ?? '').trim();
      const dataRaw = body.data;
      const data: Record<string, string> =
        dataRaw && typeof dataRaw === 'object' && !Array.isArray(dataRaw)
          ? Object.fromEntries(
              Object.entries(dataRaw as Record<string, unknown>).map(([k, v]) => [k, String(v ?? '')]),
            )
          : {};
      if (!toUserId || !type || !title || !msgBody) {
        return res.status(400).json({ error: 'toUserId, type, title, body required' });
      }

      const out = await sendOrEnqueueNotification({ toUserId, type, title, body: msgBody, data });
      return res.status(200).json({ success: out.success, ticketId: out.ticketId ?? null, queued: Boolean(out.queued) });
    } catch (e) {
      return res.status(400).json({ error: e instanceof Error ? e.message : 'bad request' });
    }
  })();
}
