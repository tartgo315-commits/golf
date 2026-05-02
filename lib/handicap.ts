import { readJsonArray, writeJson } from '@/lib/local-storage';
import { isRoundLockedSync } from '@/utils/roundLock';

export const HANDICAP_RECORDS_KEY = 'handicapRecords';

/** AI 复盘建议（与 holeData 同级，可选） */
export type HandicapAiReview = {
  problem: string;
  drills: string[];
  strategy: string;
  generatedAt: number;
  /** 解析失败时保留模型原文便于排查 */
  rawText?: string;
};

/** 成绩详情页「逐洞复盘」数据（可选，不影响差点计算） */
export type HandicapHoleData = {
  hole: number;
  par: number;
  score: number;
  putts: number;
  fir: boolean | null;
  gir: boolean | null;
  penalty: number;
};

/** 单洞记录 */
export type HoleDetail = {
  holeNumber: number;
  par: number;
  /** 洞距离（米），未填可为 null */
  distanceM: number | null;
  strokes: number;
  putts: number;
  /** Par3 为 null 表示不适用 */
  fairwayHit: boolean | null;
  /** 上果岭（标准杆内上果岭） */
  greenInRegulation: boolean;
};

export type HandicapRecord = {
  id: string;
  date: string;
  courseName: string;
  courseRating: number;
  slopeRating: number;
  /** 用于差点计算的每场总杆（已按洞上限规则调整） */
  adjustedGrossScore: number;
  holes: 18 | 9;
  scoreDifferential: number;
  notes: string;
  holeDetails: HoleDetail[];
  /** 汇总统计；`null` 表示未录入（与 0 区分），逐洞完整时会由计算覆盖为数字 */
  totalPutts: number | null;
  fairwaysHit: number | null;
  fairwaysTotal: number | null;
  greensInRegulation: number | null;
  front9Strokes: number;
  back9Strokes: number;
  /**
   * 保存本场成绩时用于 Net Double Bogey 封顶的 Playing Course Handicap（整数）。
   * 无逐洞 stroke index 时，用洞号近似 SI（1 最难）。旧数据无此字段时按 par+2 封顶。
   */
  playingCourseHandicap?: number;
  /** 可选：每洞 Stroke Index（长度与洞数一致，1..18 或 1..9，不重复），用于真实 NDB 让杆分配 */
  strokeIndexMap?: number[];
  /** 差点重算并写入完成后为 true；缺省视为 false */
  handicapProcessed?: boolean;
  /** 成绩提交时间戳（ms），用于 24h 编辑窗口；缺省时锁定判断回退 `date` */
  submittedAt?: number;
  /** 可选：逐洞复盘（与 holeDetails 独立，不触发差点重算） */
  holeData?: HandicapHoleData[];
  /** 可选：本场 AI 复盘建议（缓存，避免重复请求） */
  aiReview?: HandicapAiReview;
  /**
   * 可选：上场天气（手填，用于以后看成绩单时回忆当时环境）。
   * 可写气温、阴晴、风速、湿度等，无固定格式。
   */
  weather?: string;
  /**
   * 可选：同组人。来源可有二，**可见性**需区分：
   * - **手填姓名**：仅作备忘，数据在记录者本机账号内；同组若**未注册或未使用本应用**，不会自动看到本场成绩，记录者可将成绩单**导出或通过系统分享**到微信等。
   * - **已注册且经应用内同场记分**（如实时比赛、多人记分并写入 `sourceMatchId` 等）：在同步能力具备时，本场可**关联到各参与方账户**，对方登录后也能在自己的成绩里看到。
   * 成绩锁定后的修改申请也会引用此列表作为投票人来源。
   */
  playingPartners?: { userId: string; name: string }[];
  /** 可选：来源实时比赛 id */
  sourceMatchId?: string;
  /** 可选：申请人在比赛中的玩家下标（与 playingPartners.userId `peer:{id}:{i}` 对应） */
  requesterPlayerIndex?: number;
  /** 可选：目录球场 id（日本/服务端 KV 等） */
  courseCatalogId?: string;
  /** 可选：所选 layout 名称（与 CatalogCourse.holes[].layout 一致） */
  courseLayoutKey?: string;
  /** 可选：目录中该球场是否已核实（仅 catalog 时有意义） */
  courseCatalogVerified?: boolean;
  /** 微差计算方式：WHS 公式或估算（adjusted−par 缩放）；缺省视为 whs 以兼容旧数据 */
  differentialSource?: 'whs' | 'estimated';
  /** 本地模拟/测试灌入的成绩；设置里可一键清除，勿与真实下场混淆 */
  isMockData?: boolean;
  /** 可选：开球时间（手填，如 07:32 或 07:32 开球） */
  teeTime?: string;
  /** 可选：整场打球总时长（分钟） */
  durationTotalMinutes?: number;
  /** 可选：前 9 洞用时（分钟），18 洞场次 */
  durationFront9Minutes?: number;
  /** 可选：后 9 洞用时（分钟） */
  durationBack9Minutes?: number;
};

export type HoleStatsSummary = {
  totalStrokes: number;
  front9Strokes: number;
  back9Strokes: number;
  totalPutts: number;
  fairwaysHit: number;
  fairwaysTotal: number;
  greensInRegulation: number;
  toParFront: number;
  toParBack: number;
  toParTotal: number;
};

type BestCountMap = Record<number, number>;

const BEST_COUNT_BY_TOTAL: BestCountMap = {
  3: 1,
  4: 1,
  5: 1,
  6: 2,
  7: 2,
  8: 2,
  9: 3,
  10: 3,
  11: 3,
  12: 4,
  13: 4,
  14: 4,
  15: 5,
  16: 5,
  17: 6,
  18: 6,
  19: 7,
  20: 8,
};

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

/**
 * 等效 18 洞总杆：9 洞场次按「本场 adjusted 总杆 ×2」折算，再与 18 洞场次一起求场均。
 * （与 WHS 常见「9 洞成绩翻倍参与差点样本」的展示口径对齐。）
 */
export function equivalent18FromGrossAndHoles(adjustedGross: number, holes: 9 | 18): number {
  if (!Number.isFinite(adjustedGross)) return NaN;
  return holes === 9 ? adjustedGross * 2 : adjustedGross;
}

export function equivalent18AdjustedGross(r: HandicapRecord): number {
  return equivalent18FromGrossAndHoles(r.adjustedGrossScore, r.holes);
}

function toDateMs(date: string) {
  return Number.isFinite(Date.parse(date)) ? Date.parse(date) : 0;
}

/** 时间正序；同日多场时用 id 稳定次序，与 calcHandicapIndex 取近 20 场一致 */
export function compareHandicapRecordsChronologicalAsc(
  a: HandicapRecord,
  b: HandicapRecord,
): number {
  const da = toDateMs(a.date);
  const db = toDateMs(b.date);
  if (da !== db) return da - db;
  return a.id.localeCompare(b.id);
}

export function makeHandicapRecordId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 上果岭：非推杆杆数 ≤ 标准杆−2 */
export function calcGIR(strokes: number, par: number, putts: number): boolean {
  const nonPutt = strokes - putts;
  return nonPutt <= par - 2;
}

/** 手填「分钟」输入：合法正整数则返回并封顶 24h，否则 undefined */
export function parseDurationMinutesInput(raw: string): number | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  const n = Math.round(Number(t));
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n > 24 * 60 ? 24 * 60 : n;
}

/** 将存盘分钟数格式化为可读时长 */
export function formatRoundDurationMinutes(m: number | null | undefined): string {
  if (m == null || !Number.isFinite(m) || m <= 0) return '—';
  const roundM = Math.round(m);
  if (roundM < 60) return `${roundM} 分钟`;
  const h = Math.floor(roundM / 60);
  const min = roundM % 60;
  return min > 0 ? `${h} 小时 ${min} 分` : `${h} 小时`;
}

/** 本场推杆总数：逐洞齐全时求和，否则回退 totalPutts */
export function roundPuttsDisplayCount(r: HandicapRecord): number | null {
  const details = r.holeDetails;
  if (details.length === r.holes && r.holes > 0) {
    let s = 0;
    for (const h of details) {
      const p = Number(h.putts);
      if (!Number.isFinite(p) || p < 0) return null;
      s += p;
    }
    return s;
  }
  if (typeof r.totalPutts === 'number' && Number.isFinite(r.totalPutts))
    return Math.round(r.totalPutts);
  return null;
}

/** 标 on（GIR）率 0–100，一位小数；需完整逐洞 */
export function roundGirPctDisplay(r: HandicapRecord): number | null {
  const details = r.holeDetails;
  if (details.length !== r.holes) return null;
  let gir = 0;
  for (const h of details) {
    if (h.greenInRegulation) gir += 1;
  }
  return Math.round((gir / details.length) * 1000) / 10;
}

/** 从已有逐洞成绩生成复盘数据；洞数不一致时返回 null */
export function seedHandicapHoleDataFromHoleDetails(
  details: HoleDetail[],
  holes: 18 | 9,
): HandicapHoleData[] | null {
  const sorted = [...details].sort((a, b) => a.holeNumber - b.holeNumber);
  if (sorted.length !== holes) return null;
  const out: HandicapHoleData[] = [];
  for (const h of sorted) {
    const par = h.par;
    if (par !== 3 && par !== 4 && par !== 5) return null;
    out.push({
      hole: h.holeNumber,
      par,
      score: h.strokes,
      putts: h.putts,
      fir: par === 3 ? null : h.fairwayHit,
      gir: h.greenInRegulation,
      penalty: 0,
    });
  }
  return out;
}

export function createEmptyHandicapHoleData(holes: 18 | 9): HandicapHoleData[] {
  return Array.from({ length: holes }, (_, i) => ({
    hole: i + 1,
    par: 4 as const,
    score: 5,
    putts: 2,
    fir: false,
    gir: false,
    penalty: 0,
  }));
}

/** 单场逐洞统计汇总 */
export function calcStats(holeDetails: HoleDetail[], roundHoles: 18 | 9): HoleStatsSummary {
  const list = [...holeDetails].sort((a, b) => a.holeNumber - b.holeNumber);
  let totalStrokes = 0;
  let front9Strokes = 0;
  let back9Strokes = 0;
  let totalPutts = 0;
  let fairwaysHit = 0;
  let fairwaysTotal = 0;
  let greensInRegulation = 0;
  let toParFront = 0;
  let toParBack = 0;

  for (const h of list) {
    totalStrokes += h.strokes;
    totalPutts += h.putts;
    if (h.par !== 3) {
      fairwaysTotal += 1;
      if (h.fairwayHit === true) fairwaysHit += 1;
    }
    if (h.greenInRegulation) greensInRegulation += 1;

    const rel = h.strokes - h.par;
    if (h.holeNumber <= 9) {
      front9Strokes += h.strokes;
      toParFront += rel;
    } else {
      back9Strokes += h.strokes;
      toParBack += rel;
    }
  }

  if (roundHoles === 9) {
    back9Strokes = 0;
    toParBack = 0;
  }

  const parFront = list.filter((h) => h.holeNumber <= 9).reduce((s, h) => s + h.par, 0);
  const parBack = list.filter((h) => h.holeNumber > 9).reduce((s, h) => s + h.par, 0);
  const parTotal = roundHoles === 9 ? parFront : parFront + parBack;

  return {
    totalStrokes,
    front9Strokes,
    back9Strokes,
    totalPutts,
    fairwaysHit,
    fairwaysTotal,
    greensInRegulation,
    toParFront: front9Strokes - parFront,
    toParBack: roundHoles === 18 ? back9Strokes - parBack : 0,
    toParTotal: totalStrokes - parTotal,
  };
}

/** 简化的洞成绩上限：每洞最多计为标准杆+2（无 Course Handicap 信息时的回退） */
export function escAdjustedStrokesForHole(strokes: number, par: number) {
  return Math.min(strokes, par + 2);
}

/**
 * WHS：Course Handicap = HI×(Slope/113) + (Course Rating − Par)，四舍五入为整数。
 */
export function playingCourseHandicap(
  handicapIndex: number,
  slopeRating: number,
  courseRating: number,
  coursePar: number,
): number {
  if (!Number.isFinite(handicapIndex) || !Number.isFinite(slopeRating) || slopeRating <= 0)
    return 0;
  if (!Number.isFinite(courseRating) || !Number.isFinite(coursePar)) return 0;
  return Math.round(handicapIndex * (slopeRating / 113) + (courseRating - coursePar));
}

/** 该洞分配到的让杆数（CH>0）；无 stroke index 时用 strokeIndex≈洞号、最难洞为小号。 */
function strokesAllocatedOnHole(
  courseHandicap: number,
  strokeIndex: number,
  holeCount: 18 | 9,
): number {
  if (!Number.isFinite(courseHandicap) || courseHandicap <= 0) return 0;
  const n = holeCount === 9 ? 9 : 18;
  const ch = Math.min(Math.max(Math.round(courseHandicap), 0), 54);
  const base = Math.floor(ch / n);
  const rem = ch % n;
  return base + (strokeIndex <= rem ? 1 : 0);
}

/** Net Double Bogey：par + 2 + 该洞让杆；CH 未知或 <0 时退化为 par+2。 */
export function maxNetDoubleBogeyStrokes(
  par: number,
  courseHandicap: number,
  strokeIndex: number,
  holeCount: 18 | 9,
): number {
  if (!Number.isFinite(courseHandicap) || courseHandicap < 0) return par + 2;
  return par + 2 + strokesAllocatedOnHole(courseHandicap, strokeIndex, holeCount);
}

export function adjustedStrokesForHoleWHS(
  strokes: number,
  par: number,
  strokeIndexForAllocation: number,
  courseHandicap: number | null | undefined,
  roundHoles: 18 | 9,
): number {
  if (courseHandicap == null || !Number.isFinite(courseHandicap)) {
    return escAdjustedStrokesForHole(strokes, par);
  }
  const cap = maxNetDoubleBogeyStrokes(par, courseHandicap, strokeIndexForAllocation, roundHoles);
  return Math.min(strokes, cap);
}

/** 校验并规范化 strokeIndexMap；无效时返回 undefined（走洞号回退） */
export function normalizeStrokeIndexMap(raw: unknown, holeCount: 18 | 9): number[] | undefined {
  if (!Array.isArray(raw) || raw.length !== holeCount) return undefined;
  const max = holeCount;
  const nums = raw.map((x) => Number(x));
  if (!nums.every((v) => Number.isInteger(v) && v >= 1 && v <= max)) return undefined;
  if (new Set(nums).size !== nums.length) return undefined;
  return nums;
}

export function calcAdjustedGrossFromHoles(
  holeDetails: HoleDetail[],
  roundHoles: 18 | 9,
  postingCourseHandicap?: number | null,
  strokeIndexMap?: number[] | null,
): number {
  const sorted = [...holeDetails].sort((a, b) => a.holeNumber - b.holeNumber);
  const norm = normalizeStrokeIndexMap(strokeIndexMap, roundHoles);
  const useMap =
    norm !== undefined && sorted.length === norm.length && sorted.length === roundHoles;

  return sorted.reduce((sum, h, i) => {
    const strokeIdx = useMap ? norm[i]! : h.holeNumber;
    return (
      sum +
      adjustedStrokesForHoleWHS(h.strokes, h.par, strokeIdx, postingCourseHandicap, roundHoles)
    );
  }, 0);
}

export function calcDifferential(
  adjustedGross: number,
  courseRating: number,
  slopeRating: number,
  holes: 18 | 9,
) {
  if (
    !Number.isFinite(adjustedGross) ||
    !Number.isFinite(courseRating) ||
    !Number.isFinite(slopeRating) ||
    slopeRating <= 0
  ) {
    return 0;
  }
  const base = ((adjustedGross - courseRating) * 113) / slopeRating;
  const normalized = holes === 9 ? base * 2 : base;
  return round1(normalized);
}

export type ScoreDifferentialSource = 'whs' | 'estimated';

/**
 * 微差：有可靠 CR+SR 时用 WHS；否则用估算（adjustedGross − 总标准杆，9 洞结果×2）。
 * 未传入有效 CR/SR 时会 console.warn。
 */
export function calcRoundScoreDifferential(
  adjustedGross: number,
  holes: 18 | 9,
  crsr: { courseRating: number; slopeRating: number } | null,
  parTotalForFallback: number,
): { scoreDifferential: number; source: ScoreDifferentialSource } {
  if (
    crsr != null &&
    Number.isFinite(crsr.courseRating) &&
    Number.isFinite(crsr.slopeRating) &&
    crsr.slopeRating > 0
  ) {
    return {
      scoreDifferential: calcDifferential(
        adjustedGross,
        crsr.courseRating,
        crsr.slopeRating,
        holes,
      ),
      source: 'whs',
    };
  }
  console.warn('[handicap] 未找到球场数据，使用估算公式');
  const raw = adjustedGross - parTotalForFallback;
  const normalized = holes === 9 ? raw * 2 : raw;
  return { scoreDifferential: round1(normalized), source: 'estimated' };
}

function bestCount(total: number) {
  if (total < 3) return 0;
  const safe = Math.min(total, 20);
  return BEST_COUNT_BY_TOTAL[safe] ?? 8;
}

export function calcHandicapIndex(records: HandicapRecord[]) {
  const sorted = [...records].sort((a, b) => compareHandicapRecordsChronologicalAsc(b, a));
  const recent = sorted.slice(0, 20);
  const total = recent.length;
  if (total < 3) return null;
  const take = bestCount(total);
  const best = [...recent].sort((a, b) => a.scoreDifferential - b.scoreDifferential).slice(0, take);
  if (!best.length) return null;
  const avg = best.reduce((sum, item) => sum + item.scoreDifferential, 0) / best.length;
  return round1(avg * 0.96);
}

function normalizeHoleDetail(raw: unknown, fallbackIndex: number): HoleDetail | null {
  if (!raw || typeof raw !== 'object') return null;
  const h = raw as Partial<HoleDetail>;
  const holeNumber =
    typeof h.holeNumber === 'number' && Number.isFinite(h.holeNumber)
      ? h.holeNumber
      : fallbackIndex + 1;
  const par = typeof h.par === 'number' && Number.isFinite(h.par) ? h.par : 4;
  const strokes = typeof h.strokes === 'number' && Number.isFinite(h.strokes) ? h.strokes : par;
  const putts = typeof h.putts === 'number' && Number.isFinite(h.putts) ? h.putts : 2;
  let fairwayHit: boolean | null = null;
  if (par !== 3) {
    fairwayHit = typeof h.fairwayHit === 'boolean' ? h.fairwayHit : false;
  }
  const greenInRegulation =
    typeof h.greenInRegulation === 'boolean' ? h.greenInRegulation : calcGIR(strokes, par, putts);
  const distanceM =
    typeof h.distanceM === 'number' && Number.isFinite(h.distanceM) && h.distanceM > 0
      ? h.distanceM
      : null;

  return {
    holeNumber,
    par,
    distanceM,
    strokes,
    putts,
    fairwayHit,
    greenInRegulation,
  };
}

function normalizeHoleDataEntry(raw: unknown, maxHole: number): HandicapHoleData | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const hole = Number(o.hole);
  const par = Number(o.par);
  const score = Number(o.score);
  const putts = Number(o.putts);
  const penalty = Number(o.penalty);
  if (!Number.isFinite(hole) || hole < 1 || hole > maxHole) return null;
  if (![3, 4, 5].includes(par)) return null;
  if (!Number.isFinite(score) || score < 1 || score > 20) return null;
  if (!Number.isFinite(putts) || putts < 0 || putts > 15) return null;
  let fir: boolean | null = null;
  if (o.fir === null) fir = null;
  else if (typeof o.fir === 'boolean') fir = o.fir;
  else return null;
  if (par === 3) fir = null;
  let gir: boolean | null = null;
  if (o.gir === null) gir = null;
  else if (typeof o.gir === 'boolean') gir = o.gir;
  else return null;
  const pen = Number.isFinite(penalty) && penalty >= 0 ? Math.min(15, Math.round(penalty)) : 0;
  const row: HandicapHoleData = {
    hole: Math.round(hole),
    par: par as 3 | 4 | 5,
    score: Math.round(score),
    putts: Math.round(putts),
    fir: par === 3 ? null : fir,
    gir,
    penalty: pen,
  };
  return row;
}

function normalizeHoleDataArray(raw: unknown, holes: 18 | 9): HandicapHoleData[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const maxHole = holes;
  const list = raw
    .map((x) => normalizeHoleDataEntry(x, maxHole))
    .filter((x): x is HandicapHoleData => Boolean(x));
  if (list.length !== maxHole) return undefined;
  const byHole = [...list].sort((a, b) => a.hole - b.hole);
  for (let i = 0; i < maxHole; i += 1) {
    if (byHole[i]!.hole !== i + 1) return undefined;
  }
  return byHole;
}

function normalizeAiReview(raw: unknown): HandicapAiReview | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  if (typeof o.problem !== 'string' || typeof o.strategy !== 'string') return undefined;
  const drillsRaw = o.drills;
  const drills = Array.isArray(drillsRaw)
    ? drillsRaw.filter((x): x is string => typeof x === 'string').map((s) => s.trim())
    : [];
  const pad = [...drills, '', '', ''].slice(0, 3);
  const gen =
    typeof o.generatedAt === 'number' && Number.isFinite(o.generatedAt) && o.generatedAt > 0
      ? Math.round(o.generatedAt)
      : Date.now();
  const rawText = typeof o.rawText === 'string' ? o.rawText : undefined;
  return {
    problem: o.problem.trim(),
    drills: pad,
    strategy: o.strategy.trim(),
    generatedAt: gen,
    ...(rawText ? { rawText } : {}),
  };
}

function normalizePlayingPartners(raw: unknown): HandicapRecord['playingPartners'] {
  if (!Array.isArray(raw)) return undefined;
  const out: { userId: string; name: string }[] = [];
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    const userId = typeof o.userId === 'string' ? o.userId.trim() : '';
    const name = typeof o.name === 'string' ? o.name.trim() : '';
    if (!userId) continue;
    out.push({ userId, name: name || '球友' });
  }
  return out.length > 0 ? out : undefined;
}

/** 将手填「逗号/顿号/分号/空格」分隔的姓名转为 playingPartners（记成绩页 / 详情编辑用）。 */
export function playingPartnersFromManualNames(raw: string): HandicapRecord['playingPartners'] {
  const t = raw.trim();
  if (!t) return undefined;
  const parts = t
    .split(/[,，、;；\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return undefined;
  return parts.map((name, i) => ({ userId: `manual:${i}`, name }));
}

function normalizeRecord(raw: unknown): HandicapRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Partial<HandicapRecord>;
  if (typeof item.date !== 'string' || typeof item.courseName !== 'string') return null;

  const holes: 18 | 9 = item.holes === 9 ? 9 : 18;
  const isMockDataInput = item.isMockData === true;
  const legacySimulatedCourse =
    typeof item.courseName === 'string' && item.courseName.includes('模拟');
  const repairMockScoring = isMockDataInput || legacySimulatedCourse;

  const rawCourseRating = Number(item.courseRating);
  const rawSlopeRating = Number(item.slopeRating);
  let courseRating = rawCourseRating;
  let slopeRating = rawSlopeRating;
  if (repairMockScoring) {
    courseRating = 72;
    slopeRating = 113;
  } else if (!Number.isFinite(courseRating) || !Number.isFinite(slopeRating)) {
    return null;
  }

  const adjustedGrossScoreRaw = Number(item.adjustedGrossScore);

  const holeDetails = Array.isArray(item.holeDetails)
    ? item.holeDetails
        .map((h, i) => normalizeHoleDetail(h, i))
        .filter((h): h is HoleDetail => Boolean(h))
    : [];

  const postingPh =
    typeof item.playingCourseHandicap === 'number' && Number.isFinite(item.playingCourseHandicap)
      ? item.playingCourseHandicap
      : undefined;

  const strokeIndexMapNorm = normalizeStrokeIndexMap(item.strokeIndexMap, holes);

  let adjustedGrossScore = Number.isFinite(adjustedGrossScoreRaw) ? adjustedGrossScoreRaw : 0;
  const readAgg = (v: unknown): number | null => {
    if (v === null) return null;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    return 0;
  };
  let totalPutts: number | null = readAgg(item.totalPutts);
  let fairwaysHit: number | null = readAgg(item.fairwaysHit);
  let fairwaysTotal: number | null = readAgg(item.fairwaysTotal);
  let greensInRegulation: number | null = readAgg(item.greensInRegulation);
  let front9Strokes = typeof item.front9Strokes === 'number' ? item.front9Strokes : 0;
  let back9Strokes = typeof item.back9Strokes === 'number' ? item.back9Strokes : 0;

  if (holeDetails.length > 0) {
    const stats = calcStats(holeDetails, holes);
    totalPutts = stats.totalPutts;
    fairwaysHit = stats.fairwaysHit;
    fairwaysTotal = stats.fairwaysTotal;
    greensInRegulation = stats.greensInRegulation;
    front9Strokes = stats.front9Strokes;
    back9Strokes = stats.back9Strokes;
    adjustedGrossScore = calcAdjustedGrossFromHoles(
      holeDetails,
      holes,
      postingPh,
      strokeIndexMapNorm,
    );
  } else if (!Number.isFinite(adjustedGrossScore) || adjustedGrossScore <= 0) {
    return null;
  }

  const handicapProcessedFlag = item.handicapProcessed === true;
  const submittedAtNum =
    typeof item.submittedAt === 'number' && Number.isFinite(item.submittedAt)
      ? item.submittedAt
      : undefined;

  /** 锁定后允许单独修正推杆/FIR/GIR 汇总，不再用逐洞重算覆盖这四项 */
  if (
    isRoundLockedSync({
      handicapProcessed: handicapProcessedFlag,
      submittedAt: submittedAtNum,
      date: item.date,
    }) &&
    holeDetails.length > 0
  ) {
    if (item.totalPutts === null) totalPutts = null;
    else if (typeof item.totalPutts === 'number' && Number.isFinite(item.totalPutts)) {
      totalPutts = Math.round(item.totalPutts);
    }
    if (item.fairwaysHit === null) fairwaysHit = null;
    else if (typeof item.fairwaysHit === 'number' && Number.isFinite(item.fairwaysHit)) {
      fairwaysHit = Math.round(item.fairwaysHit);
    }
    if (item.fairwaysTotal === null) fairwaysTotal = null;
    else if (typeof item.fairwaysTotal === 'number' && Number.isFinite(item.fairwaysTotal)) {
      fairwaysTotal = Math.round(item.fairwaysTotal);
    }
    if (item.greensInRegulation === null) greensInRegulation = null;
    else if (
      typeof item.greensInRegulation === 'number' &&
      Number.isFinite(item.greensInRegulation)
    ) {
      greensInRegulation = Math.round(item.greensInRegulation);
    }
  }

  const scoreDifferential = repairMockScoring
    ? calcDifferential(adjustedGrossScore, courseRating, slopeRating, holes)
    : Number.isFinite(Number(item.scoreDifferential))
      ? round1(Number(item.scoreDifferential))
      : calcDifferential(adjustedGrossScore, courseRating, slopeRating, holes);

  const holeDataNorm = normalizeHoleDataArray(item.holeData, holes);
  const aiReviewNorm = normalizeAiReview(item.aiReview);
  const playingPartners = normalizePlayingPartners(item.playingPartners);
  const sourceMatchId =
    typeof item.sourceMatchId === 'string' && item.sourceMatchId.trim()
      ? item.sourceMatchId.trim()
      : undefined;
  const requesterPlayerIndex =
    typeof item.requesterPlayerIndex === 'number' && Number.isFinite(item.requesterPlayerIndex)
      ? Math.round(item.requesterPlayerIndex)
      : undefined;

  const courseCatalogId =
    typeof item.courseCatalogId === 'string' && item.courseCatalogId.trim()
      ? item.courseCatalogId.trim()
      : undefined;
  const courseLayoutKey =
    typeof item.courseLayoutKey === 'string' && item.courseLayoutKey.trim()
      ? item.courseLayoutKey.trim()
      : undefined;
  const courseCatalogVerified =
    item.courseCatalogVerified === true || item.courseCatalogVerified === false
      ? item.courseCatalogVerified
      : undefined;
  const differentialSource: 'whs' | 'estimated' | undefined =
    item.differentialSource === 'estimated' || item.differentialSource === 'whs'
      ? item.differentialSource
      : undefined;

  const persistMockFlag = isMockDataInput || legacySimulatedCourse;

  const weather =
    typeof item.weather === 'string' && item.weather.trim().length > 0
      ? item.weather.trim()
      : undefined;

  const teeTime =
    typeof item.teeTime === 'string' && item.teeTime.trim().length > 0
      ? item.teeTime.trim().slice(0, 40)
      : undefined;

  const durationTotalMinutes =
    item.durationTotalMinutes != null
      ? parseDurationMinutesInput(String(item.durationTotalMinutes))
      : undefined;
  const durationFront9Minutes =
    item.durationFront9Minutes != null
      ? parseDurationMinutesInput(String(item.durationFront9Minutes))
      : undefined;
  const durationBack9Minutes =
    item.durationBack9Minutes != null
      ? parseDurationMinutesInput(String(item.durationBack9Minutes))
      : undefined;

  return {
    id: typeof item.id === 'string' && item.id.trim().length > 0 ? item.id : makeHandicapRecordId(),
    date: item.date,
    courseName: item.courseName.trim(),
    courseRating,
    slopeRating,
    adjustedGrossScore,
    holes,
    scoreDifferential,
    notes: typeof item.notes === 'string' ? item.notes : '',
    holeDetails,
    totalPutts,
    fairwaysHit,
    fairwaysTotal,
    greensInRegulation,
    front9Strokes,
    back9Strokes,
    ...(postingPh !== undefined ? { playingCourseHandicap: postingPh } : {}),
    ...(strokeIndexMapNorm ? { strokeIndexMap: strokeIndexMapNorm } : {}),
    ...(handicapProcessedFlag ? { handicapProcessed: true } : {}),
    ...(typeof submittedAtNum === 'number' ? { submittedAt: submittedAtNum } : {}),
    ...(holeDataNorm ? { holeData: holeDataNorm } : {}),
    ...(aiReviewNorm ? { aiReview: aiReviewNorm } : {}),
    ...(playingPartners ? { playingPartners } : {}),
    ...(sourceMatchId ? { sourceMatchId } : {}),
    ...(requesterPlayerIndex !== undefined ? { requesterPlayerIndex } : {}),
    ...(courseCatalogId ? { courseCatalogId } : {}),
    ...(courseLayoutKey ? { courseLayoutKey } : {}),
    ...(courseCatalogVerified !== undefined ? { courseCatalogVerified } : {}),
    ...(differentialSource ? { differentialSource } : {}),
    ...(weather ? { weather } : {}),
    ...(teeTime ? { teeTime } : {}),
    ...(durationTotalMinutes != null ? { durationTotalMinutes } : {}),
    ...(durationFront9Minutes != null ? { durationFront9Minutes } : {}),
    ...(durationBack9Minutes != null ? { durationBack9Minutes } : {}),
    ...(persistMockFlag ? { isMockData: true } : {}),
  };
}

export function normalizeHandicapRecords(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(normalizeRecord)
    .filter((item): item is HandicapRecord => Boolean(item))
    .sort((a, b) => toDateMs(b.date) - toDateMs(a.date));
}

export async function loadHandicapRecords(): Promise<HandicapRecord[]> {
  const raw = await readJsonArray<unknown>(HANDICAP_RECORDS_KEY);
  return normalizeHandicapRecords(raw);
}

export async function saveHandicapRecords(records: HandicapRecord[]) {
  return writeJson(HANDICAP_RECORDS_KEY, normalizeHandicapRecords(records));
}

export function buildHandicapTrend(records: HandicapRecord[]) {
  const asc = [...records].sort(compareHandicapRecordsChronologicalAsc);
  return asc.map((_, idx) => {
    const partial = asc.slice(0, idx + 1);
    return {
      date: asc[idx].date,
      index: calcHandicapIndex(partial),
    };
  });
}

/** Par72 标准杆分布（前9 + 后9） */
export const PAR_72_LAYOUT = {
  front: [4, 4, 3, 4, 5, 3, 4, 5, 4],
  back: [4, 3, 4, 5, 4, 3, 4, 4, 5],
} as const;

export function buildParArray(preset: '72' | 'custom', roundHoles: 18 | 9): number[] {
  let full: number[];
  switch (preset) {
    case '72':
      full = [...PAR_72_LAYOUT.front, ...PAR_72_LAYOUT.back];
      break;
    default:
      full = Array(18).fill(4);
      break;
  }
  return roundHoles === 9 ? full.slice(0, 9) : full;
}

export function buildInitialHoleDetails(pars: number[]): HoleDetail[] {
  return pars.map((par, i) => {
    const strokes = par;
    const putts = 2;
    return {
      holeNumber: i + 1,
      par,
      distanceM: null,
      strokes,
      putts,
      fairwayHit: par === 3 ? null : false,
      greenInRegulation: calcGIR(strokes, par, putts),
    };
  });
}

export function fairwayPercent(hit: number | null, total: number | null) {
  if (hit == null || total == null) return null;
  if (total <= 0) return null;
  return Math.round((hit / total) * 1000) / 10;
}

/** 推杆 / 球道 / GIR 汇总是否仍有未补填（`null`） */
export function recordHasPendingRoundStats(item: HandicapRecord): boolean {
  return (
    item.totalPutts == null ||
    item.fairwaysHit == null ||
    item.fairwaysTotal == null ||
    item.greensInRegulation == null
  );
}
