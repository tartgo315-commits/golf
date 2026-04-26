import {
  buildParArray,
  calcGIR,
  loadHandicapRecords,
  makeHandicapRecordId,
  normalizeHandicapRecords,
  saveHandicapRecords,
  type HandicapRecord,
  type HoleDetail,
} from '@/lib/handicap';
import { getLibraryCoursesWithScorecard, type LibraryCourse } from '@/lib/golf-courses';

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function libraryCourseRating(c: LibraryCourse): number {
  const r = c.rating;
  return typeof r === 'number' && Number.isFinite(r) && r > 0 ? r : 72;
}

function librarySlopeRating(c: LibraryCourse): number {
  const s = c.slope;
  return typeof s === 'number' && Number.isFinite(s) && s > 0 ? s : 113;
}

/** 按给定 Par 列表生成随机逐洞（杆数随机），洞号 1…N 与积分卡顺序一致 */
function buildRandomHoleDetailsFromPars(pars: number[]): HoleDetail[] {
  return pars.map((par, i) => {
    const rel = randInt(-2, 5);
    let strokes = par + rel;
    if (strokes < 1) strokes = 1;
    let putts = randInt(1, 3);
    if (putts > strokes) putts = strokes;
    const fairwayHit: boolean | null = par === 3 ? null : Math.random() < 0.45;
    const greenInRegulation = calcGIR(strokes, par, putts);
    return {
      holeNumber: i + 1,
      par,
      distanceM: null,
      strokes,
      putts,
      fairwayHit,
      greenInRegulation,
    };
  });
}

/** 库为空时回退：标准 Par72 布局 */
function buildRandomHoleDetails18(): HoleDetail[] {
  return buildRandomHoleDetailsFromPars(buildParArray('72', 18));
}

/**
 * 生成若干条用于本地测试的 HandicapRecord（18 洞、含逐洞）。
 * 优先使用 `data/courses.json` 中带完整 18 洞记分卡的球场名、难度/坡度与 Par 布局；库为空时回退「模拟球场」+ Par72。
 * 日期从新到旧错开，便于趋势与「近 N 场」窗口。
 * 经 normalize 写入微差/总杆，避免手写 scoreDifferential:0 覆盖 WHS 计算。
 */
export function buildMockHandicapRecords(count: number): HandicapRecord[] {
  const pool = getLibraryCoursesWithScorecard();
  const raw: unknown[] = [];
  const baseMs = Date.now();
  for (let i = 0; i < count; i++) {
    const dayOffset = i * (1 + (i % 4));
    const d = new Date(baseMs - dayOffset * 86400000);
    const dateStr = d.toISOString().slice(0, 10);

    if (pool.length > 0) {
      const course = pool[i % pool.length]!;
      const pars = course.scorecard.map((h) => h.par);
      raw.push({
        id: makeHandicapRecordId(),
        date: dateStr,
        courseName: course.nameCn,
        courseRating: libraryCourseRating(course),
        slopeRating: librarySlopeRating(course),
        holes: 18,
        notes: '',
        holeDetails: buildRandomHoleDetailsFromPars(pars),
        courseCatalogId: course.id,
      });
    } else {
      const slopeRating = 113 + randInt(-8, 12);
      const courseRating = Math.round((72 + (Math.random() * 1.6 - 0.8)) * 10) / 10;
      raw.push({
        id: makeHandicapRecordId(),
        date: dateStr,
        courseName: `模拟球场 ${String(i + 1).padStart(2, '0')}`,
        courseRating,
        slopeRating,
        holes: 18,
        notes: '',
        holeDetails: buildRandomHoleDetails18(),
      });
    }
  }
  return normalizeHandicapRecords(raw);
}

/** 将模拟场次追加到本地差点记录（新数据在前），返回写入条数 */
export function appendMockHandicapRounds(rounds = 21): number {
  const existing = loadHandicapRecords();
  const fresh = buildMockHandicapRecords(rounds);
  saveHandicapRecords([...fresh, ...existing]);
  return fresh.length;
}

/** 用模拟场次完全替换本地记录（用于填满固定场数测试） */
export function replaceWithMockHandicapRounds(rounds: number): number {
  const fresh = buildMockHandicapRecords(rounds);
  saveHandicapRecords(fresh);
  return fresh.length;
}
