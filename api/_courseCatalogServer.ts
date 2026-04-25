/**
 * 服务端球场目录：合并 data/courses-jp.json、data/courses.json（CN）、可选 KV 扩展与建议队列。
 */

import coursesJp from '../data/courses-jp.json';
import coursesCn from '../data/courses.json';
import coursesCnCatalogExtra from '../data/courses-cn.json';
import coursesCnOsm from '../data/courses-cn-osm.json';
import type {
  CatalogCourse,
  CatalogCourseLayout,
  CatalogCourseSearchHit,
  CatalogHoleDetail,
  CourseSuggestBody,
} from '../lib/course-catalog-types';

type JpRoot = { courses: CatalogCourse[] };
type CnHole = { hole: number; par: number; yards: number; hcp: number };
type CnCourse = {
  id: string;
  nameCn: string;
  nameEn: string;
  country?: string;
  province?: string;
  address?: string;
  totalPar: number;
  rating?: number;
  slope?: number;
  scorecard: CnHole[];
};

type CnRoot = { courses: CnCourse[] };

const KV_KEY_CATALOG = 'gca_course_catalog';
const KV_KEY_SUGGEST = 'gca_course_suggest_queue';

async function kvExec<T = unknown>(cmd: unknown[]): Promise<T | null> {
  const base = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!base || !token) return null;
  const url = base.endsWith('/') ? base.slice(0, -1) : base;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { result?: T };
  return j.result ?? null;
}

async function kvGetJson<T>(key: string): Promise<T | null> {
  const raw = await kvExec<string | null>(['GET', key]);
  if (raw == null || raw === '') return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function kvSetJson(key: string, value: unknown): Promise<boolean> {
  const ok = await kvExec<string>(['SET', key, JSON.stringify(value)]);
  return ok === 'OK';
}

export function loadJpCourses(): CatalogCourse[] {
  const root = coursesJp as unknown as JpRoot;
  return Array.isArray(root.courses) ? root.courses : [];
}

function loadCnCourses(): CnCourse[] {
  const root = coursesCn as unknown as CnRoot;
  return Array.isArray(root.courses) ? root.courses : [];
}

function cnToCatalogCourse(c: CnCourse): CatalogCourse {
  const holeDetails: CatalogHoleDetail[] = (c.scorecard ?? []).map((h) => ({
    hole: h.hole,
    par: h.par === 3 || h.par === 4 || h.par === 5 ? h.par : 4,
    handicapIndex: h.hcp,
    yards: typeof h.yards === 'number' && Number.isFinite(h.yards) ? h.yards : null,
  }));
  const cr = typeof c.rating === 'number' && Number.isFinite(c.rating) ? c.rating : null;
  const sr = typeof c.slope === 'number' && Number.isFinite(c.slope) ? c.slope : null;
  const layout: CatalogCourseLayout = {
    layout: '全场',
    holes: 18,
    courseRating: cr,
    slopeRating: sr,
    par: c.totalPar,
    holeDetails,
  };
  const city = typeof c.address === 'string' ? (c.address.split(',').pop()?.trim() ?? '') : '';
  return {
    id: c.id,
    name: c.nameCn,
    nameEn: c.nameEn,
    country: c.country ?? 'CN',
    prefecture: c.province ?? '',
    city,
    holes: [layout],
    verified: cr != null && sr != null,
    updatedAt: '2026-04-16',
  };
}

export async function loadKvExtraCourses(): Promise<CatalogCourse[]> {
  const parsed = await kvGetJson<CatalogCourse[]>(KV_KEY_CATALOG);
  return Array.isArray(parsed) ? parsed : [];
}

export async function loadAllCoursesMerged(): Promise<CatalogCourse[]> {
  const kv = await loadKvExtraCourses();
  const cn = loadCnCourses().map(cnToCatalogCourse);
  const jp = loadJpCourses();
  const extraRoot = coursesCnCatalogExtra as unknown as JpRoot;
  const extra = Array.isArray(extraRoot.courses) ? extraRoot.courses : [];
  const osmRoot = coursesCnOsm as unknown as JpRoot;
  const osm = Array.isArray(osmRoot.courses) ? osmRoot.courses : [];
  const byId = new Map<string, CatalogCourse>();
  for (const c of jp) byId.set(c.id, c);
  for (const c of cn) byId.set(c.id, c);
  for (const c of extra) byId.set(c.id, c);
  for (const c of osm) byId.set(c.id, c);
  for (const c of kv) byId.set(c.id, c);
  return [...byId.values()];
}

function toSearchHit(c: CatalogCourse): CatalogCourseSearchHit {
  return {
    id: c.id,
    name: c.name,
    nameEn: c.nameEn,
    country: c.country,
    prefecture: c.prefecture,
    city: c.city,
    verified: c.verified,
    updatedAt: c.updatedAt,
    layouts: (c.holes ?? []).map((h) => ({
      layout: h.layout,
      holes: h.holes,
      courseRating: h.courseRating,
      slopeRating: h.slopeRating,
      par: h.par,
    })),
  };
}

function norm(s: string) {
  return s.trim().toLowerCase();
}

function matchesQuery(c: CatalogCourse, q: string): boolean {
  const t = norm(q);
  if (!t) return true;
  return (
    norm(c.name).includes(t) ||
    norm(c.nameEn).includes(t) ||
    norm(c.prefecture).includes(t) ||
    norm(c.city).includes(t)
  );
}

function matchesCountry(c: CatalogCourse, country?: string | null): boolean {
  if (!country || !country.trim()) return true;
  return norm(c.country) === norm(country);
}

export async function searchCoursesServer(
  q: string,
  opts: { country?: string | null; limit?: number },
): Promise<CatalogCourseSearchHit[]> {
  const limit = Math.min(50, Math.max(1, opts.limit ?? 10));
  const all = await loadAllCoursesMerged();
  const filtered = all.filter((c) => matchesCountry(c, opts.country) && matchesQuery(c, q));
  return filtered.slice(0, limit).map(toSearchHit);
}

export async function getCourseByIdServer(id: string): Promise<CatalogCourse | null> {
  const all = await loadAllCoursesMerged();
  return all.find((c) => c.id === id) ?? null;
}

export async function pushCourseSuggest(
  body: CourseSuggestBody,
): Promise<{ ok: boolean; persisted: boolean }> {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return { ok: false, persisted: false };

  const entry = {
    ...body,
    name,
    receivedAt: new Date().toISOString(),
  };

  const prev = (await kvGetJson<unknown[]>(KV_KEY_SUGGEST)) ?? [];
  const next = [...prev, entry];
  const persisted = await kvSetJson(KV_KEY_SUGGEST, next);
  return { ok: true, persisted };
}
