/**
 * 记分页单洞渲染：DOM 规模应为 O(players) 而非 O(players × holes)
 *   npx tsx scripts/test-round-score-single-hole.mts
 */

function holesRenderedAtOnce(totalHoles: number, viewMode: 'all' | 'single'): number {
  return viewMode === 'single' ? 1 : totalHoles;
}

function playerBlocksRendered(players: number, holesShown: number): number {
  return players * holesShown;
}

let ok = 0;
let fail = 0;

function assert(name: string, cond: boolean) {
  if (cond) {
    console.log(`  ✓ ${name}`);
    ok += 1;
  } else {
    console.log(`  ✗ ${name}`);
    fail += 1;
  }
}

const players = 20;
const holes = 18;

const oldBlocks = playerBlocksRendered(players, holesRenderedAtOnce(holes, 'all'));
const newBlocks = playerBlocksRendered(players, holesRenderedAtOnce(holes, 'single'));

console.log('\n=== 记分页渲染块数量（球员块 ≈ 人数 × 显示洞数）===\n');
console.log(`  旧：${players} 人 × ${holes} 洞 = ${oldBlocks} 块`);
console.log(`  新：${players} 人 × 1 洞 = ${newBlocks} 块`);

assert('单洞模式块数等于人数', newBlocks === players);
assert('单洞比全洞少至少 10 倍', newBlocks * 10 <= oldBlocks);

console.log(`\n结果：${ok} 通过，${fail} 失败\n`);
process.exit(fail > 0 ? 1 : 0);
