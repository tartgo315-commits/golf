/**
 * Vercel Serverless: GET /api/timestamp
 * 返回服务端毫秒时间戳，供客户端成绩锁定等逻辑使用（防改机时间）。
 */

type Req = { method?: string };
type Res = {
  setHeader(name: string, value: string): void;
  status(code: number): { json(body: unknown): void; end(): void };
};

export default function handler(req: Req, res: Res): void {
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
  const ts = Date.now();
  res.status(200).json({ ts, iso: new Date(ts).toISOString() });
}
