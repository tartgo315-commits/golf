/**
 * 近期修复回归：差点指数过滤、AI 补全 JSON 解析与批量 patch
 */
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const hb = await import(pathToFileURL(join(root, 'lib', 'handicap.ts')).href);
const { calcHandicapIndex } = hb as typeof import('../lib/handicap.ts');
type HandicapRecord = import('../lib/handicap.ts').HandicapRecord;

let passed = 0;
let failed = 0;

function expect(name: string, cond: boolean, detail?: string) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const mk = (id: string, diff: number, extra: Partial<HandicapRecord> = {}): HandicapRecord =>
  ({
    id,
    date: '2024-06-01',
    courseName: 't',
    courseRating: 72,
    slopeRating: 113,
    adjustedGrossScore: 80,
    holes: 18,
    scoreDifferential: diff,
    notes: '',
    holeDetails: [],
    totalPutts: 32,
    fairwaysHit: 7,
    fairwaysTotal: 14,
    greensInRegulation: 8,
    front9Strokes: 40,
    back9Strokes: 40,
    handicapProcessed: true,
    ...extra,
  }) as HandicapRecord;

{
  const legacy = [
    mk('a', 10, { handicapProcessed: undefined }),
    mk('b', 12, { handicapProcessed: undefined }),
    mk('c', 8, { handicapProcessed: undefined }),
  ];
  expect('legacy local (no flag) counts for HI', calcHandicapIndex(legacy) != null);

  const withLive = [
    ...legacy,
    mk('live', 5, { handicapProcessed: false, sourceRoundStatus: 'in_progress' }),
  ];
  expect(
    'in_progress excluded',
    calcHandicapIndex(withLive) === calcHandicapIndex(legacy),
  );
}

{
  const raw = '说明文字\n```json\n{"loft":"10.5°","shaft":"Ventus","shaftFlex":"S"}\n```\n';
  const clean = raw.replace(/```json|```/g, '').trim();
  const jsonSlice = clean.match(/\{[\s\S]*\}/)?.[0] ?? clean;
  const specs = JSON.parse(jsonSlice) as Record<string, string>;
  expect('AI json extract loft', specs.loft === '10.5°');
  expect('AI json extract shaft', specs.shaft === 'Ventus');

  type Club = { id: string; loft: string; shaftModel: string; flex: string };
  const club: Club = { id: '1w', loft: '', shaftModel: '', flex: '' };
  const AI_SPEC: Record<string, keyof Club> = {
    loft: 'loft',
    shaft: 'shaftModel',
    shaftFlex: 'flex',
  };
  const patch: Partial<Club> = {};
  for (const f of Object.keys(AI_SPEC) as (keyof typeof AI_SPEC)[]) {
    const v = specs[f];
    if (typeof v === 'string' && v.trim()) patch[AI_SPEC[f]!] = v.trim();
  }
  const merged = { ...club, ...patch };
  expect('batch patch merges all fields', merged.loft === '10.5°' && merged.shaftModel === 'Ventus' && merged.flex === 'S');
}

console.log(`\nrecent-fixes: 通过 ${passed}，失败 ${failed}`);
process.exit(failed > 0 ? 1 : 0);
