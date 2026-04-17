import {
  buildParArray,
  calcGIR,
  loadHandicapRecords,
  makeHandicapRecordId,
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
 */
export function buildMockHandicapRecords(count: number): HandicapRecord[] {
  const out: HandicapRecord[] = [];
  const baseMs = Date.now();
  for (let i = 0; i < count; i++) {
    const dayOffset = i * (1 + (i % 4));
    const d = new Date(baseMs - dayOffset * 86400000);
    const dateStr = d.toISOString().slice(0, 10);
    const slopeRating = 113 + randInt(-8, 12);
    const courseRating = Math.round((72 + (Math.random() * 1.6 - 0.8)) * 10) / 10;
    const holeDetails = buildRandomHoleDetails18();
    const rec: HandicapRecord = {
      id: makeHandicapRecordId(),
      date: dateStr,
      courseName: `模拟球场 ${String(i + 1).padStart(2, '0')}`,
      courseRating,
      slopeRating,
      adjustedGrossScore: 0,
      holes: 18,
      scoreDifferential: 0,
      notes: '',
      holeDetails,
      totalPutts: 0,
      fairwaysHit: 0,
      fairwaysTotal: 0,
      greensInRegulation: 0,
      front9Strokes: 0,
      back9Strokes: 0,
    };
    out.push(rec);
  }
  return out;
}

/** 将模拟场次追加到本地差点记录（新数据在前），返回写入条数 */
export function appendMockHandicapRounds(rounds = 20): number {
  const existing = loadHandicapRecords();
  const fresh = buildMockHandicapRecords(rounds);
  saveHandicapRecords([...fresh, ...existing]);
  return fresh.length;
}
