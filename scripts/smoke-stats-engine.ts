/**
 * 冒烟：statsEngine.js API
 * 运行: npx tsx scripts/smoke-stats-engine.ts
 */
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

  console.log('smoke ok', { engineHi: all.scoring.handicapIndex, fir: fr.toFixed(1) });
}

main();
