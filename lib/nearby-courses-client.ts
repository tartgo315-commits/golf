/**
 * 客户端调用部署好的 `api/nearby-courses.js`（如 Vercel）。
 * 在根目录 `.env` 配置：EXPO_PUBLIC_NEARBY_COURSES_URL=https://xxx.vercel.app/api/nearby-courses
 */

export type NearbyCourse = {
  name: string;
  address?: string;
  distance?: number;
};

export function getNearbyCoursesBaseUrl(): string | null {
  const raw = process.env.EXPO_PUBLIC_NEARBY_COURSES_URL;
  const u = typeof raw === 'string' ? raw.trim().replace(/\/$/, '') : '';
  return u.length > 0 ? u : null;
}

function isNearbyCourse(x: unknown): x is NearbyCourse {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return typeof o.name === 'string' && o.name.length > 0;
}

function toRequestUrl(base: string, lat: number, lng: number, force?: 'amap' | 'google' | 'osm'): string {
  const absolute =
    base.startsWith('http://') || base.startsWith('https://') ? base : `https://${base}`;
  const u = new URL(absolute);
  u.searchParams.set('lat', String(lat));
  u.searchParams.set('lng', String(lng));
  if (force) u.searchParams.set('force', force);
  return u.toString();
}

export async function fetchNearbyCourses(
  lat: number,
  lng: number,
  options?: { force?: 'amap' | 'google' | 'osm'; signal?: AbortSignal },
): Promise<NearbyCourse[]> {
  const base = getNearbyCoursesBaseUrl();
  if (!base) return [];

  const res = await fetch(toRequestUrl(base, lat, lng, options?.force), { signal: options?.signal });
  if (!res.ok) throw new Error(`请求失败 ${res.status}`);
  const json: unknown = await res.json();
  if (!json || typeof json !== 'object' || !('courses' in json)) return [];
  const rawList = (json as { courses: unknown }).courses;
  if (!Array.isArray(rawList)) return [];
  return rawList.filter(isNearbyCourse);
}
