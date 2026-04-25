import AsyncStorage from '@react-native-async-storage/async-storage';

export const MATCH_DAY_STORAGE_KEY = '@gca_match_day_v1';

export type MatchBriefingStored = {
  strategy: string;
  focus: string[];
  leverage: string;
  mindset: string;
  rawText?: string;
  generatedAt: number;
};

export type MatchDayRecord = {
  dateKey: string;
  createdAt: number;
  updatedAt: number;
  courseName: string;
  holes: 9 | 18;
  mode: string;
  players: { name: string; hcp: string }[];
  briefing?: MatchBriefingStored | null;
};

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

type Root = { byDate: Record<string, MatchDayRecord> };

function emptyRoot(): Root {
  return { byDate: {} };
}

async function loadRoot(): Promise<Root> {
  const raw = await AsyncStorage.getItem(MATCH_DAY_STORAGE_KEY);
  if (!raw) return emptyRoot();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return emptyRoot();
    const byDate = (parsed as { byDate?: unknown }).byDate;
    if (!byDate || typeof byDate !== 'object') return emptyRoot();
    return { byDate: byDate as Record<string, MatchDayRecord> };
  } catch {
    return emptyRoot();
  }
}

async function saveRoot(root: Root): Promise<void> {
  await AsyncStorage.setItem(MATCH_DAY_STORAGE_KEY, JSON.stringify(root));
}

function normalizeRecord(raw: unknown): MatchDayRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.dateKey !== 'string' || !o.dateKey.trim()) return null;
  const holes = o.holes === 9 ? 9 : 18;
  const courseName = typeof o.courseName === 'string' ? o.courseName : '';
  const mode = typeof o.mode === 'string' ? o.mode : '';
  const createdAt =
    typeof o.createdAt === 'number' && Number.isFinite(o.createdAt) ? o.createdAt : Date.now();
  const updatedAt =
    typeof o.updatedAt === 'number' && Number.isFinite(o.updatedAt) ? o.updatedAt : createdAt;
  const players = Array.isArray(o.players)
    ? o.players
        .map((p) => {
          if (!p || typeof p !== 'object') return null;
          const r = p as Record<string, unknown>;
          return {
            name: typeof r.name === 'string' ? r.name : '',
            hcp: typeof r.hcp === 'string' ? r.hcp : '',
          };
        })
        .filter((x): x is { name: string; hcp: string } => Boolean(x))
    : [];
  let briefing: MatchBriefingStored | null | undefined;
  if (o.briefing === null) briefing = null;
  else if (o.briefing && typeof o.briefing === 'object') {
    const b = o.briefing as Record<string, unknown>;
    const strategy = typeof b.strategy === 'string' ? b.strategy : '';
    const leverage = typeof b.leverage === 'string' ? b.leverage : '';
    const mindset = typeof b.mindset === 'string' ? b.mindset : '';
    const focus = Array.isArray(b.focus)
      ? b.focus.filter((x): x is string => typeof x === 'string')
      : [];
    const gen =
      typeof b.generatedAt === 'number' && Number.isFinite(b.generatedAt)
        ? b.generatedAt
        : Date.now();
    const rawText = typeof b.rawText === 'string' ? b.rawText : undefined;
    briefing = {
      strategy,
      focus: focus.slice(0, 5),
      leverage,
      mindset,
      generatedAt: gen,
      ...(rawText ? { rawText } : {}),
    };
  }
  return {
    dateKey: o.dateKey.trim(),
    createdAt,
    updatedAt,
    holes,
    courseName,
    mode,
    players,
    ...(briefing !== undefined ? { briefing } : {}),
  };
}

export async function getMatchDayRecord(dateKey?: string): Promise<MatchDayRecord | null> {
  const key = dateKey ?? todayKey();
  const root = await loadRoot();
  const raw = root.byDate[key];
  return normalizeRecord(raw);
}

export async function upsertMatchDayDraft(partial: {
  courseName: string;
  holes: 9 | 18;
  mode: string;
  players: { name: string; hcp: string }[];
}): Promise<void> {
  const dk = todayKey();
  const root = await loadRoot();
  const prev = normalizeRecord(root.byDate[dk]);
  const now = Date.now();
  const next: MatchDayRecord = {
    dateKey: dk,
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
    courseName: partial.courseName.trim(),
    holes: partial.holes,
    mode: partial.mode,
    players: partial.players.map((p) => ({ name: p.name, hcp: p.hcp })),
    ...(prev?.briefing !== undefined ? { briefing: prev.briefing } : {}),
  };
  root.byDate[dk] = next;
  await saveRoot(root);
}

export async function saveMatchDayBriefing(briefing: MatchBriefingStored): Promise<void> {
  const dk = todayKey();
  const root = await loadRoot();
  const prev = normalizeRecord(root.byDate[dk]);
  const now = Date.now();
  const base: MatchDayRecord =
    prev ??
    ({
      dateKey: dk,
      createdAt: now,
      updatedAt: now,
      courseName: '',
      holes: 18,
      mode: '',
      players: [],
    } as MatchDayRecord);
  root.byDate[dk] = {
    ...base,
    briefing,
    updatedAt: now,
  };
  await saveRoot(root);
}

/** 首页：今日已建档、已填球场、尚无有效 briefing */
export async function getTodayBriefingHomeState(): Promise<{ pendingBriefing: boolean }> {
  const rec = await getMatchDayRecord(todayKey());
  if (!rec) return { pendingBriefing: false };
  if (!rec.courseName.trim()) return { pendingBriefing: false };
  const b = rec.briefing;
  if (b && b.strategy.trim() && typeof b.generatedAt === 'number' && b.generatedAt > 0) {
    return { pendingBriefing: false };
  }
  return { pendingBriefing: true };
}
