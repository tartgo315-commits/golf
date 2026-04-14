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
  shaftNotes: string;
  /** 内部统一存 mph（空字符串表示未填） */
  swingSpeedMph: string;
  /** 内部统一存米（空字符串表示未填） */
  carryDistanceM: string;
  /** 推杆握把型号；配件「型号/品牌」（列表标题：名称 + 型号） */
  grip: string;
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

function parseCarryInputToMeters(input: string, unit: 'm' | 'y'): string {
  const t = input.trim();
  if (t === '') return '';
  const v = parseFloat(t.replace(',', '.'));
  if (!Number.isFinite(v)) return '';
  if (unit === 'm') return String(round1(v));
  return String(round1(v * YARD_TO_M));
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

export default function MyBagScreen() {
  const [clubs, setClubs] = useState<BagClub[]>(() => DEFAULT_CLUBS.map((c) => ({ ...c })));
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
          const arr = Array.isArray(stored) ? stored : [];
          let merged = mergeStoredClubs(arr);
          merged = applyGripMigration(merged, arr, legacyInv);
          if (cancelled) return;
          setClubs(merged);
        } catch {
          let merged = DEFAULT_CLUBS.map((c) => ({ ...c }));
          merged = applyGripMigration(merged, [], legacyInv);
          if (!cancelled) setClubs(merged);
        }
      } else {
        let merged = DEFAULT_CLUBS.map((c) => ({ ...c }));
        merged = applyGripMigration(merged, [], legacyInv);
        if (!cancelled) setClubs(merged);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeCount = clubs.filter((c) => c.type !== 'accessory' && c.active).length;
  const showActiveToggle = activeCount > 14 || clubs.some((c) => !c.active);

  const update = (id: string, key: keyof BagClub, val: string | boolean) => {
    setClubs((prev) => prev.map((c) => (c.id === id ? { ...c, [key]: val } : c)));
    setSaved(false);
  };

  const setSwingUnitPersist = (u: 'mph' | 'ms') => {
    setSwingUnit(u);
    AsyncStorage.setItem(STORAGE_SWING_UNIT, u);
  };

  const setCarryUnitPersist = (u: 'm' | 'y') => {
    setCarryUnit(u);
    AsyncStorage.setItem(STORAGE_CARRY_UNIT, u);
  };

  const addClub = useCallback((type: string) => {
    setClubs((prev) => {
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
    });
    setSaved(false);
  }, []);

  const removeClub = useCallback((id: string) => {
    setExpanded((e) => (e === id ? null : e));
    setClubs((prev) => prev.filter((c) => c.id !== id));
    setSaved(false);
  }, []);

  const clubTitleText = (c: BagClub) => {
    if (c.type === 'accessory') {
      const gx = c.grip.trim();
      return gx ? `${c.name} ${gx}` : c.name;
    }
    const carry = formatCarryWithUnit(c.carryDistanceM, carryUnit);
    return carry ? `${c.name} ${carry}` : c.name;
  };

  const requestRemoveClub = useCallback(
    (id: string, name: string) => {
      const msg = `确定删除「${name}」？删除后无法恢复。`;
      const go = () => removeClub(id);
      if (Platform.OS === 'web' && typeof globalThis.confirm === 'function') {
        if (globalThis.confirm(msg)) go();
        return;
      }
      Alert.alert('删除球杆', msg, [
        { text: '取消', style: 'cancel' },
        { text: '删除', style: 'destructive', onPress: go },
      ]);
    },
    [removeClub],
  );

  const save = async () => {
    await AsyncStorage.setItem(STORAGE_CLUBS, JSON.stringify(clubs));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

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

  const renderClubFields = (club: BagClub) => {
    const nameRow = (
      <View style={s.fieldRow}>
        <Text style={s.fieldLabel}>球杆名称</Text>
        <TextInput
          style={s.fieldInput}
          value={club.name}
          onChangeText={(v) => update(club.id, 'name', v)}
          placeholder="如 4号铁木杆、5号木"
          placeholderTextColor={C.muted2}
        />
      </View>
    );

    const headModelRow = (
      <View style={s.fieldRow}>
        <Text style={s.fieldLabel}>杆头型号</Text>
        <TextInput
          style={s.fieldInput}
          value={club.headModel}
          onChangeText={(v) => update(club.id, 'headModel', v)}
          placeholder="如 Qi10 LS、SM9"
          placeholderTextColor={C.muted2}
        />
      </View>
    );

    const modelBrandRow = (
      <View style={s.fieldRow}>
        <Text style={s.fieldLabel}>型号/品牌</Text>
        <TextInput
          style={s.fieldInput}
          value={club.grip}
          onChangeText={(v) => update(club.id, 'grip', v)}
          placeholder="输入型号或品牌"
          placeholderTextColor={C.muted2}
        />
      </View>
    );

    const swingDisplay = formatSwingDisplay(club.swingSpeedMph, swingUnit);
    const carryDisplay = formatCarryDisplay(club.carryDistanceM, carryUnit);

    return (
      <>
        {nameRow}
        {headModelRow}
        <View style={s.fieldFullRow}>
          <Text style={s.fieldLabelSmall}>杆身型号</Text>
          <TextInput
            style={s.fieldInputFull}
            value={club.shaftModel}
            onChangeText={(v) => update(club.id, 'shaftModel', v)}
            placeholder="如 Fujikura Ventus TR Blue 60"
            placeholderTextColor={C.muted2}
          />
        </View>
        <View style={s.fieldTripleRow}>
          <View style={s.fieldThird}>
            <Text style={s.fieldLabelSmall}>硬度 Flex</Text>
            <TextInput
              style={s.fieldInputThird}
              value={club.flex}
              onChangeText={(v) => update(club.id, 'flex', v)}
              placeholder="S / SR / R / X（日规注明 JP）"
              placeholderTextColor={C.muted2}
            />
          </View>
          <View style={s.fieldThird}>
            <Text style={s.fieldLabelSmall}>硬度 CPM</Text>
            <TextInput
              style={s.fieldInputThird}
              value={club.flexCpm}
              onChangeText={(v) => update(club.id, 'flexCpm', v)}
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
              onChangeText={(v) => update(club.id, 'shaftLengthInch', v)}
              placeholder="inch"
              placeholderTextColor={C.muted2}
              keyboardType="decimal-pad"
            />
          </View>
        </View>
        <View style={s.fieldDoubleRow}>
          <View style={s.fieldHalf}>
            <Text style={s.fieldLabelSmall}>重量 (g)</Text>
            <TextInput
              style={s.fieldInputThird}
              value={club.shaftWeightG}
              onChangeText={(v) => update(club.id, 'shaftWeightG', v)}
              placeholder="g"
              placeholderTextColor={C.muted2}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={s.fieldHalfFlex}>
            <Text style={s.fieldLabelSmall}>杆身备注</Text>
            <TextInput
              style={s.fieldInputThird}
              value={club.shaftNotes}
              onChangeText={(v) => update(club.id, 'shaftNotes', v)}
              placeholder="如前切1寸"
              placeholderTextColor={C.muted2}
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
                onChangeText={(v) => update(club.id, 'swingSpeedMph', parseSwingInputToMph(v, swingUnit))}
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
                onChangeText={(v) => update(club.id, 'carryDistanceM', parseCarryInputToMeters(v, carryUnit))}
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

  return (
    <View style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
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
        {groups.map((type) => {
          const groupClubs = clubs.filter((c) => c.type === type);
          return (
            <View key={type} style={s.group}>
              <View style={s.groupHeader}>
                <Text style={s.groupTitle}>{TYPE_LABELS[type]}</Text>
                <TouchableOpacity style={s.addBtn} onPress={() => addClub(type)} hitSlop={8}>
                  <Text style={s.addBtnText}>+</Text>
                </TouchableOpacity>
              </View>
              {groupClubs.map((club) =>
                club.type === 'accessory' ? (
                  <View key={club.id} style={[s.clubCard, s.accessoryOneLine]}>
                    <TextInput
                      style={s.accessoryNameInput}
                      value={club.name}
                      onChangeText={(v) => update(club.id, 'name', v)}
                      placeholder="名称"
                      placeholderTextColor={C.muted2}
                    />
                    <TextInput
                      style={s.accessoryDetailInput}
                      value={club.grip}
                      onChangeText={(v) => update(club.id, 'grip', v)}
                      placeholder="型号/备注"
                      placeholderTextColor={C.muted2}
                    />
                    <TouchableOpacity
                      style={s.accessoryDeleteBtn}
                      onPress={() => requestRemoveClub(club.id, clubTitleText(club))}
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
                      onPress={() => setExpanded(expanded === club.id ? null : club.id)}
                    >
                      <View style={s.clubNameWrap}>
                        <Text
                          style={[s.clubName, !club.active && { color: 'rgba(255,255,255,0.35)' }]}
                          numberOfLines={2}
                          ellipsizeMode="tail"
                        >
                          {clubTitleText(club)}
                        </Text>
                      </View>
                      <View style={s.clubRowRight}>
                        {showActiveToggle && (
                          <TouchableOpacity
                            style={[s.toggleBtn, club.active ? s.toggleActive : s.toggleInactive]}
                            onPress={() => update(club.id, 'active', !club.active)}
                          >
                            <Text style={[s.toggleText, !club.active && { color: 'rgba(255,255,255,0.4)' }]}>
                              {club.active ? '启用' : '备用'}
                            </Text>
                          </TouchableOpacity>
                        )}
                        <Text style={s.expandIcon}>{expanded === club.id ? '▲' : '▼'}</Text>
                      </View>
                    </TouchableOpacity>

                    {expanded === club.id && (
                      <View style={s.fieldsBox}>
                        {renderClubFields(club)}
                        <TouchableOpacity
                          style={s.removeFooterBtn}
                          onPress={() => requestRemoveClub(club.id, clubTitleText(club))}
                          activeOpacity={0.75}
                        >
                          <Text style={s.removeFooterText}>删除此球杆</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))}
            </View>
          );
        })}

        <TouchableOpacity style={s.saveBottomBtn} onPress={save}>
          <Text style={s.saveBottomBtnText}>{saved ? '✓ 已保存' : '保存球包数据'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 10,
  },
  backBtn: { width: 60 },
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
    marginHorizontal: 14,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
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
  scrollContent: { paddingHorizontal: 14, paddingBottom: 40 },

  group: { marginBottom: 16 },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
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
    minWidth: 32,
    height: 28,
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
    borderRadius: 14,
    marginBottom: 6,
    overflow: 'hidden',
  },
  clubCardInactive: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderColor: 'rgba(255,255,255,0.05)',
  },
  clubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  clubNameWrap: { flex: 1, minWidth: 0, paddingRight: 8 },
  clubName: { fontSize: 14, color: C.white, fontWeight: '600' },
  clubRowRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  toggleBtn: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1 },
  toggleActive: { backgroundColor: C.limeBg, borderColor: C.limeBorder },
  toggleInactive: { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' },
  toggleText: { fontSize: 11, color: C.lime, fontWeight: '600' },

  expandIcon: { fontSize: 10, color: 'rgba(255,255,255,0.3)' },

  fieldsBox: {
    borderTopWidth: 1,
    borderTopColor: C.line,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 10,
  },
  accessoryOneLine: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 8,
  },
  accessoryNameInput: {
    width: 100,
    flexShrink: 0,
    backgroundColor: C.inputBg,
    borderWidth: 1,
    borderColor: C.inputBorder,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 13,
    color: C.white,
  },
  accessoryDetailInput: {
    flex: 1,
    minWidth: 0,
    backgroundColor: C.inputBg,
    borderWidth: 1,
    borderColor: C.inputBorder,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: C.white,
  },
  accessoryDeleteBtn: {
    flexShrink: 0,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  accessoryDeleteText: { fontSize: 13, color: C.warn, fontWeight: '600' },
  removeFooterBtn: {
    marginTop: 4,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,128,128,0.35)',
    backgroundColor: 'rgba(255,80,80,0.08)',
  },
  removeFooterText: { fontSize: 13, color: '#ff9b9b', fontWeight: '600' },
  fieldTripleRow: { flexDirection: 'row', gap: 8 },
  fieldDoubleRow: { flexDirection: 'row', gap: 8 },
  fieldThird: { flex: 1, minWidth: 0 },
  fieldHalf: { width: '31%' },
  fieldHalfFlex: { flex: 1, minWidth: 0 },
  fieldFullRow: { gap: 4 },
  fieldLabelSmall: { fontSize: 11, color: C.muted, marginBottom: 4 },
  measurePairRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  measurePairCol: { flex: 1, minWidth: 0, gap: 4 },
  measureRowInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  measureChips: { flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 0 },
  measureInput: {
    flex: 1,
    minWidth: 0,
    backgroundColor: C.inputBg,
    borderWidth: 1,
    borderColor: C.inputBorder,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: C.white,
  },
  fieldInputFull: {
    backgroundColor: C.inputBg,
    borderWidth: 1,
    borderColor: C.inputBorder,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: C.white,
  },
  fieldInputThird: {
    backgroundColor: C.inputBg,
    borderWidth: 1,
    borderColor: C.inputBorder,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 6,
    fontSize: 12,
    color: C.white,
  },
  fieldRow: { flexDirection: 'row', alignItems: 'center' },
  fieldLabel: { width: 90, fontSize: 12, color: C.muted },
  fieldInput: {
    flex: 1,
    backgroundColor: C.inputBg,
    borderWidth: 1,
    borderColor: C.inputBorder,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    color: C.white,
  },

  saveBottomBtn: {
    backgroundColor: C.lime,
    borderRadius: 14,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveBottomBtnText: { fontSize: 15, fontWeight: '700', color: C.bg },
});
