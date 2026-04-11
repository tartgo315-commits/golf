import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInput as RNTextInput,
} from 'react-native';
import * as Location from 'expo-location';
import { type Href, useRouter } from 'expo-router';

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
import { fetchNearbyCourses, getNearbyCoursesBaseUrl, type NearbyCourse } from '@/lib/nearby-courses-client';

const GREEN = '#166534';
const BG = '#f3f4f6';
const WHITE = '#ffffff';
const BORDER = '#e5e7eb';
const TEXT_PRIMARY = '#111827';
const TEXT_SECONDARY = '#6b7280';
const RED = '#dc2626';
const LIGHT_GREEN = '#dcfce7';
const BOGEY_BG = '#fee2e2';

type ParPreset = '72' | '71' | '70' | 'custom';

export type ScorecardEntryProps = {
  onBack?: () => void;
};

function todayStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function filterCourseRating(raw: string) {
  const cleaned = raw.replace(/[^\d.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot === -1) return cleaned;
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
}

function buildSampleStrokeStrings(pars: number[]) {
  return pars.map((p, i) => {
    const delta = i % 3 === 0 ? 0 : i % 3 === 1 ? 1 : -1;
    return String(Math.max(1, p + delta));
  });
}

function formatVsPar(diff: number) {
  if (diff === 0) return 'E';
  return diff > 0 ? `+${diff}` : `${diff}`;
}

function parseParInput(s: string): { ok: boolean; n: number } {
  const t = s.trim();
  if (!t) return { ok: false, n: NaN };
  const n = Number(t);
  if (!Number.isInteger(n) || n < 3 || n > 6) return { ok: false, n };
  return { ok: true, n };
}

function parseStrokeField(s: string): { empty: boolean; valid: boolean; value: number } {
  const t = s.trim();
  if (!t) return { empty: true, valid: false, value: NaN };
  if (!/^\d+$/.test(t)) return { empty: false, valid: false, value: NaN };
  const n = Number(t);
  if (!Number.isFinite(n) || n > 15) return { empty: false, valid: false, value: n };
  return { empty: false, valid: true, value: n };
}

function parsePuttField(s: string): { count: number | null } {
  const t = s.trim();
  if (!t) return { count: null };
  if (!/^\d+$/.test(t)) return { count: null };
  const n = Number(t);
  if (!Number.isFinite(n) || n > 15) return { count: null };
  return { count: n };
}

export function ScorecardEntry({ onBack }: ScorecardEntryProps) {
  const router = useRouter();
  const [date, setDate] = useState(todayStr);
  const [courseName, setCourseName] = useState('');
  const [roundHoles, setRoundHoles] = useState<18 | 9>(18);
  const [courseRating, setCourseRating] = useState('');
  const [slopeRating, setSlopeRating] = useState('113');
  const [parPreset, setParPreset] = useState<ParPreset>('72');
  const [playerName, setPlayerName] = useState('球员 A');

  const [pars, setPars] = useState<number[]>(() => buildParArray('72', 18));
  const [parTexts, setParTexts] = useState<string[]>(() => buildParArray('72', 18).map(String));
  const [strokeTexts, setStrokeTexts] = useState<string[]>(() => buildSampleStrokeStrings(buildParArray('72', 18)));
  const [puttTexts, setPuttTexts] = useState<string[]>(() => Array(18).fill('2'));

  const strokeRefs = useRef<(RNTextInput | null)[]>([]);
  const puttRefs = useRef<(RNTextInput | null)[]>([]);
  const parsRef = useRef(pars);
  const nearbyAbortRef = useRef<AbortController | null>(null);

  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyErr, setNearbyErr] = useState<string | null>(null);
  const [nearbyList, setNearbyList] = useState<NearbyCourse[]>([]);

  const holeCount = roundHoles;

  useEffect(() => {
    parsRef.current = pars;
  }, [pars]);

  useEffect(() => {
    return () => {
      nearbyAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const n = roundHoles;
    if (parPreset !== 'custom') {
      const base = buildParArray(parPreset, n);
      setPars(base);
      setParTexts(base.map(String));
      setStrokeTexts(buildSampleStrokeStrings(base));
      setPuttTexts(Array(n).fill('2'));
      return;
    }
    setPars((prev) => {
      const next = prev.slice(0, n);
      while (next.length < n) next.push(4);
      return next;
    });
    setParTexts((prev) => {
      const next = prev.slice(0, n);
      while (next.length < n) next.push('4');
      return next;
    });
    setStrokeTexts((prev) => {
      const next = prev.slice(0, n);
      while (next.length < n) next.push('');
      return next;
    });
    setPuttTexts((prev) => {
      const next = prev.slice(0, n);
      while (next.length < n) next.push('');
      return next;
    });
  }, [roundHoles, parPreset]);

  const totals = useMemo(() => {
    let strokeSum = 0;
    let puttSum = 0;
    let parForScored = 0;
    let scored = 0;
    for (let i = 0; i < holeCount; i += 1) {
      const st = parseStrokeField(strokeTexts[i] ?? '');
      if (st.valid) {
        strokeSum += st.value;
        parForScored += pars[i] ?? 0;
        scored += 1;
      }
      const pt = parsePuttField(puttTexts[i] ?? '');
      if (pt.count !== null) puttSum += pt.count;
    }
    const vs = scored > 0 ? strokeSum - parForScored : null;
    return { strokeSum, puttSum, vs, scored };
  }, [holeCount, pars, strokeTexts, puttTexts]);

  const strokeInvalid = useCallback(
    (idx: number) => {
      const s = strokeTexts[idx] ?? '';
      if (!s.trim()) return false;
      const p = parseStrokeField(s);
      return !p.valid;
    },
    [strokeTexts],
  );

  const strokeCellBg = useCallback(
    (idx: number) => {
      if (strokeInvalid(idx)) return WHITE;
      const st = parseStrokeField(strokeTexts[idx] ?? '');
      if (!st.valid) return WHITE;
      const par = pars[idx] ?? 4;
      if (st.value < par) return LIGHT_GREEN;
      if (st.value > par) return BOGEY_BG;
      return WHITE;
    },
    [pars, strokeInvalid, strokeTexts],
  );

  const onSaveRound = useCallback(() => {
    const name = courseName.trim();
    const cr = Number(courseRating);
    const sr = Number(slopeRating);
    if (!name) {
      Alert.alert('提示', '请填写球场名称。');
      return;
    }
    if (!Number.isFinite(cr) || cr < 50 || cr > 90) {
      Alert.alert('提示', '请填写合理的球场难度系数（Course Rating，常见约 55–75）。');
      return;
    }
    if (!Number.isFinite(sr) || sr < 55 || sr > 155) {
      Alert.alert('提示', '请填写合理的坡度系数（Slope Rating，常见 113 左右）。');
      return;
    }

    const details: HoleDetail[] = [];
    for (let i = 0; i < holeCount; i += 1) {
      const st = parseStrokeField(strokeTexts[i] ?? '');
      if (!st.valid) {
        Alert.alert('提示', `请填写第 ${i + 1} 洞的杆数。`);
        return;
      }
      const par = pars[i] ?? 4;
      const pt = parsePuttField(puttTexts[i] ?? '');
      const putts = pt.count !== null ? pt.count : 2;
      const fairwayHit: boolean | null = par === 3 ? null : false;
      details.push({
        holeNumber: i + 1,
        par,
        distanceM: null,
        strokes: st.value,
        putts,
        fairwayHit,
        greenInRegulation: calcGIR(st.value, par, putts),
      });
    }

    const adjustedGross = calcAdjustedGrossFromHoles(details);
    const diff = calcDifferential(adjustedGross, cr, sr, holeCount);

    const newRecord: HandicapRecord = {
      id: makeHandicapRecordId(),
      date: date.trim() || todayStr(),
      courseName: name,
      courseRating: cr,
      slopeRating: sr,
      adjustedGrossScore: adjustedGross,
      holes: holeCount,
      scoreDifferential: diff,
      notes: '',
      holeDetails: details,
      totalPutts: 0,
      fairwaysHit: 0,
      fairwaysTotal: 0,
      greensInRegulation: 0,
      front9Strokes: 0,
      back9Strokes: 0,
    };

    try {
      const existing = loadHandicapRecords();
      saveHandicapRecords([newRecord, ...existing]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '保存失败';
      Alert.alert('保存失败', msg);
      return;
    }

    Alert.alert('已保存', '本轮成绩已写入差点记录。', [
      {
        text: '好的',
        onPress: () => {
          onBack?.();
          router.replace('/(tabs)/handicap' as Href);
        },
      },
    ]);
  }, [
    courseName,
    courseRating,
    date,
    holeCount,
    onBack,
    pars,
    puttTexts,
    router,
    slopeRating,
    strokeTexts,
  ]);

  const clearStrokes = useCallback(() => {
    setStrokeTexts(Array(holeCount).fill(''));
    setPuttTexts(Array(holeCount).fill(''));
  }, [holeCount]);

  const showSlopeTip = useCallback(() => {
    Alert.alert('坡度系数', '标准坡度系数为 113，男子通常 55-155');
  }, []);

  const showCourseTip = useCallback(() => {
    Alert.alert('球场难度系数', '由球场官方评定，通常印在记分卡上，代表零差点球手的预期成绩。');
  }, []);

  const onPickNearbyCourse = useCallback((name: string) => {
    setCourseName(name);
    setNearbyList([]);
    setNearbyErr(null);
  }, []);

  const loadNearbyCourses = useCallback(async (force?: 'osm') => {
    if (!getNearbyCoursesBaseUrl()) {
      Alert.alert(
        '未配置球场搜索接口',
        '请在项目根目录创建 .env，添加：\nEXPO_PUBLIC_NEARBY_COURSES_URL=https://你的域名/api/nearby-courses\n然后重新启动 Expo（需能访问部署好的 api/nearby-courses.js）。',
      );
      return;
    }
    nearbyAbortRef.current?.abort();
    const ac = new AbortController();
    nearbyAbortRef.current = ac;
    setNearbyErr(null);
    setNearbyLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setNearbyErr('需要定位权限才能搜索附近球场，请在系统设置中开启。');
        setNearbyList([]);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = pos.coords;
      const list = await fetchNearbyCourses(latitude, longitude, { force: force, signal: ac.signal });
      setNearbyList(list);
      if (list.length === 0) {
        setNearbyErr('附近未找到球场，可改用手动输入名称。');
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return;
      const msg = e instanceof Error ? e.message : '加载失败';
      setNearbyErr(msg);
      setNearbyList([]);
    } finally {
      setNearbyLoading(false);
    }
  }, []);

  const onParChange = useCallback((idx: number, text: string) => {
    const digit = text.replace(/\D/g, '').slice(0, 1);
    setParTexts((prev) => {
      const next = [...prev];
      next[idx] = digit;
      return next;
    });
    if (digit === '') return;
    const v = Number(digit);
    if (v >= 3 && v <= 6) {
      setPars((prev) => {
        const next = [...prev];
        next[idx] = v;
        return next;
      });
    }
  }, []);

  const onParBlur = useCallback((idx: number) => {
    setParTexts((prevT) => {
      const nextT = [...prevT];
      if ((nextT[idx] ?? '').trim() === '') nextT[idx] = String(parsRef.current[idx] ?? 4);
      return nextT;
    });
  }, []);

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      {onBack ? (
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backTxt}>← 返回</Text>
        </Pressable>
      ) : null}
      <Text style={styles.title}>成绩记录</Text>

      <View style={styles.compactCard}>
        <Text style={styles.compactLabel}>日期</Text>
        <View style={styles.inline}>
          <TextInput value={date} onChangeText={setDate} style={[styles.compactInput, styles.inlineInput]} placeholder="YYYY-MM-DD" />
          <Pressable style={styles.todayBtn} onPress={() => setDate(todayStr())}>
            <Text style={styles.todayBtnText}>今天</Text>
          </Pressable>
        </View>

        <Text style={styles.compactLabel}>球场名称</Text>
        <TextInput value={courseName} onChangeText={setCourseName} style={styles.compactInput} placeholder="例如 XX 高尔夫球场" />
        <View style={styles.nearbyBtnRow}>
          <Pressable
            style={[styles.nearbyBtn, nearbyLoading && styles.nearbyBtnDisabled]}
            onPress={() => void loadNearbyCourses()}
            disabled={nearbyLoading}>
            {nearbyLoading ? (
              <ActivityIndicator color={GREEN} size="small" />
            ) : (
              <Text style={styles.nearbyBtnTxt}>定位并搜索附近球场</Text>
            )}
          </Pressable>
          <Pressable
            style={[styles.nearbyBtnGhost, nearbyLoading && styles.nearbyBtnDisabled]}
            onPress={() => void loadNearbyCourses('osm')}
            disabled={nearbyLoading}>
            <Text style={styles.nearbyBtnGhostTxt}>仅 OSM</Text>
          </Pressable>
        </View>
        {!getNearbyCoursesBaseUrl() ? (
          <Text style={styles.nearbyHint}>未设置 EXPO_PUBLIC_NEARBY_COURSES_URL 时无法联网搜球场，仍可手输名称。</Text>
        ) : null}
        {nearbyErr ? <Text style={styles.nearbyErr}>{nearbyErr}</Text> : null}
        {nearbyList.length > 0 ? (
          <ScrollView style={styles.nearbyScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {nearbyList.map((c, idx) => (
              <Pressable
                key={`${c.name}-${idx}`}
                style={styles.nearbyRow}
                onPress={() => onPickNearbyCourse(c.name)}>
                <View style={styles.nearbyRowText}>
                  <Text style={styles.nearbyName} numberOfLines={2}>
                    {c.name}
                  </Text>
                  <Text style={styles.nearbyMeta} numberOfLines={1}>
                    {typeof c.distance === 'number' ? `约 ${c.distance} km` : ''}
                    {c.address ? ` · ${c.address}` : ''}
                  </Text>
                </View>
                <Text style={styles.nearbyPick}>选用</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <Text style={styles.compactLabel}>洞数</Text>
        <View style={styles.chipRow}>
          <Pressable style={[styles.chip, roundHoles === 18 && styles.chipOn]} onPress={() => setRoundHoles(18)}>
            <Text style={[styles.chipTxt, roundHoles === 18 && styles.chipTxtOn]}>18洞</Text>
          </Pressable>
          <Pressable style={[styles.chip, roundHoles === 9 && styles.chipOn]} onPress={() => setRoundHoles(9)}>
            <Text style={[styles.chipTxt, roundHoles === 9 && styles.chipTxtOn]}>9洞</Text>
          </Pressable>
        </View>

        <View style={styles.labelRow}>
          <Text style={styles.compactLabel}>球场难度系数</Text>
          <Pressable onPress={showCourseTip} hitSlop={8} style={styles.helpMarkWrap}>
            <Text style={styles.helpMarkTxt}>?</Text>
          </Pressable>
        </View>
        <TextInput
          value={courseRating}
          onChangeText={(t) => setCourseRating(filterCourseRating(t))}
          style={styles.compactInput}
          placeholder="例如 72.4"
          keyboardType="decimal-pad"
        />

        <View style={styles.labelRow}>
          <Text style={styles.compactLabel}>坡度系数</Text>
          <Pressable onPress={showSlopeTip} hitSlop={8} style={styles.helpMarkWrap}>
            <Text style={styles.helpMarkTxt}>?</Text>
          </Pressable>
        </View>
        <TextInput value={slopeRating} onChangeText={setSlopeRating} style={styles.compactInput} placeholder="113" keyboardType="number-pad" />

        <Text style={styles.compactLabel}>标准杆预设</Text>
        <View style={styles.presetRow}>
          {(['72', '71', '70', 'custom'] as ParPreset[]).map((p) => (
            <Pressable key={p} style={[styles.presetChip, parPreset === p && styles.chipOn]} onPress={() => setParPreset(p)}>
              <Text style={[styles.presetTxt, parPreset === p && styles.chipTxtOn]}>{p === 'custom' ? '自定义' : `Par${p}`}</Text>
            </Pressable>
          ))}
        </View>
        {parPreset === 'custom' ? <Text style={styles.hint}>自定义默认每洞 Par4，可在表格中逐洞修改。</Text> : null}
      </View>

      <View style={styles.tableCard}>
        <Text style={styles.tableTitle}>记分卡</Text>
        <Text style={styles.playerLabel}>球员名称</Text>
        <TextInput value={playerName} onChangeText={setPlayerName} style={styles.playerInput} placeholder="球员 A" />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tableScroll}>
          <View style={styles.tableInner}>
            <View style={styles.labelCol}>
              <Text style={[styles.cornerCell, styles.headerText]}> </Text>
              <Text style={styles.rowLabel}>标准杆</Text>
              <Text style={styles.rowLabel}>杆数</Text>
              <Text style={styles.rowLabel}>推杆</Text>
            </View>
            {Array.from({ length: holeCount }, (_, idx) => (
              <View key={idx} style={styles.holeCol}>
                <Text style={[styles.holeNum, styles.headerText]}>{idx + 1}</Text>
                <TextInput
                  value={parTexts[idx] ?? ''}
                  onChangeText={(t) => onParChange(idx, t)}
                  onBlur={() => onParBlur(idx)}
                  style={styles.parCell}
                  keyboardType="number-pad"
                  selectTextOnFocus
                />
                <TextInput
                  ref={(el) => {
                    strokeRefs.current[idx] = el;
                  }}
                  value={strokeTexts[idx] ?? ''}
                  onChangeText={(t) =>
                    setStrokeTexts((prev) => {
                      const next = [...prev];
                      next[idx] = t.replace(/\D/g, '');
                      return next;
                    })
                  }
                  style={[
                    styles.scoreCell,
                    { backgroundColor: strokeCellBg(idx) },
                    strokeInvalid(idx) && styles.scoreCellError,
                  ]}
                  keyboardType="number-pad"
                  selectTextOnFocus
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => puttRefs.current[idx]?.focus()}
                />
                <TextInput
                  ref={(el) => {
                    puttRefs.current[idx] = el;
                  }}
                  value={puttTexts[idx] ?? ''}
                  onChangeText={(t) =>
                    setPuttTexts((prev) => {
                      const next = [...prev];
                      next[idx] = t.replace(/\D/g, '');
                      return next;
                    })
                  }
                  style={styles.scoreCell}
                  placeholder="选填"
                  placeholderTextColor={TEXT_SECONDARY}
                  keyboardType="number-pad"
                  selectTextOnFocus
                  returnKeyType={idx < holeCount - 1 ? 'next' : 'done'}
                  blurOnSubmit={false}
                  onSubmitEditing={() => {
                    if (idx < holeCount - 1) strokeRefs.current[idx + 1]?.focus();
                  }}
                />
              </View>
            ))}
          </View>
        </ScrollView>

        <View style={styles.totalsRow}>
          <Text style={styles.totalLine}>
            总杆数 <Text style={styles.totalEm}>{totals.strokeSum}</Text>
          </Text>
          <Text style={styles.totalLine}>
            总推杆 <Text style={styles.totalEm}>{totals.puttSum}</Text>
          </Text>
          <Text style={styles.totalLine}>
            较标准杆{' '}
            <Text style={styles.totalEm}>
              {totals.vs === null ? '—' : formatVsPar(totals.vs)}（已录 {totals.scored} 洞）
            </Text>
          </Text>
        </View>

        <View style={styles.actionsRow}>
          <Pressable style={styles.ghostBtn} onPress={clearStrokes}>
            <Text style={styles.ghostBtnTxt}>清空杆数</Text>
          </Pressable>
        </View>
      </View>

      <Pressable style={styles.saveBtn} onPress={onSaveRound}>
        <Text style={styles.saveBtnTxt}>保存轮次</Text>
      </Pressable>
      {Platform.OS === 'web' ? (
        <Text style={styles.webHint}>Web 端可用 Tab 在输入框间切换；手机端用键盘「下一项」跳转。</Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: Platform.OS === 'web' ? 44 : 16, paddingBottom: 32 },
  backBtn: { marginBottom: 8, alignSelf: 'flex-start' },
  backTxt: { color: GREEN, fontWeight: '600' },
  title: { fontSize: 22, fontWeight: '700', color: TEXT_PRIMARY, marginBottom: 10 },
  compactCard: {
    backgroundColor: WHITE,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: BORDER,
    padding: 12,
    marginBottom: 10,
  },
  compactLabel: { fontSize: 11, color: TEXT_SECONDARY, marginBottom: 4, marginTop: 6 },
  compactInput: {
    borderWidth: 0.5,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: TEXT_PRIMARY,
    backgroundColor: WHITE,
  },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inlineInput: { flex: 1 },
  todayBtn: {
    borderWidth: 0.5,
    borderColor: GREEN,
    backgroundColor: LIGHT_GREEN,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  todayBtnText: { color: GREEN, fontSize: 12, fontWeight: '700' },
  nearbyBtnRow: { flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'center' },
  nearbyBtn: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: GREEN,
    backgroundColor: LIGHT_GREEN,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  nearbyBtnDisabled: { opacity: 0.6 },
  nearbyBtnTxt: { color: GREEN, fontSize: 13, fontWeight: '700' },
  nearbyBtnGhost: {
    borderWidth: 0.5,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: WHITE,
  },
  nearbyBtnGhostTxt: { fontSize: 12, color: TEXT_SECONDARY, fontWeight: '600' },
  nearbyHint: { fontSize: 11, color: TEXT_SECONDARY, marginTop: 6, lineHeight: 16 },
  nearbyErr: { fontSize: 12, color: RED, marginTop: 6 },
  nearbyScroll: { maxHeight: 200, marginTop: 8, borderWidth: 0.5, borderColor: BORDER, borderRadius: 10, backgroundColor: WHITE },
  nearbyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  nearbyRowText: { flex: 1, paddingRight: 10 },
  nearbyName: { fontSize: 14, fontWeight: '600', color: TEXT_PRIMARY },
  nearbyMeta: { fontSize: 11, color: TEXT_SECONDARY, marginTop: 2 },
  nearbyPick: { fontSize: 12, fontWeight: '700', color: GREEN },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    borderWidth: 0.5,
    borderColor: BORDER,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: WHITE,
  },
  chipOn: { borderColor: GREEN, backgroundColor: LIGHT_GREEN },
  chipTxt: { fontSize: 12, color: TEXT_SECONDARY },
  chipTxtOn: { color: GREEN, fontWeight: '700' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  helpMarkWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 0.5,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WHITE,
  },
  helpMarkTxt: { fontSize: 13, fontWeight: '700', color: TEXT_SECONDARY },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  presetChip: {
    borderWidth: 0.5,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: WHITE,
  },
  presetTxt: { fontSize: 12, color: TEXT_SECONDARY },
  hint: { fontSize: 11, color: TEXT_SECONDARY, marginTop: 6, lineHeight: 16 },
  tableCard: {
    backgroundColor: WHITE,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: BORDER,
    padding: 12,
    marginBottom: 12,
  },
  tableTitle: { fontSize: 15, fontWeight: '700', color: TEXT_PRIMARY, marginBottom: 8 },
  playerLabel: { fontSize: 11, color: TEXT_SECONDARY, marginBottom: 4 },
  playerInput: {
    borderWidth: 0.5,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    marginBottom: 10,
  },
  tableScroll: { paddingBottom: 4 },
  tableInner: { flexDirection: 'row', alignItems: 'flex-start' },
  labelCol: { width: 52, paddingRight: 4 },
  cornerCell: { height: 28, marginBottom: 4 },
  rowLabel: { fontSize: 11, color: TEXT_SECONDARY, height: 36, lineHeight: 36, marginBottom: 4 },
  headerText: { fontWeight: '700', color: TEXT_PRIMARY, textAlign: 'center' },
  holeCol: { width: 48, marginRight: 4 },
  holeNum: { fontSize: 12, height: 28, lineHeight: 28, marginBottom: 4, textAlign: 'center' },
  parCell: {
    height: 36,
    borderWidth: 0.5,
    borderColor: BORDER,
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 13,
    paddingVertical: 0,
    marginBottom: 4,
    color: TEXT_PRIMARY,
  },
  scoreCell: {
    height: 36,
    borderWidth: 0.5,
    borderColor: BORDER,
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 0,
    marginBottom: 4,
    color: TEXT_PRIMARY,
  },
  scoreCellError: { borderColor: RED, borderWidth: 1 },
  totalsRow: { marginTop: 10, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: BORDER, gap: 6 },
  totalLine: { fontSize: 13, color: TEXT_SECONDARY },
  totalEm: { color: TEXT_PRIMARY, fontWeight: '700' },
  actionsRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 },
  ghostBtn: {
    borderWidth: 0.5,
    borderColor: GREEN,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: LIGHT_GREEN,
  },
  ghostBtnTxt: { color: GREEN, fontSize: 13, fontWeight: '700' },
  saveBtn: {
    backgroundColor: GREEN,
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 13,
    marginTop: 4,
  },
  saveBtnTxt: { color: WHITE, fontSize: 16, fontWeight: '700' },
  webHint: { fontSize: 11, color: TEXT_SECONDARY, marginTop: 8, lineHeight: 16 },
});
