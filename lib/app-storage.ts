import { readJson } from '@/lib/local-storage';

export const USER_PROFILE_KEY = 'user_profile';
export const FAVORITES_KEY = 'favorites';

/** AsyncStorage `user_profile` 标准结构（新建/保存） */
export type UserProfileStorage = {
  name: string;
  birthday: string;
  bloodType: '' | 'A' | 'B' | 'AB' | 'O';
  dominantHand: 'left' | 'right';
  height: number | null;
  weight: number | null;
  wristToFloor: number | null;
  gloveSize: string;
  fingerLength: string;
  handicap: number | null;
  driverSpeed: number | null;
  golfAge: string;
  swingTempo: string;
  ballFlight: string;
  homeCourses: string[];
};

/** 与 {@link UserProfileStorage} 同义；读档后请用 {@link parseUserProfile} 收敛旧 JSON */
export type StoredUserProfile = UserProfileStorage;

export type FavoriteRecommendation = {
  id: string;
  type: string;
  model: string;
  savedAt: string;
};

export function emptyUserProfile(): UserProfileStorage {
  return {
    name: '',
    birthday: '',
    bloodType: '',
    dominantHand: 'right',
    height: null,
    weight: null,
    wristToFloor: null,
    gloveSize: '',
    fingerLength: '',
    handicap: null,
    driverSpeed: null,
    golfAge: '',
    swingTempo: '',
    ballFlight: '',
    homeCourses: [],
  };
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** 将任意 JSON 收敛为 {@link UserProfileStorage}，并尽量承接旧字段 */
export function parseUserProfile(raw: unknown): UserProfileStorage {
  const b = emptyUserProfile();
  if (!raw || typeof raw !== 'object') return b;
  const o = raw as Record<string, unknown>;

  if (typeof o.name === 'string') b.name = o.name;
  else if (typeof o.username === 'string' && o.username.trim()) b.name = o.username.trim();
  if (typeof o.birthday === 'string') b.birthday = o.birthday;
  const bt = o.bloodType;
  if (bt === 'A' || bt === 'B' || bt === 'AB' || bt === 'O') b.bloodType = bt;
  if (o.dominantHand === 'left' || o.dominantHand === 'right') b.dominantHand = o.dominantHand;

  b.height = numOrNull(o.height ?? o.heightCm);
  b.weight = numOrNull(o.weight ?? o.weightKg);
  b.wristToFloor = numOrNull(o.wristToFloor ?? o.wristToFloorCm);

  if (typeof o.gloveSize === 'string') b.gloveSize = o.gloveSize;
  if (typeof o.fingerLength === 'string') b.fingerLength = o.fingerLength;

  const hd = o.handicap;
  if (hd != null && hd !== '') {
    const n = typeof hd === 'number' ? hd : Number(String(hd).replace(',', '.'));
    if (Number.isFinite(n)) b.handicap = Math.round(n * 10) / 10;
  }

  const ds = numOrNull(o.driverSpeed ?? o.swingSpeedMph);
  if (ds != null && ds > 0) b.driverSpeed = ds;

  if (typeof o.golfAge === 'string') b.golfAge = o.golfAge;

  const st = o.swingTempo;
  if (st === '慢' || st === '中' || st === '快') b.swingTempo = st;
  else if (st === 'slow') b.swingTempo = '慢';
  else if (st === 'fast') b.swingTempo = '快';
  else if (st === 'medium') b.swingTempo = '中';

  const bf = o.ballFlight;
  if (bf === '左曲' || bf === '直' || bf === '右曲') b.ballFlight = bf;
  else if (bf === 'high' || bf === 'mid' || bf === 'low') {
    if (bf === 'high') b.ballFlight = '左曲';
    else if (bf === 'low') b.ballFlight = '右曲';
    else b.ballFlight = '直';
  }

  if (Array.isArray(o.homeCourses)) {
    b.homeCourses = o.homeCourses
      .map((x) => (typeof x === 'string' ? x.trim() : ''))
      .filter(Boolean)
      .slice(0, 3);
  }

  if (!b.ballFlight) {
    const sh = o.shotShape;
    if (sh === 'draw' || sh === 'hook') b.ballFlight = '左曲';
    else if (sh === 'fade' || sh === 'slice') b.ballFlight = '右曲';
    else if (sh === 'straight') b.ballFlight = '直';
  }

  if (!b.golfAge && typeof o.yearsPlaying === 'string' && o.yearsPlaying.trim()) {
    const y = Number(o.yearsPlaying);
    if (Number.isFinite(y)) {
      if (y < 1) b.golfAge = '< 1年';
      else if (y <= 3) b.golfAge = '1-3年';
      else if (y <= 5) b.golfAge = '3-5年';
      else if (y <= 10) b.golfAge = '5-10年';
      else b.golfAge = '10年以上';
    }
  }

  return b;
}

export async function loadUserProfile(): Promise<UserProfileStorage> {
  const raw = await readJson<unknown>(USER_PROFILE_KEY, null);
  return parseUserProfile(raw);
}

/** 球龄下拉 → 推荐算法用的近似年数 */
export function golfAgeBandToYearsPlaying(band: string): number {
  switch (band) {
    case '< 1年':
      return 0;
    case '1-3年':
      return 2;
    case '3-5年':
      return 4;
    case '5-10年':
      return 7;
    case '10年以上':
      return 12;
    default:
      return 0;
  }
}

/** 供问卷/推荐算法等读取：与旧 parseProfileNumbers 对齐的数值与枚举 */
export function profileCompatNumbers(p: UserProfileStorage | null) {
  const swingSpeed = p?.driverSpeed ?? 90;
  const handicap = p?.handicap ?? 18;
  const heightCm = p?.height ?? 170;
  const wristToFloor = p?.wristToFloor ?? 0;
  const handCm = 0;
  const yearsPlaying = golfAgeBandToYearsPlaying(p?.golfAge ?? '');
  const budget = 0;
  const currentBrand = '';

  let ballFlight: 'high' | 'mid' | 'low' = 'mid';
  let shotShape: 'straight' | 'draw' | 'fade' | 'slice' | 'hook' = 'straight';
  if (p?.ballFlight === '左曲') {
    shotShape = 'draw';
  } else if (p?.ballFlight === '右曲') {
    shotShape = 'fade';
  } else if (p?.ballFlight === '直') {
    shotShape = 'straight';
  }

  let tempo: 'slow' | 'medium' | 'fast' = 'medium';
  if (p?.swingTempo === '慢') tempo = 'slow';
  else if (p?.swingTempo === '快') tempo = 'fast';

  return {
    swingSpeed,
    handicap,
    heightCm,
    wristToFloor,
    handCm,
    yearsPlaying,
    budget,
    ballFlight,
    shotShape,
    tempo,
    currentBrand,
  };
}

/** 公历生日 → 中文星座名（摩羯跨年 12/22–1/19） */
export function zodiacFromIso(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!m) return '—';
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!Number.isFinite(month) || !Number.isFinite(day)) return '—';
  const md = month * 100 + day;
  if (md >= 1222 || md <= 119) return '摩羯座';
  if (md <= 218) return '水瓶座';
  if (md <= 320) return '双鱼座';
  if (md <= 419) return '白羊座';
  if (md <= 520) return '金牛座';
  if (md <= 620) return '双子座';
  if (md <= 722) return '巨蟹座';
  if (md <= 822) return '狮子座';
  if (md <= 922) return '处女座';
  if (md <= 1022) return '天秤座';
  if (md <= 1121) return '天蝎座';
  if (md <= 1221) return '射手座';
  return '摩羯座';
}

export function ageFromIso(isoDate: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const birth = new Date(y, mo, d);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const mdiff = today.getMonth() - birth.getMonth();
  if (mdiff < 0 || (mdiff === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}
