import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const STORAGE_CLUBS = 'myBagClubs';
const STORAGE_SWING_UNIT = 'myBagSwingUnit';
const STORAGE_CARRY_UNIT = 'myBagCarryUnit';
/** 旧版独立握把长文本，首次加载时合并入默认配件「握把」 */
const STORAGE_GRIP_INVENTORY_LEGACY = 'myBagGripInventory';

const GRIP_ACCESSORY_ID = 'grp';

const MPH_TO_MS = 0.44704;
const YARD_TO_M = 0.9144;

const C = {
  bg: '#0d1f10',
  lime: '#a3e635',
  limeBorder: 'rgba(163,230,53,0.4)',
  limeBg: 'rgba(163,230,53,0.15)',
  white: '#fff',
  muted: 'rgba(255,255,255,0.5)',
  muted2: 'rgba(255,255,255,0.2)',
  line: 'rgba(255,255,255,0.07)',
  card: 'rgba(255,255,255,0.06)',
  cardBorder: 'rgba(255,255,255,0.09)',
  inputBg: 'rgba(255,255,255,0.06)',
  inputBorder: 'rgba(255,255,255,0.1)',
  warn: '#ff8080',
  /** 折叠行 Loft 字色（比 muted 略亮，易辨认） */
  loftRowText: 'rgba(255,255,255,0.72)',
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
  /** 推杆握把型号；配件「型号/品牌」（列表标题：名称 + 型号） */
  grip: string;
  /** 杆面角度（Loft），可填数字或如 58° */
  loft: string;
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

function applyGripMigration(merged: BagClub[], rawArr: any[], legacyInvRaw: string | null): BagClub[] {
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
  const type = (['wood', 'iron', 'wedge', 'putter', 'accessory'].includes(x?.type) ? x.type : 'iron') as ClubType;
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

  return {
    id: String(x?.id ?? ''),
    name: String(x?.name || '球杆'),
    type,
    active: x?.active !== false,
    headModel: x?.headModel != null ? String(x.headModel) : '',
    shaftModel: x?.shaftModel != null ? String(x.shaftModel) : '',
    flex: x?.flex != null ? String(x.flex) : '',
    flexCpm: x?.flexCpm != null ? String(x.flexCpm) : '',
    shaftLengthInch,
    shaftWeightG,
    shaftNotes: x?.shaftNotes != null ? String(x.shaftNotes) : '',
    swingSpeedMph,
    carryDistanceM,
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

function parseExpandKey(key: string | null): { bagKey: string; clubId: string } | null {
  if (!key) return null;
  const i = key.indexOf(BAG_KEY_SEP);
  if (i <= 0) return null;
  return { bagKey: key.slice(0, i), clubId: key.slice(i + BAG_KEY_SEP.length) };
}

/** 兼容旧版：纯数组；新版 v2：主包 + 最多 3 个备用包 */
function normalizePersisted(raw: unknown, legacyInv: string | null): { main: BagClub[]; spares: SpareBag[] } {
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
  const [mainClubs, setMainClubs] = useState<BagClub[]>(() => DEFAULT_CLUBS.map((c) => ({ ...c })));
  const [spareBags, setSpareBags] = useState<SpareBag[]>([]);
  /** 当前展示的球包：主包或某一备用包 id */
  const [activeBagKey, setActiveBagKey] = useState<'main' | string>('main');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [swingUnit, setSwingUnit] = useState<'mph' | 'ms'>('mph');
  const [carryUnit, setCarryUnit] = useState<'m' | 'y'>('m');

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

  const activeSpare = activeBagKey !== 'main' ? spareBags.find((b) => b.id === activeBagKey) : undefined;
  const viewingMain = activeBagKey === 'main' || !activeSpare;
  const displayClubs = viewingMain ? mainClubs : activeSpare.clubs;
  const displayBagKey = viewingMain ? 'main' : activeSpare.id;

  const activeCount = displayClubs.filter((c) => c.type !== 'accessory' && c.active).length;

  const updateClubInBag = useCallback((bagKey: string, clubId: string, key: keyof BagClub, val: string | boolean) => {
    const patch = (prev: BagClub[]) => prev.map((c) => (c.id === clubId ? { ...c, [key]: val } : c));
    if (bagKey === 'main') {
      setMainClubs(patch);
    } else {
      setSpareBags((prev) => prev.map((b) => (b.id === bagKey ? { ...b, clubs: patch(b.clubs) } : b)));
    }
    setSaved(false);
  }, []);

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
      setSpareBags((prev) => prev.map((b) => (b.id === bagKey ? { ...b, clubs: drop(b.clubs) } : b)));
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
    const parts = [c.name.trim() || '球杆'];
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

  const goBackFromBag = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)' as any);
    }
  }, []);

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
    const nameHeadLoftRow = (
      <View style={s.fieldTripleRow}>
        <View style={s.fieldThird}>
          <Text style={s.fieldLabelSmall}>球杆名称</Text>
          <TextInput
            style={s.fieldInputThird}
            value={club.name}
            onChangeText={(v) => updateClubInBag(bagKey, club.id, 'name', v)}
            placeholder="1号木"
            placeholderTextColor={C.muted2}
          />
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

    const shaftWeightNotesRow = (
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

    const modelBrandRow = (
      <View style={s.fieldRow}>
        <Text style={s.fieldLabel}>型号/品牌</Text>
        <TextInput
          style={s.fieldInput}
          value={club.grip}
          onChangeText={(v) => updateClubInBag(bagKey, club.id, 'grip', v)}
          placeholder="输入型号或品牌"
          placeholderTextColor={C.muted2}
        />
      </View>
    );

    const swingDisplay = formatSwingDisplay(club.swingSpeedMph, swingUnit);
    const carryDisplay = formatCarryDisplay(club.carryDistanceM, carryUnit);

    return (
      <>
        {nameHeadLoftRow}
        {shaftWeightNotesRow}
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
        <View style={s.measurePairRow}>
          <View style={s.measurePairCol}>
            <Text style={s.fieldLabelSmall}>挥速</Text>
            <View style={s.measureRowInner}>
              <TextInput
                style={s.measureInput}
                value={swingDisplay}
                onChangeText={(v) =>
                  updateClubInBag(bagKey, club.id, 'swingSpeedMph', parseSwingInputToMph(v, swingUnit))
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
                  updateClubInBag(bagKey, club.id, 'carryDistanceM', parseCarryInputToMeters(v, carryUnit))
                }
                placeholder={carryUnit === 'm' ? 'm' : '码'}
                placeholderTextColor={C.muted2}
                keyboardType="decimal-pad"
              />
              <View style={s.measureChips}>
                {renderUnitChip(carryUnit === 'm', 'm', () => setCarryUnitPersist('m'), true)}
                {renderUnitChip(carryUnit === 'y', '码', () => setCarryUnitPersist('y'), true)}
              </View>
            </View>
          </View>
        </View>
        {club.type === 'putter' && modelBrandRow}
      </>
    );
  };

  const renderBagBlock = (bagKey: string, clubs: BagClub[]) => {
    const activeCountBag = clubs.filter((c) => c.type !== 'accessory' && c.active).length;
    const showActiveToggleBag = activeCountBag > 14 || clubs.some((c) => !c.active);

    return groups.map((type) => {
      const groupClubs = clubs.filter((c) => c.type === type);
      return (
        <View key={`${bagKey}_${type}`} style={s.group}>
          <View style={s.groupHeader}>
            <Text style={s.groupTitle}>{TYPE_LABELS[type]}</Text>
            <TouchableOpacity style={s.addBtn} onPress={() => addClubToBag(bagKey, type)} hitSlop={8}>
              <Text style={s.addBtnText}>+</Text>
            </TouchableOpacity>
          </View>
          {groupClubs.map((club) =>
            club.type === 'accessory' ? (
              <View key={club.id} style={[s.clubCard, s.accessoryOneLine]}>
                <TextInput
                  style={s.accessoryNameInput}
                  value={club.name}
                  onChangeText={(v) => updateClubInBag(bagKey, club.id, 'name', v)}
                  placeholder="名称"
                  placeholderTextColor={C.muted2}
                />
                <TextInput
                  style={s.accessoryDetailInput}
                  value={club.grip}
                  onChangeText={(v) => updateClubInBag(bagKey, club.id, 'grip', v)}
                  placeholder="型号/备注"
                  placeholderTextColor={C.muted2}
                />
                <TouchableOpacity
                  style={s.accessoryDeleteBtn}
                  onPress={() => requestRemoveClubFromBag(bagKey, club.id, clubTitleText(club))}
                  hitSlop={6}
                >
                  <Text style={s.accessoryDeleteText}>删除</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View
                key={club.id}
                style={[s.clubCard, !club.active && s.clubCardInactive]}
              >
                <TouchableOpacity
                  style={s.clubRow}
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
                      ellipsizeMode="tail">
                      {club.name}
                    </Text>
                  </View>
                  <View style={s.clubCarrySlot}>
                    <Text style={[s.clubCarryText, !club.active && { color: 'rgba(255,255,255,0.3)' }]}>
                      {formatCarryWithUnit(club.carryDistanceM, carryUnit) || ' '}
                    </Text>
                  </View>
                  <View style={s.clubRightSlot}>
                    <Text
                      style={[s.clubLoftText, !club.active && { color: 'rgba(255,255,255,0.28)' }]}
                      numberOfLines={1}>
                      {formatLoftHeader(club.loft) || ' '}
                    </Text>
                    {showActiveToggleBag && (
                      <TouchableOpacity
                        style={[s.toggleBtn, club.active ? s.toggleActive : s.toggleInactive]}
                        onPress={() => updateClubInBag(bagKey, club.id, 'active', !club.active)}
                      >
                        <Text style={[s.toggleText, !club.active && { color: 'rgba(255,255,255,0.4)' }]}>
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
                      onPress={() =>
                        requestRemoveClubFromBag(bagKey, club.id, clubTitleText(club))
                      }
                      activeOpacity={0.75}
                    >
                      <Text style={s.removeFooterText}>删除此球杆</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ),
          )}
        </View>
      );
    });
  };

  return (
    <View style={s.root}>
      <View style={s.header}>
        <TouchableOpacity
          onPress={goBackFromBag}
          style={s.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 8, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="返回">
          <Text style={s.backText}>‹ 返回</Text>
        </TouchableOpacity>
        <Text style={s.title}>🏌️ 我的球包</Text>
        <TouchableOpacity onPress={save} style={s.saveBtn}>
          <Text style={s.saveBtnText}>{saved ? '已保存✓' : '保存'}</Text>
        </TouchableOpacity>
      </View>

      <View style={s.statusBar}>
        <Text style={s.statusText}>
          球杆数量：<Text style={[s.statusNum, activeCount > 14 && { color: C.warn }]}>{activeCount}</Text> / 14
        </Text>
        {activeCount > 14 && <Text style={s.statusWarn}>超出限制！请将部分球杆设为备用</Text>}
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        {viewingMain ? (
          <Text style={s.mainBagHint}>主用球包</Text>
        ) : activeSpare ? (
          <View style={s.spareViewHeader}>
            <View style={s.spareViewHeaderLeft}>
              <Text style={s.spareViewHeaderLabel}>球包名称</Text>
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
            </View>
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
          </View>
        ) : null}

        {renderBagBlock(displayBagKey, displayClubs)}

        <TouchableOpacity style={s.saveBottomBtn} onPress={save}>
          <Text style={s.saveBottomBtnText}>{saved ? '✓ 已保存' : '保存球包数据'}</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={s.bagSwitcher}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.bagSwitcherScrollContent}>
          <TouchableOpacity
            style={[s.bagChip, viewingMain && s.bagChipOn]}
            onPress={() => setActiveBagKey('main')}
            hitSlop={6}>
            <Text
              style={[s.bagChipText, viewingMain && s.bagChipTextOn]}
              numberOfLines={1}
              ellipsizeMode="tail">
              我的球包
            </Text>
          </TouchableOpacity>
          {spareBags.map((bag) => {
            const on = activeBagKey === bag.id;
            return (
              <TouchableOpacity
                key={bag.id}
                style={[s.bagChip, on && s.bagChipOn]}
                onPress={() => setActiveBagKey(bag.id)}
                hitSlop={6}>
                <Text
                  style={[s.bagChipText, on && s.bagChipTextOn]}
                  numberOfLines={1}
                  ellipsizeMode="tail">
                  {bag.name.trim() || '备用包'}
                </Text>
              </TouchableOpacity>
            );
          })}
          {spareBags.length < 3 ? (
            <TouchableOpacity style={s.bagChipAdd} onPress={addSpareBag} hitSlop={6}>
              <Text style={s.bagChipAddText}>＋ 备用</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  /** 勿固定窄宽：「‹ 返回」会超出触摸区，导致点到文字右侧无反应 */
  backBtn: { flexShrink: 0, paddingVertical: 6, paddingHorizontal: 4, justifyContent: 'center' },
  backText: { fontSize: 16, color: C.lime, fontWeight: '600' },
  title: { fontSize: 17, color: C.white, fontWeight: '700' },
  saveBtn: {
    backgroundColor: C.limeBg,
    borderWidth: 1,
    borderColor: C.limeBorder,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  saveBtnText: { fontSize: 12, color: C.lime, fontWeight: '600' },

  statusBar: {
    marginHorizontal: 12,
    marginBottom: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusText: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  statusNum: { color: C.lime, fontWeight: '700' },
  statusWarn: { fontSize: 11, color: C.warn, marginTop: 2 },
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
  scrollContent: { paddingHorizontal: 12, paddingBottom: 28 },

  mainBagHint: {
    fontSize: 12,
    color: C.muted,
    fontWeight: '600',
    marginBottom: 6,
    marginLeft: 2,
  },
  spareViewHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 8,
  },
  spareViewHeaderLeft: { flex: 1, minWidth: 0 },
  spareViewHeaderLabel: { fontSize: 11, color: C.muted, marginBottom: 4 },
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

  bagSwitcher: {
    borderTopWidth: 1,
    borderTopColor: C.line,
    paddingVertical: 8,
    paddingBottom: 10,
    backgroundColor: C.bg,
  },
  bagSwitcherScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingRight: 16,
  },
  bagChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginRight: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    maxWidth: 140,
  },
  bagChipOn: {
    borderColor: C.limeBorder,
    backgroundColor: C.limeBg,
  },
  bagChipText: { fontSize: 13, color: C.muted, fontWeight: '600' },
  bagChipTextOn: { color: C.lime },
  bagChipAdd: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginRight: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(163,230,53,0.35)',
    backgroundColor: 'rgba(163,230,53,0.08)',
  },
  bagChipAddText: { fontSize: 13, color: C.lime, fontWeight: '600' },

  group: { marginBottom: 10 },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    paddingRight: 2,
  },
  groupTitle: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginLeft: 2,
  },
  addBtn: {
    minWidth: 30,
    height: 26,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(163,230,53,0.45)',
    backgroundColor: 'rgba(163,230,53,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  addBtnText: { fontSize: 18, color: C.lime, fontWeight: '700', lineHeight: 20 },

  clubCard: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.cardBorder,
    borderRadius: 12,
    marginBottom: 5,
    overflow: 'hidden',
  },
  clubCardInactive: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderColor: 'rgba(255,255,255,0.05)',
  },
  clubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 9,
  },
  /** 名称用 View 包一层：避免 Text 直接 flex 把右侧 Loft 挤出可视区（父级 overflow:hidden 会裁掉） */
  clubNameSlot: { flex: 1, minWidth: 0, marginRight: 4 },
  clubNameText: { fontSize: 13, color: C.white, fontWeight: '600' },
  /** 中间落点固定宽度，保证左右都能露出 */
  clubCarrySlot: {
    width: 80,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clubCarryText: { fontSize: 12, color: C.lime, fontWeight: '700', textAlign: 'center' },
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
    fontSize: 12,
    color: C.loftRowText,
    fontWeight: '600',
    minWidth: 36,
    maxWidth: 72,
    textAlign: 'right',
  },

  toggleBtn: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1 },
  toggleActive: { backgroundColor: C.limeBg, borderColor: C.limeBorder },
  toggleInactive: { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' },
  toggleText: { fontSize: 11, color: C.lime, fontWeight: '600' },

  expandIcon: { fontSize: 10, color: 'rgba(255,255,255,0.3)' },

  fieldsBox: {
    borderTopWidth: 1,
    borderTopColor: C.line,
    paddingHorizontal: 10,
    paddingTop: 7,
    paddingBottom: 8,
    gap: 6,
  },
  accessoryOneLine: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 8,
    gap: 6,
  },
  accessoryNameInput: {
    width: 92,
    flexShrink: 0,
    backgroundColor: C.inputBg,
    borderWidth: 1,
    borderColor: C.inputBorder,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 6,
    fontSize: 12,
    color: C.white,
  },
  accessoryDetailInput: {
    flex: 1,
    minWidth: 0,
    backgroundColor: C.inputBg,
    borderWidth: 1,
    borderColor: C.inputBorder,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 12,
    color: C.white,
  },
  accessoryDeleteBtn: {
    flexShrink: 0,
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  accessoryDeleteText: { fontSize: 12, color: C.warn, fontWeight: '600' },
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

  saveBottomBtn: {
    backgroundColor: C.lime,
    borderRadius: 12,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  saveBottomBtnText: { fontSize: 14, fontWeight: '700', color: C.bg },
});
