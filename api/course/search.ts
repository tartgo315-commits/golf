/**
 * Vercel: GET /api/course/search?q=&country=JP&limit=10
 */

import type { IncomingMessage } from 'http';

import { searchCoursesServer } from '../_courseCatalogServer';

type Req = IncomingMessage & { query?: Record<string, string | string[] | undefined> };
type Res = {
  setHeader(name: string, value: string): void;
  status(code: number): { json(body: unknown): void; end(): void };
};

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

  const url = new URL(req.url || '/api/course/search', 'http://localhost');
  const q = url.searchParams.get('q') ?? '';
  const country = url.searchParams.get('country');
  const limRaw = url.searchParams.get('limit');
  const lim = limRaw != null ? Number(limRaw) : 10;

  const hits = await searchCoursesServer(q, {
    country: country ?? undefined,
    limit: Number.isFinite(lim) ? lim : 10,
  });
  res.status(200).json({ courses: hits });
}
