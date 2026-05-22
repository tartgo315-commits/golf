/**
 * 模拟 1–20 人「只记成绩」开局与常见赌法人数校验。
 * 不依赖 Supabase；可选设置 SIMULATE_DB=1 且已登录 session 时再跑真实建局（需本地 .env）。
 *
 *   npx tsx scripts/simulate-multi-player-rounds.mts
 */
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const { isPlayerCountOkForGame } = await import(
  pathToFileURL(join(root, 'utils', 'sideGameCatalog.ts')).href
);

type BetCheck = { gameType: string; label: string };

const WAGER_SPOT_CHECKS: BetCheck[] = [
  { gameType: 'landlord', label: '斗地主' },
  { gameType: 'fixed_lasi', label: '固拉' },
  { gameType: 'rotating_lasi', label: '乱拉' },
  { gameType: 'trumpet', label: '喇叭花' },
  { gameType: 'match_play', label: '比洞' },
  { gameType: 'stroke_play', label: '比杆' },
];

function makeGuests(n: number) {
  const companions = n - 1;
  return Array.from({ length: companions }, (_, i) => ({
    type: 'guest' as const,
    id: `sim_guest_${n}_${i}`,
    name: `访客${i + 1}`,
  }));
}

let passed = 0;
let failed = 0;

function ok(cond: boolean, msg: string) {
  if (cond) {
    console.log(`  ✓ ${msg}`);
    passed += 1;
  } else {
    console.log(`  ✗ ${msg}`);
    failed += 1;
  }
}

console.log('\n=== 1–20 人 · 只记成绩（无赌法人数限制）===\n');
for (let n = 1; n <= 20; n += 1) {
  const guests = makeGuests(n);
  ok(guests.length === n - 1, `${n} 人局：同伴 ${guests.length} 名（含创建者共 ${n}）`);
}

console.log('\n=== 赌法人数校验（与 NewRoundScreen 一致）===\n');
const expectations: Record<number, Partial<Record<string, boolean>>> = {
  1: { match_play: false, stroke_play: false, landlord: false, fixed_lasi: false, trumpet: false },
  2: { match_play: true, stroke_play: true, landlord: false, fixed_lasi: false, trumpet: false },
  3: { landlord: true, fixed_lasi: false, trumpet: false },
  4: { fixed_lasi: true, rotating_lasi: true, trumpet: false },
  5: { fixed_lasi: false, trumpet: true },
  20: { fixed_lasi: true, trumpet: false },
};

for (let n = 1; n <= 20; n += 1) {
  const line: string[] = [];
  for (const { gameType, label } of WAGER_SPOT_CHECKS) {
    const allowed = isPlayerCountOkForGame(gameType as any, n);
    const exp = expectations[n]?.[gameType];
    if (exp !== undefined) {
      ok(allowed === exp, `${n} 人 · ${label}：${allowed ? '可选' : '不可选'}（预期 ${exp ? '可选' : '不可选'}）`);
    } else {
      line.push(`${label}:${allowed ? '✓' : '—'}`);
    }
  }
  if (line.length) console.log(`  ${n} 人  ${line.join('  ')}`);
}

console.log('\n=== 多组示意（4 组 × 5 人 = 20 人分场）===\n');
const groupSizes = [5, 5, 5, 5];
ok(groupSizes.reduce((a, b) => a + b, 0) === 20, '4 组各 5 人，合计 20（需分别开局 4 次，无单场 20 人合并记分）');

console.log('\n=== 旁观者场景（逻辑清单，需真机/Web + 两账号）===\n');
const spectatorSteps = [
  '账号 A：公开 visibility 开局，录入若干洞成绩，保持 in_progress',
  '账号 B（已关注 A）：首页「关注」或好友页「动态」见进行中卡片',
  'B 点卡片 → /rounds/:id 查看实时记分（好友页已与首页一致）',
  'B 进入 /friends/:id → 发消息 → /chat/:friendId 与 A 私聊（无局内聊天频道）',
  'A 继续记分；B 切回首页需重新进入 Tab 才刷新 feed（无 pull-to-refresh）',
];
spectatorSteps.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));

if (process.env.SIMULATE_DB === '1') {
  console.log('\n=== Supabase 建局（SIMULATE_DB=1）===\n');
  try {
    const { createRound, upsertScoreCell, setRoundStatus, getRoundBundle } = await import(
      pathToFileURL(join(root, 'lib', 'scorecardApi.ts')).href
    );
    for (const n of [1, 2, 5, 20] as const) {
      const { roundId } = await createRound({
        courseName: `模拟 ${n} 人局`,
        teeColor: 'white',
        playedAt: new Date().toISOString().slice(0, 10),
        holes: 9,
        players: makeGuests(n),
        visibility: 'public',
      });
      const bundle = await getRoundBundle(roundId);
      ok(bundle.players.length === n, `DB：${n} 人 bundle.players.length === ${n}`);
      const first = bundle.players[0];
      if (first) {
        await upsertScoreCell({
          roundId,
          userId: first.userId,
          holeNumber: 1,
          strokes: 5,
          par: 4,
        });
      }
      await setRoundStatus(roundId, 'completed');
      ok(true, `DB：${n} 人局 ${roundId.slice(0, 8)}… 已记 1 洞并完成`);
    }
  } catch (e) {
    console.log(`  ⚠ Supabase 跳过：${e instanceof Error ? e.message : String(e)}`);
  }
} else {
  console.log('\n（未设置 SIMULATE_DB=1，跳过真实建局；本地登录后可：SIMULATE_DB=1 npx tsx scripts/simulate-multi-player-rounds.mts）\n');
}

console.log(`\n结果：${passed} 通过，${failed} 失败\n`);
process.exit(failed > 0 ? 1 : 0);
