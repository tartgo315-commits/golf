/**
 * 冒烟：statsEngine.js API
 * 运行: npx tsx scripts/smoke-stats-engine.ts
 */
import { calcHandicapIndex, type HandicapRecord } from '../lib/handicap';
import {
  calcRoundFirPct,
  computeAllStats,
  filterRounds,
  migrateOldData,
  validateRound,
  type RoundData,
} from '../src/utils/statsEngine';

function hole(
  n: number,
  par: number,
  score: number,
  putts: number,
  fw: boolean | null,
): RoundData['holes'][0] {
  const nonPutt = score - putts;
  const girHit = nonPutt <= par - 2;
  return {
    holeNumber: n,
    par,
    score,
    putts,
    fairwayHit: par === 3 ? null : fw,
    girHit,
    upAndDown: !girHit ? score <= par : null,
    sandSave: null,
    penalties: 0,
    driveDistance: null,
    approachDistance: null,
    firstPuttDistance: null,
  };
}

function make18(id: string, date: string, bump: number): RoundData {
  const holes: RoundData['holes'] = [];
  for (let i = 1; i <= 18; i++) {
    const par = i % 5 === 0 ? 5 : i % 3 === 0 ? 3 : 4;
    const score = par + (i % 3) + bump;
    const putts = Math.min(2, Math.max(1, score - par));
    holes.push(hole(i, par, score, putts, par === 3 ? null : i % 2 === 0));
  }
  let sumS = 0,
    sumP = 0;
  for (const h of holes) {
    sumS += h.score;
    sumP += h.putts;
  }
  return {
    roundId: id,
    date,
    courseName: 'Smoke CC',
    courseRating: 72,
    slopeRating: 113,
    totalScore: sumS,
    totalPutts: sumP,
    holes,
    holeCount: 18,
  };
}

function roundToHandicapRecord(r: RoundData, scoreDifferential: number): HandicapRecord {
  const fh = r.holes.filter((h) => h.par !== 3);
  const fwHit = fh.filter((h) => h.fairwayHit === true).length;
  const gir = r.holes.filter((h) => h.girHit).length;
  const f9 = r.holes.filter((h) => h.holeNumber <= 9).reduce((s, h) => s + h.score, 0);
  const b9 = r.holes.filter((h) => h.holeNumber > 9).reduce((s, h) => s + h.score, 0);
  return {
    id: r.roundId,
    date: r.date,
    courseName: r.courseName,
    courseRating: r.courseRating,
    slopeRating: r.slopeRating,
    adjustedGrossScore: r.totalScore,
    holes: 18,
    scoreDifferential,
    notes: '',
    holeDetails: r.holes.map((h) => ({
      holeNumber: h.holeNumber,
      par: h.par,
      distanceM: null,
      strokes: h.score,
      putts: h.putts,
      fairwayHit: h.fairwayHit,
      greenInRegulation: h.girHit,
    })),
    totalPutts: r.totalPutts,
    fairwaysHit: fwHit,
    fairwaysTotal: fh.length,
    greensInRegulation: gir,
    front9Strokes: f9,
    back9Strokes: b9,
  };
}

function main() {
  const r1 = make18('a', '2026-01-10', 0);
  const r2 = make18('b', '2026-02-10', 1);
  const v = validateRound(r1);
  if (!v.ok) throw new Error(JSON.stringify(v));

  const f = filterRounds([r2, r1], 'last10');
  if (f.actualCount !== 2) throw new Error('filter');

  const all = computeAllStats([r2, r1], 'all');
  if (all.scoring.roundCount !== 2) throw new Error('count');
  if (all.putting.avgPuttsPerHole == null) throw new Error('putts');

  const fr = calcRoundFirPct(r1);
  if (fr == null) throw new Error('fir');

  const migrated = migrateOldData([]);
  if (migrated.length !== 0) throw new Error('migrate');

  const ra = make18('ha', '2026-03-01', 0);
  const rb = make18('hb', '2026-02-01', 0);
  const rc = make18('hc', '2026-01-01', 0);
  const recsHi = [
    roundToHandicapRecord(ra, 4),
    roundToHandicapRecord(rb, 5),
    roundToHandicapRecord(rc, 8),
  ];
  const hiHome = calcHandicapIndex(recsHi);
  const roundsHi = [
    { ...ra, scoreDifferential: 4 },
    { ...rb, scoreDifferential: 5 },
    { ...rc, scoreDifferential: 8 },
  ];
  for (const r of roundsHi) {
    if (!validateRound(r).ok) throw new Error('roundHi invalid');
  }
  const hiEngine = computeAllStats(roundsHi, 'all').scoring.handicapIndex;
  if (hiHome == null || hiEngine == null || Math.abs(hiHome - hiEngine) > 0.001) {
    throw new Error(`handicapIndex mismatch home=${hiHome} engine=${hiEngine}`);
  }

  console.log('smoke ok', { engineHi: all.scoring.handicapIndex, fir: fr.toFixed(1), hiAlign: hiEngine });
}

main();
