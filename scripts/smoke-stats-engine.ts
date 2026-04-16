/**
 * 冒烟：statsEngine 新 API
 * 运行: npx tsx scripts/smoke-stats-engine.ts
 */
import {
  calcPostingDifferentialForRound,
  calcRoundFirPct,
  calcTrend,
  computeAllStats,
  filterRounds,
  hydrateRoundTotals,
  migrateOldData,
  validateRound,
  type HoleData,
  type RoundData,
} from '../src/utils/statsEngine';

function makeHole(idx: number, par: number, score: number, putts: number, fairwayHit: boolean | null): HoleData {
  const nonPutt = score - putts;
  const girHit = nonPutt <= par - 2;
  const missGir = !girHit;
  return {
    holeNumber: idx,
    par,
    score,
    putts,
    fairwayHit: par === 3 ? null : fairwayHit,
    girHit,
    upAndDown: missGir ? score <= par : null,
    sandSave: null,
    penalties: 0,
    driveDistance: null,
    approachDistance: null,
    puttsDistance: null,
    missDirection: null,
  };
}

function makeRound18(id: string, date: string, strokeOffset: number): RoundData {
  const holes: HoleData[] = [];
  for (let i = 1; i <= 18; i++) {
    const par = i % 5 === 0 ? 5 : i % 3 === 0 ? 3 : 4;
    const base = par + (strokeOffset % 3);
    const putts = Math.min(2, Math.max(1, base - 2));
    const score = base;
    holes.push(makeHole(i, par, score, putts, par === 3 ? null : i % 2 === 0));
  }
  const partial: RoundData = {
    roundId: id,
    date,
    courseName: 'Smoke CC',
    courseRating: 72.0,
    slopeRating: 113,
    teeColor: null,
    totalScore: 0,
    totalPutts: 0,
    totalFairways: 0,
    totalGIR: 0,
    holes,
    holeCount: 18,
  };
  return hydrateRoundTotals(partial);
}

function main() {
  const r1 = makeRound18('r1', '2025-01-10', 0);
  const r2 = makeRound18('r2', '2025-02-10', 1);
  const r3 = makeRound18('r3', '2025-03-10', 2);

  const v1 = validateRound(r1);
  if (!v1.ok) throw new Error(`validate r1: ${JSON.stringify(v1)}`);
  console.log('validateRound: ok');

  const diff = calcPostingDifferentialForRound(r1);
  if (diff == null || !Number.isFinite(diff)) throw new Error(`posting diff: ${diff}`);
  console.log('calcPostingDifferentialForRound:', diff);

  const f = filterRounds([r3, r2, r1], 'last10');
  if (f.actualCount !== 3 || f.requestedCount !== 10) throw new Error('filterRounds');
  const stats = computeAllStats(f.rounds);
  if (!stats.scoring.handicapIndex.ok) throw new Error('HI');
  console.log('computeAllStats HI:', stats.scoring.handicapIndex.index);

  const tr = calcTrend([70, 72, 71, 73, 74, 75, 76, 77, 78, 79, 80, 81], 5);
  if (tr.direction !== 'up') throw new Error(`trend ${tr.direction}`);
  console.log('calcTrend:', tr);

  const migrated = migrateOldData([]);
  if (migrated.length !== 0) throw new Error('migrate empty');
  console.log('migrateOldData([]): ok');

  const fr = calcRoundFirPct(r1);
  if (fr == null) throw new Error('fir');
  console.log('calcRoundFirPct:', fr.toFixed(1));

  console.log('\nAll smoke checks passed.');
}

main();
