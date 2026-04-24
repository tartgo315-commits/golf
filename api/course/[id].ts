/**
 * Vercel: GET /api/course/:id
 */

import type { IncomingMessage } from 'http';

import { getCourseByIdServer } from '../_courseCatalogServer';

type Req = IncomingMessage & { query?: Record<string, string | string[] | undefined> };
type Res = {
  setHeader(name: string, value: string): void;
  status(code: number): { json(body: unknown): void; end(): void };
};

function readId(req: Req): string | null {
  const q = req.query?.id;
  if (typeof q === 'string' && q.trim()) return q.trim();
  if (Array.isArray(q) && typeof q[0] === 'string' && q[0].trim()) return q[0].trim();
  return null;
}

export default async function handler(req: Req, res: Res): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const id = readId(req);
  if (!id) {
    res.status(400).json({ error: 'Missing id' });
    return;
  }

  const course = await getCourseByIdServer(id);
  if (!course) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.status(200).json({ course });
}
