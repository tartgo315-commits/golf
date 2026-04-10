import { readJson, writeJson } from '@/lib/local-storage';

export const MY_CLUB_BAG_KEY = 'myClubBag';

export type ClubSpecs = {
  headModel: string;
  shaftBrand: string;
  shaftModel: string;
  shaftWeight: string;
  flex: string;
  cpm: string;
  length: string;
  swingWeight: string;
  gripModel: string;
  notes: string;
};

export type MyClubItem = {
  id: string;
  name: string;
  order: number;
  distance: number | null;
  specs: ClubSpecs;
};

const DEFAULT_CLUB_NAMES = ['一号木', '3木', '5木', '4铁', '5铁', '6铁', '7铁', '8铁', '9铁', 'PW', 'GW', 'SW'];

export function buildEmptySpecs(): ClubSpecs {
  return {
    headModel: '',
    shaftBrand: '',
    shaftModel: '',
    shaftWeight: '',
    flex: '',
    cpm: '',
    length: '',
    swingWeight: '',
    gripModel: '',
    notes: '',
  };
}

export function makeClubId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function buildDefaultClubBag(): MyClubItem[] {
  return DEFAULT_CLUB_NAMES.map((name, index) => ({
    id: `default-${index}-${name}`,
    name,
    order: index,
    distance: null,
    specs: buildEmptySpecs(),
  }));
}

function normalizeClub(raw: unknown, fallbackOrder: number): MyClubItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Partial<MyClubItem>;
  const name = typeof item.name === 'string' ? item.name.trim() : '';
  if (!name) return null;

  const specsRaw = item.specs && typeof item.specs === 'object' ? (item.specs as Partial<ClubSpecs>) : {};
  const distance = typeof item.distance === 'number' && Number.isFinite(item.distance) ? item.distance : null;
  const order = typeof item.order === 'number' && Number.isFinite(item.order) ? item.order : fallbackOrder;

  return {
    id: typeof item.id === 'string' && item.id.trim().length > 0 ? item.id : makeClubId(),
    name,
    order,
    distance,
    specs: {
      headModel: typeof specsRaw.headModel === 'string' ? specsRaw.headModel : '',
      shaftBrand: typeof specsRaw.shaftBrand === 'string' ? specsRaw.shaftBrand : '',
      shaftModel: typeof specsRaw.shaftModel === 'string' ? specsRaw.shaftModel : '',
      shaftWeight: typeof specsRaw.shaftWeight === 'string' ? specsRaw.shaftWeight : '',
      flex: typeof specsRaw.flex === 'string' ? specsRaw.flex : '',
      cpm: typeof specsRaw.cpm === 'string' ? specsRaw.cpm : '',
      length: typeof specsRaw.length === 'string' ? specsRaw.length : '',
      swingWeight: typeof specsRaw.swingWeight === 'string' ? specsRaw.swingWeight : '',
      gripModel: typeof specsRaw.gripModel === 'string' ? specsRaw.gripModel : '',
      notes: typeof specsRaw.notes === 'string' ? specsRaw.notes : '',
    },
  };
}

export function normalizeClubBag(raw: unknown): MyClubItem[] {
  if (!Array.isArray(raw)) return [];
  const cleaned = raw
    .map((item, index) => normalizeClub(item, index))
    .filter((item): item is MyClubItem => Boolean(item))
    .sort((a, b) => a.order - b.order)
    .map((item, index) => ({ ...item, order: index }));
  return cleaned;
}

export function loadMyClubBag(): MyClubItem[] {
  const stored = readJson<unknown>(MY_CLUB_BAG_KEY, []);
  const normalized = normalizeClubBag(stored);
  if (normalized.length > 0) return normalized;
  const defaults = buildDefaultClubBag();
  writeJson(MY_CLUB_BAG_KEY, defaults);
  return defaults;
}

export function saveMyClubBag(items: MyClubItem[]) {
  const normalized = normalizeClubBag(items);
  return writeJson(MY_CLUB_BAG_KEY, normalized);
}
