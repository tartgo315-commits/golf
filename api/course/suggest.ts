/**
 * Vercel: POST /api/course/suggest
 */

import type { IncomingMessage } from 'http';

import type { CourseSuggestBody } from '../../lib/course-catalog-types';
import { pushCourseSuggest } from '../_courseCatalogServer';

type Req = IncomingMessage;
type Res = {
  setHeader(name: string, value: string): void;
  status(code: number): { json(body: unknown): void; end(): void };
};

function readBody(req: Req): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(Buffer.from(c)));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export default async function handler(req: Req, res: Res): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let body: unknown;
  try {
    const raw = await readBody(req);
    body = raw ? JSON.parse(raw) : {};
  } catch {
    res.status(400).json({ error: 'Invalid JSON' });
    return;
  }

  const o = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const payload: CourseSuggestBody = {
    name: typeof o.name === 'string' ? o.name : '',
    courseRating:
      typeof o.courseRating === 'number'
        ? o.courseRating
        : o.courseRating === null
          ? null
          : undefined,
    slopeRating:
      typeof o.slopeRating === 'number' ? o.slopeRating : o.slopeRating === null ? null : undefined,
    par: typeof o.par === 'number' ? o.par : undefined,
    source: typeof o.source === 'string' ? o.source : undefined,
  };

  const r = await pushCourseSuggest(payload);
  if (!r.ok) {
    res.status(400).json({ error: 'Invalid payload' });
    return;
  }
  res.status(200).json({ ok: true, persisted: r.persisted });
}
