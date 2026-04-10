import { readJson, writeJson } from '@/lib/local-storage';

export const HANDICAP_RECORDS_KEY = 'handicapRecords';

/** 单洞记录 */
export type HoleDetail = {
  holeNumber: number;
  par: number;
  /** 洞距离（米），未填可为 null */
  distanceM: number | null;
  strokes: number;
  putts: number;
  /** Par3 为 null 表示不适用 */
  fairwayHit: boolean | null;
  /** 上果岭（标准杆内上果岭） */
  greenInRegulation: boolean;
};

export type HandicapRecord = {
  id: string;
  date: string;
  courseName: string;
  courseRating: number;
  slopeRating: number;
  /** 用于差点计算的每场总杆（已按洞上限规则调整） */
  adjustedGrossScore: number;
  holes: 18 | 9;
  scoreDifferential: number;
  notes: string;
  holeDetails: HoleDetail[];
  totalPutts: number;
  fairwaysHit: number;
  fairwaysTotal: number;
  greensInRegulation: number;
  front9Strokes: number;
  back9Strokes: number;
};

export type HoleStatsSummary = {
  totalStrokes: number;
  front9Strokes: number;
  back9Strokes: number;
  totalPutts: number;
  fairwaysHit: number;
  fairwaysTotal: number;
  greensInRegulation: number;
  toParFront: number;
  toParBack: number;
  toParTotal: number;
};

type BestCountMap = Record<number, number>;

const BEST_COUNT_BY_TOTAL: BestCountMap = {
  3: 1,
  4: 1,
  5: 1,
  6: 2,
  7: 2,
  8: 2,
  9: 3,
  10: 3,
  11: 3,
  12: 4,
  13: 4,
  14: 4,
  15: 5,
  16: 5,
  17: 6,
  18: 6,
  19: 7,
  20: 8,
};

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function toDateMs(date: string) {
  return Number.isFinite(Date.parse(date)) ? Date.parse(date) : 0;
}

export function makeHandicapRecordId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 上果岭：非推杆杆数 ≤ 标准杆−2 */
export function calcGIR(strokes: number, par: number, putts: number): boolean {
  const nonPutt = strokes - putts;
  return nonPutt <= par - 2;
}

/** 单场逐洞统计汇总 */
export function calcStats(holeDetails: HoleDetail[], roundHoles: 18 | 9): HoleStatsSummary {
  const list = [...holeDetails].sort((a, b) => a.holeNumber - b.holeNumber);
  let totalStrokes = 0;
  let front9Strokes = 0;
  let back9Strokes = 0;
  let totalPutts = 0;
  let fairwaysHit = 0;
  let fairwaysTotal = 0;
  let greensInRegulation = 0;
  let toParFront = 0;
  let toParBack = 0;

  for (const h of list) {
    totalStrokes += h.strokes;
    totalPutts += h.putts;
    if (h.par !== 3) {
      fairwaysTotal += 1;
      if (h.fairwayHit === true) fairwaysHit += 1;
    }
    if (h.greenInRegulation) greensInRegulation += 1;

    const rel = h.strokes - h.par;
    if (h.holeNumber <= 9) {
      front9Strokes += h.strokes;
      toParFront += rel;
    } else {
      back9Strokes += h.strokes;
      toParBack += rel;
    }
  }

  if (roundHoles === 9) {
    back9Strokes = 0;
    toParBack = 0;
  }

  const parFront = list.filter((h) => h.holeNumber <= 9).reduce((s, h) => s + h.par, 0);
  const parBack = list.filter((h) => h.holeNumber > 9).reduce((s, h) => s + h.par, 0);
  const parTotal = roundHoles === 9 ? parFront : parFront + parBack;

  return {
    totalStrokes,
    front9Strokes,
    back9Strokes,
    totalPutts,
    fairwaysHit,
    fairwaysTotal,
    greensInRegulation,
    toParFront: front9Strokes - parFront,
    toParBack: roundHoles === 18 ? back9Strokes - parBack : 0,
    toParTotal: totalStrokes - parTotal,
  };
}

/** 简化的洞成绩上限：每洞最多计为标准杆+2（用于差点侧总杆） */
export function escAdjustedStrokesForHole(strokes: number, par: number) {
  return Math.min(strokes, par + 2);
}

export function calcAdjustedGrossFromHoles(holeDetails: HoleDetail[]) {
  return holeDetails.reduce((sum, h) => sum + escAdjustedStrokesForHole(h.strokes, h.par), 0);
}

export function calcDifferential(adjustedGross: number, courseRating: number, slopeRating: number, holes: 18 | 9) {
  if (!Number.isFinite(adjustedGross) || !Number.isFinite(courseRating) || !Number.isFinite(slopeRating) || slopeRating <= 0) {
    return 0;
  }
  const base = ((adjustedGross - courseRating) * 113) / slopeRating;
  const normalized = holes === 9 ? base * 2 : base;
  return round1(normalized);
}

function bestCount(total: number) {
  if (total < 3) return 0;
  const safe = Math.min(total, 20);
  return BEST_COUNT_BY_TOTAL[safe] ?? 8;
}

export function calcHandicapIndex(records: HandicapRecord[]) {
  const sorted = [...records].sort((a, b) => toDateMs(b.date) - toDateMs(a.date));
  const recent = sorted.slice(0, 20);
  const total = recent.length;
  if (total < 3) return null;
  const take = bestCount(total);
  const best = [...recent]
    .sort((a, b) => a.scoreDifferential - b.scoreDifferential)
    .slice(0, take);
  if (!best.length) return null;
  const avg = best.reduce((sum, item) => sum + item.scoreDifferential, 0) / best.length;
  return round1(avg * 0.96);
}

function normalizeHoleDetail(raw: unknown, fallbackIndex: number): HoleDetail | null {
  if (!raw || typeof raw !== 'object') return null;
  const h = raw as Partial<HoleDetail>;
  const holeNumber = typeof h.holeNumber === 'number' && Number.isFinite(h.holeNumber) ? h.holeNumber : fallbackIndex + 1;
  const par = typeof h.par === 'number' && Number.isFinite(h.par) ? h.par : 4;
  const strokes = typeof h.strokes === 'number' && Number.isFinite(h.strokes) ? h.strokes : par;
  const putts = typeof h.putts === 'number' && Number.isFinite(h.putts) ? h.putts : 2;
  let fairwayHit: boolean | null = null;
  if (par !== 3) {
    fairwayHit = typeof h.fairwayHit === 'boolean' ? h.fairwayHit : false;
  }
  const greenInRegulation = typeof h.greenInRegulation === 'boolean' ? h.greenInRegulation : calcGIR(strokes, par, putts);
  const distanceM =
    typeof h.distanceM === 'number' && Number.isFinite(h.distanceM) && h.distanceM > 0 ? h.distanceM : null;

  return {
    holeNumber,
    par,
    distanceM,
    strokes,
    putts,
    fairwayHit,
    greenInRegulation,
  };
}

function normalizeRecord(raw: unknown): HandicapRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Partial<HandicapRecord>;
  if (typeof item.date !== 'string' || typeof item.courseName !== 'string') return null;

  const holes: 18 | 9 = item.holes === 9 ? 9 : 18;
  const courseRating = Number(item.courseRating);
  const slopeRating = Number(item.slopeRating);
  const adjustedGrossScoreRaw = Number(item.adjustedGrossScore);
  if (!Number.isFinite(courseRating) || !Number.isFinite(slopeRating)) return null;

  const holeDetails = Array.isArray(item.holeDetails)
    ? item.holeDetails.map((h, i) => normalizeHoleDetail(h, i)).filter((h): h is HoleDetail => Boolean(h))
    : [];

  let adjustedGrossScore = Number.isFinite(adjustedGrossScoreRaw) ? adjustedGrossScoreRaw : 0;
  let totalPutts = typeof item.totalPutts === 'number' ? item.totalPutts : 0;
  let fairwaysHit = typeof item.fairwaysHit === 'number' ? item.fairwaysHit : 0;
  let fairwaysTotal = typeof item.fairwaysTotal === 'number' ? item.fairwaysTotal : 0;
  let greensInRegulation = typeof item.greensInRegulation === 'number' ? item.greensInRegulation : 0;
  let front9Strokes = typeof item.front9Strokes === 'number' ? item.front9Strokes : 0;
  let back9Strokes = typeof item.back9Strokes === 'number' ? item.back9Strokes : 0;

  if (holeDetails.length > 0) {
    const stats = calcStats(holeDetails, holes);
    totalPutts = stats.totalPutts;
    fairwaysHit = stats.fairwaysHit;
    fairwaysTotal = stats.fairwaysTotal;
    greensInRegulation = stats.greensInRegulation;
    front9Strokes = stats.front9Strokes;
    back9Strokes = stats.back9Strokes;
    adjustedGrossScore = calcAdjustedGrossFromHoles(holeDetails);
  } else if (!Number.isFinite(adjustedGrossScore) || adjustedGrossScore <= 0) {
    return null;
  }

  const scoreDifferential = Number.isFinite(Number(item.scoreDifferential))
    ? round1(Number(item.scoreDifferential))
    : calcDifferential(adjustedGrossScore, courseRating, slopeRating, holes);

  return {
    id: typeof item.id === 'string' && item.id.trim().length > 0 ? item.id : makeHandicapRecordId(),
    date: item.date,
    courseName: item.courseName.trim(),
    courseRating,
    slopeRating,
    adjustedGrossScore,
    holes,
    scoreDifferential,
    notes: typeof item.notes === 'string' ? item.notes : '',
    holeDetails,
    totalPutts,
    fairwaysHit,
    fairwaysTotal,
    greensInRegulation,
    front9Strokes,
    back9Strokes,
  };
}

export function normalizeHandicapRecords(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(normalizeRecord)
    .filter((item): item is HandicapRecord => Boolean(item))
    .sort((a, b) => toDateMs(b.date) - toDateMs(a.date));
}

export function loadHandicapRecords() {
  const raw = readJson<unknown>(HANDICAP_RECORDS_KEY, []);
  return normalizeHandicapRecords(raw);
}

export function saveHandicapRecords(records: HandicapRecord[]) {
  return writeJson(HANDICAP_RECORDS_KEY, normalizeHandicapRecords(records));
}

export function buildHandicapTrend(records: HandicapRecord[]) {
  const asc = [...records].sort((a, b) => toDateMs(a.date) - toDateMs(b.date));
  return asc.map((_, idx) => {
    const partial = asc.slice(0, idx + 1);
    return {
      date: asc[idx].date,
      index: calcHandicapIndex(partial),
    };
  });
}

/** Par72 标准杆分布（前9 + 后9） */
export const PAR_72_LAYOUT = {
  front: [4, 4, 3, 4, 5, 3, 4, 5, 4],
  back: [4, 3, 4, 5, 4, 3, 4, 4, 5],
} as const;

export const PAR_71_LAYOUT = {
  front: [4, 4, 3, 4, 4, 3, 4, 4, 5],
  back: [4, 3, 4, 5, 4, 3, 4, 4, 5],
} as const;

export const PAR_70_LAYOUT = {
  front: [4, 4, 3, 4, 5, 3, 4, 4, 4],
  back: [4, 3, 4, 4, 4, 3, 4, 4, 5],
} as const;

export function buildParArray(preset: '72' | '71' | '70' | 'custom', roundHoles: 18 | 9): number[] {
  let full: number[];
  switch (preset) {
    case '72':
      full = [...PAR_72_LAYOUT.front, ...PAR_72_LAYOUT.back];
      break;
    case '71':
      full = [...PAR_71_LAYOUT.front, ...PAR_71_LAYOUT.back];
      break;
    case '70':
      full = [...PAR_70_LAYOUT.front, ...PAR_70_LAYOUT.back];
      break;
    default:
      full = Array(18).fill(4);
      break;
  }
  return roundHoles === 9 ? full.slice(0, 9) : full;
}

export function buildInitialHoleDetails(pars: number[]): HoleDetail[] {
  return pars.map((par, i) => {
    const strokes = par;
    const putts = 2;
    return {
      holeNumber: i + 1,
      par,
      distanceM: null,
      strokes,
      putts,
      fairwayHit: par === 3 ? null : false,
      greenInRegulation: calcGIR(strokes, par, putts),
    };
  });
}

export function fairwayPercent(hit: number, total: number) {
  if (total <= 0) return null;
  return Math.round((hit / total) * 1000) / 10;
}
