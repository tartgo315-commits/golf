import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { submittedAtMs, isRoundLocked } = await import(
  pathToFileURL(join(__dirname, '..', 'utils', 'roundLock.ts')).href
);

const H = 60 * 60 * 1000;
const now = Date.now();

let passed = 0;
let failed = 0;

function report(caseNum: number, ok: boolean) {
  if (ok) {
    console.log(`✓ case ${caseNum} passed`);
    passed += 1;
  } else {
    console.log(`✗ case ${caseNum} failed`);
    failed += 1;
  }
}

// 1. 合法 submittedAt（25小时前）+ handicapProcessed true → isRoundLocked 应为 true
{
  const submittedAt = now - 25 * H;
  const locked = isRoundLocked({
    handicapProcessed: true,
    submittedAt,
    date: '2020-01-01',
    id: 'case-1',
  });
  report(1, locked === true);
}

// 2. 合法 submittedAt（1小时前）+ handicapProcessed true → isRoundLocked 应为 false
{
  const submittedAt = now - 1 * H;
  const locked = isRoundLocked({
    handicapProcessed: true,
    submittedAt,
    date: '2020-01-01',
    id: 'case-2',
  });
  report(2, locked === false);
}

// 3. submittedAt 为 NaN → 回退到 date，控制台出现 warn
{
  const warns: string[] = [];
  const orig = console.warn;
  console.warn = (...args: unknown[]) => {
    warns.push(args.map(String).join(' '));
    orig.apply(console, args as Parameters<typeof console.warn>);
  };
  try {
    const dateStr = '2024-06-15';
    const want = Date.parse(dateStr);
    const got = submittedAtMs({
      date: dateStr,
      submittedAt: Number.NaN,
      id: 'case-3',
    });
    const hasWarn = warns.some((w) => w.includes('[roundLock]') && w.includes('submittedAt 无效') && w.includes('case-3'));
    report(3, got === want && hasWarn);
  } finally {
    console.warn = orig;
  }
}

// 4. handicapProcessed false → isRoundLocked 为 false
{
  const locked = isRoundLocked({
    handicapProcessed: false,
    submittedAt: now - 100 * H,
    date: '2020-01-01',
    id: 'case-4',
  });
  report(4, locked === false);
}

console.log('');
console.log(`汇总: 通过 ${passed}，失败 ${failed}`);
if (failed > 0) {
  process.exit(1);
}
