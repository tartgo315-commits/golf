/**
 * 模拟差点成绩用的球场池：
 * - `courses.json` 中带完整 18 洞记分卡的条目；
 * - 再加 **JP + courses.json 合并目录** 与 **`courses-cn.json` 增补** 里可转成 18 洞的条目。
 *
 * 故意 **不** 经过 `utils/courseDatabase`、也 **不** 静态引入 `courses-cn-osm.json`，避免启动时与根布局种子逻辑
 * 一起把超大 OSM 包拉进首屏依赖图，导致 Web 长时间白屏或像「打不开」。
 * （OSM 球场仍可在「选场搜索」等路径按需加载，与 courseDatabase 一致。）
 */

import coursesJp from '@/data/courses-jp.json';
import coursesCnMain from '@/data/courses.json';
import coursesCnCatalogExtra from '@/data/courses-cn.json';
import { loadLocalMergedCatalogCourses } from '@/lib/course-catalog-helpers';
import type { CatalogCourse } from '@/lib/course-catalog-types';
import { getLibraryCoursesWithScorecard, type LibraryCourse, type LibraryHole } from '@/lib/golf-courses';
import { buildParArray } from '@/lib/handicap';

function normPar(p: unknown): 3 | 4 | 5 {
  const n = Number(p);
  if (n === 3 || n === 4 || n === 5) return n;
  return 4;
}

/**
 * 从目录球场取一个 18 洞 layout，转成与 `LibraryCourse` 兼容的结构供 mock 逐洞生成。
 * - 有 18 条 holeDetails：用真实逐洞 Par/码数/SI
 * - 无逐洞：用 `buildParArray('72')` 占位，总标准杆以 layout.par 为准（常见 72）
 */
function catalogCourseToLibraryMock(c: CatalogCourse): LibraryCourse | null {
  const layout18 =
    (c.holes ?? []).find((h) => h.holes === 18 && Array.isArray(h.holeDetails) && h.holeDetails.length === 18) ??
    (c.holes ?? []).find((h) => h.holes === 18 && (!h.holeDetails || h.holeDetails.length === 0));
  if (!layout18 || layout18.holes !== 18) return null;

  const details = layout18.holeDetails ?? [];
  let pars: number[];
  if (details.length === 18) {
    pars = details.map((h) => normPar(h.par));
  } else {
    pars = buildParArray('72', 18);
  }

  const scorecard: LibraryHole[] = pars.map((par, i) => {
    const d = details[i];
    const yards =
      d && typeof d.yards === 'number' && Number.isFinite(d.yards) ? Math.round(d.yards) : 0;
    const hcp =
      d && typeof d.handicapIndex === 'number' && Number.isFinite(d.handicapIndex)
        ? Math.round(d.handicapIndex)
        : i + 1;
    return { hole: i + 1, par, yards, hcp };
  });

  const sumParFromHoles = pars.reduce((a, b) => a + b, 0);
  const totalPar =
    details.length === 18
      ? sumParFromHoles
      : typeof layout18.par === 'number' && Number.isFinite(layout18.par) && layout18.par > 0
        ? layout18.par
        : sumParFromHoles;
  const totalYards = scorecard.reduce((a, h) => a + h.yards, 0);
  const rating =
    typeof layout18.courseRating === 'number' &&
    Number.isFinite(layout18.courseRating) &&
    layout18.courseRating > 0
      ? layout18.courseRating
      : undefined;
  const slope =
    typeof layout18.slopeRating === 'number' &&
    Number.isFinite(layout18.slopeRating) &&
    layout18.slopeRating > 0
      ? layout18.slopeRating
      : undefined;

  return {
    id: c.id,
    nameCn: c.name,
    nameEn: c.nameEn,
    province: c.prefecture,
    totalPar,
    totalYards,
    rating,
    slope,
    scorecard,
    ...(typeof c.lat === 'number' && typeof c.lng === 'number'
      ? { location: { lat: c.lat, lng: c.lng } }
      : {}),
  };
}

function buildLightMergedCatalog(): CatalogCourse[] {
  const base = loadLocalMergedCatalogCourses(coursesJp, coursesCnMain);
  const extraRoot = coursesCnCatalogExtra as { courses?: CatalogCourse[] };
  const extra = Array.isArray(extraRoot.courses) ? extraRoot.courses : [];
  const byId = new Map<string, CatalogCourse>();
  for (const c of base) byId.set(c.id, c);
  for (const c of extra) byId.set(c.id, c);
  return [...byId.values()];
}

let poolCache: LibraryCourse[] | null = null;

/**
 * 模拟成绩可轮换的球场列表：`courses.json` 全洞模板优先，再并入 JP / cn 增补目录（去重 id，不含 OSM 大包）。
 */
export function getMockHandicapCoursePool(): LibraryCourse[] {
  if (poolCache) return poolCache;
  const seen = new Set<string>();
  const out: LibraryCourse[] = [];

  for (const c of getLibraryCoursesWithScorecard()) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    out.push(c);
  }

  for (const c of buildLightMergedCatalog()) {
    if (seen.has(c.id)) continue;
    const lib = catalogCourseToLibraryMock(c);
    if (!lib) continue;
    seen.add(c.id);
    out.push(lib);
  }

  poolCache = out;
  return poolCache;
}
