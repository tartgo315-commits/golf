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

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** 单轮 18 洞随机逐洞（Par72 布局），洞号 1–18 与积分卡一致，杆数随机 */
function buildRandomHoleDetails18(): HoleDetail[] {
  const pars = buildParArray('72', 18);
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

/**
 * 生成若干条用于本地测试的 HandicapRecord（18 洞、含逐洞）。
 * 日期从新到旧错开，便于趋势与「近 N 场」窗口。
 * 经 normalize 写入微差/总杆，避免手写 scoreDifferential:0 覆盖 WHS 计算。
 */
export function buildMockHandicapRecords(count: number): HandicapRecord[] {
  const raw: unknown[] = [];
  const baseMs = Date.now();
  for (let i = 0; i < count; i++) {
    const dayOffset = i * (1 + (i % 4));
    const d = new Date(baseMs - dayOffset * 86400000);
    const dateStr = d.toISOString().slice(0, 10);
    const slopeRating = 113 + randInt(-8, 12);
    const courseRating = Math.round((72 + (Math.random() * 1.6 - 0.8)) * 10) / 10;
    const holeDetails = buildRandomHoleDetails18();
    raw.push({
      id: makeHandicapRecordId(),
      date: dateStr,
      courseName: `模拟球场 ${String(i + 1).padStart(2, '0')}`,
      courseRating,
      slopeRating,
      holes: 18,
      notes: '',
      holeDetails,
    });
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
