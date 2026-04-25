/**
 * 在 Node 下用内存 localStorage 模拟浏览器，生成 21 场随机差点记录并校验 calcHandicapIndex。
 * 运行: npx tsx scripts/seed-21-mock-handicap.mts
 *
 * 在本机 Web 里载入：把生成的 `scripts/handicap-seed-21.json` 全文复制到 DevTools Console：
 *   localStorage.setItem('handicapRecords', '<粘贴 JSON 数组>');
 *   location.reload();
 */
import { writeFileSync } from 'node:fs';

const mem: Record<string, string> = {};
const localStoragePoly = {
  getItem: (k: string) => (k in mem ? mem[k]! : null),
  setItem: (k: string, v: string) => {
    mem[k] = v;
  },
  removeItem: (k: string) => {
    delete mem[k];
  },
  clear: () => {
    for (const k of Object.keys(mem)) delete mem[k];
  },
  get length() {
    return Object.keys(mem).length;
  },
  key: (i: number) => Object.keys(mem)[i] ?? null,
} as Storage;

/** readJsonArray/writeJson 依赖 `window`，仅 polyfill localStorage 不会写入 */
const g = globalThis as typeof globalThis & { window: typeof globalThis; localStorage: Storage };
g.localStorage = localStoragePoly;
g.window = g;

const { dirname, join } = await import('node:path');
const { fileURLToPath, pathToFileURL } = await import('node:url');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { HANDICAP_RECORDS_KEY, calcHandicapIndex, loadHandicapRecords } = (await import(
  pathToFileURL(join(root, 'lib', 'handicap.ts')).href,
)) as typeof import('../lib/handicap.ts');
const { replaceWithMockHandicapRounds } = (await import(
  pathToFileURL(join(root, 'lib', 'mock-handicap-rounds.ts')).href,
)) as typeof import('../lib/mock-handicap-rounds.ts');

const n = replaceWithMockHandicapRounds(21);
const records = loadHandicapRecords();
const hi = calcHandicapIndex(records);

/** 与 lib/handicap BEST_COUNT_BY_TOTAL 一致：20 场取 8 个最低微差 */
const recent = [...records]
  .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  .slice(0, 20);
const diffs = recent.map((r) => r.scoreDifferential).sort((a, b) => a - b);
const best8 = diffs.slice(0, 8);
const avg8 = best8.reduce((s, x) => s + x, 0) / best8.length;
const hiManual = Math.round(avg8 * 0.96 * 10) / 10;

console.log('seed-21-mock-handicap');
console.log('  wrote rounds:', n, 'loaded:', records.length);
console.log('  calcHandicapIndex:', hi);
console.log(
  '  sanity (avg of 8 lowest diffs in newest 20 × 0.96, round1):',
  hiManual,
  hi === hiManual ? 'OK' : 'MISMATCH',
);
console.log('  newest 5 differentials:', recent.slice(0, 5).map((r) => r.scoreDifferential));

const json = mem[HANDICAP_RECORDS_KEY] ?? JSON.stringify(records);
const outPath = join(process.cwd(), 'scripts', 'handicap-seed-21.json');
writeFileSync(outPath, json, 'utf8');
console.log('  JSON for localStorage →', outPath);
