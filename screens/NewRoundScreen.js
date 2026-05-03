import { TAB_BAR_SCROLL_EXTRA } from '@/constants/theme';
import * as Location from 'expo-location';
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { GOLF } from '@/constants/golfTheme';
import { createBetsForRound, createRound, searchFriendsByEmailOrUsername } from '@/lib/scorecardApi';
import { searchCourses, getNearbyCourses, type Course } from '@/lib/coursesApi';
import {
  SIDE_GAME_CATALOG,
  isPlayerCountOkForGame,
  sideGameTypeShortLabel,
} from '@/utils/sideGameCatalog';

const TEE_OPTS = [
  { key: 'white', label: '白' },
  { key: 'yellow', label: '黄' },
  { key: 'blue', label: '蓝' },
  { key: 'red', label: '红' },
];

const PAR_OPTS = [70, 71, 72, 73, 74];

function toOptInt(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.round(n));
}

function digitsOnly(t) {
  return String(t ?? '').replace(/[^0-9]/g, '');
}

/** WMO Weather interpretation codes (Open-Meteo) → short Chinese */
function wmoWeatherZh(code) {
  const c = Number(code);
  if (c === 0) return '晴';
  if (c === 1) return '大部晴';
  if (c === 2) return '局部多云';
  if (c === 3) return '多云';
  if (c === 45 || c === 48) return '雾';
  if (c >= 51 && c <= 57) return '毛毛雨';
  if (c >= 61 && c <= 67) return '雨';
  if (c >= 71 && c <= 77) return '雪';
  if (c >= 80 && c <= 82) return '阵雨';
  if (c >= 85 && c <= 86) return '阵雪';
  if (c >= 95 && c <= 99) return '雷雨';
  if (c >= 4 && c <= 10) return '阴';
  return '天气';
}

async function fetchWeatherSummary(lat, lng) {
  try {
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(String(lat))}&longitude=${encodeURIComponent(String(lng))}&current_weather=true`;
    const res = await fetch(u);
    if (!res.ok) return null;
    const data = await res.json();
    const cw = data?.current_weather;
    if (!cw || typeof cw.temperature !== 'number') return null;
    const zh = wmoWeatherZh(cw.weathercode);
    return `${zh} ${Math.round(cw.temperature)}℃`;
  } catch {
    return null;
  }
}

/** @returns {{ ok: true } | { ok: false, reason: 'permission' | 'error' }} */
async function locateAndCaptureWeather(setLocationState, weatherRef) {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return { ok: false, reason: 'permission' };
  try {
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    setLocationState({ lat, lng });
    const summary = await fetchWeatherSummary(lat, lng);
    if (summary) weatherRef.current = summary;
    return { ok: true };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

function clampStimp(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return 9;
  const n = Number(s);
  if (!Number.isFinite(n)) return 9;
  return Math.max(6, Math.min(15, Math.round(n)));
}

function makeBetDraftId() {
  return `bd_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

const BET_TYPE_ORDER = [
  'match_play',
  'stroke_play',
  'stableford',
  'nassau_pack',
  'points_8421',
  'fixed_lasi',
  'rotating_lasi',
  'landlord',
  'trumpet',
];

function gameCardTitle(type) {
  return sideGameTypeShortLabel(type);
}

export default function NewRoundScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const isTab = pathname === '/bet'; // 在 Tab 里显示时隐藏返回按钮
  const [courseName, setCourseName] = useState('');
  const [courseSearchQuery, setCourseSearchQuery] = useState('');
  const [courseResults, setCourseResults] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [courseSearching, setCourseSearching] = useState(false);
  const [teeColor, setTeeColor] = useState('blue');
  const [holes, setHoles] = useState(18);
  const [stimpStr, setStimpStr] = useState('9');
  const autoWeatherRef = useRef(null);
  const [teeTime, setTeeTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [front9Minutes, setFront9Minutes] = useState('');
  const [back9Minutes, setBack9Minutes] = useState('');
  const [parSetting, setParSetting] = useState(72);

  const [friendQuery, setFriendQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [picked, setPicked] = useState([]); // { userId, username }

  const [mode, setMode] = useState('score'); // 'score' | 'wager'
  const [isPublicBets, setIsPublicBets] = useState(false);
  const [visibility, setVisibility] = useState('public'); // 'public' | 'friends' | 'private'
  const [location, setLocation] = useState(null); // { lat, lng }
  const [locating, setLocating] = useState(false);
  const [betDrafts, setBetDrafts] = useState(() => [
    { id: makeBetDraftId(), gameType: 'match_play', unitStr: '1000', settlementTiming: 'per_hole' },
  ]);

  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await locateAndCaptureWeather((loc) => {
        if (!cancelled) setLocation(loc);
      }, autoWeatherRef);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const canCreate = useMemo(() => {
    return courseName.trim().length > 0 && (holes === 9 || holes === 18) && !creating;
  }, [courseName, holes, creating]);

  async function onSearch() {
    const q = friendQuery.trim();
    if (!q) return;
    try {
      setSearching(true);
      const list = await searchFriendsByEmailOrUsername(q);
      setSearchResults(list);
      if (list.length === 0) {
        Alert.alert('搜索球友', '未找到该用户');
      }
    } catch (e) {
      Alert.alert('搜索球友', e instanceof Error ? e.message : '搜索失败，请重试');
    } finally {
      setSearching(false);
    }
  }

  function togglePick(u) {
    setPicked((prev) => {
      const exists = prev.some((x) => x.userId === u.userId);
      if (exists) return prev.filter((x) => x.userId !== u.userId);
      return [...prev, u];
    });
  }

  async function onCreate() {
    if (!canCreate) return;
    try {
      setCreating(true);
      const playerCount = 1 + picked.length;
      if (mode === 'wager') {
        const ok = betDrafts.every((b) => isPlayerCountOkForGame(b.gameType, playerCount));
        if (!ok) {
          Alert.alert('新建一局', '当前球友人数与所选玩法不匹配，请调整玩法或球友人数');
          return;
        }
      }
      const playedAt = new Date().toISOString().split('T')[0];
      const weatherAuto = autoWeatherRef.current?.trim() || '';

      const { roundId } = await createRound({
        courseName,
        teeColor,
        playedAt,
        holes: holes === 9 ? 9 : 18,
        playerUserIds: picked.map((x) => x.userId),
        weather: weatherAuto || undefined,
        teeTime,
        durationMinutes: toOptInt(durationMinutes),
        front9Minutes: toOptInt(front9Minutes),
        back9Minutes: toOptInt(back9Minutes),
        parSetting,
        visibility,
        latitude: location?.lat ?? null,
        longitude: location?.lng ?? null,
        greenSpeed: clampStimp(stimpStr),
      });

      if (mode === 'wager') {
        const payload = betDrafts.map((b, idx) => ({
          betType: b.gameType,
          unitAmount: Number(digitsOnly(b.unitStr || '1000')) || 1000,
          settlementTiming: b.settlementTiming === 'end_total' ? 'end_total' : 'per_hole',
          sortOrder: idx,
          isPublic: isPublicBets,
        }));
        await createBetsForRound(roundId, payload);
      }
      router.replace(`/rounds/${roundId}`);
    } catch (e) {
      Alert.alert('新建一局', e instanceof Error ? e.message : '创建失败，请重试');
    } finally {
      setCreating(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: GOLF.bg }}
      >
        {!isTab && (
          <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8}>
            <Text style={styles.backText}>‹ 返回</Text>
          </Pressable>
        )}

        <Text style={styles.title}>新建一局</Text>
        <Text style={styles.subtitle}>填写基本信息并邀请球友</Text>

        <View style={styles.card}>
          <Text style={styles.label}>球场名称</Text>

          {selectedCourse ? (
            <Pressable
              style={styles.selectedCourse}
              onPress={() => { setSelectedCourse(null); setCourseName(''); setCourseResults([]); setCourseSearchQuery(''); }}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.selectedCourseName}>{selectedCourse.name}</Text>
                {selectedCourse.province || selectedCourse.city ? (
                  <Text style={styles.selectedCourseSub}>{[selectedCourse.province, selectedCourse.city].filter(Boolean).join(' · ')}</Text>
                ) : null}
              </View>
              <Text style={{ color: GOLF.muted, fontSize: 12 }}>更换 ›</Text>
            </Pressable>
          ) : (
            <>
              <View style={styles.row}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={courseSearchQuery}
                  onChangeText={setCourseSearchQuery}
                  placeholder="搜索球场名称"
                  placeholderTextColor={GOLF.muted}
                  returnKeyType="search"
                  onSubmitEditing={async () => {
                    if (!courseSearchQuery.trim()) return;
                    setCourseSearching(true);
                    try {
                      const results = await searchCourses(courseSearchQuery);
                      setCourseResults(results);
                    } catch { setCourseResults([]); } finally { setCourseSearching(false); }
                  }}
                />
                <Pressable
                  style={styles.searchBtn}
                  onPress={async () => {
                    if (!courseSearchQuery.trim()) return;
                    setCourseSearching(true);
                    try {
                      const results = await searchCourses(courseSearchQuery);
                      setCourseResults(results);
                    } catch { setCourseResults([]); } finally { setCourseSearching(false); }
                  }}
                >
                  <Text style={styles.searchBtnTxt}>{courseSearching ? '...' : '搜索'}</Text>
                </Pressable>
              </View>

              {courseResults.length > 0 && (
                <View style={styles.courseDropdown}>
                  {courseResults.map((c) => (
                    <Pressable
                      key={c.id}
                      style={styles.courseItem}
                      onPress={() => {
                        setSelectedCourse(c);
                        setCourseName(c.name);
                        if (c.total_par) setParSetting(c.total_par);
                        setCourseResults([]);
                        setCourseSearchQuery('');
                      }}
                    >
                      <Text style={styles.courseItemName}>{c.name}</Text>
                      {c.province || c.city ? (
                        <Text style={styles.courseItemSub}>{[c.province, c.city].filter(Boolean).join(' · ')}</Text>
                      ) : null}
                    </Pressable>
                  ))}
                </View>
              )}

              {courseResults.length === 0 && courseSearchQuery.length > 0 && !courseSearching && (
                <>
                  <Text style={{ color: GOLF.muted, fontSize: 12, marginTop: 6 }}>未找到，可直接输入球场名</Text>
                  <TextInput
                    style={[styles.input, { marginTop: 6 }]}
                    value={courseName}
                    onChangeText={setCourseName}
                    placeholder="手动输入球场名称"
                    placeholderTextColor={GOLF.muted}
                  />
                </>
              )}
            </>
          )}

          <Text style={styles.label}>发球台颜色</Text>
          <View style={styles.row}>
            {TEE_OPTS.map((o) => {
              const on = o.key === teeColor;
              return (
                <Pressable
                  key={o.key}
                  onPress={() => setTeeColor(o.key)}
                  style={[styles.chip, on && styles.chipOn]}
                >
                  <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{o.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>洞数</Text>
          <View style={styles.row}>
            {[9, 18].map((h) => {
              const on = h === holes;
              return (
                <Pressable key={h} onPress={() => setHoles(h)} style={[styles.chip, on && styles.chipOn]}>
                  <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{h} 洞</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>果岭速度（Stimp）</Text>
          <TextInput
            style={styles.input}
            value={stimpStr}
            onChangeText={(t) => setStimpStr(digitsOnly(t).slice(0, 2))}
            placeholder="9"
            placeholderTextColor={GOLF.muted}
            keyboardType="number-pad"
          />
          <Text style={{ color: GOLF.muted, fontSize: 12, marginTop: -2, marginBottom: 2 }}>范围 6–15，默认 9</Text>

          <Text style={styles.label}>开球时间（选填）</Text>
          <TextInput
            style={styles.input}
            value={teeTime}
            onChangeText={setTeeTime}
            placeholder="如：07:32"
            placeholderTextColor={GOLF.muted}
          />

          <Text style={styles.label}>整场用时（选填，分钟）</Text>
          <TextInput
            style={styles.input}
            value={durationMinutes}
            onChangeText={setDurationMinutes}
            placeholder="例如 255"
            placeholderTextColor={GOLF.muted}
            keyboardType="number-pad"
          />

          <Text style={styles.label}>前9用时（选填，分钟）</Text>
          <TextInput
            style={styles.input}
            value={front9Minutes}
            onChangeText={setFront9Minutes}
            placeholder="例如 125"
            placeholderTextColor={GOLF.muted}
            keyboardType="number-pad"
          />

          <Text style={styles.label}>后9用时（选填，分钟）</Text>
          <TextInput
            style={styles.input}
            value={back9Minutes}
            onChangeText={setBack9Minutes}
            placeholder="例如 130"
            placeholderTextColor={GOLF.muted}
            keyboardType="number-pad"
          />

          <Text style={styles.label}>标准杆设置（选填）</Text>
          <View style={styles.row}>
            {PAR_OPTS.map((p) => {
              const on = p === parSetting;
              return (
                <Pressable key={p} onPress={() => setParSetting(p)} style={[styles.chip, on && styles.chipOn]}>
                  <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{`Par${p}`}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>邀请球友</Text>
          <Text style={styles.sectionSub}>输入邮箱或昵称搜索（仅显示已注册用户）</Text>

          <View style={styles.searchRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              value={friendQuery}
              onChangeText={setFriendQuery}
              placeholder="例如 golfer@example.com 或 Lee"
              placeholderTextColor={GOLF.muted}
              autoCapitalize="none"
            />
            <Pressable style={[styles.searchBtn, searching && styles.disabled]} onPress={onSearch} disabled={searching}>
              {searching ? <ActivityIndicator color="#fff" /> : <Text style={styles.searchBtnTxt}>搜索</Text>}
            </Pressable>
          </View>

          {searchResults.map((u) => {
            const on = picked.some((x) => x.userId === u.userId);
            return (
              <Pressable key={u.userId} onPress={() => togglePick(u)} style={styles.pickRow}>
                <Text style={styles.pickName}>{u.username}</Text>
                <Text style={[styles.pickMeta, on && { color: GOLF.accent }]}>{on ? '已添加' : '添加'}</Text>
              </Pressable>
            );
          })}

          {picked.length > 0 ? (
            <View style={styles.pickedWrap}>
              <Text style={styles.pickedTitle}>已添加：</Text>
              <Text style={styles.pickedText}>{picked.map((x) => x.username).join(' · ')}</Text>
            </View>
          ) : null}
        </View>

        {/* 可见范围 */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>成绩可见范围</Text>
          <Text style={styles.sectionSub}>控制本局成绩在动态流中的显示范围</Text>
          <View style={[styles.row, { marginTop: 10, flexWrap: 'wrap' }]}>
            {[
              { key: 'public', label: '🌐 公开' },
              { key: 'friends', label: '👥 仅好友' },
              { key: 'private', label: '🔒 仅自己' },
            ].map((opt) => (
              <Pressable
                key={opt.key}
                onPress={() => setVisibility(opt.key)}
                style={[styles.chip, visibility === opt.key && styles.chipOn]}
              >
                <Text style={[styles.chipTxt, visibility === opt.key && styles.chipTxtOn]}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* 定位 */}
          <Pressable
            style={[styles.locBtn, location && styles.locBtnDone]}
            onPress={async () => {
              setLocating(true);
              try {
                const r = await locateAndCaptureWeather(setLocation, autoWeatherRef);
                if (!r.ok) {
                  if (r.reason === 'permission') {
                    Alert.alert('定位', '请允许应用访问位置信息');
                  } else {
                    Alert.alert('定位失败', '请检查系统定位权限后重试');
                  }
                }
              } finally {
                setLocating(false);
              }
            }}
          >
            <Text style={styles.locBtnTxt}>
              {locating ? '定位中...' : location ? `📍 已定位` : '📍 记录球场位置（选填）'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>赌球设置</Text>
          <Text style={styles.sectionSub}>可选：只记成绩或配置本场赌局</Text>

          <View style={[styles.row, { marginTop: 10 }]}>
            <Pressable
              onPress={() => setMode('score')}
              style={[styles.chip, mode === 'score' && styles.chipOn]}
            >
              <Text style={[styles.chipTxt, mode === 'score' && styles.chipTxtOn]}>只记成绩</Text>
            </Pressable>
            <Pressable
              onPress={() => setMode('wager')}
              style={[styles.chip, mode === 'wager' && styles.chipOn]}
            >
              <Text style={[styles.chipTxt, mode === 'wager' && styles.chipTxtOn]}>赌球</Text>
            </Pressable>
          </View>

          {mode === 'wager' ? (
            <>
              <Text style={styles.label}>玩法选择（人数不符会置灰）</Text>
              {betDrafts.map((bd, idx) => {
                const playerCount = 1 + picked.length;
                const title = `赌局 ${idx + 1}`;
                return (
                  <View key={bd.id} style={styles.betBlock}>
                    <View style={styles.betHead}>
                      <Text style={styles.betTitle}>{title}</Text>
                      {betDrafts.length > 1 ? (
                        <Pressable
                          onPress={() => setBetDrafts((prev) => prev.filter((x) => x.id !== bd.id))}
                          hitSlop={8}
                        >
                          <Text style={styles.betRemove}>移除</Text>
                        </Pressable>
                      ) : null}
                    </View>

                    <View style={styles.betCards}>
                      {BET_TYPE_ORDER.map((t) => {
                        const ok = isPlayerCountOkForGame(t, playerCount);
                        const on = bd.gameType === t;
                        const disabled = !ok;
                        return (
                          <Pressable
                            key={t}
                            onPress={() => {
                              if (disabled) return;
                              setBetDrafts((prev) =>
                                prev.map((x) => (x.id === bd.id ? { ...x, gameType: t } : x)),
                              );
                            }}
                            style={[
                              styles.betCard,
                              on && styles.betCardOn,
                              disabled && styles.betCardDisabled,
                            ]}
                            disabled={disabled}
                          >
                            <Text style={[styles.betCardTxt, on && styles.betCardTxtOn]}>
                              {gameCardTitle(t)}
                            </Text>
                            <Text style={styles.betCardSub}>
                              {SIDE_GAME_CATALOG.find((e) => e.type === t)?.playersLabel ?? ''}
                            </Text>
                            {t !== 'match_play' && t !== 'stroke_play' ? (
                              <Text style={styles.betCardSoon}>即将上线</Text>
                            ) : null}
                          </Pressable>
                        );
                      })}
                    </View>

                    <Text style={styles.label}>单位金额（默认 1000）</Text>
                    <TextInput
                      style={styles.input}
                      value={bd.unitStr}
                      onChangeText={(v) =>
                        setBetDrafts((prev) =>
                          prev.map((x) => (x.id === bd.id ? { ...x, unitStr: digitsOnly(v) } : x)),
                        )
                      }
                      placeholder="1000"
                      placeholderTextColor={GOLF.muted}
                      keyboardType="number-pad"
                    />

                    <Text style={styles.label}>结算节奏</Text>
                    <View style={styles.row}>
                      <Pressable
                        onPress={() =>
                          setBetDrafts((prev) =>
                            prev.map((x) =>
                              x.id === bd.id ? { ...x, settlementTiming: 'per_hole' } : x,
                            ),
                          )
                        }
                        style={[styles.chip, bd.settlementTiming === 'per_hole' && styles.chipOn]}
                      >
                        <Text
                          style={[
                            styles.chipTxt,
                            bd.settlementTiming === 'per_hole' && styles.chipTxtOn,
                          ]}
                        >
                          一洞一算
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() =>
                          setBetDrafts((prev) =>
                            prev.map((x) =>
                              x.id === bd.id ? { ...x, settlementTiming: 'end_total' } : x,
                            ),
                          )
                        }
                        style={[styles.chip, bd.settlementTiming === 'end_total' && styles.chipOn]}
                      >
                        <Text
                          style={[
                            styles.chipTxt,
                            bd.settlementTiming === 'end_total' && styles.chipTxtOn,
                          ]}
                        >
                          打完一起算
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}

              <Pressable
                style={[styles.addBetBtn, creating && styles.disabled]}
                onPress={() =>
                  setBetDrafts((prev) => [
                    ...prev,
                    { id: makeBetDraftId(), gameType: 'match_play', unitStr: '1000', settlementTiming: 'per_hole' },
                  ])
                }
                disabled={creating}
              >
                <Text style={styles.addBetTxt}>＋ 添加另一个赌局</Text>
              </Pressable>

              <View style={styles.privacyRow}>
                <Pressable
                  onPress={() => setIsPublicBets((x) => !x)}
                  style={[styles.toggle, isPublicBets && styles.toggleOn]}
                >
                  <View style={[styles.toggleKnob, isPublicBets && styles.toggleKnobOn]} />
                </Pressable>
                <View style={{ flex: 1 }}>
                  <Text style={styles.privacyTitle}>公开展示赌局</Text>
                  <Text style={styles.privacySub}>开启后赌局状态将在动态流中展示</Text>
                </View>
              </View>
            </>
          ) : null}
        </View>

        <Pressable style={[styles.primary, (!canCreate || creating) && styles.disabled]} onPress={onCreate} disabled={!canCreate || creating}>
          <Text style={styles.primaryTxt}>{creating ? '创建中…' : '开始记分'}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#0d1b11' },
  // Web(Tab 内) 原 paddingTop=44 会造成明显“顶端空白”；同时底部需要更大 padding 才不被 TabBar 遮挡
  scroll: {
    flexGrow: 1,
    padding: 16,
    paddingTop: Platform.OS === 'web' ? 18 : 20,
    // Web：额外预留 TabBar + 一点呼吸区，避免“最后一项贴着 TabBar/被压住”的观感
    paddingBottom: (Platform.OS === 'web' ? 96 : 40) + TAB_BAR_SCROLL_EXTRA,
  },
  back: { marginBottom: 12, alignSelf: 'flex-start' },
  backText: { color: '#c9ff4a', fontSize: 15, fontWeight: '700' },
  title: { color: '#e8f0e5', fontSize: 24, fontWeight: '900', marginTop: 4 },
  subtitle: { color: '#5a6b5f', marginTop: 4, marginBottom: 16, fontSize: 13, lineHeight: 18 },

  card: {
    backgroundColor: '#16261c',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 14,
    marginBottom: 10,
  },
  label: { color: '#8a9a8e', fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: '#e8f0e5',
    fontSize: 15,
    marginBottom: 6,
  },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 2 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  chipOn: { borderColor: '#c9ff4a', backgroundColor: 'rgba(201,255,74,0.14)' },
  chipTxt: { color: '#8a9a8e', fontWeight: '700', fontSize: 13 },
  chipTxtOn: { color: '#c9ff4a', fontWeight: '800' },

  sectionTitle: { color: '#e8f0e5', fontSize: 15, fontWeight: '800' },
  sectionSub: { color: '#5a6b5f', marginTop: 4, lineHeight: 18, fontSize: 12 },

  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  searchBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#c9ff4a',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  searchBtnTxt: { color: '#c9ff4a', fontWeight: '900', fontSize: 14 },

  selectedCourse: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(201,255,74,0.10)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(201,255,74,0.28)',
    marginBottom: 4,
  },
  selectedCourseName: { fontSize: 14, fontWeight: '700', color: '#e8f0e5' },
  selectedCourseSub: { fontSize: 12, color: '#8a9a8e', marginTop: 2 },

  courseDropdown: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 10,
    marginTop: 4,
    maxHeight: 220,
    overflow: 'hidden',
  },
  courseItem: {
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  courseItemName: { fontSize: 13, fontWeight: '600', color: '#e8f0e5' },
  courseItemSub: { fontSize: 11, color: '#8a9a8e', marginTop: 2 },

  disabled: { opacity: 0.5 },
  pickRow: {
    marginTop: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  pickName: { color: '#e8f0e5', fontWeight: '700' },
  pickMeta: { color: '#8a9a8e', fontWeight: '700' },
  pickedWrap: { marginTop: 10 },
  pickedTitle: { color: '#8a9a8e', fontWeight: '700', fontSize: 12 },
  pickedText: { color: '#e8f0e5', marginTop: 4, lineHeight: 20, fontSize: 14 },

  betBlock: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  betHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  betTitle: { color: '#e8f0e5', fontWeight: '800', fontSize: 14 },
  betRemove: { color: '#f87171', fontWeight: '700', fontSize: 13 },
  betCards: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4, marginBottom: 8 },
  betCard: {
    width: '48%',
    minWidth: 140,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 12,
  },
  betCardOn: { borderColor: '#c9ff4a', backgroundColor: 'rgba(201,255,74,0.10)' },
  betCardDisabled: { opacity: 0.3 },
  betCardTxt: { color: '#e8f0e5', fontWeight: '800', fontSize: 14 },
  betCardTxtOn: { color: '#e8f0e5' },
  betCardSub: { color: '#8a9a8e', marginTop: 4, fontSize: 12, fontWeight: '600', lineHeight: 16 },
  betCardSoon: { color: '#5a6b5f', marginTop: 8, fontSize: 11, fontWeight: '700' },
  addBetBtn: {
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingVertical: 12,
    alignItems: 'center',
  },
  addBetTxt: { color: '#8a9a8e', fontWeight: '700', fontSize: 13 },

  privacyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  toggle: {
    width: 44,
    height: 26,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    padding: 2,
    justifyContent: 'center',
  },
  toggleOn: { backgroundColor: 'rgba(201,255,74,0.14)', borderColor: 'rgba(201,255,74,0.28)' },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.4)',
    transform: [{ translateX: 0 }],
  },
  toggleKnobOn: { backgroundColor: '#fff', transform: [{ translateX: 16 }] },
  privacyTitle: { color: '#e8f0e5', fontWeight: '700', fontSize: 14 },
  privacySub: { color: '#5a6b5f', marginTop: 2, fontSize: 12, lineHeight: 16 },

  locBtn: {
    marginTop: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  locBtnDone: { borderColor: 'rgba(201,255,74,0.28)', backgroundColor: 'rgba(201,255,74,0.10)' },
  locBtnTxt: { fontSize: 13, fontWeight: '600', color: '#8a9a8e' },

  primary: {
    backgroundColor: '#c9ff4a',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  primaryTxt: { color: '#07120b', fontSize: 17, fontWeight: '900' },
});

