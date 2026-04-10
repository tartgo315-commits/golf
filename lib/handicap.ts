import { readJson, writeJson } from '@/lib/local-storage';

export const HANDICAP_RECORDS_KEY = 'handicapRecords';

export type HandicapRecord = {
  id: string;
  date: string;
  courseName: string;
  courseRating: number;
  slopeRating: number;
  adjustedGrossScore: number;
  holes: 18 | 9;
  scoreDifferential: number;
  notes: string;
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

function normalizeRecord(raw: unknown): HandicapRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Partial<HandicapRecord>;
  if (typeof item.date !== 'string' || typeof item.courseName !== 'string') return null;

  const holes: 18 | 9 = item.holes === 9 ? 9 : 18;
  const courseRating = Number(item.courseRating);
  const slopeRating = Number(item.slopeRating);
  const adjustedGrossScore = Number(item.adjustedGrossScore);
  if (!Number.isFinite(courseRating) || !Number.isFinite(slopeRating) || !Number.isFinite(adjustedGrossScore)) return null;

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
