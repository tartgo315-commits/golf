/**
 * 一次性冒烟：验证 statsEngine 可导入且核心函数不抛错。
 * 运行: npx tsx scripts/smoke-stats-engine.ts
 */
import {
  calcFourDimensionStatsFromRounds,
  calcGirByApproachDistanceBuckets,
  calcHandicapIndexFromRounds,
  calcPostingDifferentialForRound,
  calcTrend,
  hydrateRoundTotals,
  migrateOldData,
  validateRound,
  type HoleShot,
  type RoundData,
} from '../src/utils/statsEngine';

function makeHole(
  idx: number,
  par: number,
  score: number,
  putts: number,
  fairwayHit: boolean | null,
): HoleShot {
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
    penalties: 0,
  };
}

function makeRound18(id: string, date: string, strokeOffset: number): RoundData {
  const holes: HoleShot[] = [];
  for (let i = 1; i <= 18; i++) {
    const par = i % 5 === 0 ? 5 : i % 3 === 0 ? 3 : 4;
    const base = par + (strokeOffset % 3);
    const putts = Math.min(2, base - 1);
    const score = base;
    holes.push(makeHole(i, par, score, putts, par === 3 ? null : i % 2 === 0));
  }
  const partial: RoundData = {
    roundId: id,
    date,
    courseName: 'Smoke CC',
    courseRating: 72.0,
    slopeRating: 113,
    holeCount: 18,
    holes,
    totalScore: 0,
    totalPutts: 0,
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

  const hi = calcHandicapIndexFromRounds([r3, r2, r1]);
  if (!hi.ok) throw new Error(`HI: ${JSON.stringify(hi)}`);
  console.log('calcHandicapIndexFromRounds:', hi.index, hi.scoresUsed, hi.bestDiffsUsed);

  const four = calcFourDimensionStatsFromRounds([r1, r2, r3]);
  console.log('four FIR%', four.driving.firPct?.toFixed(1), 'GIR%', four.approach.girPct?.toFixed(1));

  const trend = calcTrend([r3, r2, r1, r3, r2, r1], 'avgScore', 2);
  console.log('calcTrend:', trend.trend, 'valuesLen', trend.values.length);

  const buckets = calcGirByApproachDistanceBuckets([
    {
      ...r1,
      holes: r1.holes.map((h, i) =>
        i === 0 ? { ...h, approachDistanceYds: 95 } : { ...h, approachDistanceYds: 120 },
      ),
    },
  ]);
  console.log('buckets[0]', buckets[0]);

  const migrated = migrateOldData([]);
  if (!Array.isArray(migrated) || migrated.length !== 0) throw new Error('migrate empty');
  console.log('migrateOldData([]): ok');

  const fakeOld = [
    {
      id: 'old-1',
      date: '2024-06-01',
      courseName: 'Old',
      courseRating: 72,
      slopeRating: 113,
      adjustedGrossScore: 90,
      holes: 18,
      scoreDifferential: 18,
      notes: '',
      holeDetails: Array.from({ length: 18 }, (_, i) => {
        const par = 4;
        const strokes = 5;
        const putts = 2;
        return {
          holeNumber: i + 1,
          par,
          distanceM: null,
          strokes,
          putts,
          fairwayHit: false,
          greenInRegulation: strokes - putts <= par - 2,
        };
      }),
      totalPutts: 36,
      fairwaysHit: 0,
      fairwaysTotal: 14,
      greensInRegulation: 0,
      front9Strokes: 45,
      back9Strokes: 45,
    },
  ];
  const mig = migrateOldData(fakeOld);
  if (mig.length !== 1) throw new Error(`migrate count ${mig.length}`);
  const vm = validateRound(mig[0]!);
  if (!vm.ok) throw new Error(`migrate validate: ${JSON.stringify(vm)}`);
  console.log('migrateOldData(sample): ok, holes', mig[0]!.holes.length);

  console.log('\nAll smoke checks passed.');
}

main();
