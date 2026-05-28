/**
 * Node 可重复跑的核心逻辑压测（不启动 Metro / 不依赖真机）。
 * 覆盖：WHS 微差、差点指数取样、趋势、统计解析、AI 复盘文本解析等。
 */
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const hb = await import(pathToFileURL(join(root, 'lib', 'handicap.ts')).href);
const ha = await import(pathToFileURL(join(root, 'utils', 'holeAnalysis.ts')).href);
const hsa = await import(pathToFileURL(join(root, 'lib', 'home-score-analytics.ts')).href);

type HandicapRecord = import('../lib/handicap.ts').HandicapRecord;

const {
  calcDifferential,
  calcRoundScoreDifferential,
  calcHandicapIndex,
  buildHandicapTrend,
  normalizeHandicapRecords,
  playingCourseHandicap,
  calcAdjustedGrossFromHoles,
  fairwayPercent,
  recordHasPendingRoundStats,
  compareHandicapRecordsChronologicalAsc,
} = hb as typeof import('../lib/handicap.ts');
const { parseStructuredAiReview } = ha as typeof import('../utils/holeAnalysis.ts');
const { buildSliceStats } = hsa as typeof import('../lib/home-score-analytics.ts');

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

/** 宝塚旧コース・Back：CR 71.5 SR 137 par 70，18 洞 AGS 85 */
{
  const d18 = calcDifferential(85, 71.5, 137, 18);
  expect('Takarazuka Back 18h differential', Math.abs(d18 - 11.1) < 0.001, `got ${d18}`);
  const rawBase = ((40 - 71.5) * 113) / 137;
  const d9 = calcDifferential(40, 71.5, 137, 9);
  const manual9 = Math.round(rawBase * 2 * 10) / 10;
  expect('9h diff = round1(2 × sloped base)', d9 === manual9, `d9=${d9} manual=${manual9}`);
}

{
  const whs = calcRoundScoreDifferential(85, 18, { courseRating: 71.5, slopeRating: 137 }, 70);
  expect('calcRound WHS source', whs.source === 'whs' && whs.scoreDifferential === 11.1);
  const est = calcRoundScoreDifferential(85, 18, null, 72);
  expect(
    'calcRound estimated when no CR/SR',
    est.source === 'estimated' && est.scoreDifferential === 13,
  );
}

{
  const mk = (id: string, date: string, diff: number): HandicapRecord =>
    ({
      id,
      date,
      courseName: 't',
      courseRating: 72,
      slopeRating: 113,
      adjustedGrossScore: 72 + diff,
      holes: 18,
      scoreDifferential: diff,
      notes: '',
      holeDetails: [],
      totalPutts: 32,
      fairwaysHit: 7,
      fairwaysTotal: 14,
      greensInRegulation: 8,
      front9Strokes: 0,
      back9Strokes: 0,
      handicapProcessed: true,
    }) as HandicapRecord;

  expect('HI 0 rounds', calcHandicapIndex([]) === null);
  expect('HI 1 round', calcHandicapIndex([mk('a', '2024-01-02', 10)]) === null);
  expect(
    'HI 2 rounds',
    calcHandicapIndex([mk('a', '2024-01-02', 10), mk('b', '2024-01-03', 12)]) === null,
  );
  const three = [mk('a', '2024-01-01', 10), mk('b', '2024-01-02', 12), mk('c', '2024-01-03', 8)];
  const hi3 = calcHandicapIndex(three);
  expect('HI 3 rounds is number', typeof hi3 === 'number' && hi3 !== null && Number.isFinite(hi3));
  const inProgress = mk('live', '2024-01-04', 9);
  inProgress.handicapProcessed = false;
  inProgress.sourceRoundStatus = 'in_progress';
  expect(
    'HI excludes in_progress',
    calcHandicapIndex([...three, inProgress]) === hi3,
  );
  const many = Array.from({ length: 20 }, (_, i) =>
    mk(`r${i}`, `2024-02-${String((i % 28) + 1).padStart(2, '0')}`, 5 + (i % 7)),
  );
  const hi20 = calcHandicapIndex(many);
  expect('HI 20 rounds', typeof hi20 === 'number' && hi20 !== null);
}

{
  const one = normalizeHandicapRecords([
    {
      id: '1',
      date: '2024-03-01',
      courseName: 'X',
      courseRating: 72,
      slopeRating: 113,
      adjustedGrossScore: 90,
      holes: 18,
      scoreDifferential: 18,
      notes: '',
      holeDetails: [],
      totalPutts: 30,
      fairwaysHit: null,
      fairwaysTotal: null,
      greensInRegulation: null,
      front9Strokes: 0,
      back9Strokes: 0,
      handicapProcessed: true,
      submittedAt: Date.now(),
    },
  ]);
  expect('normalize 1 quick-like row', one.length === 1);
  const t = buildHandicapTrend(one);
  expect('trend last point index null when HI null', t.length === 1 && t[0]!.index === null);
}

{
  const ch = playingCourseHandicap(15, 137, 71.5, 70);
  expect('playing CH integer', ch === Math.round(ch));
  const pars = hb.buildParArray('72', 18);
  const details = pars.map((par, i) => ({
    holeNumber: i + 1,
    par,
    distanceM: null,
    strokes: 20,
    putts: 3,
    fairwayHit: par === 3 ? (null as boolean | null) : false,
    greenInRegulation: false,
  }));
  const ag = calcAdjustedGrossFromHoles(details, 18, ch, undefined);
  expect('NDB caps vs raw 360 gross when CH set', ag < 20 * 18 && ag > 72);
}

{
  expect('fairway null', fairwayPercent(null, 14) === null);
  expect('fairway ok', fairwayPercent(7, 14) === 50);
}

{
  const quickLike = {
    id: 'q',
    date: '2024-04-01',
    courseName: 'Q',
    courseRating: 72,
    slopeRating: 113,
    adjustedGrossScore: 88,
    holes: 18,
    scoreDifferential: 16,
    notes: '',
    holeDetails: [],
    totalPutts: 33,
    fairwaysHit: null,
    fairwaysTotal: null,
    greensInRegulation: null,
    front9Strokes: 0,
    back9Strokes: 0,
  };
  expect(
    'pending stats quick',
    recordHasPendingRoundStats(normalizeHandicapRecords([quickLike])[0]!) === true,
  );
}

{
  const raw = `1. 推杆不稳\n2. - 练习 10 英尺推杆\n- 节奏练习\n3. 下场少攻旗`;
  const p = parseStructuredAiReview(raw);
  expect(
    'AI parse 3 sections',
    p != null &&
      p.problem.includes('推杆') &&
      p.strategy.length > 0 &&
      p.drills.filter(Boolean).length >= 1,
  );
  expect('AI parse empty fail', parseStructuredAiReview('') === null);
  expect('AI parse missing 3 fail', parseStructuredAiReview('1. only problem\n2. drills') === null);
}

{
  const r18 = (g: number, id: string): HandicapRecord =>
    ({
      id,
      date: `2024-05-${id}`,
      courseName: 'c',
      courseRating: 72,
      slopeRating: 113,
      adjustedGrossScore: g,
      holes: 18,
      scoreDifferential: g - 72,
      notes: '',
      holeDetails: [],
      totalPutts: 30,
      fairwaysHit: 6,
      fairwaysTotal: 12,
      greensInRegulation: 9,
      front9Strokes: 0,
      back9Strokes: 0,
    }) as HandicapRecord;
  const r9 = (g: number, id: string): HandicapRecord => ({
    ...r18(g, id),
    holes: 9 as const,
    scoreDifferential: (g - 36) * 2,
  });
  const slice = [r9(45, 'a'), r18(85, 'b')];
  const st = buildSliceStats(slice);
  expect('slice avgGross equiv18 mean (45×2+85)/2', st.avgGross === 87.5);
}

{
  // 9 洞只录 5 洞逐洞：总杆统计不得用 5 洞杆数和去折算，须回退整场 adjustedGross（9→×2）
  const partialHoles = [1, 2, 3, 4, 5].map((holeNumber) => ({
    holeNumber,
    par: 4,
    distanceM: null as number | null,
    strokes: 5,
    putts: 2,
    fairwayHit: null as boolean | null,
    greenInRegulation: false,
  }));
  const r: HandicapRecord = {
    id: 'partial-9',
    date: '2024-07-01',
    courseName: 'c',
    courseRating: 36,
    slopeRating: 113,
    adjustedGrossScore: 45,
    holes: 9,
    scoreDifferential: 9,
    notes: '',
    holeDetails: partialHoles,
    totalPutts: null,
    fairwaysHit: null,
    fairwaysTotal: null,
    greensInRegulation: null,
    front9Strokes: 0,
    back9Strokes: 0,
  };
  const st = buildSliceStats([r]);
  const wrongIfSum5 = 5 * 5 * 2;
  expect(
    'buildSliceStats 9h partial holeDetails ignores stroke sum (not equiv from 25)',
    st.avgGross === 90 && st.avgGross !== wrongIfSum5,
  );
  expect(
    'buildSliceStats partial holeDetails still increments roundsWithHoles',
    st.roundsWithHoles === 1,
  );
}

{
  const rows = [
    { date: '2024-06-02', id: 'b' },
    { date: '2024-06-01', id: 'a' },
  ].map(
    (x, i) =>
      ({
        id: x.id,
        date: x.date,
        courseName: 'c',
        courseRating: 72,
        slopeRating: 113,
        adjustedGrossScore: 80 + i,
        holes: 18,
        scoreDifferential: 8 + i,
        notes: '',
        holeDetails: [],
        totalPutts: 30,
        fairwaysHit: 6,
        fairwaysTotal: 12,
        greensInRegulation: 9,
        front9Strokes: 0,
        back9Strokes: 0,
      }) as HandicapRecord,
  );
  const sorted = [...rows].sort(compareHandicapRecordsChronologicalAsc);
  expect('chronological asc by date', sorted[0]!.id === 'a' && sorted[1]!.id === 'b');
}

console.log('');
console.log(`handicap-core: 通过 ${passed}，失败 ${failed}`);
if (failed > 0) process.exit(1);
