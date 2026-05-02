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
import { getMockHandicapCoursePool } from '@/lib/mock-handicap-course-pool';

/** 模拟轮次统一用中性难度，避免把真实球场的 CR 与随机总杆组合成「微差趋近 0」拉歪差点 */
const MOCK_COURSE_RATING = 72;
const MOCK_SLOPE_RATING = 113;

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** 根据目标差点返回每洞相对 Par 的随机偏差范围 */
function relRangeForHandicap(targetHI: number): [number, number] {
  if (targetHI <= 5) return [-1, 3];
  if (targetHI <= 15) return [0, 4];
  if (targetHI <= 25) return [0, 5];
  return [1, 6];
}

/** 按给定 Par 列表生成随机逐洞（杆数随机），洞号 1…N 与积分卡顺序一致 */
function buildRandomHoleDetailsFromPars(pars: number[], targetHI = 20): HoleDetail[] {
  const [minRel, maxRel] = relRangeForHandicap(targetHI);
  return pars.map((par, i) => {
    const rel = randInt(minRel, maxRel);
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
function buildRandomHoleDetails18(targetHI = 20): HoleDetail[] {
  return buildRandomHoleDetailsFromPars(buildParArray('72', 18), targetHI);
}

/**
 * 生成若干条用于本地测试的 HandicapRecord（18 洞、含逐洞）。
 * 优先使用 `getMockHandicapCoursePool()` 的**球场名与逐洞 Par 布局**；`courseRating`/`slopeRating` 一律固定为 72 / 113，
 * 避免沿用真实球场 CR（可能接近某次随机总杆）导致微差不合理。整库仍空时回退「模拟球场」+ Par72，同样 72/113。
 * 日期从新到旧错开，便于趋势与「近 N 场」窗口。
 * 经 normalize 写入微差/总杆，避免手写 scoreDifferential:0 覆盖 WHS 计算。
 */
export function buildMockHandicapRecords(count: number): HandicapRecord[] {
  const pool = getMockHandicapCoursePool();
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
        courseRating: MOCK_COURSE_RATING,
        slopeRating: MOCK_SLOPE_RATING,
        holes: 18,
        notes: '',
        holeDetails: buildRandomHoleDetailsFromPars(pars, 20),
        courseCatalogId: course.id,
        isMockData: true,
      });
    } else {
      raw.push({
        id: makeHandicapRecordId(),
        date: dateStr,
        courseName: `模拟球场 ${String(i + 1).padStart(2, '0')}`,
        courseRating: MOCK_COURSE_RATING,
        slopeRating: MOCK_SLOPE_RATING,
        holes: 18,
        notes: '',
        holeDetails: buildRandomHoleDetails18(20),
        isMockData: true,
      });
    }
  }
  return normalizeHandicapRecords(raw);
}

/** 将模拟场次追加到本地差点记录（新数据在前），返回写入条数 */
export async function appendMockHandicapRounds(rounds = 21): Promise<number> {
  const existing = await loadHandicapRecords();
  const fresh = buildMockHandicapRecords(rounds);
  await saveHandicapRecords([...fresh, ...existing]);
  return fresh.length;
}

/** 用模拟场次完全替换本地记录（用于填满固定场数测试） */
export async function replaceWithMockHandicapRounds(rounds: number): Promise<number> {
  const fresh = buildMockHandicapRecords(rounds);
  await saveHandicapRecords(fresh);
  return fresh.length;
}
