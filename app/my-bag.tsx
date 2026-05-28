import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle, Ellipse, Line, Path, Rect } from 'react-native-svg';

import { ScreenHeader } from '@/components/ScreenHeader';
import { TAB_BAR_SCROLL_EXTRA } from '@/constants/theme';
import { THEME } from '@/constants/theme';
import {
  pickFromParam,
  returnHrefForFrom,
  TABS_ROOT_HREF,
} from '@/utils/tabReturnFrom';

const STORAGE_CLUBS = 'myBagClubs';
const STORAGE_SWING_UNIT = 'myBagSwingUnit';
const STORAGE_CARRY_UNIT = 'myBagCarryUnit';
/** 旧版独立握把长文本，首次加载时合并入默认配件「握把」 */
const STORAGE_GRIP_INVENTORY_LEGACY = 'myBagGripInventory';

const GRIP_ACCESSORY_ID = 'grp';

const MPH_TO_MS = 0.44704;
const YARD_TO_M = 0.9144;

/** 页面内表单区沿用（与全站深色卡一致） */
const C = {
  bg: THEME.bg,
  lime: THEME.accent,
  limeBorder: '#2d5436',
  limeBg: THEME.accentBg,
  white: THEME.text2,
  muted: THEME.text3,
  muted2: THEME.text3,
  line: 'rgba(255,255,255,0.06)',
  card: THEME.card,
  cardBorder: 'rgba(255,255,255,0.06)',
  inputBg: 'rgba(13,27,17,0.85)',
  inputBorder: 'rgba(255,255,255,0.06)',
  warn: '#d94848',
  surfaceDeep: '#2d5436',
  saveMatte: '#1e3a26',
  groupCardBg: THEME.card,
  rowSep: 'rgba(255,255,255,0.06)',
  loftMuted: THEME.text3,
  expandMuted: THEME.text3,
  deleteX: '#ef4444',
};

type ClubType = 'wood' | 'iron' | 'wedge' | 'putter' | 'accessory';

type BagClub = {
  id: string;
  name: string;
  type: ClubType;
  active: boolean;
  /** 杆头型号（列表标题「名称」后展示，可编辑） */
  headModel: string;
  shaftModel: string;
  flex: string;
  flexCpm: string;
  shaftLengthInch: string;
  shaftWeightG: string;
  /** 紧凑行第三列展示为「挥重」；仍兼容旧数据中的杆身备注文案 */
  shaftNotes: string;
  /** 内部统一存 mph（空字符串表示未填） */
  swingSpeedMph: string;
  /** 内部统一存米（空字符串表示未填） */
  carryDistanceM: string;
  /** 目标/推荐落点（米，空字符串表示未填） */
  targetDistanceM: string;
  /** 推杆握把型号；配件「型号/品牌」（列表标题：名称 + 型号） */
  grip: string;
  /** 杆面角度（Loft），可填数字或如 58° */
  loft: string;
};

/** DeepSeek 返回字段 → 球包存盘字段 */
const AI_SPEC_TO_CLUB: Record<string, keyof BagClub> = {
  loft: 'loft',
  shaft: 'shaftModel',
  shaftFlex: 'flex',
  shaftWeight: 'shaftWeightG',
  length: 'shaftLengthInch',
  swingWeight: 'shaftNotes',
  gripModel: 'grip',
};

const DEFAULT_ROWS: Pick<BagClub, 'id' | 'name' | 'type'>[] = [
  { id: '1w', name: '1号木', type: 'wood' },
  { id: '3w', name: '3号木', type: 'wood' },
  { id: '5w', name: '5号木', type: 'wood' },
  { id: '4i', name: '4铁', type: 'iron' },
  { id: '5i', name: '5铁', type: 'iron' },
  { id: '6i', name: '6铁', type: 'iron' },
  { id: '7i', name: '7铁', type: 'iron' },
  { id: '8i', name: '8铁', type: 'iron' },
  { id: '9i', name: '9铁', type: 'iron' },
  { id: 'pi', name: 'P铁', type: 'iron' },
  { id: 'w52', name: '52度挖起杆', type: 'wedge' },
  { id: 'w56', name: '56度挖起杆', type: 'wedge' },
  { id: 'w60', name: '60度挖起杆', type: 'wedge' },
  { id: 'pt', name: '推杆', type: 'putter' },
  { id: GRIP_ACCESSORY_ID, name: '握把', type: 'accessory' },
  { id: 'rng', name: '测距仪', type: 'accessory' },
  { id: 'ball', name: '惯用球', type: 'accessory' },
];

function emptyClubFields(): Omit<BagClub, 'id' | 'name' | 'type'> {
  return {
    active: true,
    headModel: '',
    shaftModel: '',
    flex: '',
    flexCpm: '',
    shaftLengthInch: '',
    shaftWeightG: '',
    shaftNotes: '',
    swingSpeedMph: '',
    carryDistanceM: '',
    targetDistanceM: '',
    grip: '',
    loft: '',
  };
}

const DEFAULT_CLUBS: BagClub[] = DEFAULT_ROWS.map((r) => ({ ...emptyClubFields(), ...r }));

const TYPE_LABELS: Record<string, string> = {
  wood: '木杆',
  iron: '铁杆',
  wedge: '挖起杆',
  putter: '推杆',
  accessory: '配件',
};

const UI = {
  pageBg: '#0d1b11',
  card: '#16261c',
  accent: '#b5ff3a',
  textMain: '#e8f0e5',
  textSec: '#a8b5ac',
  textTer: '#8a9a8e',
  textMuted: '#5a6b5f',
  warnOrange: '#e89b3a',
  warnRed: '#d94848',
  btnBg: '#1e3a26',
  btnBorder: '#2d5436',
  segOn: '#2d5436',
  badgeOkBg: 'rgba(181,255,58,0.10)',
  badgeWarnBg: 'rgba(232,155,58,0.10)',
  badgeBadBg: 'rgba(217,72,72,0.12)',
};

const STROKE = 1.45;

function IconDriver() {
  return (
    <Svg width={18} height={18} viewBox="0 0 16 16" fill="none">
      <Line
        x1={10.5}
        y1={2}
        x2={5}
        y2={12}
        stroke={UI.accent}
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
      <Ellipse
        cx={3.5}
        cy={13}
        rx={2.8}
        ry={1.5}
        fill="none"
        stroke={UI.accent}
        strokeWidth={STROKE}
      />
    </Svg>
  );
}

function IconIron() {
  return (
    <Svg width={18} height={18} viewBox="0 0 16 16" fill="none">
      <Line
        x1={9}
        y1={2}
        x2={5.5}
        y2={11}
        stroke={UI.accent}
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
      <Path
        d="M 1.8 14 L 3.3 10.3 L 7.8 10.3 L 6.5 14 Z"
        fill="none"
        stroke={UI.accent}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function IconWedge() {
  return (
    <Svg width={18} height={18} viewBox="0 0 16 16" fill="none">
      <Line
        x1={10}
        y1={2}
        x2={6}
        y2={11}
        stroke={UI.accent}
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
      <Path
        d="M 1.3 14 L 3.2 10 L 7.7 10 L 5.8 14 Z"
        fill="none"
        stroke={UI.accent}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function IconPutter() {
  return (
    <Svg width={18} height={18} viewBox="0 0 16 16" fill="none">
      <Line
        x1={8}
        y1={2}
        x2={8}
        y2={10}
        stroke={UI.accent}
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
      <Rect
        x={2.8}
        y={10}
        width={10.4}
        height={3}
        rx={0.5}
        fill="none"
        stroke={UI.accent}
        strokeWidth={STROKE}
      />
    </Svg>
  );
}

function IconAccessory() {
  return (
    <Svg width={18} height={18} viewBox="0 0 16 16" fill="none">
      <Rect
        x={4}
        y={2}
        width={8}
        height={5}
        rx={1}
        fill="none"
        stroke={UI.accent}
        strokeWidth={STROKE}
      />
      <Circle cx={8} cy={12} r={2.5} fill="none" stroke={UI.accent} strokeWidth={STROKE} />
    </Svg>
  );
}

function TypeIcon({ type }: { type: ClubType }) {
  if (type === 'wood') return <IconDriver />;
  if (type === 'iron') return <IconIron />;
  if (type === 'wedge') return <IconWedge />;
  if (type === 'putter') return <IconPutter />;
  return <IconAccessory />;
}

function SvgCheck() {
  return (
    <Svg width={12} height={12} viewBox="0 0 16 16" fill="none">
      <Path
        d="M3 8.5l3 3 7-8"
        stroke={UI.accent}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function SvgBang() {
  return (
    <Svg width={12} height={12} viewBox="0 0 16 16" fill="none">
      <Path d="M8 3v6M8 12.5h.01" stroke={UI.warnOrange} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

const DEFAULT_IDS = new Set(DEFAULT_CLUBS.map((c) => c.id));

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function formatSwingDisplay(mphStr: string, unit: 'mph' | 'ms'): string {
  const t = mphStr.trim();
  if (t === '') return '';
  const v = parseFloat(t.replace(',', '.'));
  if (!Number.isFinite(v)) return mphStr;
  if (unit === 'mph') return String(round1(v));
  return String(round1(v * MPH_TO_MS));
}

function parseSwingInputToMph(input: string, unit: 'mph' | 'ms'): string {
  const t = input.trim();
  if (t === '') return '';
  const v = parseFloat(t.replace(',', '.'));
  if (!Number.isFinite(v)) return '';
  if (unit === 'mph') return String(round1(v));
  return String(round1(v / MPH_TO_MS));
}

function formatCarryDisplay(mStr: string, unit: 'm' | 'y'): string {
  const t = mStr.trim();
  if (t === '') return '';
  const v = parseFloat(t.replace(',', '.'));
  if (!Number.isFinite(v)) return mStr;
  if (unit === 'm') return String(round1(v));
  return String(round1(v / YARD_TO_M));
}

/** 列表标题等：数字 + 单位（与表单「落点距离」所选 m/码 一致） */
function formatCarryWithUnit(mStr: string, unit: 'm' | 'y'): string {
  const num = formatCarryDisplay(mStr, unit).trim();
  if (num === '') return '';
  return unit === 'm' ? `${num}m` : `${num}码`;
}

/** 折叠行右侧展示：数字自动加 °，已含 °/度则原样 */
function formatLoftHeader(loftRaw: string): string {
  const t = loftRaw.trim();
  if (t === '') return '';
  if (t.includes('°') || t.includes('度')) return t;
  const v = parseFloat(t.replace(',', '.'));
  if (Number.isFinite(v)) return `${round1(v)}°`;
  return t;
}

function parseCarryInputToMeters(input: string, unit: 'm' | 'y'): string {
  const t = input.trim();
  if (t === '') return '';
  const v = parseFloat(t.replace(',', '.'));
  if (!Number.isFinite(v)) return '';
  if (unit === 'm') return String(round1(v));
  /** 码→米：勿对乘积 round1。例 170×0.9144=155.448，若存成 155.4 再÷0.9144 会变成约 169.9 码 */
  const m = v * YARD_TO_M;
  return String(Math.round(m * 1e6) / 1e6);
}

function collectLegacyGripLines(raw: any[]): string[] {
  const lines: string[] = [];
  if (!Array.isArray(raw)) return lines;
  for (const s of raw) {
    if (!s || !['wood', 'iron', 'wedge'].includes(s.type)) continue;
    const g = s.grip != null ? String(s.grip).trim() : '';
    if (!g) continue;
    const label = String(s.name || s.id || '球杆');
    lines.push(`${label}：${g}`);
  }
  return lines;
}

function applyGripMigration(
  merged: BagClub[],
  rawArr: any[],
  legacyInvRaw: string | null,
): BagClub[] {
  const gripClub = merged.find((c) => c.id === GRIP_ACCESSORY_ID);
  if (!gripClub || gripClub.grip.trim() !== '') return merged;
  const lines = collectLegacyGripLines(rawArr);
  const invTrim = (legacyInvRaw || '').trim();
  const chunks: string[] = [];
  if (lines.length > 0) chunks.push(lines.join('\n'));
  if (invTrim) chunks.push(invTrim);
  if (chunks.length === 0) return merged;
  const text = chunks.join('\n\n');
  return merged.map((c) => (c.id === GRIP_ACCESSORY_ID ? { ...c, grip: text } : c));
}

function normalizeClub(x: any): BagClub {
  const type = (
    ['wood', 'iron', 'wedge', 'putter', 'accessory'].includes(x?.type) ? x.type : 'iron'
  ) as ClubType;
  const legacyShaft = typeof x?.shaft === 'string' ? x.shaft : '';

  const shaftLengthInch =
    x?.shaftLengthInch != null && String(x.shaftLengthInch).trim() !== ''
      ? String(x.shaftLengthInch)
      : x?.shaftLength != null && String(x.shaftLength).trim() !== ''
        ? String(x.shaftLength)
        : legacyShaft;

  const shaftWeightG =
    x?.shaftWeightG != null && String(x.shaftWeightG).trim() !== ''
      ? String(x.shaftWeightG)
      : x?.shaftWeight != null
        ? String(x.shaftWeight)
        : '';

  let swingSpeedMph = x?.swingSpeedMph != null ? String(x.swingSpeedMph) : '';
  if (swingSpeedMph.trim() === '' && x?.swingSpeed != null && String(x.swingSpeed).trim() !== '') {
    swingSpeedMph = String(x.swingSpeed).trim();
  }

  let carryDistanceM = x?.carryDistanceM != null ? String(x.carryDistanceM) : '';
  if (carryDistanceM.trim() === '' && x?.distance != null && String(x.distance).trim() !== '') {
    carryDistanceM = String(x.distance).trim();
  }

  const gripRaw = x?.grip != null ? String(x.grip) : '';

  const nameRaw = String(x?.name || '球杆');
  let headModel = x?.headModel != null ? String(x.headModel) : '';
  /** 旧版「球杆名称」若已改成具体称呼，迁入推杆型号（headModel） */
  if (type === 'putter' && headModel.trim() === '') {
    const nm = nameRaw.trim();
    if (nm && nm !== '推杆' && !/^推杆 \d+$/.test(nm)) {
      headModel = nm;
    }
  }

  return {
    id: String(x?.id ?? ''),
    name: nameRaw,
    type,
    active: x?.active !== false,
    headModel,
    shaftModel: x?.shaftModel != null ? String(x.shaftModel) : '',
    flex: x?.flex != null ? String(x.flex) : '',
    flexCpm: x?.flexCpm != null ? String(x.flexCpm) : '',
    shaftLengthInch,
    shaftWeightG,
    shaftNotes: x?.shaftNotes != null ? String(x.shaftNotes) : '',
    swingSpeedMph,
    carryDistanceM,
    targetDistanceM: typeof x?.targetDistanceM === 'string' ? x.targetDistanceM : '',
    grip: type === 'putter' || type === 'accessory' ? gripRaw : '',
    loft: x?.loft != null ? String(x.loft) : '',
  };
}

function mergeStoredClubs(stored: any[]): BagClub[] {
  if (!Array.isArray(stored) || stored.length === 0) return DEFAULT_CLUBS.map((c) => ({ ...c }));
  const mergedDefaults = DEFAULT_CLUBS.map((d) => {
    const s = stored.find((x: any) => x && x.id === d.id) || {};
    return normalizeClub({ ...d, ...s, id: d.id, type: d.type });
  });
  const seen = new Set(mergedDefaults.map((c) => c.id));
  const extras = stored
    .filter((x: any) => x && x.id && !DEFAULT_IDS.has(x.id))
    .map(normalizeClub)
    .filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
  return [...mergedDefaults, ...extras];
}

type SpareBag = { id: string; name: string; clubs: BagClub[] };

const BAG_KEY_SEP = '\x1e';

function expandKey(bagKey: string, clubId: string): string {
  return `${bagKey}${BAG_KEY_SEP}${clubId}`;
}

/** 折叠时在标题后展示的球杆/配件名（前几条 + 总数提示） */
const GROUP_PREVIEW_MAX_NAMES = 3;

/** 推杆列表/标题：型号存 headModel，无则回退名称（如「推杆」「推杆 2」） */
function putterListLabel(c: BagClub): string {
  const hm = c.headModel.trim();
  if (hm) return hm;
  return c.name.trim() || '未命名';
}

function formatGroupClubPreview(clubs: BagClub[], type: ClubType): string {
  if (clubs.length === 0) return '';
  if (type === 'accessory') {
    const parts: string[] = [];
    for (let i = 0; i < Math.min(GROUP_PREVIEW_MAX_NAMES, clubs.length); i++) {
      parts.push(clubs[i].name.trim() || '未命名');
    }
    let s = parts.join('、');
    if (clubs.length > GROUP_PREVIEW_MAX_NAMES) s += ` 等${clubs.length}项`;
    return s;
  }
  if (type === 'putter') {
    const names = clubs.map((c) => putterListLabel(c));
    const shown = names.slice(0, GROUP_PREVIEW_MAX_NAMES);
    let s = shown.join('、');
    if (clubs.length > GROUP_PREVIEW_MAX_NAMES) s += `…共${clubs.length}支`;
    return s;
  }
  const names = clubs.map((c) => c.name.trim() || '未命名');
  const shown = names.slice(0, GROUP_PREVIEW_MAX_NAMES);
  let s = shown.join('、');
  if (clubs.length > GROUP_PREVIEW_MAX_NAMES) s += `…共${clubs.length}支`;
  return s;
}

function parseExpandKey(key: string | null): { bagKey: string; clubId: string } | null {
  if (!key) return null;
  const i = key.indexOf(BAG_KEY_SEP);
  if (i <= 0) return null;
  return { bagKey: key.slice(0, i), clubId: key.slice(i + BAG_KEY_SEP.length) };
}

/** 兼容旧版：纯数组；新版 v2：主包 + 最多 3 个备用包 */
function normalizePersisted(
  raw: unknown,
  legacyInv: string | null,
): { main: BagClub[]; spares: SpareBag[] } {
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && (raw as { v?: number }).v === 2) {
    const o = raw as { main?: unknown; spares?: unknown };
    const mainArr = Array.isArray(o.main) ? o.main : [];
    let main = mergeStoredClubs(mainArr);
    main = applyGripMigration(main, mainArr, legacyInv);
    const sparesRaw = Array.isArray(o.spares) ? o.spares : [];
    const spares: SpareBag[] = sparesRaw.slice(0, 3).map((slot: unknown, idx: number) => {
      const s = slot as { id?: string; name?: string; clubs?: unknown };
      const id =
        typeof s?.id === 'string' && s.id.length > 0
          ? s.id
          : `spare_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const nm = typeof s?.name === 'string' ? s.name.trim() : '';
      const name = nm || `备用 ${idx + 1}`;
      const arr = Array.isArray(s?.clubs) ? s.clubs : [];
      return { id, name, clubs: mergeStoredClubs(arr) };
    });
    return { main, spares };
  }
  const arr = Array.isArray(raw) ? raw : [];
  let main = mergeStoredClubs(arr);
  main = applyGripMigration(main, arr, legacyInv);
  return { main, spares: [] };
}

export default function MyBagScreen() {
  const routeParams = useLocalSearchParams<{ from?: string | string[] }>();
  const returnTabHref = useMemo(
    () => returnHrefForFrom(pickFromParam(routeParams.from)),
    [routeParams.from],
  );

  const [mainClubs, setMainClubs] = useState<BagClub[]>(() => DEFAULT_CLUBS.map((c) => ({ ...c })));
  const [spareBags, setSpareBags] = useState<SpareBag[]>([]);
  /** 当前展示的球包：主包或某一备用包 id */
  const [activeBagKey, setActiveBagKey] = useState<'main' | string>('main');
  const [expanded, setExpanded] = useState<string | null>(null);
  /** 总览「配置明细」卡片 → 点分类进入；编辑完成返回总览 */
  const [hubView, setHubView] = useState<'overview' | ClubType>('overview');
  const [editMode, setEditMode] = useState(false);
  const [saved, setSaved] = useState(false);
  const [swingUnit, setSwingUnit] = useState<'mph' | 'ms'>('mph');
  const [carryUnit, setCarryUnit] = useState<'m' | 'y'>('m');
  const [aiFillingId, setAiFillingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [rawClubs, uSwing, uCarry, legacyInv] = await Promise.all([
        AsyncStorage.getItem(STORAGE_CLUBS),
        AsyncStorage.getItem(STORAGE_SWING_UNIT),
        AsyncStorage.getItem(STORAGE_CARRY_UNIT),
        AsyncStorage.getItem(STORAGE_GRIP_INVENTORY_LEGACY),
      ]);
      if (cancelled) return;
      if (uSwing === 'ms' || uSwing === 'mph') setSwingUnit(uSwing);
      if (uCarry === 'y' || uCarry === 'm') setCarryUnit(uCarry);

      if (rawClubs) {
        try {
          const stored = JSON.parse(rawClubs);
          const { main, spares } = normalizePersisted(stored, legacyInv);
          if (cancelled) return;
          setMainClubs(main);
          setSpareBags(spares);
        } catch {
          let merged = DEFAULT_CLUBS.map((c) => ({ ...c }));
          merged = applyGripMigration(merged, [], legacyInv);
          if (!cancelled) {
            setMainClubs(merged);
            setSpareBags([]);
          }
        }
      } else {
        let merged = DEFAULT_CLUBS.map((c) => ({ ...c }));
        merged = applyGripMigration(merged, [], legacyInv);
        if (!cancelled) {
          setMainClubs(merged);
          setSpareBags([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (activeBagKey !== 'main' && !spareBags.some((b) => b.id === activeBagKey)) {
      setActiveBagKey('main');
    }
  }, [activeBagKey, spareBags]);

  const activeSpare =
    activeBagKey !== 'main' ? spareBags.find((b) => b.id === activeBagKey) : undefined;
  const viewingMain = activeBagKey === 'main' || !activeSpare;
  const displayClubs = viewingMain ? mainClubs : activeSpare.clubs;
  const displayBagKey = viewingMain ? 'main' : activeSpare.id;

  const activeCount = displayClubs.filter((c) => c.type !== 'accessory' && c.active).length;

  const updateClubInBag = useCallback(
    (bagKey: string, clubId: string, key: keyof BagClub, val: string | boolean) => {
      const patch = (prev: BagClub[]) =>
        prev.map((c) => (c.id === clubId ? { ...c, [key]: val } : c));
      if (bagKey === 'main') {
        setMainClubs(patch);
      } else {
        setSpareBags((prev) =>
          prev.map((b) => (b.id === bagKey ? { ...b, clubs: patch(b.clubs) } : b)),
        );
      }
      setSaved(false);
    },
    [],
  );

  const fillClubWithAI = useCallback(
    async (bagKey: string, club: BagClub) => {
      const nameForLookup =
        club.type === 'putter' ? club.headModel.trim() || club.name.trim() : club.name.trim();
      if (!nameForLookup) {
        Alert.alert('提示', club.type === 'putter' ? '请先填写推杆型号' : '请先填写球杆名称');
        return;
      }
      const apiKey = process.env.EXPO_PUBLIC_DEEPSEEK_API_KEY;
      if (!apiKey?.trim()) {
        Alert.alert('补全失败', '未配置 DeepSeek API Key（EXPO_PUBLIC_DEEPSEEK_API_KEY）');
        return;
      }
      setAiFillingId(club.id);
      try {
        const res = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            max_tokens: 300,
            messages: [
              {
                role: 'user',
                content: `请查找高尔夫球杆「${nameForLookup}」的出厂规格参数。
只返回 JSON，不要任何其他文字：
{
  "loft": "度数如10.5°或空字符串",
  "shaft": "原配杆身型号如Fujikura Ventus Blue 6S或空字符串",
  "shaftFlex": "硬度如S/R/X/SR或空字符串",
  "shaftWeight": "杆身重量如60g或空字符串",
  "length": "杆长如45.5英寸或空字符串",
  "swingWeight": "挥重如D2或空字符串",
  "gripModel": "握把型号如Golf Pride MCC或空字符串"
}
如果不确定某字段填空字符串。`,
              },
            ],
          }),
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const json = (await res.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const text = json.choices?.[0]?.message?.content ?? '';
        const clean = text.replace(/```json|```/g, '').trim();
        const jsonSlice = clean.match(/\{[\s\S]*\}/)?.[0] ?? clean;
        const specs = JSON.parse(jsonSlice) as Record<string, string>;
        const patch: Partial<Record<keyof BagClub, string>> = {};
        (Object.keys(AI_SPEC_TO_CLUB) as (keyof typeof AI_SPEC_TO_CLUB)[]).forEach((f) => {
          const raw = specs[f];
          if (typeof raw !== 'string' || !raw.trim()) return;
          const targetKey = AI_SPEC_TO_CLUB[f]!;
          if (targetKey === 'grip' && club.type !== 'putter' && club.type !== 'accessory') {
            return;
          }
          patch[targetKey] = raw.trim();
        });
        if (Object.keys(patch).length === 0) {
          Alert.alert('补全失败', '未识别到可用规格字段，请手动填写');
          return;
        }
        const applyPatch = (prev: BagClub[]) =>
          prev.map((c) => (c.id === club.id ? { ...c, ...patch } : c));
        if (bagKey === 'main') {
          setMainClubs(applyPatch);
        } else {
          setSpareBags((prev) =>
            prev.map((b) => (b.id === bagKey ? { ...b, clubs: applyPatch(b.clubs) } : b)),
          );
        }
        setSaved(false);
        Alert.alert('✅ 补全完成', '已自动填入出厂规格，请核对后保存');
      } catch {
        Alert.alert('补全失败', '无法获取球杆数据，请手动填写');
      } finally {
        setAiFillingId(null);
      }
    },
    [updateClubInBag],
  );

  const setSwingUnitPersist = (u: 'mph' | 'ms') => {
    setSwingUnit(u);
    AsyncStorage.setItem(STORAGE_SWING_UNIT, u);
  };

  const setCarryUnitPersist = (u: 'm' | 'y') => {
    setCarryUnit(u);
    AsyncStorage.setItem(STORAGE_CARRY_UNIT, u);
  };

  const addClubToBag = useCallback((bagKey: string, type: string) => {
    const insertClub = (prev: BagClub[]) => {
      let insertAt = prev.length;
      for (let i = prev.length - 1; i >= 0; i--) {
        if (prev[i].type === type) {
          insertAt = i + 1;
          break;
        }
      }
      const n = prev.filter((c) => c.type === type).length + 1;
      const id = `custom_${type}_${Date.now()}`;
      const name = `${TYPE_LABELS[type] ?? type} ${n}`;
      const row: BagClub = {
        id,
        name,
        type: type as ClubType,
        ...emptyClubFields(),
      };
      const next = [...prev];
      next.splice(insertAt, 0, row);
      return next;
    };
    if (bagKey === 'main') {
      setMainClubs(insertClub);
    } else {
      setSpareBags((prev) =>
        prev.map((b) => (b.id === bagKey ? { ...b, clubs: insertClub(b.clubs) } : b)),
      );
    }
    setSaved(false);
  }, []);

  const removeClubFromBag = useCallback((bagKey: string, clubId: string) => {
    setExpanded((e) => {
      const p = parseExpandKey(e);
      if (p && p.bagKey === bagKey && p.clubId === clubId) return null;
      return e;
    });
    const drop = (prev: BagClub[]) => prev.filter((c) => c.id !== clubId);
    if (bagKey === 'main') {
      setMainClubs(drop);
    } else {
      setSpareBags((prev) =>
        prev.map((b) => (b.id === bagKey ? { ...b, clubs: drop(b.clubs) } : b)),
      );
    }
    setSaved(false);
  }, []);

  const addSpareBag = useCallback(() => {
    let createdId: string | null = null;
    setSpareBags((prev) => {
      if (prev.length >= 3) return prev;
      createdId = `spare_${Date.now()}`;
      const n = prev.length + 1;
      return [
        ...prev,
        { id: createdId, name: `备用 ${n}`, clubs: DEFAULT_CLUBS.map((c) => ({ ...c })) },
      ];
    });
    if (createdId) setActiveBagKey(createdId);
    setSaved(false);
  }, []);

  const setSpareBagName = useCallback((spareId: string, name: string) => {
    setSpareBags((prev) => prev.map((b) => (b.id === spareId ? { ...b, name } : b)));
    setSaved(false);
  }, []);

  const removeSpareBag = useCallback((spareId: string) => {
    setExpanded((e) => {
      const p = parseExpandKey(e);
      if (p && p.bagKey === spareId) return null;
      return e;
    });
    setSpareBags((prev) => prev.filter((b) => b.id !== spareId));
    setActiveBagKey((k) => (k === spareId ? 'main' : k));
    setSaved(false);
  }, []);

  const clubTitleText = (c: BagClub) => {
    if (c.type === 'accessory') {
      const gx = c.grip.trim();
      return gx ? `${c.name} ${gx}` : c.name;
    }
    const carry = formatCarryWithUnit(c.carryDistanceM, carryUnit);
    const lo = formatLoftHeader(c.loft);
    const baseName = c.type === 'putter' ? putterListLabel(c) : c.name.trim() || '球杆';
    const parts = [baseName];
    if (carry) parts.push(carry);
    if (lo) parts.push(lo);
    return parts.join(' ');
  };

  const requestRemoveClubFromBag = useCallback(
    (bagKey: string, clubId: string, name: string) => {
      const msg = `确定删除「${name}」？删除后无法恢复。`;
      const go = () => removeClubFromBag(bagKey, clubId);
      if (Platform.OS === 'web' && typeof globalThis.confirm === 'function') {
        if (globalThis.confirm(msg)) go();
        return;
      }
      Alert.alert('删除球杆', msg, [
        { text: '取消', style: 'cancel' },
        { text: '删除', style: 'destructive', onPress: go },
      ]);
    },
    [removeClubFromBag],
  );

  const requestRemoveSpareBag = useCallback(
    (spareId: string, title: string) => {
      const msg = `确定删除整个「${title}」？该备用包内所有球杆数据将一并删除。`;
      const go = () => removeSpareBag(spareId);
      if (Platform.OS === 'web' && typeof globalThis.confirm === 'function') {
        if (globalThis.confirm(msg)) go();
        return;
      }
      Alert.alert('删除备用球包', msg, [
        { text: '取消', style: 'cancel' },
        { text: '删除', style: 'destructive', onPress: go },
      ]);
    },
    [removeSpareBag],
  );

  const save = async () => {
    await AsyncStorage.setItem(
      STORAGE_CLUBS,
      JSON.stringify({ v: 2, main: mainClubs, spares: spareBags }),
    );
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const finishEdit = async () => {
    await save();
    setEditMode(false);
    setExpanded(null);
  };

  const clubViewSubtitle = (club: BagClub) => {
    if (club.type === 'accessory') {
      return club.grip.trim() || '—';
    }
    if (club.type === 'putter') {
      const parts = [club.headModel.trim(), club.loft.trim()].filter(Boolean);
      return parts.length ? parts.join(' · ') : '—';
    }
    const parts = [club.shaftModel.trim(), club.flex.trim()].filter(Boolean);
    return parts.length ? parts.join(' · ') : '—';
  };

  const clubViewRightLabel = (club: BagClub) => {
    if (club.type === 'accessory') return '—';
    if (club.type === 'putter') {
      const len = club.shaftLengthInch.trim();
      return len ? `${len}"` : '—';
    }
    return club.shaftNotes.trim() || '—';
  };

  const renderClubViewRow = (club: BagClub) => {
    const inactive = club.type !== 'accessory' && !club.active;
    return (
      <View
        style={[
          s.clubRow,
          { height: undefined, minHeight: 56, paddingVertical: 10 },
          inactive && s.clubRowInactive,
        ]}
      >
        <View style={s.clubNameSlot}>
          <Text
            style={[s.overviewTypeName, inactive && { color: 'rgba(255,255,255,0.35)' }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {club.name}
          </Text>
          <Text style={s.overviewSummary} numberOfLines={1} ellipsizeMode="tail">
            {clubViewSubtitle(club)}
          </Text>
        </View>
        <Text
          style={[s.clubCarryText, inactive && { color: 'rgba(255,255,255,0.3)' }]}
          numberOfLines={1}
        >
          {clubViewRightLabel(club)}
        </Text>
      </View>
    );
  };

  const goBackFromBag = useCallback(() => {
    if (returnTabHref) {
      router.replace(returnTabHref);
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(TABS_ROOT_HREF);
  }, [returnTabHref]);

  const groups = ['wood', 'iron', 'wedge', 'putter', 'accessory'] as const;

  const renderUnitChip = (
    active: boolean,
    label: string,
    onPress: () => void,
    narrow?: boolean,
  ) => (
    <TouchableOpacity
      onPress={onPress}
      style={[s.unitChip, active && s.unitChipOn, narrow && s.unitChipNarrow]}
      hitSlop={6}
    >
      <Text style={[s.unitChipText, active && s.unitChipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );

  const renderClubFields = (bagKey: string, club: BagClub) => {
    if (club.type === 'putter') {
      return (
        <View style={s.fieldTripleRow}>
          <View style={s.fieldThird}>
            <Text style={s.fieldLabelSmall}>推杆型号</Text>
            <TextInput
              style={s.fieldInputThird}
              value={club.headModel}
              onChangeText={(v) => updateClubInBag(bagKey, club.id, 'headModel', v)}
              placeholder="如 Spider EX"
              placeholderTextColor={C.muted2}
            />
          </View>
          <View style={s.fieldThird}>
            <Text style={s.fieldLabelSmall}>Loft</Text>
            <TextInput
              style={s.fieldInputThird}
              value={club.loft}
              onChangeText={(v) => updateClubInBag(bagKey, club.id, 'loft', v)}
              placeholder="10.5°"
              placeholderTextColor={C.muted2}
            />
          </View>
          <View style={s.fieldThird}>
            <Text style={s.fieldLabelSmall}>长度</Text>
            <TextInput
              style={s.fieldInputThird}
              value={club.shaftLengthInch}
              onChangeText={(v) => updateClubInBag(bagKey, club.id, 'shaftLengthInch', v)}
              placeholder="如 34"
              placeholderTextColor={C.muted2}
              keyboardType="decimal-pad"
            />
          </View>
        </View>
      );
    }

    const nameHeadLoftRow = (
      <View style={s.fieldTripleRow}>
        <View style={s.fieldThird}>
          <Text style={s.fieldLabelSmall}>球杆名称</Text>
          <View style={s.nameAiRow}>
            <TextInput
              style={[s.fieldInputThird, s.nameAiInput]}
              value={club.name}
              onChangeText={(v) => updateClubInBag(bagKey, club.id, 'name', v)}
              placeholder="1号木"
              placeholderTextColor={C.muted2}
            />
            <TouchableOpacity
              onPress={() => void fillClubWithAI(bagKey, club)}
              disabled={aiFillingId === club.id}
              style={s.aiFillBtn}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="AI 补全出厂规格"
            >
              <Text style={s.aiFillBtnTxt}>
                {aiFillingId === club.id ? '补全中…' : '✦ AI 补全'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={s.fieldThird}>
          <Text style={s.fieldLabelSmall}>杆头型号</Text>
          <TextInput
            style={s.fieldInputThird}
            value={club.headModel}
            onChangeText={(v) => updateClubInBag(bagKey, club.id, 'headModel', v)}
            placeholder="Qi10"
            placeholderTextColor={C.muted2}
          />
        </View>
        <View style={s.fieldThird}>
          <Text style={s.fieldLabelSmall}>Loft</Text>
          <TextInput
            style={s.fieldInputThird}
            value={club.loft}
            onChangeText={(v) => updateClubInBag(bagKey, club.id, 'loft', v)}
            placeholder="10.5°"
            placeholderTextColor={C.muted2}
          />
        </View>
      </View>
    );

    const shaftMidNotesRow = (
      <View style={s.fieldTripleRow}>
        <View style={s.fieldThird}>
          <Text style={s.fieldLabelSmall}>杆身型号</Text>
          <TextInput
            style={s.fieldInputThird}
            value={club.shaftModel}
            onChangeText={(v) => updateClubInBag(bagKey, club.id, 'shaftModel', v)}
            placeholder="Ventus"
            placeholderTextColor={C.muted2}
          />
        </View>
        <View style={s.fieldThird}>
          <Text style={s.fieldLabelSmall}>重量 (g)</Text>
          <TextInput
            style={s.fieldInputThird}
            value={club.shaftWeightG}
            onChangeText={(v) => updateClubInBag(bagKey, club.id, 'shaftWeightG', v)}
            placeholder="g"
            placeholderTextColor={C.muted2}
            keyboardType="decimal-pad"
          />
        </View>
        <View style={s.fieldThird}>
          <Text style={s.fieldLabelSmall}>挥重</Text>
          <TextInput
            style={s.fieldInputThird}
            value={club.shaftNotes}
            onChangeText={(v) => updateClubInBag(bagKey, club.id, 'shaftNotes', v)}
            placeholder="如 D4、C9"
            placeholderTextColor={C.muted2}
          />
        </View>
      </View>
    );

    const swingDisplay = formatSwingDisplay(club.swingSpeedMph, swingUnit);
    const carryDisplay = formatCarryDisplay(club.carryDistanceM, carryUnit);

    const flexCpmLengthRow = (
      <View style={s.fieldTripleRow}>
        <View style={s.fieldThird}>
          <Text style={s.fieldLabelSmall}>硬度 Flex</Text>
          <TextInput
            style={s.fieldInputThird}
            value={club.flex}
            onChangeText={(v) => updateClubInBag(bagKey, club.id, 'flex', v)}
            placeholder="S / SR / R / X（日规注明 JP）"
            placeholderTextColor={C.muted2}
          />
        </View>
        <View style={s.fieldThird}>
          <Text style={s.fieldLabelSmall}>硬度 CPM</Text>
          <TextInput
            style={s.fieldInputThird}
            value={club.flexCpm}
            onChangeText={(v) => updateClubInBag(bagKey, club.id, 'flexCpm', v)}
            placeholder="cpm"
            placeholderTextColor={C.muted2}
            keyboardType="decimal-pad"
          />
        </View>
        <View style={s.fieldThird}>
          <Text style={s.fieldLabelSmall}>长度 (inch)</Text>
          <TextInput
            style={s.fieldInputThird}
            value={club.shaftLengthInch}
            onChangeText={(v) => updateClubInBag(bagKey, club.id, 'shaftLengthInch', v)}
            placeholder="inch"
            placeholderTextColor={C.muted2}
            keyboardType="decimal-pad"
          />
        </View>
      </View>
    );

    const swingCarryRow = (
      <View style={s.measurePairRow}>
        <View style={s.measurePairCol}>
          <Text style={s.fieldLabelSmall}>挥速</Text>
          <View style={s.measureRowInner}>
            <TextInput
              style={s.measureInput}
              value={swingDisplay}
              onChangeText={(v) =>
                updateClubInBag(
                  bagKey,
                  club.id,
                  'swingSpeedMph',
                  parseSwingInputToMph(v, swingUnit),
                )
              }
              placeholder={swingUnit === 'mph' ? 'mph' : 'm/s'}
              placeholderTextColor={C.muted2}
              keyboardType="decimal-pad"
            />
            <View style={s.measureChips}>
              {renderUnitChip(swingUnit === 'mph', 'mph', () => setSwingUnitPersist('mph'), true)}
              {renderUnitChip(swingUnit === 'ms', 'm/s', () => setSwingUnitPersist('ms'), true)}
            </View>
          </View>
        </View>
        <View style={s.measurePairCol}>
          <Text style={s.fieldLabelSmall}>落点距离</Text>
          <View style={s.measureRowInner}>
            <TextInput
              style={s.measureInput}
              value={carryDisplay}
              onChangeText={(v) =>
                updateClubInBag(
                  bagKey,
                  club.id,
                  'carryDistanceM',
                  parseCarryInputToMeters(v, carryUnit),
                )
              }
              placeholder={carryUnit === 'm' ? 'm' : '码'}
              placeholderTextColor={C.muted2}
              keyboardType="decimal-pad"
              onBlur={() => void save()}
            />
            <View style={s.measureChips}>
              {renderUnitChip(carryUnit === 'm', 'm', () => setCarryUnitPersist('m'), true)}
              {renderUnitChip(carryUnit === 'y', '码', () => setCarryUnitPersist('y'), true)}
            </View>
          </View>
          <Text style={s.fieldLabelSmall}>目标距离</Text>
          <TextInput
            style={s.fieldInput}
            value={formatCarryDisplay(club.targetDistanceM, carryUnit)}
            onChangeText={(v) =>
              updateClubInBag(
                bagKey,
                club.id,
                'targetDistanceM',
                parseCarryInputToMeters(v, carryUnit),
              )
            }
            keyboardType="decimal-pad"
            placeholder={carryUnit === 'm' ? 'm' : '码'}
            placeholderTextColor={C.muted2}
            onBlur={() => void save()}
          />
        </View>
      </View>
    );

    return (
      <>
        {nameHeadLoftRow}
        {shaftMidNotesRow}
        {flexCpmLengthRow}
        {swingCarryRow}
      </>
    );
  };

  const renderGroupDetailBlock = (bagKey: string, clubs: BagClub[], type: ClubType) => {
    const groupClubs = clubs.filter((c) => c.type === type);
    const lastIdx = groupClubs.length - 1;
    const activeCountBag = clubs.filter((c) => c.type !== 'accessory' && c.active).length;
    const showActiveToggleBag = activeCountBag > 14 || clubs.some((c) => !c.active);

    return (
      <View style={s.groupDetailOuter}>
        <View style={s.detailToolbar}>
          <Text style={s.detailToolbarTitle}>{TYPE_LABELS[type]}</Text>
          {editMode ? (
            <TouchableOpacity
              style={s.detailAddTap}
              onPress={() => addClubToBag(bagKey, type)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`添加${TYPE_LABELS[type]}`}
            >
              <Text style={s.detailAddTapTxt}>+ 添加</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={s.groupCard}>
          {groupClubs.map((club, rowIdx) =>
            club.type === 'accessory' ? (
              <View key={club.id} style={[s.clubRowBlock, rowIdx !== lastIdx && s.clubRowSep]}>
                {editMode ? (
                  <View style={s.accessoryRow}>
                    <TextInput
                      style={s.accessoryTypeInput}
                      value={club.name}
                      onChangeText={(v) => updateClubInBag(bagKey, club.id, 'name', v)}
                      placeholder="类型"
                      placeholderTextColor={C.muted2}
                    />
                    <TextInput
                      style={s.accessoryModelInput}
                      value={club.grip}
                      onChangeText={(v) => updateClubInBag(bagKey, club.id, 'grip', v)}
                      placeholder="型号"
                      placeholderTextColor={C.muted2}
                    />
                    <TouchableOpacity
                      style={s.accessoryDeleteIconBtn}
                      onPress={() => requestRemoveClubFromBag(bagKey, club.id, clubTitleText(club))}
                      hitSlop={10}
                      accessibilityLabel="删除"
                      accessibilityRole="button"
                    >
                      <Text style={s.accessoryDeleteChar}>删除</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  renderClubViewRow(club)
                )}
              </View>
            ) : club.type === 'putter' ? (
              <View key={club.id} style={[s.clubRowBlock, rowIdx !== lastIdx && s.clubRowSep]}>
                {editMode ? (
                  <>
                    {showActiveToggleBag ? (
                      <View style={[s.putterToggleRow, !club.active && s.putterToggleRowInactive]}>
                        <TouchableOpacity
                          style={[s.toggleBtn, club.active ? s.toggleActive : s.toggleInactive]}
                          onPress={() => updateClubInBag(bagKey, club.id, 'active', !club.active)}
                          hitSlop={6}
                        >
                          <Text
                            style={[s.toggleText, !club.active && { color: 'rgba(255,255,255,0.4)' }]}
                          >
                            {club.active ? '启用' : '备用'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                    <View style={[s.fieldsBox, showActiveToggleBag && s.fieldsBoxAfterPutterToggle]}>
                      {renderClubFields(bagKey, club)}
                      <TouchableOpacity
                        style={s.removeFooterBtn}
                        onPress={() => requestRemoveClubFromBag(bagKey, club.id, clubTitleText(club))}
                        activeOpacity={0.75}
                      >
                        <Text style={s.removeFooterText}>删除此球杆</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  renderClubViewRow(club)
                )}
              </View>
            ) : editMode ? (
              <View key={club.id} style={[s.clubRowBlock, rowIdx !== lastIdx && s.clubRowSep]}>
                <TouchableOpacity
                  style={[s.clubRow, !club.active && s.clubRowInactive]}
                  onPress={() =>
                    setExpanded(
                      expanded === expandKey(bagKey, club.id) ? null : expandKey(bagKey, club.id),
                    )
                  }
                >
                  <View style={s.clubNameSlot}>
                    <Text
                      style={[s.clubNameText, !club.active && { color: 'rgba(255,255,255,0.35)' }]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {club.name}
                    </Text>
                  </View>
                  <View style={s.clubCarrySlot}>
                    <Text
                      style={[s.clubCarryText, !club.active && { color: 'rgba(255,255,255,0.3)' }]}
                    >
                      {formatCarryWithUnit(club.carryDistanceM, carryUnit) || ' '}
                    </Text>
                  </View>
                  <View style={s.clubRightSlot}>
                    <Text
                      style={[s.clubLoftText, !club.active && { color: 'rgba(255,255,255,0.25)' }]}
                      numberOfLines={1}
                    >
                      {formatLoftHeader(club.loft) || ' '}
                    </Text>
                    {showActiveToggleBag && (
                      <TouchableOpacity
                        style={[s.toggleBtn, club.active ? s.toggleActive : s.toggleInactive]}
                        onPress={() => updateClubInBag(bagKey, club.id, 'active', !club.active)}
                      >
                        <Text
                          style={[s.toggleText, !club.active && { color: 'rgba(255,255,255,0.4)' }]}
                        >
                          {club.active ? '启用' : '备用'}
                        </Text>
                      </TouchableOpacity>
                    )}
                    <Text style={s.expandIcon}>
                      {expanded === expandKey(bagKey, club.id) ? '▲' : '▼'}
                    </Text>
                  </View>
                </TouchableOpacity>

                {expanded === expandKey(bagKey, club.id) && (
                  <View style={s.fieldsBox}>
                    {renderClubFields(bagKey, club)}
                    <TouchableOpacity
                      style={s.removeFooterBtn}
                      onPress={() => requestRemoveClubFromBag(bagKey, club.id, clubTitleText(club))}
                      activeOpacity={0.75}
                    >
                      <Text style={s.removeFooterText}>删除此球杆</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ) : (
              <View key={club.id} style={[s.clubRowBlock, rowIdx !== lastIdx && s.clubRowSep]}>
                {renderClubViewRow(club)}
              </View>
            ),
          )}
        </View>
      </View>
    );
  };

  const onPressHeaderBack = () => {
    if (hubView !== 'overview') {
      setHubView('overview');
      return;
    }
    goBackFromBag();
  };

  const selectMainBag = () => setActiveBagKey('main');

  const selectSpareTab = () => {
    if (spareBags.length === 0) {
      addSpareBag();
      return;
    }
    if (activeBagKey === 'main') {
      setActiveBagKey(spareBags[0].id);
      return;
    }
    if (spareBags.length > 1) {
      const idx = spareBags.findIndex((b) => b.id === activeBagKey);
      if (idx >= 0) {
        setActiveBagKey(spareBags[(idx + 1) % spareBags.length].id);
      }
    }
  };

  const heroBadge = (() => {
    if (activeCount === 14) {
      return (
        <View style={[s.heroBadge, { backgroundColor: UI.badgeOkBg }]}>
          <SvgCheck />
          <Text style={[s.heroBadgeTxt, { color: UI.accent }]}>已配满</Text>
        </View>
      );
    }
    if (activeCount < 14) {
      const n = 14 - activeCount;
      return (
        <View style={[s.heroBadge, { backgroundColor: UI.badgeWarnBg }]}>
          <SvgBang />
          <Text style={[s.heroBadgeTxt, { color: UI.warnOrange }]}>还差 {n} 支</Text>
        </View>
      );
    }
    const over = activeCount - 14;
    return (
      <View style={[s.heroBadge, { backgroundColor: UI.badgeBadBg }]}>
        <Text style={[s.heroBadgeTxt, { color: UI.warnRed }]}>超出 {over} 支</Text>
      </View>
    );
  })();

  const headerTitle = hubView === 'overview' ? '我的球包' : TYPE_LABELS[hubView];
  const headerSub = hubView === 'overview' ? '配杆中心 · 球杆管理' : '配杆中心 · 球杆管理';

  return (
    <View style={s.root}>
      <ScreenHeader
        variant="stack"
        backMode="chevron"
        title={headerTitle}
        subtitle={headerSub}
        onBack={onPressHeaderBack}
        trailing={
          editMode ? (
            <TouchableOpacity onPress={() => void finishEdit()} style={s.saveOutline} activeOpacity={0.85}>
              <Text style={s.saveOutlineTxt}>完成</Text>
            </TouchableOpacity>
          ) : (
            <Pressable onPress={() => setEditMode(true)} hitSlop={10} accessibilityRole="button">
              <Text style={s.saveOutlineTxt}>编辑</Text>
            </Pressable>
          )
        }
      />

      <View style={s.bagSegOuter}>
        <Pressable
          style={[s.bagSegChip, viewingMain && s.bagSegChipOn]}
          onPress={selectMainBag}
          accessibilityRole="button"
        >
          <Text style={[s.bagSegTxt, viewingMain && s.bagSegTxtOn]}>主球包</Text>
        </Pressable>
        <Pressable
          style={[s.bagSegChip, !viewingMain && s.bagSegChipOn]}
          onPress={selectSpareTab}
          accessibilityRole="button"
        >
          <Text style={[s.bagSegTxt, !viewingMain && s.bagSegTxtOn]}>备用</Text>
        </Pressable>
        <Pressable
          style={[s.bagSegChip, spareBags.length >= 3 && s.bagSegChipDisabled]}
          onPress={addSpareBag}
          disabled={spareBags.length >= 3}
          accessibilityRole="button"
          accessibilityState={{ disabled: spareBags.length >= 3 }}
        >
          <Text
            style={[s.bagSegTxt, spareBags.length >= 3 && s.bagSegTxtDisabled]}
          >{`+ 新建`}</Text>
        </Pressable>
      </View>

      {spareBags.length > 1 && !viewingMain ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.sparePickScroll}
          style={s.sparePickBar}
        >
          {spareBags.map((bag) => {
            const on = activeBagKey === bag.id;
            return (
              <Pressable
                key={bag.id}
                style={[s.sparePickChip, on && s.sparePickChipOn]}
                onPress={() => setActiveBagKey(bag.id)}
              >
                <Text style={[s.sparePickTxt, on && s.sparePickTxtOn]} numberOfLines={1}>
                  {bag.name.trim() || '备用包'}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {!viewingMain && activeSpare ? (
        <View style={s.spareViewHeader}>
          <View style={s.spareViewHeaderLeft}>
            <Text style={s.spareViewHeaderLabel}>球包名称</Text>
            {editMode ? (
              <TextInput
                style={s.spareBagNameInput}
                value={activeSpare.name}
                onChangeText={(t) => setSpareBagName(activeSpare.id, t)}
                onBlur={() => {
                  if (!activeSpare.name.trim()) {
                    const i = spareBags.findIndex((x) => x.id === activeSpare.id) + 1;
                    setSpareBags((p) =>
                      p.map((b) => (b.id === activeSpare.id ? { ...b, name: `备用 ${i}` } : b)),
                    );
                    setSaved(false);
                  }
                }}
                placeholder="备用包名称"
                placeholderTextColor={C.muted2}
              />
            ) : (
              <Text style={s.overviewTypeName}>{activeSpare.name.trim() || '备用包'}</Text>
            )}
          </View>
          {editMode ? (
            <TouchableOpacity
              style={s.removeSpareBtn}
              onPress={() => {
                const i = spareBags.findIndex((x) => x.id === activeSpare.id) + 1;
                requestRemoveSpareBag(activeSpare.id, activeSpare.name.trim() || `备用 ${i}`);
              }}
              hitSlop={8}
            >
              <Text style={s.removeSpareBtnText}>移除整包</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {hubView === 'overview' ? (
        <View style={s.heroCard}>
          <View style={s.heroLeft}>
            <Text style={s.heroMini}>球杆数量</Text>
            <View style={s.heroNumRow}>
              <Text style={s.heroBig}>{activeCount}</Text>
              <Text style={s.heroSlash}> / 14</Text>
            </View>
            <Text style={s.heroHint}>规则上限 14 支</Text>
          </View>
          {heroBadge}
        </View>
      ) : null}

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {hubView === 'overview' ? (
          <>
            <Text style={s.sectionTitle}>配置明细</Text>
            {groups.map((type) => {
              const groupClubs = displayClubs.filter((c) => c.type === type);
              const n = groupClubs.length;
              const summary = formatGroupClubPreview(groupClubs, type);
              const unit = type === 'accessory' ? '件' : '支';
              return (
                <Pressable
                  key={type}
                  style={s.overviewRowCard}
                  onPress={() => setHubView(type)}
                  accessibilityRole="button"
                  accessibilityLabel={`${TYPE_LABELS[type]} 明细`}
                >
                  <View style={s.overviewIconWrap}>
                    <TypeIcon type={type} />
                  </View>
                  <View style={s.overviewMid}>
                    <View style={s.overviewTopLine}>
                      <Text style={s.overviewTypeName}>{TYPE_LABELS[type]}</Text>
                      <Text style={s.overviewCount}>
                        {n} {unit}
                      </Text>
                    </View>
                    <Text style={s.overviewSummary} numberOfLines={1} ellipsizeMode="tail">
                      {summary || '暂无明细'}
                    </Text>
                  </View>
                  <Text style={s.overviewChev}>›</Text>
                </Pressable>
              );
            })}
          </>
        ) : (
          renderGroupDetailBlock(displayBagKey, displayClubs, hubView)
        )}
        <View style={s.scrollFooterSpacer} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  saveOutline: {
    backgroundColor: UI.btnBg,
    borderWidth: 1,
    borderColor: UI.btnBorder,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
  },
  saveOutlineTxt: { fontSize: 13, fontWeight: '700', color: UI.accent },

  bagSegOuter: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: UI.card,
    borderRadius: 10,
    padding: 3,
    gap: 4,
  },
  bagSegChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  bagSegChipOn: { backgroundColor: UI.segOn },
  bagSegChipDisabled: { opacity: 0.45 },
  bagSegTxt: { fontSize: 12, fontWeight: '700', color: UI.textTer },
  bagSegTxtOn: { fontWeight: '800', color: UI.accent },
  bagSegTxtDisabled: { color: UI.textTer },

  sparePickBar: { maxHeight: 44, marginBottom: 8 },
  sparePickScroll: { paddingHorizontal: 16, gap: 8, alignItems: 'center', flexDirection: 'row' },
  sparePickChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sparePickChipOn: { borderColor: UI.btnBorder, backgroundColor: 'rgba(45,84,54,0.4)' },
  sparePickTxt: { fontSize: 12, fontWeight: '600', color: UI.textTer, maxWidth: 140 },
  sparePickTxtOn: { fontWeight: '700', color: UI.accent },

  heroCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    backgroundColor: UI.card,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroLeft: { flex: 1, minWidth: 0 },
  heroMini: { fontSize: 11, fontWeight: '700', color: UI.textTer, marginBottom: 8 },
  heroNumRow: { flexDirection: 'row', alignItems: 'baseline' },
  heroBig: {
    fontSize: 38,
    fontWeight: '800',
    color: UI.accent,
    letterSpacing: -1,
  },
  heroSlash: { fontSize: 18, fontWeight: '700', color: UI.textMuted },
  heroHint: { fontSize: 11, fontWeight: '600', color: UI.textMuted, marginTop: 6 },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 8,
    flexShrink: 0,
  },
  heroBadgeTxt: { fontSize: 11, fontWeight: '800' },

  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: UI.textSec,
    marginBottom: 10,
    marginHorizontal: 16,
  },
  overviewRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: UI.card,
    borderRadius: 12,
    padding: 14,
  },
  overviewIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: 'rgba(181,255,58,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overviewMid: { flex: 1, minWidth: 0 },
  overviewTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  overviewTypeName: { fontSize: 14, fontWeight: '700', color: UI.textMain },
  overviewCount: { fontSize: 11, fontWeight: '800', color: UI.accent },
  overviewSummary: { fontSize: 11, fontWeight: '600', color: UI.textTer },
  overviewChev: { fontSize: 16, fontWeight: '600', color: UI.textMuted },

  groupDetailOuter: { paddingHorizontal: 16, paddingBottom: 8 },
  detailToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  detailToolbarTitle: { fontSize: 14, fontWeight: '700', color: UI.textSec },
  detailAddTap: { paddingVertical: 4, paddingHorizontal: 4 },
  detailAddTapTxt: { fontSize: 13, fontWeight: '700', color: UI.accent },

  unitChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  unitChipNarrow: { paddingHorizontal: 6 },
  unitChipOn: {
    borderColor: C.limeBorder,
    backgroundColor: C.limeBg,
  },
  unitChipText: { fontSize: 11, color: C.muted, fontWeight: '600' },
  unitChipTextOn: { color: C.lime },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 0, paddingBottom: 24 + TAB_BAR_SCROLL_EXTRA },
  scrollFooterSpacer: { height: 12 },

  spareViewHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
    marginHorizontal: 16,
  },
  spareViewHeaderLeft: { flex: 1, minWidth: 0 },
  spareViewHeaderLabel: { fontSize: 12, color: C.muted, marginBottom: 6 },
  spareBagNameInput: {
    fontSize: 14,
    color: C.white,
    fontWeight: '700',
    paddingVertical: 7,
    paddingHorizontal: 9,
    backgroundColor: C.inputBg,
    borderWidth: 1,
    borderColor: C.inputBorder,
    borderRadius: 10,
  },
  removeSpareBtn: { paddingVertical: 4, paddingHorizontal: 2, marginTop: 14 },
  removeSpareBtnText: { fontSize: 13, color: C.warn, fontWeight: '600' },

  group: {},
  groupGapTop: { marginTop: 16 },
  groupCard: {
    backgroundColor: C.groupCardBg,
    borderRadius: 12,
    overflow: 'hidden',
    padding: 0,
  },
  groupTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.rowSep,
  },
  groupTitleTouchable: { flex: 1, minWidth: 0 },
  groupTitleLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 },
  /** 下拉箭头与「+」同一行、同一垂直对齐 */
  groupTitleRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexShrink: 0,
  },
  groupChevronBtn: {
    minWidth: 32,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupTitleAndPreview: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    marginRight: 4,
  },
  groupTitleAccent: {
    width: 3,
    height: 20,
    borderRadius: 1,
    backgroundColor: C.lime,
    opacity: 0.6,
    marginRight: 12,
  },
  groupTitleText: { fontSize: 16, color: C.white, fontWeight: '800', flexShrink: 0 },
  groupTitlePreview: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    color: C.muted,
    fontWeight: '600',
    lineHeight: 20,
  },
  groupChevron: {
    fontSize: 15,
    lineHeight: 15,
    color: C.expandMuted,
    textAlign: 'center',
    ...Platform.select({ android: { includeFontPadding: false } }),
  },
  addBtnCircle: {
    minWidth: 32,
    minHeight: 32,
    marginLeft: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 0,
    backgroundColor: 'transparent',
  },
  addBtnCircleText: {
    fontSize: 15,
    lineHeight: 15,
    color: C.lime,
    fontWeight: '700',
    textAlign: 'center',
    ...Platform.select({ android: { includeFontPadding: false } }),
  },

  clubRowBlock: {},
  clubRowSep: {
    borderBottomWidth: 0.5,
    borderBottomColor: C.rowSep,
  },
  clubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    height: 48,
    paddingHorizontal: 14,
    paddingVertical: 0,
  },
  clubRowInactive: { opacity: 0.72 },
  /** 名称用 View 包一层：避免 Text 直接 flex 把右侧 Loft 挤出可视区（父级 overflow:hidden 会裁掉） */
  clubNameSlot: { flex: 1, minWidth: 0, marginRight: 4 },
  clubNameText: { fontSize: 14, color: C.white, fontWeight: '600' },
  /** 中间落点固定宽度，保证左右都能露出 */
  clubCarrySlot: {
    width: 80,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clubCarryText: { fontSize: 14, color: C.lime, fontWeight: '700', textAlign: 'center' },
  clubRightSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 5,
    flexShrink: 0,
    minWidth: 108,
    paddingLeft: 2,
  },
  clubLoftText: {
    fontSize: 13,
    color: C.loftMuted,
    fontWeight: '600',
    minWidth: 36,
    maxWidth: 72,
    textAlign: 'right',
  },

  toggleBtn: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4, borderWidth: 1 },
  toggleActive: { backgroundColor: C.limeBg, borderColor: C.limeBorder },
  toggleInactive: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  toggleText: { fontSize: 12, color: C.lime, fontWeight: '600' },

  expandIcon: { fontSize: 12, color: C.expandMuted, marginLeft: 2 },

  /** 推杆无折叠行时：启用/备用条与表单之间只保留一条分隔 */
  putterToggleRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.rowSep,
  },
  putterToggleRowInactive: { opacity: 0.72 },
  fieldsBoxAfterPutterToggle: {
    borderTopWidth: 0,
    paddingTop: 10,
  },
  fieldsBox: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.rowSep,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    gap: 8,
  },
  accessoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    height: 48,
    paddingHorizontal: 14,
    paddingVertical: 0,
    gap: 8,
  },
  accessoryTypeInput: {
    width: 92,
    flexShrink: 0,
    paddingVertical: 0,
    paddingHorizontal: 0,
    fontSize: 12,
    color: C.muted,
    fontWeight: '600',
  },
  accessoryModelInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 0,
    paddingHorizontal: 0,
    fontSize: 14,
    color: C.white,
    fontWeight: '600',
  },
  accessoryDeleteIconBtn: {
    flexShrink: 0,
    paddingHorizontal: 4,
    paddingVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  accessoryDeleteChar: {
    fontSize: 13,
    color: C.deleteX,
    fontWeight: '600',
    backgroundColor: 'transparent',
  },
  removeFooterBtn: {
    marginTop: 2,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,128,128,0.35)',
    backgroundColor: 'rgba(255,80,80,0.08)',
  },
  removeFooterText: { fontSize: 12, color: '#ff9b9b', fontWeight: '600' },
  fieldTripleRow: { flexDirection: 'row', gap: 6 },
  fieldThird: { flex: 1, minWidth: 0 },
  fieldLabelSmall: { fontSize: 10, color: C.muted, marginBottom: 2 },
  measurePairRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  measurePairCol: { flex: 1, minWidth: 0, gap: 3 },
  measureRowInner: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  measureChips: { flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 0 },
  measureInput: {
    flex: 1,
    minWidth: 0,
    backgroundColor: C.inputBg,
    borderWidth: 1,
    borderColor: C.inputBorder,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 11,
    color: C.white,
  },
  fieldInputThird: {
    backgroundColor: C.inputBg,
    borderWidth: 1,
    borderColor: C.inputBorder,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 5,
    fontSize: 11,
    color: C.white,
  },
  nameAiRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nameAiInput: { flex: 1, minWidth: 0 },
  aiFillBtn: {
    backgroundColor: 'rgba(201,255,74,0.12)',
    borderWidth: 0.5,
    borderColor: 'rgba(201,255,74,0.3)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    flexShrink: 0,
  },
  aiFillBtnTxt: { fontSize: 11, fontWeight: '700', color: '#c9ff4a' },
  fieldRow: { flexDirection: 'row', alignItems: 'center' },
  fieldLabel: { width: 76, fontSize: 11, color: C.muted },
  fieldInput: {
    flex: 1,
    backgroundColor: C.inputBg,
    borderWidth: 1,
    borderColor: C.inputBorder,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    fontSize: 12,
    color: C.white,
  },
});
