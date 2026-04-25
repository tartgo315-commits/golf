/**
 * 单条 mock 原始对象经 normalize 是否保留（Node）。
 * 运行: npx tsx scripts/debug-normalize-one.mts
 */
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const hb = await import(pathToFileURL(join(root, 'lib', 'handicap.ts')).href);
const {
  buildParArray,
  calcGIR,
  makeHandicapRecordId,
  normalizeHandicapRecords,
} = hb as typeof import('../lib/handicap.ts');

function randInt(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1));
}
function buildRandomHoleDetails18() {
  const pars = buildParArray('72', 18);
  return pars.map((par, i) => {
    const rel = randInt(-2, 5);
    let strokes = par + rel;
    if (strokes < 1) strokes = 1;
    let putts = randInt(1, 3);
    if (putts > strokes) putts = strokes;
    const fairwayHit: boolean | null = par === 3 ? null : Math.random() < 0.45;
    return {
      holeNumber: i + 1,
      par,
      distanceM: null,
      strokes,
      putts,
      fairwayHit,
      greenInRegulation: calcGIR(strokes, par, putts),
    };
  });
}
const raw = [
  {
    id: makeHandicapRecordId(),
    date: '2026-01-01',
    courseName: 't',
    courseRating: 72,
    slopeRating: 113,
    holes: 18,
    notes: '',
    holeDetails: buildRandomHoleDetails18(),
  },
];
const n = normalizeHandicapRecords(raw);
console.log('len', n.length, n[0]?.adjustedGrossScore, n[0]?.scoreDifferential);
