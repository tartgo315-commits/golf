import type { CatalogCourse, CatalogCourseSearchHit, CatalogHoleDetail } from '@/lib/course-catalog-types';

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

export function catalogCourseToSearchHit(c: CatalogCourse): CatalogCourseSearchHit {
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

export function cnJsonCourseToCatalogCourse(c: CnCourse): CatalogCourse {
  const holeDetails: CatalogHoleDetail[] = (c.scorecard ?? []).map((h) => ({
    hole: h.hole,
    par: h.par === 3 || h.par === 4 || h.par === 5 ? h.par : 4,
    handicapIndex: h.hcp,
    yards: typeof h.yards === 'number' && Number.isFinite(h.yards) ? h.yards : null,
  }));
  const cr = typeof c.rating === 'number' && Number.isFinite(c.rating) ? c.rating : null;
  const sr = typeof c.slope === 'number' && Number.isFinite(c.slope) ? c.slope : null;
  return {
    id: c.id,
    name: c.nameCn,
    nameEn: c.nameEn,
    country: c.country ?? 'CN',
    prefecture: c.province ?? '',
    city: typeof c.address === 'string' ? c.address.split(',').pop()?.trim() ?? '' : '',
    holes: [
      {
        layout: '全场',
        holes: 18,
        courseRating: cr,
        slopeRating: sr,
        par: c.totalPar,
        holeDetails,
      },
    ],
    verified: cr != null && sr != null,
    updatedAt: '2026-04-16',
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

export function searchLocalCatalogCourses(
  all: CatalogCourse[],
  q: string,
  opts: { country?: string | null; limit?: number },
): CatalogCourseSearchHit[] {
  const limit = Math.min(50, Math.max(1, opts.limit ?? 10));
  return all
    .filter((c) => matchesCountry(c, opts.country) && matchesQuery(c, q))
    .slice(0, limit)
    .map(catalogCourseToSearchHit);
}

export function loadLocalMergedCatalogCourses(jpJson: unknown, cnJson: unknown): CatalogCourse[] {
  const jpRoot = jpJson as JpRoot;
  const cnRoot = cnJson as CnRoot;
  const jp = Array.isArray(jpRoot.courses) ? jpRoot.courses : [];
  const cnList = Array.isArray(cnRoot.courses) ? cnRoot.courses : [];
  const cn = cnList.map(cnJsonCourseToCatalogCourse);
  const byId = new Map<string, CatalogCourse>();
  for (const c of jp) byId.set(c.id, c);
  for (const c of cn) byId.set(c.id, c);
  return [...byId.values()];
}
