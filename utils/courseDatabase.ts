import AsyncStorage from '@react-native-async-storage/async-storage';

import coursesJp from '@/data/courses-jp.json';
import coursesCn from '@/data/courses.json';
import coursesCnCatalogExtra from '@/data/courses-cn.json';
import type {
  CatalogCourse,
  CatalogCourseSearchHit,
  CourseSuggestBody,
} from '@/lib/course-catalog-types';
import {
  catalogCourseToSearchHit,
  loadLocalMergedCatalogCourses,
  searchLocalCatalogCourses,
} from '@/lib/course-catalog-helpers';

export const DETAIL_PREFIX = '@gca_course_detail_v1_';
const DETAIL_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function getCourseApiBase(): string | null {
  const raw = typeof process !== 'undefined' ? process.env.EXPO_PUBLIC_COURSE_API_URL : undefined;
  if (raw && String(raw).trim()) return String(raw).trim().replace(/\/$/, '');
  const nearby =
    typeof process !== 'undefined' ? process.env.EXPO_PUBLIC_NEARBY_COURSES_URL : undefined;
  if (nearby && String(nearby).includes('/api/')) {
    return String(nearby)
      .replace(/\/api\/[^/]+$/, '')
      .replace(/\/$/, '');
  }
  return null;
}

function dedupeHits(list: CatalogCourseSearchHit[]): CatalogCourseSearchHit[] {
  const seen = new Set<string>();
  const out: CatalogCourseSearchHit[] = [];
  for (const h of list) {
    if (seen.has(h.id)) continue;
    seen.add(h.id);
    out.push(h);
  }
  return out;
}

let localCache: CatalogCourse[] | null = null;

function getLocalCourses(): CatalogCourse[] {
  if (!localCache) {
    const base = loadLocalMergedCatalogCourses(coursesJp, coursesCn);
    const extraRoot = coursesCnCatalogExtra as { courses?: CatalogCourse[] };
    const extra = Array.isArray(extraRoot.courses) ? extraRoot.courses : [];
    const byId = new Map<string, CatalogCourse>();
    for (const c of base) byId.set(c.id, c);
    for (const c of extra) byId.set(c.id, c);
    localCache = [...byId.values()];
  }
  return localCache;
}

export async function searchCourses(
  query: string,
  country?: string | null,
  limit = 10,
): Promise<CatalogCourseSearchHit[]> {
  const localHits = searchLocalCatalogCourses(getLocalCourses(), query, { country, limit });
  const base = getCourseApiBase();
  if (!base) return localHits;

  try {
    const u = new URL(`${base}/api/course/search`);
    u.searchParams.set('q', query);
    if (country) u.searchParams.set('country', country);
    u.searchParams.set('limit', String(limit));
    const res = await fetch(u.toString());
    if (!res.ok) return localHits;
    const j = (await res.json()) as { courses?: CatalogCourseSearchHit[] };
    const remote = Array.isArray(j.courses) ? j.courses : [];
    return dedupeHits([...localHits, ...remote]).slice(0, limit);
  } catch {
    return localHits;
  }
}

type DetailCache = { cachedAt: number; course: CatalogCourse };

export async function getCourseDetail(courseId: string): Promise<CatalogCourse | null> {
  const key = `${DETAIL_PREFIX}${courseId}`;
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as DetailCache;
      if (
        parsed &&
        typeof parsed.cachedAt === 'number' &&
        parsed.course &&
        parsed.cachedAt + DETAIL_TTL_MS > Date.now()
      ) {
        return parsed.course;
      }
    }
  } catch {
    /* ignore */
  }

  const local = getLocalCourses().find((c) => c.id === courseId) ?? null;
  if (local) {
    try {
      await AsyncStorage.setItem(
        key,
        JSON.stringify({ cachedAt: Date.now(), course: local } satisfies DetailCache),
      );
    } catch {
      /* ignore */
    }
    return local;
  }

  const base = getCourseApiBase();
  if (!base) return null;

  try {
    const res = await fetch(`${base}/api/course/${encodeURIComponent(courseId)}`);
    if (!res.ok) return null;
    const j = (await res.json()) as { course?: CatalogCourse };
    if (!j.course) return null;
    try {
      await AsyncStorage.setItem(
        key,
        JSON.stringify({ cachedAt: Date.now(), course: j.course } satisfies DetailCache),
      );
    } catch {
      /* ignore */
    }
    return j.course;
  } catch {
    return null;
  }
}

export function getHandicapIndexForHole(
  course: CatalogCourse,
  layout: string,
  hole: number,
): number | null {
  const lo = course.holes?.find((h) => h.layout === layout);
  const details = lo?.holeDetails;
  if (!details || details.length === 0) return null;
  const d = details.find((x) => x.hole === hole);
  return typeof d?.handicapIndex === 'number' && Number.isFinite(d.handicapIndex)
    ? d.handicapIndex
    : null;
}

export async function suggestCourse(
  data: CourseSuggestBody,
): Promise<{ ok: boolean; persisted?: boolean }> {
  const base = getCourseApiBase();
  if (!base) return { ok: false };
  try {
    const res = await fetch(`${base}/api/course/suggest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) return { ok: false };
    const j = (await res.json()) as { ok?: boolean; persisted?: boolean };
    return { ok: Boolean(j.ok), persisted: j.persisted };
  } catch {
    return { ok: false };
  }
}

/** 客户端离线：按 id 取完整目录对象（不读 AsyncStorage 网络缓存） */
export function getLocalCourseById(courseId: string): CatalogCourse | undefined {
  return getLocalCourses().find((c) => c.id === courseId);
}

export { catalogCourseToSearchHit };
