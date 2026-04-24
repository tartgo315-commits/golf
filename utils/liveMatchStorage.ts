import AsyncStorage from '@react-native-async-storage/async-storage';

import { refreshServerTime } from '@/utils/serverTime';
import {
  buildParArray,
  calcAdjustedGrossFromHoles,
  calcDifferential,
  calcGIR,
  loadHandicapRecords,
  makeHandicapRecordId,
  saveHandicapRecords,
  type HandicapRecord,
  type HoleDetail,
} from '@/lib/handicap';
import { markHandicapProcessingComplete } from '@/utils/roundLock';
import {
  calcMatchPlayResult,
  calcMoneyResult,
  calcNassauResult,
  countConsecutiveHolesComplete,
  totalNetThrough,
  totalParThrough,
  vsParLabel,
  type MatchMode,
  type MatchPlayer,
  type MatchRecord,
} from '@/utils/matchScoring';

const KEY = '@gca_live_matches_v1';

type Root = { matches: MatchRecord[] };

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function loadRoot(): Promise<Root> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return { matches: [] };
  try {
    const p: unknown = JSON.parse(raw);
    if (!p || typeof p !== 'object' || !Array.isArray((p as Root).matches)) return { matches: [] };
    return p as Root;
  } catch {
    return { matches: [] };
  }
}

async function saveRoot(root: Root): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(root));
}

function normalizePlayer(raw: unknown): MatchPlayer | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const name = typeof o.name === 'string' ? o.name : '';
  const handicap = typeof o.handicap === 'number' && Number.isFinite(o.handicap) ? Math.round(o.handicap) : 0;
  const scores = Array.isArray(o.scores)
    ? o.scores
        .map((s) => {
          if (!s || typeof s !== 'object') return null;
          const r = s as Record<string, unknown>;
          const hole = Number(r.hole);
          const par = Number(r.par);
          const gross = Number(r.gross);
          const net = Number(r.net);
          const stablefordPoints = Number(r.stablefordPoints);
          if (!Number.isFinite(hole) || !Number.isFinite(par) || !Number.isFinite(gross) || !Number.isFinite(net)) return null;
          return {
            hole: Math.round(hole),
            par: Math.round(par),
            gross: Math.round(gross),
            net: Math.round(net),
            stablefordPoints: Number.isFinite(stablefordPoints) ? Math.round(stablefordPoints) : 0,
          };
        })
        .filter((x): x is NonNullable<typeof x> => Boolean(x))
    : [];
  return { name, handicap, scores };
}

function normalizeMatch(raw: unknown): MatchRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== 'string' || !o.id.trim()) return null;
  const holes = o.holes === 9 ? 9 : 18;
  const mode = o.mode as MatchMode;
  if (mode !== 'matchplay' && mode !== 'nassau' && mode !== 'stableford' && mode !== 'stroke') return null;
  const status = o.status === 'finished' ? 'finished' : 'active';
  const course = typeof o.course === 'string' ? o.course : '';
  const unit = typeof o.unit === 'number' && Number.isFinite(o.unit) ? Math.max(0, o.unit) : 0;
  const createdAt = typeof o.createdAt === 'number' && o.createdAt > 0 ? o.createdAt : Date.now();
  const players = Array.isArray(o.players)
    ? o.players.map(normalizePlayer).filter((x): x is MatchPlayer => Boolean(x))
    : [];
  if (players.length === 0) return null;
  return { id: o.id.trim(), createdAt, course, holes, mode, unit, players, status };
}

export function createLiveMatchId(): string {
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function mapBetModeToMatchMode(
  id: 'match' | 'nassau' | 'stableford' | 'stroke',
): MatchMode {
  if (id === 'match') return 'matchplay';
  if (id === 'nassau') return 'nassau';
  if (id === 'stableford') return 'stableford';
  return 'stroke';
}

export function buildNewMatchRecord(input: {
  course: string;
  holes: 9 | 18;
  mode: MatchMode;
  unit: number;
  players: { name: string; handicap: number }[];
}): MatchRecord {
  const players: MatchPlayer[] = input.players.map((p) => ({
    name: p.name.trim() || '玩家',
    handicap: Math.min(54, Math.max(0, Math.round(p.handicap))),
    scores: [],
  }));
  return {
    id: createLiveMatchId(),
    createdAt: Date.now(),
    course: input.course.trim(),
    holes: input.holes,
    mode: input.mode,
    unit: Math.max(0, Math.round(input.unit)),
    players,
    status: 'active',
  };
}

export async function getMatchById(id: string): Promise<MatchRecord | null> {
  const root = await loadRoot();
  const m = root.matches.find((x) => x.id === id);
  return normalizeMatch(m);
}

export async function saveMatchRecord(match: MatchRecord): Promise<void> {
  const root = await loadRoot();
  const idx = root.matches.findIndex((x) => x.id === match.id);
  const next = { ...match, players: match.players.map((p) => ({ ...p, scores: [...p.scores] })) };
  if (idx >= 0) root.matches[idx] = next;
  else root.matches.unshift(next);
  await saveRoot(root);
}

export async function listMatchesNewestFirst(): Promise<MatchRecord[]> {
  const root = await loadRoot();
  return root.matches
    .map(normalizeMatch)
    .filter((x): x is MatchRecord => Boolean(x))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function listRecentMatches(limit: number): Promise<MatchRecord[]> {
  const all = await listMatchesNewestFirst();
  return all.slice(0, limit);
}

/** 将指定玩家完整 9/18 洞成绩写入差点（快速：有逐洞杆数，汇总统计由 holeDetails 推导） */
export async function saveQuickHandicapFromMatch(
  match: MatchRecord,
  playerIndex = 0,
): Promise<{ ok: true } | { ok: false; message: string }> {
  await refreshServerTime();
  const pl = match.players[playerIndex];
  if (!pl) return { ok: false, message: '无此玩家' };
  if (pl.scores.length !== match.holes) return { ok: false, message: '请先录完全部球洞' };
  const pars = buildParArray('72', match.holes);
  const details: HoleDetail[] = [];
  for (let i = 0; i < match.holes; i += 1) {
    const h = i + 1;
    const sc = pl.scores.find((s) => s.hole === h);
    const par = pars[i] ?? 4;
    if (!sc) return { ok: false, message: `缺少第 ${h} 洞数据` };
    const putts = 2;
    details.push({
      holeNumber: h,
      par,
      distanceM: null,
      strokes: sc.gross,
      putts,
      fairwayHit: par === 3 ? null : false,
      greenInRegulation: calcGIR(sc.gross, par, putts),
    });
  }
  const parTotal = pars.slice(0, match.holes).reduce((s, p) => s + p, 0);
  const cr = parTotal;
  const sr = 113;
  const existing = loadHandicapRecords();
  const adjustedGross = calcAdjustedGrossFromHoles(details, match.holes, undefined, undefined);
  const diff = calcDifferential(adjustedGross, cr, sr, match.holes);
  const hid = makeHandicapRecordId();
  const playingPartners = match.players.map((p, i) => ({
    userId: `peer:${hid}:${i}`,
    name: p.name.trim() || `玩家${i + 1}`,
  }));
  const rec = markHandicapProcessingComplete({
    id: hid,
    date: todayStr(),
    courseName: match.course || '未命名球场',
    courseRating: cr,
    slopeRating: sr,
    adjustedGrossScore: adjustedGross,
    holes: match.holes,
    scoreDifferential: diff,
    notes: `来自实时比赛 ${match.id}`,
    holeDetails: details,
    totalPutts: 0,
    fairwaysHit: 0,
    fairwaysTotal: 0,
    greensInRegulation: 0,
    front9Strokes: 0,
    back9Strokes: 0,
    playingPartners,
    sourceMatchId: match.id,
    requesterPlayerIndex: playerIndex,
  } as HandicapRecord);
  saveHandicapRecords([rec, ...existing]);
  return { ok: true };
}

export function buildMatchShareText(match: MatchRecord): string {
  const lines: string[] = [];
  lines.push(`球场：${match.course}`);
  lines.push(`玩法：${match.mode} · ${match.holes} 洞`);
  match.players.forEach((pl, i) => {
    const gross = pl.scores.reduce((s, x) => s + x.gross, 0);
    lines.push(`${i + 1}. ${pl.name || '玩家'} 总杆 ${gross}`);
  });
  lines.push(`时间：${new Date(match.createdAt).toLocaleString()}`);
  return lines.join('\n');
}

function formatMatchDateLabel(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 历史列表一行：比分摘要 + 玩家 0 的盈亏（多人且有 unit 时） */
export function formatMatchHistoryRow(match: MatchRecord): { dateLabel: string; course: string; result: string; moneyText: string } {
  const th = countConsecutiveHolesComplete(match);
  const pars = buildParArray('72', match.holes);
  const p0 = match.players[0];
  const p1 = match.players[1];
  let result = th === 0 ? '未录入' : '—';
  if (th > 0 && p0) {
    if (match.mode === 'matchplay' && p1) {
      result = calcMatchPlayResult(p0, p1, th, match.holes).text;
    } else if (match.mode === 'nassau' && p1) {
      result = calcNassauResult(p0, p1, match.holes).total;
    } else if (match.mode === 'stableford') {
      result = match.players
        .map((pl) => pl.scores.filter((s) => s.hole <= th).reduce((a, s) => a + s.stablefordPoints, 0))
        .join(' : ');
    } else if (match.mode === 'stroke') {
      const parT = totalParThrough(pars, th);
      result = match.players.map((pl) => `${pl.name.slice(0, 4)} ${vsParLabel(totalNetThrough(pl, th), parT)}`).join(' · ');
    } else if (match.mode === 'matchplay') {
      result = '练习';
    }
  }
  const money = calcMoneyResult(match, th);
  const me = money.payoutsYuan[0] ?? 0;
  let moneyText = '—';
  if (match.unit > 0 && match.players.length > 1) {
    moneyText = me === 0 ? '¥0' : me > 0 ? `+¥${me}` : `-¥${Math.abs(me)}`;
  }
  return { dateLabel: formatMatchDateLabel(match.createdAt), course: match.course || '未命名球场', result, moneyText };
}
