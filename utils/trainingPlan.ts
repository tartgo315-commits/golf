import AsyncStorage from '@react-native-async-storage/async-storage';

import type { HandicapHoleData, HandicapRecord } from '@/lib/handicap';
import { lossBreakdown } from '@/utils/holeAnalysis';
import { parseJsonArray } from '@/lib/local-storage';

export const TRAINING_ITEMS_KEY = '@gca_training_items_v1';

export type TrainingSource = 'ai' | 'manual';

export type TrainingCategory = 'putt' | 'short' | 'long' | 'strategy';

export type TrainingItem = {
  id: string;
  source: TrainingSource;
  roundId?: string;
  category: TrainingCategory;
  content: string;
  createdAt: number;
  completedDates: number[];
  archived: boolean;
};

const MAX_ACTIVE = 20;

function newId(): string {
  return `tr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function toLocalDateKey(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayKey(): string {
  return toLocalDateKey(Date.now());
}

function categoryOrderIndex(c: TrainingCategory): number {
  if (c === 'putt') return 0;
  if (c === 'short') return 1;
  if (c === 'long') return 2;
  return 3;
}

/** 按本场失分占比，为每条练习分配类别（与 lossBreakdown 同源） */
export function categoriesForDrillLines(
  holeData: HandicapHoleData[],
  lineCount: number,
): TrainingCategory[] {
  const n = Math.min(3, Math.max(1, Math.floor(lineCount)));
  const b = lossBreakdown(holeData);
  const sum = b.putting + b.shortGame + b.longGame + b.penalty;
  const pairs: { cat: TrainingCategory; w: number }[] = [
    { cat: 'putt', w: b.putting },
    { cat: 'short', w: b.shortGame },
    { cat: 'long', w: b.longGame },
    { cat: 'strategy', w: b.penalty },
  ];
  pairs.sort((a, b) => {
    if (b.w !== a.w) return b.w - a.w;
    return categoryOrderIndex(a.cat) - categoryOrderIndex(b.cat);
  });
  const ordered = pairs.map((p) => p.cat);
  const uniq = [...new Set(ordered)];
  const base: TrainingCategory[] = [];
  if (sum <= 0 || uniq.length === 0) {
    base.push('putt', 'short', 'long');
  } else {
    for (let i = 0; i < 3; i += 1) base.push(uniq[i % uniq.length]!);
  }
  return Array.from({ length: n }, (_, i) => base[i]!);
}

function normalizeItem(raw: unknown): TrainingItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== 'string' || !o.id.trim()) return null;
  if (o.source !== 'ai' && o.source !== 'manual') return null;
  const cat = o.category;
  if (cat !== 'putt' && cat !== 'short' && cat !== 'long' && cat !== 'strategy') return null;
  const content = typeof o.content === 'string' ? o.content.trim() : '';
  if (!content) return null;
  const createdAt =
    typeof o.createdAt === 'number' && Number.isFinite(o.createdAt) && o.createdAt > 0
      ? Math.round(o.createdAt)
      : Date.now();
  const completedDates = Array.isArray(o.completedDates)
    ? o.completedDates
        .filter((x): x is number => typeof x === 'number' && Number.isFinite(x))
        .map((x) => Math.round(x))
    : [];
  const archived = o.archived === true;
  const roundId = typeof o.roundId === 'string' && o.roundId.trim() ? o.roundId.trim() : undefined;
  return {
    id: o.id.trim(),
    source: o.source,
    roundId,
    category: cat,
    content,
    createdAt,
    completedDates,
    archived,
  };
}

async function loadAllRaw(): Promise<TrainingItem[]> {
  const raw = await AsyncStorage.getItem(TRAINING_ITEMS_KEY);
  const arr = parseJsonArray<unknown>(raw);
  return arr.map(normalizeItem).filter((x): x is TrainingItem => Boolean(x));
}

async function saveAll(items: TrainingItem[]): Promise<void> {
  await AsyncStorage.setItem(TRAINING_ITEMS_KEY, JSON.stringify(items));
}

function activeCount(items: TrainingItem[]): number {
  return items.filter((x) => !x.archived).length;
}

/** 未归档项，按 createdAt 降序 */
export async function getTrainingItems(): Promise<TrainingItem[]> {
  const all = await loadAllRaw();
  return all.filter((x) => !x.archived).sort((a, b) => b.createdAt - a.createdAt);
}

export type AddTrainingInput = {
  source: TrainingSource;
  roundId?: string;
  category: TrainingCategory;
  content: string;
};

/** 新增一条；未归档超过 20 条时返回失败 */
export async function addTrainingItem(
  input: AddTrainingInput,
): Promise<{ ok: true; item: TrainingItem } | { ok: false; message: string }> {
  const content = input.content.trim();
  if (!content) return { ok: false, message: '请输入训练内容' };
  const all = await loadAllRaw();
  if (activeCount(all) >= MAX_ACTIVE) {
    return { ok: false, message: '请先完成或归档现有训练' };
  }
  const item: TrainingItem = {
    id: newId(),
    source: input.source,
    roundId: input.roundId?.trim() || undefined,
    category: input.category,
    content,
    createdAt: Date.now(),
    completedDates: [],
    archived: false,
  };
  await saveAll([item, ...all]);
  return { ok: true, item };
}

/** 将 AI 复盘中的练习建议写入训练计划（最多 3 条非空） */
export async function saveAiReviewDrillsToPlan(
  round: HandicapRecord,
  holeData: HandicapHoleData[],
  drills: readonly string[],
): Promise<{ ok: true; added: number } | { ok: false; message: string }> {
  const lines = drills
    .map((d) => d.trim())
    .filter(Boolean)
    .slice(0, 3);
  if (lines.length === 0) return { ok: false, message: '暂无有效训练建议' };
  const all = await loadAllRaw();
  const active = activeCount(all);
  if (active + lines.length > MAX_ACTIVE) {
    return { ok: false, message: '请先完成或归档现有训练' };
  }
  const cats = categoriesForDrillLines(holeData, lines.length);
  const now = Date.now();
  const created: TrainingItem[] = lines.map((content, i) => ({
    id: newId(),
    source: 'ai' as const,
    roundId: round.id,
    category: cats[i]!,
    content,
    createdAt: now + i,
    completedDates: [],
    archived: false,
  }));
  await saveAll([...created, ...all]);
  return { ok: true, added: created.length };
}

/** 同一自然日仅一次打卡 */
export async function checkInTrainingItem(
  id: string,
): Promise<{ ok: true } | { ok: false; reason: 'not_found' | 'already' }> {
  const all = await loadAllRaw();
  const idx = all.findIndex((x) => x.id === id);
  if (idx < 0) return { ok: false, reason: 'not_found' };
  const it = all[idx]!;
  if (it.archived) return { ok: false, reason: 'not_found' };
  const tkey = todayKey();
  if (it.completedDates.some((ts) => toLocalDateKey(ts) === tkey)) {
    return { ok: false, reason: 'already' };
  }
  const next = { ...it, completedDates: [...it.completedDates, Date.now()] };
  const copy = [...all];
  copy[idx] = next;
  await saveAll(copy);
  return { ok: true };
}

export async function archiveTrainingItem(id: string): Promise<boolean> {
  const all = await loadAllRaw();
  const idx = all.findIndex((x) => x.id === id);
  if (idx < 0) return false;
  const it = all[idx]!;
  if (it.archived) return true;
  const copy = [...all];
  copy[idx] = { ...it, archived: true };
  await saveAll(copy);
  return true;
}

export async function deleteTrainingItem(id: string): Promise<boolean> {
  const all = await loadAllRaw();
  const next = all.filter((x) => x.id !== id);
  if (next.length === all.length) return false;
  await saveAll(next);
  return true;
}

/** 未归档项数量、今日已有打卡的项数、连续打卡天数（从今天往前，每天至少有一项打卡） */
export async function getTrainingStats(): Promise<{
  totalItems: number;
  checkedInToday: number;
  streakDays: number;
}> {
  const items = (await loadAllRaw()).filter((x) => !x.archived);
  const totalItems = items.length;
  const tkey = todayKey();
  let checkedInToday = 0;
  for (const it of items) {
    if (it.completedDates.some((ts) => toLocalDateKey(ts) === tkey)) checkedInToday += 1;
  }
  let streakDays = 0;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  while (true) {
    const key = toLocalDateKey(d.getTime());
    let any = false;
    for (const it of items) {
      for (const ts of it.completedDates) {
        if (toLocalDateKey(ts) === key) {
          any = true;
          break;
        }
      }
      if (any) break;
    }
    if (!any) break;
    streakDays += 1;
    d.setDate(d.getDate() - 1);
  }
  return { totalItems, checkedInToday, streakDays };
}

/** 当前自然周（周一至周日）内，该训练项已打卡的天数（0–7） */
export function weekCheckInCountForItem(item: TrainingItem, now = Date.now()): number {
  const anchor = new Date(now);
  const day = anchor.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const monday = new Date(anchor);
  monday.setDate(anchor.getDate() + diffToMon);
  monday.setHours(0, 0, 0, 0);
  const keys = new Set<string>();
  for (let i = 0; i < 7; i += 1) {
    const x = new Date(monday);
    x.setDate(monday.getDate() + i);
    keys.add(toLocalDateKey(x.getTime()));
  }
  let c = 0;
  for (const k of keys) {
    if (item.completedDates.some((ts) => toLocalDateKey(ts) === k)) c += 1;
  }
  return c;
}

/** 周一至周日顺序，该天是否已打卡（用于 7 圆点） */
export function weekDotsState(item: TrainingItem, now = Date.now()): boolean[] {
  const anchor = new Date(now);
  const day = anchor.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const monday = new Date(anchor);
  monday.setDate(anchor.getDate() + diffToMon);
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(monday);
    x.setDate(monday.getDate() + i);
    const key = toLocalDateKey(x.getTime());
    return item.completedDates.some((ts) => toLocalDateKey(ts) === key);
  });
}

export function itemCheckedInToday(item: TrainingItem, now = Date.now()): boolean {
  const k = toLocalDateKey(now);
  return item.completedDates.some((ts) => toLocalDateKey(ts) === k);
}
