import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  buildInitialHoleDetails,
  buildParArray,
  calcAdjustedGrossFromHoles,
  calcDifferential,
  calcGIR,
  calcStats,
  loadHandicapRecords,
  makeHandicapRecordId,
  saveHandicapRecords,
  type HandicapRecord,
  type HoleDetail,
} from '@/lib/handicap';

const GREEN = '#166534';
const BG = '#f3f4f6';
const WHITE = '#ffffff';
const BORDER = '#e5e7eb';
const TEXT_PRIMARY = '#111827';
const TEXT_SECONDARY = '#6b7280';
const RED = '#dc2626';
const LIGHT_GREEN = '#dcfce7';

type HelpType = 'course' | 'slope' | null;
type Step = 1 | 2 | 3;
type ParPreset = '72' | '71' | '70' | 'custom';

/** 附近球场 API 返回项 */
type NearbyCourse = { name: string; address: string; distance: number };

/**
 * 请求 /api/nearby-courses（部署在同源的 Vercel 等）。
 * 原生端请配置 EXPO_PUBLIC_NEARBY_COURSES_API_URL，例如：https://你的域名/api/nearby-courses
 */
function buildNearbyCoursesUrl(lat: number, lng: number): string {
  const q = `lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`;
  const base = process.env.EXPO_PUBLIC_NEARBY_COURSES_API_URL?.trim();
  if (base) {
    const b = base.replace(/\/$/, '');
    return b.includes('?') ? `${b}&${q}` : `${b}?${q}`;
  }
  if (Platform.OS === 'web') {
    const loc = typeof globalThis !== 'undefined' ? (globalThis as { location?: { origin?: string } }).location : undefined;
    if (loc?.origin) {
      return `${loc.origin}/api/nearby-courses?${q}`;
    }
  }
  return `/api/nearby-courses?${q}`;
}

function todayStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function relativeToParText(strokes: number, par: number) {
  const d = strokes - par;
  if (d <= -3) return '-3 信天翁🦅🦅';
  if (d === -2) return '-2 老鹰🦅';
  if (d === -1) return '-1 小鸟🐦';
  if (d === 0) return 'Par ⭕';
  if (d === 1) return '+1 博忌';
  if (d === 2) return '+2 双博忌';
  if (d === 3) return '+3 三柏忌';
  return '+4以上 ✗';
}

function cloneDetails(list: HoleDetail[]) {
  return list.map((h) => ({ ...h }));
}

export default function HandicapAddScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [date, setDate] = useState(todayStr());
  const [courseName, setCourseName] = useState('');
  const [courseRating, setCourseRating] = useState('');
  const [slopeRating, setSlopeRating] = useState('113');
  const [roundHoles, setRoundHoles] = useState<18 | 9>(18);
  const [parPreset, setParPreset] = useState<ParPreset>('72');
  const [helpType, setHelpType] = useState<HelpType>(null);
  const [error, setError] = useState('');

  const [nearbyOpen, setNearbyOpen] = useState(false);
  const [nearbyPhase, setNearbyPhase] = useState<'idle' | 'locating' | 'fetching'>('idle');
  const [nearbySlowHint, setNearbySlowHint] = useState(false);
  const [nearbyHint, setNearbyHint] = useState<string | null>(null);
  const [nearbyCourses, setNearbyCourses] = useState<NearbyCourse[]>([]);
  const nearbySlowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nearbyCancelledRef = useRef(false);

  const clearNearbySlowTimer = useCallback(() => {
    if (nearbySlowTimerRef.current) {
      clearTimeout(nearbySlowTimerRef.current);
      nearbySlowTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearNearbySlowTimer(), [clearNearbySlowTimer]);

  const nearbyBusy = nearbyPhase !== 'idle';

  const openNearbySearch = useCallback(async () => {
    nearbyCancelledRef.current = false;
    setNearbyOpen(true);
    setNearbyPhase('locating');
    setNearbyHint(null);
    setNearbyCourses([]);
    setNearbySlowHint(false);
    clearNearbySlowTimer();
    nearbySlowTimerRef.current = setTimeout(() => {
      if (!nearbyCancelledRef.current) setNearbySlowHint(true);
    }, 3000);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (nearbyCancelledRef.current) return;
      if (status !== 'granted') {
        clearNearbySlowTimer();
        setNearbySlowHint(false);
        setNearbyHint('请允许位置权限，或手动输入球场名');
        setNearbyPhase('idle');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (nearbyCancelledRef.current) return;
      setNearbyPhase('fetching');
      const url = buildNearbyCoursesUrl(pos.coords.latitude, pos.coords.longitude);
      const res = await fetch(url);
      if (nearbyCancelledRef.current) return;
      clearNearbySlowTimer();
      setNearbySlowHint(false);
      if (!res.ok) {
        setNearbyHint('搜索失败，请手动输入');
        setNearbyPhase('idle');
        return;
      }
      const data = (await res.json()) as { courses?: NearbyCourse[] };
      const list = Array.isArray(data.courses) ? data.courses : [];
      if (nearbyCancelledRef.current) return;
      if (list.length === 0) {
        setNearbyHint('附近10km内未找到球场，请手动输入');
      } else {
        setNearbyCourses(list);
      }
    } catch {
      if (nearbyCancelledRef.current) return;
      clearNearbySlowTimer();
      setNearbySlowHint(false);
      setNearbyHint('搜索失败，请手动输入');
    } finally {
      if (!nearbyCancelledRef.current) setNearbyPhase('idle');
    }
  }, [clearNearbySlowTimer]);

  const closeNearby = useCallback(() => {
    nearbyCancelledRef.current = true;
    clearNearbySlowTimer();
    setNearbySlowHint(false);
    setNearbyOpen(false);
    setNearbyHint(null);
    setNearbyCourses([]);
    setNearbyPhase('idle');
  }, [clearNearbySlowTimer]);

  const pickNearbyCourse = useCallback(
    (c: NearbyCourse) => {
      setCourseName(c.name);
      closeNearby();
    },
    [closeNearby],
  );

  const [details, setDetails] = useState<HoleDetail[]>([]);
  const [currentHoleIdx, setCurrentHoleIdx] = useState(0);
  const [showFront9Modal, setShowFront9Modal] = useState(false);
  const [notes, setNotes] = useState('');

  const totalHoles = details.length;
  const current = details[currentHoleIdx];

  const liveTotalStrokes = useMemo(() => details.reduce((s, h) => s + h.strokes, 0), [details]);

  const summaryStats = useMemo(() => {
    if (!details.length) return null;
    return calcStats(details, roundHoles);
  }, [details, roundHoles]);

  const adjustedGross = useMemo(() => (details.length ? calcAdjustedGrossFromHoles(details) : 0), [details]);

  const previewDiff = useMemo(() => {
    const cr = Number(courseRating);
    const sr = Number(slopeRating);
    if (!details.length || !Number.isFinite(cr) || !Number.isFinite(sr) || sr <= 0) return null;
    return calcDifferential(adjustedGross, cr, sr, roundHoles);
  }, [adjustedGross, courseRating, details.length, roundHoles, slopeRating]);

  const highlights = useMemo(() => {
    if (!details.length) return null;
    let bestIdx = 0;
    let worstIdx = 0;
    let minPuttIdx = 0;
    for (let i = 1; i < details.length; i += 1) {
      const rel = (h: HoleDetail) => h.strokes - h.par;
      if (rel(details[i]) < rel(details[bestIdx])) bestIdx = i;
      if (rel(details[i]) > rel(details[worstIdx])) worstIdx = i;
      if (details[i].putts < details[minPuttIdx].putts) minPuttIdx = i;
    }
    const best = details[bestIdx];
    const worst = details[worstIdx];
    const minP = details[minPuttIdx];
    const br = best.strokes - best.par;
    let bestText = '见明细';
    if (br <= -2) bestText = '老鹰或更好';
    else if (br === -1) bestText = '小鸟';
    else if (br === 0) bestText = 'Par';
    return {
      bestHole: best.holeNumber,
      bestText,
      worstHole: worst.holeNumber,
      worstOver: worst.strokes - worst.par,
      minPuttHole: minP.holeNumber,
      minPutts: minP.putts,
    };
  }, [details]);

  function startRound() {
    const cr = Number(courseRating);
    const sr = Number(slopeRating);
    if (!date.trim() || !courseName.trim()) {
      setError('请填写日期和球场名称');
      return;
    }
    if (!Number.isFinite(cr) || !Number.isFinite(sr) || sr <= 0) {
      setError('请填写有效的球场难度与坡度系数');
      return;
    }
    setError('');
    const pars = buildParArray(parPreset, roundHoles);
    setDetails(buildInitialHoleDetails(pars));
    setCurrentHoleIdx(0);
    setStep(2);
  }

  const updateCurrent = useCallback(
    (patch: Partial<HoleDetail>) => {
      setDetails((prev) => {
        const next = cloneDetails(prev);
        const h = { ...next[currentHoleIdx], ...patch };
        if (h.putts < 0) h.putts = 0;
        if (h.strokes < h.par) h.strokes = h.par;
        if (h.par === 3) h.fairwayHit = null;
        else if (h.fairwayHit === null || h.fairwayHit === undefined) h.fairwayHit = false;
        if (patch.strokes !== undefined || patch.putts !== undefined || patch.par !== undefined) {
          h.greenInRegulation = calcGIR(h.strokes, h.par, h.putts);
        }
        next[currentHoleIdx] = h;
        return next;
      });
    },
    [currentHoleIdx],
  );

  function goPrev() {
    if (currentHoleIdx > 0) setCurrentHoleIdx((i) => i - 1);
  }

  function goNext() {
    if (!totalHoles) return;
    if (currentHoleIdx < totalHoles - 1) {
      if (roundHoles === 18 && currentHoleIdx === 8) {
        setShowFront9Modal(true);
        return;
      }
      setCurrentHoleIdx((i) => i + 1);
    } else {
      setStep(3);
    }
  }

  function confirmFront9Continue() {
    setShowFront9Modal(false);
    setCurrentHoleIdx(9);
  }

  function onSaveRecord() {
    const cr = Number(courseRating);
    const sr = Number(slopeRating);
    if (!details.length || !Number.isFinite(cr) || !Number.isFinite(sr) || sr <= 0) return;

    const stats = calcStats(details, roundHoles);
    const adj = calcAdjustedGrossFromHoles(details);
    const record: HandicapRecord = {
      id: makeHandicapRecordId(),
      date: date.trim(),
      courseName: courseName.trim(),
      courseRating: cr,
      slopeRating: sr,
      adjustedGrossScore: adj,
      holes: roundHoles,
      scoreDifferential: calcDifferential(adj, cr, sr, roundHoles),
      notes: notes.trim(),
      holeDetails: cloneDetails(details),
      totalPutts: stats.totalPutts,
      fairwaysHit: stats.fairwaysHit,
      fairwaysTotal: stats.fairwaysTotal,
      greensInRegulation: stats.greensInRegulation,
      front9Strokes: stats.front9Strokes,
      back9Strokes: stats.back9Strokes,
    };

    const records = loadHandicapRecords();
    saveHandicapRecords([record, ...records]);
    router.replace('/handicap');
  }

  const front9ModalStats = useMemo(() => {
    if (!details.length) return null;
    const front = details.filter((h) => h.holeNumber <= 9);
    const strokes = front.reduce((s, h) => s + h.strokes, 0);
    const par = front.reduce((s, h) => s + h.par, 0);
    return { strokes, toPar: strokes - par };
  }, [details]);

  return (
    <View style={styles.container}>
      {step === 1 ? (
        <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} bounces={false}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backTxt}>← 返回</Text>
          </Pressable>
          <Text style={styles.title}>球场信息</Text>

          <View style={styles.card}>
            <Text style={styles.label}>日期</Text>
            <View style={styles.inline}>
              <TextInput value={date} onChangeText={setDate} style={[styles.input, styles.inlineInput]} placeholder="YYYY-MM-DD" />
              <Pressable style={styles.todayBtn} onPress={() => setDate(todayStr())}>
                <Text style={styles.todayBtnText}>今天</Text>
              </Pressable>
            </View>

            <View style={styles.labelRowBetween}>
              <Text style={styles.labelSide}>球场名称</Text>
              <Pressable
                style={[styles.nearbyBtn, nearbyBusy && styles.nearbyBtnDisabled]}
                onPress={openNearbySearch}
                disabled={nearbyBusy}
              >
                <Text style={styles.nearbyBtnText}>{nearbyBusy ? '定位中…' : '📍 附近'}</Text>
              </Pressable>
            </View>
            <TextInput value={courseName} onChangeText={setCourseName} style={styles.input} placeholder="例如 XX 高尔夫球场" />

            <Text style={styles.label}>洞数</Text>
            <View style={styles.chipRow}>
              <Pressable style={[styles.chip, roundHoles === 18 && styles.chipOn]} onPress={() => setRoundHoles(18)}>
                <Text style={[styles.chipTxt, roundHoles === 18 && styles.chipTxtOn]}>18洞</Text>
              </Pressable>
              <Pressable style={[styles.chip, roundHoles === 9 && styles.chipOn]} onPress={() => setRoundHoles(9)}>
                <Text style={[styles.chipTxt, roundHoles === 9 && styles.chipTxtOn]}>9洞</Text>
              </Pressable>
            </View>

            <View style={styles.labelRow}>
              <Text style={styles.label}>球场难度系数</Text>
              <Pressable onPress={() => setHelpType('course')}>
                <Text style={styles.help}>❓</Text>
              </Pressable>
            </View>
            <TextInput value={courseRating} onChangeText={setCourseRating} style={styles.input} placeholder="例如 72.4" keyboardType="decimal-pad" />

            <View style={styles.labelRow}>
              <Text style={styles.label}>坡度系数（默认113）</Text>
              <Pressable onPress={() => setHelpType('slope')}>
                <Text style={styles.help}>❓</Text>
              </Pressable>
            </View>
            <TextInput value={slopeRating} onChangeText={setSlopeRating} style={styles.input} placeholder="113" keyboardType="number-pad" />

            <Text style={styles.label}>标准杆预设</Text>
            <View style={styles.presetGrid}>
              {(['72', '71', '70', 'custom'] as ParPreset[]).map((p) => (
                <Pressable key={p} style={[styles.presetChip, parPreset === p && styles.chipOn]} onPress={() => setParPreset(p)}>
                  <Text style={[styles.presetTxt, parPreset === p && styles.chipTxtOn]}>
                    {p === 'custom' ? '自定义' : `Par${p}`}
                  </Text>
                </Pressable>
              ))}
            </View>
            {parPreset === 'custom' ? (
              <Text style={styles.hint}>自定义为18洞均为Par4，可在下一步逐洞调整标准杆。</Text>
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>

          <Pressable style={styles.primaryBtn} onPress={startRound}>
            <Text style={styles.primaryBtnText}>开始记录 →</Text>
          </Pressable>
        </ScrollView>
      ) : null}

      {step === 2 && current ? (
        <View style={styles.flex}>
          <View style={styles.step2Header}>
            <Pressable onPress={() => setStep(1)} style={styles.backBtnSmall}>
              <Text style={styles.backTxt}>←</Text>
            </Pressable>
            <View style={styles.step2HeaderMid}>
              <Text style={styles.step2Sub}>
                第 {current.holeNumber} 洞 / 共 {totalHoles} 洞
              </Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${((currentHoleIdx + 1) / totalHoles) * 100}%` }]} />
              </View>
            </View>
            <Text style={styles.liveTotal}>{liveTotalStrokes}杆</Text>
          </View>

          <ScrollView style={styles.flex} contentContainerStyle={styles.step2Scroll} showsVerticalScrollIndicator={false} bounces={false}>
            <View style={styles.holeCard}>
              <View style={styles.holeCardTop}>
                <Text style={styles.holeTitle}>第 {current.holeNumber} 洞</Text>
                <Text style={styles.holeMeta}>
                  Par {current.par}
                  {typeof current.distanceM === 'number' && current.distanceM > 0 ? `    距离 ${current.distanceM}m` : '    距离 —'}
                </Text>
              </View>
              <View style={styles.distRow}>
                <Text style={styles.miniLabel}>洞距离（米，选填）</Text>
                <TextInput
                  value={current.distanceM ? String(current.distanceM) : ''}
                  onChangeText={(t) => {
                    const n = Number(t);
                    updateCurrent({ distanceM: t.trim() && Number.isFinite(n) && n > 0 ? n : null });
                  }}
                  style={styles.distInput}
                  placeholder="—"
                  keyboardType="number-pad"
                />
              </View>
              <View style={styles.parEditRow}>
                <Text style={styles.miniLabel}>本洞标准杆</Text>
                <View style={styles.stepper}>
                  <Pressable style={styles.stepperBtn} onPress={() => updateCurrent({ par: Math.max(3, current.par - 1) })}>
                    <Text style={styles.stepperBtnTxt}>−</Text>
                  </Pressable>
                  <Text style={styles.stepperVal}>{current.par}</Text>
                  <Pressable style={styles.stepperBtn} onPress={() => updateCurrent({ par: Math.min(6, current.par + 1) })}>
                    <Text style={styles.stepperBtnTxt}>＋</Text>
                  </Pressable>
                </View>
              </View>

              <Text style={styles.sectionLabel}>杆数</Text>
              <View style={styles.bigStepper}>
                <Pressable style={styles.bigStepperBtn} onPress={() => updateCurrent({ strokes: Math.max(1, current.strokes - 1) })}>
                  <Text style={styles.bigStepperBtnTxt}>➖</Text>
                </Pressable>
                <Text style={styles.bigStepperVal}>{current.strokes}</Text>
                <Pressable style={styles.bigStepperBtn} onPress={() => updateCurrent({ strokes: current.strokes + 1 })}>
                  <Text style={styles.bigStepperBtnTxt}>➕</Text>
                </Pressable>
              </View>
              <Text style={styles.relPar}>{relativeToParText(current.strokes, current.par)}</Text>

              <Text style={styles.sectionLabel}>推杆</Text>
              <View style={styles.rowStepper}>
                <Pressable style={styles.stepperBtn} onPress={() => updateCurrent({ putts: Math.max(0, current.putts - 1) })}>
                  <Text style={styles.stepperBtnTxt}>➖</Text>
                </Pressable>
                <Text style={styles.stepperValWide}>{current.putts}</Text>
                <Pressable style={styles.stepperBtn} onPress={() => updateCurrent({ putts: current.putts + 1 })}>
                  <Text style={styles.stepperBtnTxt}>➕</Text>
                </Pressable>
              </View>

              {current.par !== 3 ? (
                <>
                  <Text style={styles.sectionLabel}>球道</Text>
                  <View style={styles.twoBtnRow}>
                    <Pressable
                      style={[styles.choiceBtn, current.fairwayHit === true && styles.choiceBtnOn]}
                      onPress={() => updateCurrent({ fairwayHit: true })}
                    >
                      <Text style={[styles.choiceBtnTxt, current.fairwayHit === true && styles.choiceBtnTxtOn]}>✓ 上球道</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.choiceBtn, current.fairwayHit === false && styles.choiceBtnOn]}
                      onPress={() => updateCurrent({ fairwayHit: false })}
                    >
                      <Text style={[styles.choiceBtnTxt, current.fairwayHit === false && styles.choiceBtnTxtOn]}>✗ 未上球道</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <Text style={styles.par3Note}>Par3 洞不统计球道。</Text>
              )}

              <Text style={styles.sectionLabel}>果岭</Text>
              <View style={styles.twoBtnRow}>
                <Pressable
                  style={[styles.choiceBtn, current.greenInRegulation && styles.choiceBtnOn]}
                  onPress={() => updateCurrent({ greenInRegulation: true })}
                >
                  <Text style={[styles.choiceBtnTxt, current.greenInRegulation && styles.choiceBtnTxtOn]}>✓ 上果岭</Text>
                </Pressable>
                <Pressable
                  style={[styles.choiceBtn, !current.greenInRegulation && styles.choiceBtnOn]}
                  onPress={() => updateCurrent({ greenInRegulation: false })}
                >
                  <Text style={[styles.choiceBtnTxt, !current.greenInRegulation && styles.choiceBtnTxtOn]}>✗ 未上果岭</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>

          <View style={styles.bottomNav}>
            <Pressable style={[styles.navBtn, currentHoleIdx === 0 && styles.navBtnDisabled]} onPress={goPrev} disabled={currentHoleIdx === 0}>
              <Text style={styles.navBtnTxt}>← 上一洞</Text>
            </Pressable>
            <Text style={styles.navMid}>
              {currentHoleIdx + 1}/{totalHoles}
            </Text>
            {currentHoleIdx >= totalHoles - 1 ? (
              <Pressable style={styles.navBtnPrimary} onPress={() => setStep(3)}>
                <Text style={styles.navBtnPrimaryTxt}>查看汇总 →</Text>
              </Pressable>
            ) : (
              <Pressable style={styles.navBtnPrimary} onPress={goNext}>
                <Text style={styles.navBtnPrimaryTxt}>下一洞 →</Text>
              </Pressable>
            )}
          </View>
        </View>
      ) : null}

      {step === 3 && summaryStats ? (
        <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} bounces={false}>
          <Pressable onPress={() => setStep(2)} style={styles.backBtn}>
            <Text style={styles.backTxt}>← 返回逐洞</Text>
          </Pressable>
          <Text style={styles.title}>汇总确认</Text>

          <View style={styles.card}>
            <Text style={styles.tableTitle}>成绩汇总</Text>
            <View style={styles.tableHead}>
              <Text style={[styles.th, styles.thNarrow]} />
              <Text style={styles.th}>前9</Text>
              <Text style={styles.th}>{roundHoles === 18 ? '后9' : '—'}</Text>
              <Text style={styles.th}>合计</Text>
            </View>
            <View style={styles.tr}>
              <Text style={styles.tdLabel}>总杆</Text>
              <Text style={styles.td}>{summaryStats.front9Strokes}</Text>
              <Text style={styles.td}>{roundHoles === 18 ? summaryStats.back9Strokes : '—'}</Text>
              <Text style={styles.td}>{summaryStats.totalStrokes}</Text>
            </View>
            <View style={styles.tr}>
              <Text style={styles.tdLabel}>对标准杆</Text>
              <Text style={styles.td}>{summaryStats.toParFront >= 0 ? `+${summaryStats.toParFront}` : summaryStats.toParFront}</Text>
              <Text style={styles.td}>
                {roundHoles === 18 ? (summaryStats.toParBack >= 0 ? `+${summaryStats.toParBack}` : summaryStats.toParBack) : '—'}
              </Text>
              <Text style={styles.td}>{summaryStats.toParTotal >= 0 ? `+${summaryStats.toParTotal}` : summaryStats.toParTotal}</Text>
            </View>
            <View style={styles.tr}>
              <Text style={styles.tdLabel}>推杆</Text>
              <Text style={styles.td}>
                {details.filter((h) => h.holeNumber <= 9).reduce((s, h) => s + h.putts, 0)}
              </Text>
              <Text style={styles.td}>
                {roundHoles === 18 ? details.filter((h) => h.holeNumber > 9).reduce((s, h) => s + h.putts, 0) : '—'}
              </Text>
              <Text style={styles.td}>{summaryStats.totalPutts}</Text>
            </View>
            <View style={styles.tr}>
              <Text style={styles.tdLabel}>上球道</Text>
              <Text style={styles.td}>
                {(() => {
                  const f = details.filter((h) => h.holeNumber <= 9 && h.par !== 3);
                  const hit = f.filter((h) => h.fairwayHit).length;
                  const tot = f.length;
                  return `${hit}/${tot}`;
                })()}
              </Text>
              <Text style={styles.td}>
                {roundHoles === 18
                  ? (() => {
                      const f = details.filter((h) => h.holeNumber > 9 && h.par !== 3);
                      const hit = f.filter((h) => h.fairwayHit).length;
                      const tot = f.length;
                      return `${hit}/${tot}`;
                    })()
                  : '—'}
              </Text>
              <Text style={styles.td}>
                {summaryStats.fairwaysTotal > 0
                  ? `${summaryStats.fairwaysHit}/${summaryStats.fairwaysTotal} ${Math.round((summaryStats.fairwaysHit / summaryStats.fairwaysTotal) * 100)}%`
                  : '—'}
              </Text>
            </View>
            <View style={styles.tr}>
              <Text style={styles.tdLabel}>上果岭</Text>
              <Text style={styles.td}>
                {(() => {
                  const f = details.filter((h) => h.holeNumber <= 9);
                  const g = f.filter((h) => h.greenInRegulation).length;
                  return `${g}/${f.length}`;
                })()}
              </Text>
              <Text style={styles.td}>
                {roundHoles === 18
                  ? (() => {
                      const f = details.filter((h) => h.holeNumber > 9);
                      const g = f.filter((h) => h.greenInRegulation).length;
                      return `${g}/${f.length}`;
                    })()
                  : '—'}
              </Text>
              <Text style={styles.td}>
                {`${summaryStats.greensInRegulation}/${details.length} ${Math.round((summaryStats.greensInRegulation / details.length) * 100)}%`}
              </Text>
            </View>
            <View style={styles.tr}>
              <Text style={styles.tdLabel}>沙坑救球</Text>
              <Text style={styles.td}>—</Text>
              <Text style={styles.td}>—</Text>
              <Text style={styles.td}>—</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.tableTitle}>各洞明细</Text>
            <View style={styles.detailHead}>
              <Text style={styles.dh}>洞</Text>
              <Text style={styles.dh}>Par</Text>
              <Text style={styles.dh}>杆数</Text>
              <Text style={styles.dh}>推杆</Text>
              <Text style={styles.dh}>球道</Text>
              <Text style={styles.dh}>果岭</Text>
            </View>
            {details.map((h) => (
              <View key={h.holeNumber} style={styles.detailRow}>
                <Text style={styles.dd}>{h.holeNumber}</Text>
                <Text style={styles.dd}>{h.par}</Text>
                <Text style={styles.dd}>{h.strokes}</Text>
                <Text style={styles.dd}>{h.putts}</Text>
                <Text style={styles.dd}>{h.par === 3 ? '—' : h.fairwayHit ? '上' : '未'}</Text>
                <Text style={styles.dd}>{h.greenInRegulation ? '上' : '未'}</Text>
              </View>
            ))}
          </View>

          <View style={styles.diffCard}>
            <Text style={styles.diffLabel}>本场微差（按洞上限调整后的总杆计算）</Text>
            <Text style={styles.diffVal}>{typeof previewDiff === 'number' ? previewDiff.toFixed(1) : '--'}</Text>
          </View>

          {highlights ? (
            <View style={styles.card}>
              <Text style={styles.tableTitle}>本场亮点</Text>
              <Text style={styles.hlLine}>最佳洞：第{highlights.bestHole}洞（{highlights.bestText}）</Text>
              <Text style={styles.hlLine}>最差洞：第{highlights.worstHole}洞（+{highlights.worstOver}杆）</Text>
              <Text style={styles.hlLine}>推杆最少：第{highlights.minPuttHole}洞（{highlights.minPutts}推）</Text>
            </View>
          ) : null}

          <Text style={styles.label}>备注</Text>
          <TextInput value={notes} onChangeText={setNotes} style={styles.notesInput} placeholder="天气、果岭速度等" multiline textAlignVertical="top" />

          <Pressable style={styles.primaryBtn} onPress={onSaveRecord}>
            <Text style={styles.primaryBtnText}>保存成绩</Text>
          </Pressable>
        </ScrollView>
      ) : null}

      <Modal transparent visible={showFront9Modal} animationType="fade" onRequestClose={() => setShowFront9Modal(false)}>
        <View style={styles.modalMask}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>前9洞小计</Text>
            {front9ModalStats ? (
              <Text style={styles.modalDesc}>
                总杆 {front9ModalStats.strokes}，对标准杆 {front9ModalStats.toPar >= 0 ? '+' : ''}
                {front9ModalStats.toPar}
              </Text>
            ) : null}
            <Text style={styles.modalDesc}>继续记录后9洞？</Text>
            <Pressable style={styles.modalBtn} onPress={confirmFront9Continue}>
              <Text style={styles.modalBtnText}>继续后9洞</Text>
            </Pressable>
            <Pressable style={styles.modalGhost} onPress={() => setShowFront9Modal(false)}>
              <Text style={styles.modalGhostTxt}>取消</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={helpType !== null} animationType="fade" onRequestClose={() => setHelpType(null)}>
        <View style={styles.modalMask}>
          <View style={styles.modalCard}>
            {helpType === 'course' ? (
              <Text style={styles.modalDesc}>
                球场难度系数由高尔夫球场官方评定，通常印在记分卡上，代表零差点球手的预期成绩
              </Text>
            ) : null}
            {helpType === 'slope' ? (
              <Text style={styles.modalDesc}>
                坡度系数反映球场对差点球手的难度，标准值为113，数值越高越难，也在记分卡上
              </Text>
            ) : null}
            <Pressable style={styles.modalBtn} onPress={() => setHelpType(null)}>
              <Text style={styles.modalBtnText}>知道了</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={nearbyOpen} animationType="fade" onRequestClose={closeNearby}>
        <View style={styles.modalMask}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={closeNearby} accessibilityLabel="关闭" />
          <View style={styles.nearbySheet}>
            <Text style={styles.nearbySheetTitle}>附近球场</Text>
            {nearbyPhase === 'locating' ? (
              <View style={styles.nearbyStatusRow}>
                <ActivityIndicator color={GREEN} />
                <Text style={styles.nearbyStatusText}>定位中…</Text>
              </View>
            ) : null}
            {nearbyPhase === 'fetching' ? (
              <View style={styles.nearbyStatusRow}>
                <ActivityIndicator color={GREEN} />
                <Text style={styles.nearbyStatusText}>搜索中…</Text>
              </View>
            ) : null}
            {nearbySlowHint && (nearbyPhase === 'locating' || nearbyPhase === 'fetching') ? (
              <Text style={styles.nearbySlowText}>搜索中，OSM数据可能较慢…</Text>
            ) : null}
            {nearbyHint ? <Text style={styles.nearbyHintText}>{nearbyHint}</Text> : null}
            <ScrollView style={styles.nearbyList} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {nearbyCourses.map((c, idx) => (
                <Pressable
                  key={`${c.name}-${idx}`}
                  style={styles.nearbyRow}
                  onPress={() => pickNearbyCourse(c)}
                >
                  <Text style={styles.nearbyName} numberOfLines={2}>
                    {c.name}
                  </Text>
                  <Text style={styles.nearbySub} numberOfLines={2}>
                    {(c.address || '—') + ' · ' + c.distance + 'km'}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={styles.modalGhost} onPress={closeNearby}>
              <Text style={styles.modalGhostTxt}>关闭</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: Platform.OS === 'web' ? 44 : 16, paddingBottom: 32 },
  backBtn: { marginBottom: 8, alignSelf: 'flex-start' },
  backBtnSmall: { padding: 4, marginRight: 4 },
  backTxt: { color: GREEN, fontWeight: '600' },
  title: { fontSize: 22, fontWeight: '700', color: TEXT_PRIMARY, marginBottom: 10 },
  card: { backgroundColor: WHITE, borderRadius: 14, borderWidth: 0.5, borderColor: BORDER, padding: 14, marginBottom: 10 },
  label: { fontSize: 12, color: TEXT_SECONDARY, marginBottom: 6, marginTop: 6 },
  labelRowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    marginTop: 6,
  },
  labelSide: { fontSize: 12, color: TEXT_SECONDARY },
  nearbyBtn: {
    borderWidth: 0.5,
    borderColor: GREEN,
    backgroundColor: LIGHT_GREEN,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  nearbyBtnDisabled: { opacity: 0.65 },
  nearbyBtnText: { color: GREEN, fontSize: 13, fontWeight: '700' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  help: { color: TEXT_SECONDARY, fontSize: 12 },
  hint: { fontSize: 12, color: TEXT_SECONDARY, marginTop: 4, lineHeight: 18 },
  input: {
    borderWidth: 0.5,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: WHITE,
    fontSize: 14,
    color: TEXT_PRIMARY,
  },
  notesInput: {
    borderWidth: 0.5,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 72,
    backgroundColor: WHITE,
    fontSize: 14,
    color: TEXT_PRIMARY,
    marginBottom: 12,
  },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inlineInput: { flex: 1 },
  todayBtn: {
    borderWidth: 0.5,
    borderColor: GREEN,
    backgroundColor: LIGHT_GREEN,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  todayBtnText: { color: GREEN, fontSize: 13, fontWeight: '700' },
  chipRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  chip: {
    borderWidth: 0.5,
    borderColor: BORDER,
    borderRadius: 999,
    backgroundColor: WHITE,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipOn: { borderColor: GREEN, backgroundColor: LIGHT_GREEN },
  chipTxt: { fontSize: 13, color: TEXT_SECONDARY },
  chipTxtOn: { color: GREEN, fontWeight: '700' },
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  presetChip: {
    borderWidth: 0.5,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: WHITE,
  },
  presetTxt: { fontSize: 13, color: TEXT_SECONDARY },
  error: { marginTop: 8, fontSize: 12, color: RED },
  primaryBtn: {
    backgroundColor: GREEN,
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 13,
    marginTop: 4,
  },
  primaryBtnText: { color: WHITE, fontSize: 16, fontWeight: '700' },
  step2Header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'web' ? 44 : 12,
    paddingBottom: 8,
    backgroundColor: WHITE,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
  },
  step2HeaderMid: { flex: 1, marginHorizontal: 8 },
  step2Sub: { fontSize: 12, color: TEXT_SECONDARY, marginBottom: 4 },
  progressTrack: { height: 6, backgroundColor: '#e5e7eb', borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: GREEN, borderRadius: 999 },
  liveTotal: { fontSize: 14, color: GREEN, fontWeight: '800' },
  step2Scroll: { padding: 16, paddingBottom: 100 },
  holeCard: {
    backgroundColor: WHITE,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: BORDER,
    padding: 14,
  },
  holeCardTop: { marginBottom: 10 },
  holeTitle: { fontSize: 18, fontWeight: '700', color: TEXT_PRIMARY },
  holeMeta: { fontSize: 13, color: TEXT_SECONDARY, marginTop: 4 },
  distRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  miniLabel: { fontSize: 12, color: TEXT_SECONDARY },
  distInput: {
    width: 88,
    borderWidth: 0.5,
    borderColor: BORDER,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    textAlign: 'right',
    fontSize: 14,
  },
  parEditRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionLabel: { fontSize: 13, color: TEXT_PRIMARY, fontWeight: '700', marginTop: 10, marginBottom: 8 },
  bigStepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 6 },
  bigStepperBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WHITE,
  },
  bigStepperBtnTxt: { fontSize: 22, color: GREEN },
  bigStepperVal: { fontSize: 36, fontWeight: '800', color: TEXT_PRIMARY, minWidth: 56, textAlign: 'center' },
  relPar: { textAlign: 'center', fontSize: 14, color: TEXT_SECONDARY, marginBottom: 4 },
  rowStepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepperBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WHITE,
  },
  stepperBtnTxt: { fontSize: 18, color: GREEN, fontWeight: '700' },
  stepperVal: { fontSize: 18, fontWeight: '700', color: TEXT_PRIMARY, minWidth: 28, textAlign: 'center' },
  stepperValWide: { fontSize: 20, fontWeight: '800', color: TEXT_PRIMARY, minWidth: 36, textAlign: 'center' },
  twoBtnRow: { flexDirection: 'row', gap: 10 },
  choiceBtn: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: BORDER,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: WHITE,
  },
  choiceBtnOn: { borderColor: GREEN, backgroundColor: LIGHT_GREEN },
  choiceBtnTxt: { fontSize: 13, color: TEXT_SECONDARY, fontWeight: '600' },
  choiceBtnTxtOn: { color: GREEN },
  par3Note: { fontSize: 12, color: TEXT_SECONDARY, marginTop: 4, marginBottom: 4 },
  bottomNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: WHITE,
    borderTopWidth: 0.5,
    borderTopColor: BORDER,
    gap: 8,
  },
  navBtn: { paddingVertical: 8, paddingHorizontal: 6 },
  navBtnDisabled: { opacity: 0.35 },
  navBtnTxt: { fontSize: 13, color: GREEN, fontWeight: '600' },
  navMid: { fontSize: 13, color: TEXT_SECONDARY, fontWeight: '700' },
  navBtnPrimary: {
    backgroundColor: GREEN,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  navBtnPrimaryTxt: { color: WHITE, fontSize: 13, fontWeight: '700' },
  tableTitle: { fontSize: 15, fontWeight: '700', color: TEXT_PRIMARY, marginBottom: 10 },
  tableHead: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: BORDER, paddingBottom: 6 },
  th: { flex: 1, fontSize: 11, color: TEXT_SECONDARY, textAlign: 'center' },
  thNarrow: { flex: 0.7 },
  tr: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: BG },
  tdLabel: { flex: 0.7, fontSize: 12, color: TEXT_SECONDARY },
  td: { flex: 1, fontSize: 12, color: TEXT_PRIMARY, fontWeight: '600', textAlign: 'center' },
  detailHead: { flexDirection: 'row', paddingBottom: 6, borderBottomWidth: 0.5, borderBottomColor: BORDER },
  dh: { flex: 1, fontSize: 10, color: TEXT_SECONDARY, textAlign: 'center' },
  detailRow: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: BG },
  dd: { flex: 1, fontSize: 11, color: TEXT_PRIMARY, textAlign: 'center' },
  diffCard: {
    backgroundColor: LIGHT_GREEN,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: GREEN,
    padding: 14,
    marginBottom: 10,
  },
  diffLabel: { fontSize: 12, color: TEXT_SECONDARY, marginBottom: 6 },
  diffVal: { fontSize: 32, color: GREEN, fontWeight: '800' },
  hlLine: { fontSize: 13, color: TEXT_PRIMARY, marginBottom: 6, lineHeight: 20 },
  modalMask: {
    flex: 1,
    backgroundColor: 'rgba(17,24,39,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: WHITE,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: BORDER,
    padding: 14,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: TEXT_PRIMARY, marginBottom: 8 },
  modalDesc: { fontSize: 13, color: TEXT_SECONDARY, lineHeight: 20, marginBottom: 8 },
  modalBtn: {
    backgroundColor: GREEN,
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 6,
  },
  modalBtnText: { color: WHITE, fontSize: 14, fontWeight: '700' },
  modalGhost: { alignItems: 'center', paddingVertical: 10, marginTop: 4 },
  modalGhostTxt: { color: TEXT_SECONDARY, fontSize: 13 },
  nearbySheet: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '72%',
    backgroundColor: WHITE,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: BORDER,
    padding: 14,
    zIndex: 1,
  },
  nearbySheetTitle: { fontSize: 17, fontWeight: '700', color: TEXT_PRIMARY, marginBottom: 10 },
  nearbyStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  nearbyStatusText: { fontSize: 14, color: TEXT_SECONDARY },
  nearbySlowText: { fontSize: 12, color: TEXT_SECONDARY, marginBottom: 8, lineHeight: 18 },
  nearbyHintText: { fontSize: 13, color: TEXT_SECONDARY, marginBottom: 8, lineHeight: 20 },
  nearbyList: { maxHeight: 320, marginTop: 4 },
  nearbyRow: {
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: BG,
  },
  nearbyName: { fontSize: 16, fontWeight: '700', color: TEXT_PRIMARY },
  nearbySub: { fontSize: 12, color: TEXT_SECONDARY, marginTop: 4, lineHeight: 18 },
});
