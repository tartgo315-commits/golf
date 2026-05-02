/**
 * 对比首页差点与 statsEngine 顶栏差点（应一致）。
 * 运行: npx tsx scripts/trace-handicap.ts
 */
import { calcHandicapIndex, loadHandicapRecords, normalizeHandicapRecords } from '../lib/handicap';
import { computeAllStats, migrateOldData, validateRound } from '../src/utils/statsEngine';

async function main() {
  const normalized = normalizeHandicapRecords(await loadHandicapRecords());
  const rounds = [];
  for (const rec of normalized) {
    const round = migrateOldData([rec])[0];
    if (validateRound(round).ok) rounds.push(round);
  }
  rounds.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));

  const homeHi = calcHandicapIndex(normalized);
  const engine = computeAllStats(rounds, 'all');
  const engineHi = engine.scoring.handicapIndex;

  console.log('--- 差点口径对比 ---');
  console.log('场次(有效逐洞):', rounds.length);
  console.log('首页 calcHandicapIndex:', homeHi);
  console.log('statsEngine scoring.handicapIndex:', engineHi);
  console.log(
    '一致?',
    homeHi == null && engineHi == null
      ? '（均无）'
      : homeHi != null && engineHi != null && Math.abs(homeHi - engineHi) < 0.05
        ? '是'
        : '否（检查下方各场微差）',
  );

  const head = rounds.slice(0, 5);
  console.log('\n最近5场（引擎是否带上存盘微差）:');
  for (const r of head) {
    const sd =
      'scoreDifferential' in r && r.scoreDifferential != null ? r.scoreDifferential : '(无)';
    console.log(`  ${r.date} 总杆${r.totalScore} 存盘微差=${sd}`);
  }
}

void main();
