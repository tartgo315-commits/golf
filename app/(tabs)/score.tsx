import { type Href, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import type { HandicapRecord } from '@/lib/handicap';
import { loadHandicapRecords } from '@/lib/handicap';
import type { MyClubItem } from '@/lib/my-club-bag';
import { loadMyClubBag } from '@/lib/my-club-bag';
import { TAB_BAR_SCROLL_EXTRA } from '@/constants/theme';

const BASE_URL = 'https://golf-psi-silk.vercel.app';

const BG = '#0d1f10';
const WHITE = '#ffffff';
const CARD = 'rgba(255,255,255,0.05)';
const CARD_BORDER = 'rgba(255,255,255,0.08)';
const ACCENT = '#a3e635';
const ACCENT_TEXT = '#0d1f10';
const TEXT_MUTED = 'rgba(255,255,255,0.65)';

type NearbyCourse = { name: string; address: string; distance: number };
type Opponent = { name: string; hcp: string };

function parseNearbyCoursesPayload(raw: unknown): NearbyCourse[] {
  if (!raw || typeof raw !== 'object') return [];
  const courses = (raw as { courses?: unknown }).courses;
  if (!Array.isArray(courses)) return [];
  const out: NearbyCourse[] = [];
  for (let i = 0; i < courses.length; i++) {
    const item = courses[i];
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const nameRaw = typeof o.name === 'string' ? o.name : String(o.name ?? '');
    const name = nameRaw.trim();
    const address = typeof o.address === 'string' ? o.address : '';
    const dRaw = o.distance;
    let distance = 0;
    if (typeof dRaw === 'number' && Number.isFinite(dRaw)) {
      distance = dRaw;
    } else if (typeof dRaw === 'string') {
      const p = parseFloat(dRaw);
      distance = Number.isFinite(p) ? p : 0;
    }
    if (!name) continue;
    out.push({ name, address, distance });
  }
  return out;
}

function formatCourseKm(distance: number): string {
  if (!Number.isFinite(distance) || distance < 0) return '—';
  return `${distance.toFixed(1)}km`;
}

type AiStep =
  | 'hub'
  | 'locating'
  | 'pick_course'
  | 'manual_course'
  | 'q_tee'
  | 'q_weather'
  | 'q_opponents'
  | 'q_clubs'
  | 'ready'
  | 'loading'
  | 'result';

const TEE_OPTIONS = [
  { id: 'early', label: '早场（6-9点）' },
  { id: 'morning', label: '上午（9-12点）' },
  { id: 'afternoon', label: '下午（12-15点）' },
  { id: 'evening', label: '傍晚（15点后）' },
] as const;

const WEATHER_OPTIONS = [
  { id: 'sun', label: '☀️晴天' },
  { id: 'cloud', label: '⛅多云' },
  { id: 'wind', label: '💨有风' },
  { id: 'rain', label: '🌧️有雨' },
] as const;

function getLatLng(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 18000, maximumAge: 60000 },
      );
      return;
    }
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          resolve(null);
          return;
        }
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        resolve({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      } catch {
        resolve(null);
      }
    })();
  });
}

function statsFromRecords(records: HandicapRecord[]) {
  const slice = records.slice(0, 5);
  const n = slice.length;
  if (!n) {
    return {
      n: 0,
      avgScore: null as number | null,
      avgPutts: null as number | null,
      avgGir: null as number | null,
      avgFairway: null as number | null,
    };
  }
  const avgScore = Math.round(
    slice.reduce((s, r) => s + r.adjustedGrossScore, 0) / n,
  );
  const putts18 = slice.filter((r) => r.holes === 18);
  const avgPutts =
    putts18.length > 0
      ? Math.round(
          putts18.reduce((s, r) => s + r.totalPutts, 0) / putts18.length,
        )
      : Math.round(slice.reduce((s, r) => s + r.totalPutts, 0) / n);
  const girRows = slice.filter((r) => r.holes > 0);
  const avgGir =
    girRows.length > 0
      ? Math.round(
          girRows.reduce(
            (s, r) => s + (r.greensInRegulation / (r.holes as number)) * 100,
            0,
          ) / girRows.length,
        )
      : null;
  const fwRows = slice.filter((r) => r.fairwaysTotal > 0);
  const avgFairway =
    fwRows.length > 0
      ? Math.round(
          fwRows.reduce(
            (s, r) => s + (r.fairwaysHit / r.fairwaysTotal) * 100,
            0,
          ) / fwRows.length,
        )
      : null;
  return { n, avgScore, avgPutts, avgGir, avgFairway };
}

export default function ScoreScreen() {
  const router = useRouter();

  const [aiStep, setAiStep] = useState<AiStep>('hub');
  const [courses, setCourses] = useState<NearbyCourse[]>([]);
  const [courseLoading, setCourseLoading] = useState(false);
  const [courseFetchFailed, setCourseFetchFailed] = useState(false);
  const [canBackToCoursePick, setCanBackToCoursePick] = useState(false);
  const [manualCourse, setManualCourse] = useState('');
  const [selectedCourseName, setSelectedCourseName] = useState('');
  const [teeTime, setTeeTime] = useState<string | null>(null);
  const [weather, setWeather] = useState<string | null>(null);
  const [opponents, setOpponents] = useState<Opponent[]>([{ name: '', hcp: '' }]);
  const [bag, setBag] = useState<MyClubItem[]>([]);
  const [selectedClubIds, setSelectedClubIds] = useState<Set<string>>(new Set());
  const [aiResult, setAiResult] = useState('');
  const [loadHint, setLoadHint] = useState('AI分析中…');

  const refreshBag = useCallback(() => {
    setBag(loadMyClubBag());
  }, []);

  const startAiFlow = useCallback(async () => {
    setAiStep('locating');
    setCourses([]);
    setManualCourse('');
    setSelectedCourseName('');
    setTeeTime(null);
    setWeather(null);
    setOpponents([{ name: '', hcp: '' }]);
    setSelectedClubIds(new Set());
    setAiResult('');
    refreshBag();

    const pos = await getLatLng();
    if (!pos) {
      setCanBackToCoursePick(false);
      setCourseFetchFailed(false);
      setAiStep('manual_course');
      return;
    }
    setCanBackToCoursePick(true);
    setCourseFetchFailed(false);
    setCourseLoading(true);
    setAiStep('pick_course');
    try {
      const url = `${BASE_URL}/api/nearby-courses?lat=${pos.lat}&lng=${pos.lng}`;
      const res = await fetch(url);
      let list: NearbyCourse[] = [];
      try {
        const data: unknown = await res.json();
        list = parseNearbyCoursesPayload(data);
        if (!res.ok) {
          list = [];
          setCourseFetchFailed(true);
        }
      } catch {
        list = [];
        setCourseFetchFailed(true);
      }
      setCourses(list);
    } catch {
      setCourses([]);
      setCourseFetchFailed(true);
    } finally {
      setCourseLoading(false);
    }
  }, [refreshBag]);

  const pickCourse = (name: string) => {
    setSelectedCourseName(name);
    setAiStep('q_tee');
  };

  const confirmManualCourse = () => {
    const n = manualCourse.trim();
    if (!n) return;
    setSelectedCourseName(n);
    setAiStep('q_tee');
  };

  const toggleClub = (id: string) => {
    setSelectedClubIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (bag.length > 14 && next.size >= 14) return prev;
      else next.add(id);
      return next;
    });
  };

  const goClubsStep = () => {
    const b = loadMyClubBag();
    setBag(b);
    setAiStep('q_clubs');
    if (b.length <= 14) {
      setSelectedClubIds(new Set(b.map((c) => c.id)));
    } else {
      setSelectedClubIds(new Set());
    }
  };

  const clubSelectionValid =
    bag.length <= 14 ? selectedClubIds.size > 0 : selectedClubIds.size === 14;

  const buildPrompt = useMemo(() => {
    return () => {
      const records = loadHandicapRecords();
      const st = statsFromRecords(records);
      const clubNames = bag
        .filter((c) => selectedClubIds.has(c.id))
        .map((c) => c.name)
        .join('、');
      const oppStr =
        opponents
          .filter((o) => o.name.trim())
          .map((o) => `${o.name.trim()}（差点 ${o.hcp.trim() || '—'}）`)
          .join('；') || '无';
      const avgScoreStr = st.avgScore != null ? `${st.avgScore}杆` : '暂无';
      const avgPuttsStr = st.avgPutts != null ? `${st.avgPutts}次` : '暂无';
      const avgGirStr = st.avgGir != null ? `${st.avgGir}%` : '暂无';
      const avgFwStr = st.avgFairway != null ? `${st.avgFairway}%` : '暂无';
      return `请根据以下信息，给出今天这场高尔夫比赛的战术建议：

【球员近期数据】
- 最近${st.n}场平均总杆：${avgScoreStr}
- 平均推杆：${avgPuttsStr}
- 平均果岭命中率(GIR)：${avgGirStr}
- 平均球道命中率：${avgFwStr}

【今日赛事信息】
- 球场：${selectedCourseName}
- 开球时间：${teeTime ?? ''}
- 天气：${weather ?? ''}
- 对手：${oppStr}（各自差点）

【今日上场14支球杆】
${clubNames || '（未选择）'}

请从以下几个角度给出具体建议：
1. 针对我的弱项（GIR/推杆/球道）的重点提示
2. 针对对手差点的让杆策略和比赛心态
3. 根据天气和开球时间的注意事项
4. 今日球杆配置的使用建议（哪几支是关键杆）

回答用中文，分点列出，简洁实用，不超过400字。`;
    };
  }, [
    bag,
    opponents,
    selectedClubIds,
    selectedCourseName,
    teeTime,
    weather,
  ]);

  const runAi = useCallback(async () => {
    setAiStep('loading');
    setLoadHint('AI分析中…');
    const hintTimer = setInterval(() => {
      setLoadHint((h) => (h.endsWith('…') ? 'AI分析中' : `${h}…`));
    }, 450);
    try {
      const system =
        '你是一位专业的高尔夫球战术顾问，擅长根据球员数据、球场与天气给出简洁可执行的赛前建议。';
      const res = await fetch(`${BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system,
          messages: [{ role: 'user', content: buildPrompt() }],
        }),
      });
      const data = (await res.json()) as {
        content?: { type?: string; text?: string }[];
        error?: string;
      };
      let text = '';
      if (Array.isArray(data.content) && data.content[0]?.text) {
        text = String(data.content[0].text);
      } else if (typeof (data as { message?: string }).message === 'string') {
        text = (data as { message: string }).message;
      } else {
        text = data.error || '暂时无法生成分析，请稍后再试。';
      }
      setAiResult(text);
      setAiStep('result');
    } catch {
      setAiResult('网络异常，请检查连接后重试。');
      setAiStep('result');
    } finally {
      clearInterval(hintTimer);
    }
  }, [buildPrompt]);

  const resetAi = () => {
    setCourseFetchFailed(false);
    setCanBackToCoursePick(false);
    setAiStep('hub');
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>成绩</Text>
        <Text style={styles.headerSub}>赛前战术分析与成绩录入</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}>
        {aiStep === 'hub' ? (
          <>
            <TouchableOpacity style={styles.entryCard} activeOpacity={0.9} onPress={startAiFlow}>
              <Text style={styles.entryEmoji}>🧠</Text>
              <Text style={styles.entryTitle}>AI战术分析</Text>
              <Text style={styles.entrySub}>赛前10分钟，让AI帮你制定今日策略</Text>
              <View style={styles.entryBtnAccent}>
                <Text style={styles.entryBtnAccentText}>开始分析</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.entryCard}
              activeOpacity={0.9}
              onPress={() => router.push('/handicap/add' as Href)}>
              <Text style={styles.entryEmoji}>📝</Text>
              <Text style={styles.entryTitle}>记录成绩</Text>
              <Text style={styles.entrySub}>逐洞记录，自动计算差点微差</Text>
              <View style={styles.entryBtnOutline}>
                <Text style={styles.entryBtnOutlineText}>开始记录</Text>
              </View>
            </TouchableOpacity>
          </>
        ) : null}

        {aiStep === 'locating' ? (
          <View style={styles.centerBlock}>
            <ActivityIndicator color={ACCENT} size="large" />
            <Text style={styles.muted}>正在定位…</Text>
          </View>
        ) : null}

        {aiStep === 'pick_course' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>选择今日球场</Text>
            {courseLoading ? (
              <ActivityIndicator color={ACCENT} style={{ marginVertical: 16 }} />
            ) : (
              <>
                {courseFetchFailed ? (
                  <Text style={styles.muted}>附近球场加载失败，请检查网络后重试，或手动输入球场名称。</Text>
                ) : null}
                {!courseFetchFailed && courses.length === 0 ? (
                  <Text style={styles.muted}>附近暂无球场数据，可手动输入球场名称。</Text>
                ) : null}
                {courses.map((c, i) => (
                  <Pressable
                    key={`${c.name}-${i}`}
                    onPress={() => pickCourse(c.name)}
                    style={({ pressed }) => [
                      styles.courseRowCard,
                      pressed && styles.courseRowCardPressed,
                    ]}>
                    <Text style={styles.courseNameMain} numberOfLines={2}>
                      {c.name}
                    </Text>
                    <View style={styles.courseDistBadge}>
                      <Text style={styles.courseDistBadgeText}>{formatCourseKm(c.distance)}</Text>
                    </View>
                  </Pressable>
                ))}
              </>
            )}
            <TouchableOpacity
              style={styles.linkBtn}
              onPress={() => {
                setAiStep('manual_course');
              }}>
              <Text style={styles.linkBtnText}>手动输入球场名称</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ghostBtn} onPress={resetAi}>
              <Text style={styles.ghostBtnText}>返回</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {aiStep === 'manual_course' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>输入球场名称</Text>
            <TextInput
              style={styles.input}
              placeholder="例如：宝塚ゴルフ倶楽部"
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={manualCourse}
              onChangeText={setManualCourse}
            />
            <TouchableOpacity style={styles.primaryBtn} onPress={confirmManualCourse}>
              <Text style={styles.primaryBtnText}>下一步</Text>
            </TouchableOpacity>
            {canBackToCoursePick ? (
              <TouchableOpacity style={styles.ghostBtn} onPress={() => setAiStep('pick_course')}>
                <Text style={styles.ghostBtnText}>上一步</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.ghostBtn} onPress={resetAi}>
              <Text style={styles.ghostBtnText}>返回</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {aiStep === 'q_tee' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>开球时间</Text>
            {TEE_OPTIONS.map((o) => (
              <TouchableOpacity
                key={o.id}
                style={[styles.optionRow, teeTime === o.label && styles.optionRowActive]}
                onPress={() => {
                  setTeeTime(o.label);
                  setAiStep('q_weather');
                }}>
                <Text style={styles.optionText}>{o.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.ghostBtn} onPress={() => setAiStep('pick_course')}>
              <Text style={styles.ghostBtnText}>上一步</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {aiStep === 'q_weather' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>今天天气</Text>
            {WEATHER_OPTIONS.map((o) => (
              <TouchableOpacity
                key={o.id}
                style={[styles.optionRow, weather === o.label && styles.optionRowActive]}
                onPress={() => {
                  setWeather(o.label);
                  setAiStep('q_opponents');
                }}>
                <Text style={styles.optionText}>{o.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.ghostBtn} onPress={() => setAiStep('q_tee')}>
              <Text style={styles.ghostBtnText}>上一步</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {aiStep === 'q_opponents' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>对手信息（最多4人）</Text>
            {opponents.map((o, idx) => (
              <View key={idx} style={styles.oppoRow}>
                <TextInput
                  style={[styles.input, styles.inputFlex]}
                  placeholder="姓名"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  value={o.name}
                  onChangeText={(t) => {
                    const next = [...opponents];
                    next[idx] = { ...next[idx], name: t };
                    setOpponents(next);
                  }}
                />
                <TextInput
                  style={[styles.input, styles.inputNarrow]}
                  placeholder="差点"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  keyboardType="decimal-pad"
                  value={o.hcp}
                  onChangeText={(t) => {
                    const next = [...opponents];
                    next[idx] = { ...next[idx], hcp: t };
                    setOpponents(next);
                  }}
                />
              </View>
            ))}
            {opponents.length < 4 ? (
              <TouchableOpacity
                style={styles.addOppo}
                onPress={() => setOpponents([...opponents, { name: '', hcp: '' }])}>
                <Text style={styles.addOppoText}>+ 添加对手</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => {
                goClubsStep();
              }}>
              <Text style={styles.primaryBtnText}>下一步</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ghostBtn} onPress={() => setAiStep('q_weather')}>
              <Text style={styles.ghostBtnText}>上一步</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {aiStep === 'q_clubs' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>今日用杆</Text>
            <Text style={styles.muted}>
              {bag.length > 14
                ? `请勾选今日上场的 14 支（已选 ${selectedClubIds.size}/14）`
                : '确认今日携带的球杆'}
            </Text>
            {bag.map((c) => {
              const on = selectedClubIds.has(c.id);
              return (
                <Pressable
                  key={c.id}
                  style={[styles.clubRow, on && styles.clubRowOn]}
                  onPress={() => toggleClub(c.id)}>
                  <Text style={styles.clubCheck}>{on ? '☑' : '☐'}</Text>
                  <Text style={styles.clubName}>{c.name}</Text>
                </Pressable>
              );
            })}
            <TouchableOpacity
              style={[styles.primaryBtn, !clubSelectionValid && styles.primaryBtnDisabled]}
              disabled={!clubSelectionValid}
              onPress={() => setAiStep('ready')}>
              <Text style={styles.primaryBtnText}>下一步</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ghostBtn} onPress={() => setAiStep('q_opponents')}>
              <Text style={styles.ghostBtnText}>上一步</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {aiStep === 'ready' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>准备生成</Text>
            <Text style={styles.summary}>
              球场：{selectedCourseName}
              {'\n'}
              开球：{teeTime}
              {'\n'}
              天气：{weather}
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={runAi}>
              <Text style={styles.primaryBtnText}>生成战术分析</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ghostBtn} onPress={() => setAiStep('q_clubs')}>
              <Text style={styles.ghostBtnText}>上一步</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {aiStep === 'loading' ? (
          <View style={styles.centerBlock}>
            <ActivityIndicator color={ACCENT} size="large" />
            <Text style={styles.loadingText}>{loadHint}</Text>
            <View style={styles.skeleton}>
              <View style={styles.skelLine} />
              <View style={[styles.skelLine, { width: '88%' }]} />
              <View style={[styles.skelLine, { width: '72%' }]} />
            </View>
          </View>
        ) : null}

        {aiStep === 'result' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>战术分析</Text>
            <View style={styles.resultBox}>
              <Text style={styles.resultText}>{aiResult}</Text>
            </View>
            <TouchableOpacity style={styles.primaryBtn} onPress={runAi}>
              <Text style={styles.primaryBtnText}>重新生成</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.outlineBtn}
              onPress={() => router.push('/handicap/add' as Href)}>
              <Text style={styles.outlineBtnText}>开始记成绩</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ghostBtn} onPress={resetAi}>
              <Text style={styles.ghostBtnText}>返回首页</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: {
    backgroundColor: BG,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'web' ? 50 : (StatusBar.currentHeight || 36) + 12,
    paddingBottom: 16,
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: WHITE },
  headerSub: { fontSize: 13, color: TEXT_MUTED, marginTop: 8, lineHeight: 20 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 + TAB_BAR_SCROLL_EXTRA, gap: 12 },

  entryCard: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 16,
    padding: 18,
    marginBottom: 4,
  },
  entryEmoji: { fontSize: 28, marginBottom: 8 },
  entryTitle: { fontSize: 17, fontWeight: '700', color: WHITE, marginBottom: 6 },
  entrySub: { fontSize: 13, color: TEXT_MUTED, marginBottom: 14, lineHeight: 20 },
  entryBtnAccent: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  entryBtnAccentText: { color: ACCENT_TEXT, fontSize: 15, fontWeight: '800' },
  entryBtnOutline: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  entryBtnOutlineText: { color: WHITE, fontSize: 15, fontWeight: '700' },

  card: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 16,
    padding: 16,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: WHITE, marginBottom: 12 },
  muted: { fontSize: 13, color: TEXT_MUTED, marginVertical: 8 },
  centerBlock: { alignItems: 'center', paddingVertical: 32 },
  loadingText: { marginTop: 14, fontSize: 15, color: WHITE, fontWeight: '600' },
  skeleton: { marginTop: 24, width: '100%', gap: 10 },
  skelLine: {
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.08)',
    width: '100%',
  },

  courseRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  courseRowCardPressed: {
    borderColor: ACCENT,
  },
  courseNameMain: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: WHITE,
  },
  courseDistBadge: {
    backgroundColor: ACCENT,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  courseDistBadgeText: {
    color: ACCENT_TEXT,
    fontSize: 13,
    fontWeight: '800',
  },
  linkBtn: { marginTop: 12, paddingVertical: 8 },
  linkBtnText: { color: ACCENT, fontSize: 14, fontWeight: '600' },

  input: {
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: WHITE,
    fontSize: 15,
    marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  inputFlex: { flex: 1, marginBottom: 0, marginRight: 8 },
  inputNarrow: { width: 88, marginBottom: 0 },
  oppoRow: { flexDirection: 'row', marginBottom: 10, alignItems: 'center' },
  addOppo: { marginBottom: 12 },
  addOppoText: { color: ACCENT, fontSize: 14, fontWeight: '600' },

  optionRow: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  optionRowActive: { borderColor: ACCENT, backgroundColor: 'rgba(163,230,53,0.12)' },
  optionText: { fontSize: 15, color: WHITE },

  clubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  clubRowOn: { borderColor: ACCENT, backgroundColor: 'rgba(163,230,53,0.08)' },
  clubCheck: { fontSize: 16, color: ACCENT, width: 28 },
  clubName: { fontSize: 15, color: WHITE, fontWeight: '500' },

  summary: { fontSize: 14, color: TEXT_MUTED, lineHeight: 22, marginBottom: 16 },

  primaryBtn: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnDisabled: { opacity: 0.45 },
  primaryBtnText: { color: ACCENT_TEXT, fontSize: 16, fontWeight: '800' },
  outlineBtn: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  outlineBtnText: { color: WHITE, fontSize: 15, fontWeight: '700' },
  ghostBtn: { marginTop: 12, paddingVertical: 8, alignItems: 'center' },
  ghostBtnText: { color: TEXT_MUTED, fontSize: 14 },

  resultBox: {
    backgroundColor: '#122218',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(163,230,53,0.2)',
    marginBottom: 12,
  },
  resultText: { fontSize: 14, color: WHITE, lineHeight: 22 },
});
