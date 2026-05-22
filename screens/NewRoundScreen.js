import {
  STACK_SCREEN_TOP_PADDING,
  TAB_BAR_SCROLL_EXTRA,
  THEME,
} from '@/constants/theme';
import { ScreenHeader } from '@/components/ScreenHeader';
import * as Location from 'expo-location';
import { useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { GOLF } from '@/constants/golfTheme';
import {
  createBetsForRound,
  createRound,
  getAuthedUserId,
  searchFriendsByEmailOrUsername,
} from '@/lib/scorecardApi';
import { supabase } from '@/lib/supabase';
import { searchCourses, getNearbyCourses, type Course } from '@/lib/coursesApi';
import { catalogEntry, isPlayerCountOkForGame } from '@/utils/sideGameCatalog';
import { defaultEventConfig } from '@/utils/matchEventModifiers';

const ACCENT = '#c9ff4a';

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

function patchEventAmountsFromUnit(cfg, unitNum) {
  const d = defaultEventConfig(unitNum);
  return {
    ...cfg,
    birdieAmount: d.birdieAmount,
    eagleAmount: d.eagleAmount,
    albatrossAmount: d.albatrossAmount,
    sandSaveAmount: d.sandSaveAmount,
    parTrainAmount: d.parTrainAmount,
    waterHazardAmount: d.waterHazardAmount,
    outOfBoundsAmount: d.outOfBoundsAmount,
  };
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

/** 第一步：游戏格式（顺序固定） */
const BET_FORMATS = [
  {
    key: 'solo',
    title: '单挑',
    playersLabel: '2人起',
    subtitle: '一对一，选你要的计分方式',
    minPlayers: 2,
    maxPlayers: 99,
    blurbTypes: ['match_play', 'stroke_play', 'stableford', 'points_8421'],
  },
  {
    key: 'nassau',
    title: 'Nassau',
    playersLabel: '2人起',
    subtitle: '前九/后九/全场三段，支持 Press',
    minPlayers: 2,
    maxPlayers: 99,
    blurbTypes: ['nassau_pack'],
  },
  {
    key: 'fixed_lasi',
    title: '固拉',
    playersLabel: '4人起偶数',
    subtitle: '固定搭档两队对抗，Las Vegas 拼分',
    minPlayers: 4,
    maxPlayers: 99,
    evenPlayersOnly: true,
    blurbTypes: ['fixed_lasi'],
  },
  {
    key: 'rotating_lasi',
    title: '乱拉',
    playersLabel: '4人起偶数',
    subtitle: '每洞换搭档，Las Vegas 拼分',
    minPlayers: 4,
    maxPlayers: 99,
    evenPlayersOnly: true,
    blurbTypes: ['rotating_lasi'],
  },
  {
    key: 'landlord',
    title: '斗地主',
    playersLabel: '3人',
    subtitle: '一对二比洞',
    minPlayers: 3,
    maxPlayers: 3,
    blurbTypes: ['landlord'],
  },
  {
    key: 'trumpet',
    title: '喇叭花',
    playersLabel: '5/7/9人',
    subtitle: '中间位单挑所有人',
    minPlayers: 5,
    maxPlayers: 99,
    oddPlayersOnly: true,
    blurbTypes: ['trumpet'],
  },
  {
    key: 'skins',
    title: 'Skins',
    playersLabel: '2人起',
    subtitle: '每洞最低分赢皮，平局累积',
    minPlayers: 2,
    maxPlayers: 99,
    blurbTypes: ['skins'],
  },
];

/** 首页赌法快选 query → BET_FORMATS.key */
const BET_MODE_PARAM_TO_FMT = {
  las_vegas: 'fixed_lasi',
  random_pair: 'rotating_lasi',
  landlord: 'landlord',
  flower: 'trumpet',
  nassau: 'nassau',
  skins: 'skins',
};

const FORMAT_EMOJI = {
  solo: '⚔️',
  nassau: '🏆',
  fixed_lasi: '🤝',
  rotating_lasi: '🔀',
  landlord: '👑',
  trumpet: '📯',
  skins: '💰',
};

const STEP_SUBTITLES = ['球场信息', '邀请球友', '赌球设置'];
const STEP_LABELS = ['球场', '球友', '赌球'];

function isFormatPlayerCountOk(f, playerCount) {
  if (playerCount < f.minPlayers || playerCount > f.maxPlayers) return false;
  if (f.oddPlayersOnly && playerCount % 2 === 0) return false;
  if (f.evenPlayersOnly && playerCount % 2 !== 0) return false;
  return true;
}

function formatHelpBlurb(f) {
  const parts = (f.blurbTypes ?? [])
    .map((t) => {
      const e = catalogEntry(t);
      return e ? `${e.title}：${e.blurb}` : null;
    })
    .filter(Boolean);
  return parts.join('\n\n');
}

function defaultDraftPatchFromFormat(fmtKey, prev) {
  const uNum = Number(digitsOnly(prev.unitStr || '1000')) || 1000;
  let gameType = prev.gameType;
  let lasiScoreMode = prev.lasiScoreMode;
  let nassauScoreMode = prev.nassauScoreMode ?? 'holes';
  if (fmtKey === 'landlord') {
    gameType = 'landlord';
    lasiScoreMode = null;
  } else if (fmtKey === 'trumpet') {
    gameType = 'trumpet';
    lasiScoreMode = null;
  } else if (fmtKey === 'skins') {
    gameType = 'skins';
    lasiScoreMode = null;
  } else if (fmtKey === 'solo') {
    lasiScoreMode = null;
    if (!['match_play', 'stroke_play', 'stableford', 'points_8421'].includes(gameType)) {
      gameType = 'match_play';
    }
  } else if (fmtKey === 'nassau') {
    gameType = 'nassau_pack';
    lasiScoreMode = null;
    nassauScoreMode = prev.nassauScoreMode === 'stroke' ? 'stroke' : 'holes';
  } else if (fmtKey === 'fixed_lasi') {
    gameType = 'fixed_lasi';
    if (lasiScoreMode !== 'match' && lasiScoreMode !== 'vegas') lasiScoreMode = 'vegas';
  } else if (fmtKey === 'rotating_lasi') {
    gameType = 'rotating_lasi';
    if (lasiScoreMode !== 'match' && lasiScoreMode !== 'vegas') lasiScoreMode = 'vegas';
  }
  const isVegas =
    (fmtKey === 'fixed_lasi' || fmtKey === 'rotating_lasi') && lasiScoreMode !== 'match';
  return {
    ...prev,
    fmt: fmtKey,
    gameType,
    lasiScoreMode,
    nassauScoreMode,
    eventConfig: defaultEventConfig(uNum),
    hangSectionOpen: isVegas,
  };
}

export default function NewRoundScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const { betMode: betModeRaw } = useLocalSearchParams();
  const betMode = Array.isArray(betModeRaw) ? betModeRaw[0] : betModeRaw;
  const isTab = pathname === '/bet'; // 在 Tab 里显示时隐藏返回按钮
  const [courseName, setCourseName] = useState('');
  const [courseSearchQuery, setCourseSearchQuery] = useState('');
  const [courseResults, setCourseResults] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [courseSearching, setCourseSearching] = useState(false);
  const [teeColor, setTeeColor] = useState('blue');
  const [holes, setHoles] = useState(18);
  const [startingHole, setStartingHole] = useState(1);
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
  /** @type {Array<{ type: 'registered', userId: string, name: string } | { type: 'guest', id: string, name: string }>} */
  const [picked, setPicked] = useState([]);
  const [guestModalOpen, setGuestModalOpen] = useState(false);
  const [guestNameDraft, setGuestNameDraft] = useState('');
  const [groupAssignments, setGroupAssignments] = useState({});
  const [displayName, setDisplayName] = useState('我');

  const [mode, setMode] = useState('score'); // 'score' | 'wager'
  const [isPublicBets, setIsPublicBets] = useState(false);
  const [visibility, setVisibility] = useState('public'); // 'public' | 'friends' | 'private'
  const [location, setLocation] = useState(null); // { lat, lng }
  const [locating, setLocating] = useState(false);
  const [betDrafts, setBetDrafts] = useState(() => [
    {
      id: makeBetDraftId(),
      fmt: 'solo',
      gameType: 'match_play',
      lasiScoreMode: null,
      nassauScoreMode: 'holes',
      unitStr: '1000',
      settlementTiming: 'per_hole',
      tieRule: 'void',
      vegasTieRule: 'carry',
      eagleMultiplier: 2,
      doubleBogeyFlip: false,
      hangSectionOpen: false,
      eventConfig: defaultEventConfig(1000),
    },
  ]);

  const [creating, setCreating] = useState(false);
  const createLockRef = useRef(false);
  const [step, setStep] = useState(1);
  const [moreSettingsOpen, setMoreSettingsOpen] = useState(false);
  const scrollRef = useRef(null);

  const goStep = (n) => {
    setStep(n);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  /** 步骤条：可回退；向前跳需已填球场（与 canCreate 一致） */
  const onStepPress = (n) => {
    if (n === step) return;
    if (n < step) {
      goStep(n);
      return;
    }
    if (!canCreate) {
      Alert.alert('新建一局', '请先填写球场名称');
      return;
    }
    goStep(n);
  };

  const stepCanTap = (n) => n !== step && (n < step || canCreate);

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

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const uid = await getAuthedUserId();
        const { data } = await supabase.from('profiles').select('username').eq('id', uid).single();
        if (!alive) return;
        const n = (data?.username || '').trim();
        if (n) setDisplayName(n);
      } catch {
        /* 显示默认「我」 */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!betMode) return;
    const fmtKey = BET_MODE_PARAM_TO_FMT[betMode];
    if (!fmtKey) return;
    setMode('wager');
    setBetDrafts((prev) => {
      const first = prev[0];
      if (!first) return prev;
      return [defaultDraftPatchFromFormat(fmtKey, first), ...prev.slice(1)];
    });
    goStep(3);
  }, [betMode]);

  /** 球场名：选中结果 > 手动名 > 搜索框（避免搜不到还要填第二遍） */
  const resolvedCourseName = useMemo(() => {
    if (selectedCourse?.name?.trim()) return selectedCourse.name.trim();
    const manual = courseName.trim();
    if (manual) return manual;
    return courseSearchQuery.trim();
  }, [selectedCourse, courseName, courseSearchQuery]);

  const canCreate = useMemo(() => {
    return resolvedCourseName.length > 0 && (holes === 9 || holes === 18);
  }, [resolvedCourseName, holes]);

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

  function togglePickRegistered(u) {
    setPicked((prev) => {
      const exists = prev.some((x) => x.type === 'registered' && x.userId === u.userId);
      if (exists) return prev.filter((x) => !(x.type === 'registered' && x.userId === u.userId));
      const name = (u.username || '').trim() || u.userId.slice(0, 6);
      return [...prev, { type: 'registered', userId: u.userId, name }];
    });
  }

  function removeBuddy(p) {
    setPicked((prev) =>
      prev.filter((x) =>
        p.type === 'guest'
          ? !(x.type === 'guest' && x.id === p.id)
          : !(x.type === 'registered' && x.userId === p.userId),
      ),
    );
  }

  function confirmAddGuest() {
    const name = guestNameDraft.trim();
    if (!name) {
      Alert.alert('添加访客', '请填写访客名字');
      return;
    }
    setPicked((prev) => [...prev, { type: 'guest', id: `guest_${Date.now()}`, name }]);
    setGuestNameDraft('');
    setGuestModalOpen(false);
  }

  /** @param {{ scoreOnly?: boolean }} opts scoreOnly：「不赌球，直接开始」强制只记成绩 */
  async function onCreate(opts) {
    if (!canCreate || createLockRef.current) return;
    createLockRef.current = true;
    setCreating(true);
    let navigated = false;
    try {
      const activeMode = opts?.scoreOnly ? 'score' : mode;
      const playerCount = 1 + picked.length;
      if (activeMode === 'wager') {
        const ok = betDrafts.every((b) => isPlayerCountOkForGame(b.gameType, playerCount));
        if (!ok) {
          Alert.alert('新建一局', '当前球友人数与所选玩法不匹配，请调整玩法或球友人数');
          return;
        }
      }
      const playedAt = new Date().toISOString().split('T')[0];
      const weatherAuto = autoWeatherRef.current?.trim() || '';

      const players = picked.map((p, i) => ({
        ...p,
        groupNumber: groupAssignments[i] ?? 1,
      }));

      const { roundId } = await createRound({
        courseName: resolvedCourseName,
        teeColor,
        playedAt,
        holes: holes === 9 ? 9 : 18,
        starting_hole: holes === 9 ? startingHole : 1,
        players,
        creatorGroupNumber: groupAssignments['creator'] ?? 1,
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

      if (activeMode === 'wager') {
        const payload = betDrafts.map((b, idx) => {
          const isLasi = b.gameType === 'fixed_lasi' || b.gameType === 'rotating_lasi';
          const lasiMatch = isLasi && b.lasiScoreMode === 'match';
          const lasiVegas = isLasi && b.lasiScoreMode !== 'match';
          const tieForPayload =
            b.gameType === 'match_play' || lasiMatch ? b.tieRule ?? 'void' : null;
          return {
            betType: b.gameType,
            unitAmount: Number(digitsOnly(b.unitStr || '1000')) || 1000,
            settlementTiming: b.settlementTiming === 'end_total' ? 'end_total' : 'per_hole',
            sortOrder: idx,
            isPublic: isPublicBets,
            tieRule: tieForPayload,
            vegasTieRule: lasiVegas ? b.vegasTieRule ?? 'carry' : null,
            eagleMultiplier: lasiVegas ? b.eagleMultiplier ?? 2 : null,
            doubleBogeyFlip: lasiVegas ? Boolean(b.doubleBogeyFlip) : null,
            events: [],
            eventConfig: b.eventConfig ?? null,
          };
        });
        await createBetsForRound(roundId, payload);
      }
      router.replace(`/rounds/${roundId}`);
      navigated = true;
    } catch (e) {
      Alert.alert('新建一局', e instanceof Error ? e.message : '创建失败，请重试');
    } finally {
      if (!navigated) {
        createLockRef.current = false;
        setCreating(false);
      }
    }
  }

  return (
    <>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {isTab ? (
        <ScreenHeader title="新建一局" subtitle={STEP_SUBTITLES[step - 1]} />
      ) : (
        <ScreenHeader
          variant="stack"
          title="新建一局"
          subtitle={STEP_SUBTITLES[step - 1]}
          onBack={() => router.back()}
        />
      )}

      <View style={styles.stepBar}>
        <View style={styles.stepColsRow}>
          {STEP_LABELS.map((label, idx) => {
            const n = idx + 1;
            const done = step > n;
            const current = step === n;
            const reachable = n > step && canCreate;
            const dotStyles = [
              styles.stepDot,
              current && styles.stepDotActive,
              done && styles.stepDotDone,
              reachable && styles.stepDotReachable,
              !current && !done && !reachable && styles.stepDotIdle,
            ];
            return (
              <Pressable
                key={n}
                style={styles.stepCol}
                onPress={() => onStepPress(n)}
                disabled={!stepCanTap(n)}
              >
                <View style={dotStyles} />
                <Text
                  style={[
                    styles.stepLabel,
                    current && styles.stepLabelActive,
                    reachable && styles.stepLabelReachable,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scroll, styles.scrollStep, isTab && styles.scrollTabBody]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: GOLF.bg }}
      >
        {step === 1 ? (
        <>
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
                  onChangeText={(v) => {
                    setCourseSearchQuery(v);
                    if (!selectedCourse) setCourseName(v);
                  }}
                  placeholder="搜索球场名称"
                  placeholderTextColor={GOLF.muted}
                  returnKeyType="search"
                  onSubmitEditing={async () => {
                    if (!courseSearchQuery.trim()) return;
                    setCourseSearching(true);
                    try {
                      const results = await searchCourses(courseSearchQuery);
                      setCourseResults(results);
                      if (results.length === 0 && !selectedCourse) {
                        setCourseName(courseSearchQuery.trim());
                      }
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
                      if (results.length === 0 && !selectedCourse) {
                        setCourseName(courseSearchQuery.trim());
                      }
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
                <Text style={{ color: GOLF.muted, fontSize: 12, marginTop: 6 }}>
                  未找到球场库记录，将使用「{resolvedCourseName || courseSearchQuery.trim()}」作为本场名称
                </Text>
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
                <Pressable
                  key={h}
                  onPress={() => {
                    setHoles(h);
                    if (h === 18) setStartingHole(1);
                  }}
                  style={[styles.chip, on && styles.chipOn]}
                >
                  <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{h} 洞</Text>
                </Pressable>
              );
            })}
          </View>

          {holes === 9 ? (
            <View style={{ marginTop: 10 }}>
              <Text style={styles.label}>从哪九洞开始</Text>
              <View style={styles.row}>
                {[
                  { value: 1, label: '前9（1-9洞）' },
                  { value: 10, label: '后9（10-18洞）' },
                ].map(({ value, label }) => {
                  const on = value === startingHole;
                  return (
                    <Pressable
                      key={value}
                      onPress={() => setStartingHole(value)}
                      style={[styles.chip, on && styles.chipOn]}
                    >
                      <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

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

        <Pressable
          onPress={() => setMoreSettingsOpen((v) => !v)}
          style={styles.moreSettingsHead}
        >
          <Text style={styles.moreSettingsTxt}>
            ⚙ 更多设置 {moreSettingsOpen ? '▲' : '▼'}
          </Text>
        </Pressable>

        {moreSettingsOpen ? (
          <View style={styles.card}>
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
        ) : null}
        </>
        ) : null}

        {step === 2 ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>邀请球友</Text>
          <Text style={styles.sectionSub}>搜索已注册用户，或直接添加访客</Text>

          <View style={styles.searchRow}>
            <TextInput
              style={[styles.input, styles.searchInputFlex]}
              value={friendQuery}
              onChangeText={setFriendQuery}
              placeholder="例如 golfer@example.com 或 Lee"
              placeholderTextColor={GOLF.muted}
              autoCapitalize="none"
            />
            <Pressable style={[styles.searchBtn, searching && styles.disabled]} onPress={onSearch} disabled={searching}>
              {searching ? <ActivityIndicator color="#fff" /> : <Text style={styles.searchBtnTxt}>搜索</Text>}
            </Pressable>
            <Pressable style={styles.guestAddBtn} onPress={() => setGuestModalOpen(true)} hitSlop={6}>
              <Text style={styles.guestAddBtnTxt}>+ 添加访客</Text>
            </Pressable>
          </View>

          {picked.length === 0 ? (
            <Text style={styles.friendsEmptyHint}>
              不添加则仅记录本人成绩，可在「只记自己，跳过」后直接开始
            </Text>
          ) : null}

          {searchResults.map((u) => {
            const on = picked.some((x) => x.type === 'registered' && x.userId === u.userId);
            const initial = (u.username || '?').trim().slice(0, 1).toUpperCase();
            return (
              <Pressable key={u.userId} onPress={() => togglePickRegistered(u)} style={styles.pickRow}>
                <View style={styles.pickRowLeft}>
                  <View style={styles.buddyAvReg}>
                    <Text style={styles.buddyAvTxt}>{initial}</Text>
                  </View>
                  <Text style={styles.pickName}>{u.username}</Text>
                  <View style={styles.badgeReg}>
                    <Text style={styles.badgeRegTxt}>已注册</Text>
                  </View>
                </View>
                <Text style={[styles.pickMeta, on && { color: GOLF.accent }]}>{on ? '已添加' : '添加'}</Text>
              </Pressable>
            );
          })}

          {picked.length > 0 ? (
            <View style={styles.pickedWrap}>
              <Text style={styles.pickedTitle}>已添加</Text>
              {picked.map((p) => (
                <View key={p.type === 'guest' ? p.id : p.userId} style={styles.buddyPickedRow}>
                  {p.type === 'registered' ? (
                    <View style={styles.buddyAvReg}>
                      <Text style={styles.buddyAvTxt}>{(p.name || '?').trim().slice(0, 1).toUpperCase()}</Text>
                    </View>
                  ) : (
                    <View style={styles.buddyAvGuest}>
                      <Text style={styles.buddyGuestIcon}>👤</Text>
                    </View>
                  )}
                  <View style={styles.buddyPickedMid}>
                    <View style={styles.buddyPickedNameRow}>
                      <Text style={styles.buddyPickedName} numberOfLines={1}>
                        {p.name}
                      </Text>
                      {p.type === 'registered' ? (
                        <View style={styles.badgeReg}>
                          <Text style={styles.badgeRegTxt}>已注册</Text>
                        </View>
                      ) : (
                        <View style={styles.badgeGuest}>
                          <Text style={styles.badgeGuestTxt}>访客</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <Pressable onPress={() => removeBuddy(p)} hitSlop={10}>
                    <Text style={styles.buddyRemove}>移除</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
        </View>
        ) : null}

        {step === 2 && picked.length >= 3 ? (
          <View style={styles.groupSection}>
            <Text style={styles.groupTitle}>分同场组（可选）</Text>
            <Text style={styles.groupHint}>同组各自记分，排行榜跨组汇总</Text>

            <View style={styles.groupRow}>
              <Text style={styles.groupName} numberOfLines={1}>
                {displayName || '我'}（我）
              </Text>
              <View style={styles.groupChips}>
                {[1, 2, 3, 4].map((g) => (
                  <Pressable
                    key={`creator-g${g}`}
                    style={
                      (groupAssignments['creator'] ?? 1) === g ? styles.groupChipOn : styles.groupChipOff
                    }
                    onPress={() => setGroupAssignments((prev) => ({ ...prev, creator: g }))}
                  >
                    <Text
                      style={
                        (groupAssignments['creator'] ?? 1) === g
                          ? styles.groupChipTxtOn
                          : styles.groupChipTxtOff
                      }
                    >
                      {g}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {picked.map((c, i) => (
              <View key={c.type === 'guest' ? c.id : c.userId} style={styles.groupRow}>
                <Text style={styles.groupName} numberOfLines={1}>
                  {c.name || c.username || c.email || '访客'}
                </Text>
                <View style={styles.groupChips}>
                  {[1, 2, 3, 4].map((g) => (
                    <Pressable
                      key={`${i}-g${g}`}
                      style={(groupAssignments[i] ?? 1) === g ? styles.groupChipOn : styles.groupChipOff}
                      onPress={() => setGroupAssignments((prev) => ({ ...prev, [i]: g }))}
                    >
                      <Text
                        style={
                          (groupAssignments[i] ?? 1) === g ? styles.groupChipTxtOn : styles.groupChipTxtOff
                        }
                      >
                        {g}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {step === 3 ? (
        <View style={styles.card}>
          {betMode && BET_MODE_PARAM_TO_FMT[betMode] ? (
            <View style={styles.betModeHint}>
              <Text style={styles.betModeHintTxt}>
                🎲 已为你预选「
                {BET_FORMATS.find((f) => f.key === BET_MODE_PARAM_TO_FMT[betMode])?.title}
                」
              </Text>
            </View>
          ) : null}
          <View style={styles.modeTabs}>
            <Pressable
              onPress={() => setMode('score')}
              style={[styles.modeTab, mode === 'score' && styles.modeTabOn]}
            >
              <Text style={[styles.modeTabTxt, mode === 'score' && styles.modeTabTxtOn]}>📝 只记成绩</Text>
            </Pressable>
            <Pressable
              onPress={() => setMode('wager')}
              style={[styles.modeTab, mode === 'wager' && styles.modeTabOn]}
            >
              <Text style={[styles.modeTabTxt, mode === 'wager' && styles.modeTabTxtOn]}>🎲 赌球</Text>
            </Pressable>
          </View>

          {mode === 'wager' ? (
            <>
              {betDrafts.map((bd, idx) => {
                const playerCount = 1 + picked.length;
                const title = `赌局 ${idx + 1}`;
                const lasiVegasUi =
                  (bd.gameType === 'fixed_lasi' || bd.gameType === 'rotating_lasi') &&
                  bd.lasiScoreMode !== 'match';
                const showTieHandling =
                  bd.gameType === 'match_play' ||
                  bd.gameType === 'fixed_lasi' ||
                  bd.gameType === 'rotating_lasi';
                const tieVal =
                  bd.gameType === 'match_play' ||
                  ((bd.gameType === 'fixed_lasi' || bd.gameType === 'rotating_lasi') &&
                    bd.lasiScoreMode === 'match')
                    ? bd.tieRule ?? 'void'
                    : bd.vegasTieRule ?? 'carry';
                const fmtKey = bd.fmt ?? 'solo';
                const needsScoringStep =
                  fmtKey === 'solo' ||
                  fmtKey === 'nassau' ||
                  fmtKey === 'fixed_lasi' ||
                  fmtKey === 'rotating_lasi';

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

                    <Text style={styles.label}>① 选游戏格式</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.fmtHorizScroll}
                    >
                      {BET_FORMATS.map((f) => {
                        const ok = isFormatPlayerCountOk(f, playerCount);
                        const selected = fmtKey === f.key;
                        return (
                          <View
                            key={f.key}
                            style={[
                              styles.fmtHorizCard,
                              selected && styles.fmtHorizCardOn,
                              !ok && styles.fmtCardDis,
                            ]}
                          >
                            <Pressable
                              style={styles.fmtHorizMain}
                              disabled={!ok}
                              onPress={() => {
                                if (!ok) return;
                                setBetDrafts((prev) =>
                                  prev.map((x) =>
                                    x.id === bd.id ? defaultDraftPatchFromFormat(f.key, x) : x,
                                  ),
                                );
                              }}
                            >
                              <Text style={[styles.fmtHorizEmoji, !ok && styles.fmtMuted]}>
                                {FORMAT_EMOJI[f.key] ?? '🎯'}
                              </Text>
                              <Text style={[styles.fmtHorizTitle, !ok && styles.fmtMuted]}>{f.title}</Text>
                              <Text style={[styles.fmtHorizPlayers, !ok && styles.fmtMuted]}>
                                {f.playersLabel}
                              </Text>
                            </Pressable>
                            <Pressable
                              style={styles.fmtHelpHoriz}
                              hitSlop={10}
                              onPress={() => Alert.alert(f.title, formatHelpBlurb(f))}
                            >
                              <Text style={styles.fmtHelpTxt}>?</Text>
                            </Pressable>
                          </View>
                        );
                      })}
                    </ScrollView>

                    {needsScoringStep ? (
                      <>
                        <Text style={styles.label}>② 选计分方式</Text>
                        {fmtKey === 'solo' ? (
                          <View style={styles.scoringRow}>
                            {[
                              { gt: 'match_play', label: '比洞' },
                              { gt: 'stroke_play', label: '比杆' },
                              { gt: 'stableford', label: '三分赛（Stableford）' },
                              { gt: 'points_8421', label: '8421' },
                            ].map((opt) => {
                              const ok = isPlayerCountOkForGame(opt.gt, playerCount);
                              const on = bd.gameType === opt.gt;
                              return (
                                <Pressable
                                  key={opt.gt}
                                  disabled={!ok}
                                  onPress={() => {
                                    if (!ok) return;
                                    setBetDrafts((prev) =>
                                      prev.map((x) =>
                                        x.id === bd.id
                                          ? {
                                              ...x,
                                              fmt: 'solo',
                                              gameType: opt.gt,
                                              lasiScoreMode: null,
                                              eventConfig: defaultEventConfig(
                                                Number(digitsOnly(x.unitStr || '1000')) || 1000,
                                              ),
                                              hangSectionOpen: true,
                                            }
                                          : x,
                                      ),
                                    );
                                  }}
                                  style={[
                                    styles.scoreChip,
                                    on && styles.scoreChipOn,
                                    !ok && styles.scoreChipDis,
                                  ]}
                                >
                                  <Text style={[styles.scoreChipTxt, on && styles.scoreChipTxtOn]}>
                                    {opt.label}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        ) : null}

                        {fmtKey === 'nassau' ? (
                          <View style={styles.scoringRow}>
                            {[
                              { key: 'holes', label: '比洞' },
                              { key: 'stroke', label: '比杆' },
                            ].map((opt) => {
                              const on = (bd.nassauScoreMode ?? 'holes') === opt.key;
                              return (
                                <Pressable
                                  key={opt.key}
                                  onPress={() =>
                                    setBetDrafts((prev) =>
                                      prev.map((x) =>
                                        x.id === bd.id
                                          ? {
                                              ...x,
                                              fmt: 'nassau',
                                              gameType: 'nassau_pack',
                                              nassauScoreMode: opt.key,
                                            }
                                          : x,
                                      ),
                                    )
                                  }
                                  style={[styles.scoreChip, on && styles.scoreChipOn]}
                                >
                                  <Text style={[styles.scoreChipTxt, on && styles.scoreChipTxtOn]}>
                                    {opt.label}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        ) : null}

                        {(bd.fmt === 'fixed_lasi' || bd.fmt === 'rotating_lasi') ? (
                          <View style={styles.scoringRow}>
                            {[
                              { mode: 'vegas', label: 'Las Vegas拼分' },
                              { mode: 'match', label: '比洞' },
                            ].map((opt) => {
                              const gt = fmtKey === 'fixed_lasi' ? 'fixed_lasi' : 'rotating_lasi';
                              const on = bd.gameType === gt && bd.lasiScoreMode === opt.mode;
                              return (
                                <Pressable
                                  key={opt.mode}
                                  onPress={() =>
                                    setBetDrafts((prev) =>
                                      prev.map((x) =>
                                        x.id === bd.id
                                          ? {
                                              ...x,
                                              fmt: fmtKey,
                                              gameType: gt,
                                              lasiScoreMode: opt.mode,
                                              eventConfig: defaultEventConfig(
                                                Number(digitsOnly(x.unitStr || '1000')) || 1000,
                                              ),
                                              hangSectionOpen: opt.mode === 'vegas',
                                            }
                                          : x,
                                      ),
                                    )
                                  }
                                  style={[styles.scoreChip, on && styles.scoreChipOn]}
                                >
                                  <Text style={[styles.scoreChipTxt, on && styles.scoreChipTxtOn]}>
                                    {opt.label}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        ) : null}
                      </>
                    ) : (
                      <Text style={styles.fmtPickedHint}>
                        已选：{catalogEntry(bd.gameType)?.title ?? bd.gameType}
                      </Text>
                    )}

                    {showTieHandling ? (
                      <>
                        <Text style={styles.label}>平局处理</Text>
                        <View style={styles.row}>
                          {[
                            { key: 'void', label: '作废' },
                            { key: 'carry', label: '累积' },
                            { key: 'double', label: '翻倍' },
                          ].map((opt) => {
                            const on = tieVal === opt.key;
                            return (
                              <Pressable
                                key={opt.key}
                                onPress={() =>
                                  setBetDrafts((prev) =>
                                    prev.map((x) => {
                                      if (x.id !== bd.id) return x;
                                      const useVegasTie =
                                        (x.gameType === 'fixed_lasi' || x.gameType === 'rotating_lasi') &&
                                        x.lasiScoreMode !== 'match';
                                      if (useVegasTie) return { ...x, vegasTieRule: opt.key };
                                      return { ...x, tieRule: opt.key };
                                    }),
                                  )
                                }
                                style={[styles.chip, on && styles.chipOn]}
                              >
                                <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{opt.label}</Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </>
                    ) : null}

                    {lasiVegasUi ? (
                      <>
                        <Text style={styles.label}>Las Vegas 额外设置</Text>
                        <Text style={styles.label}>老鹰倍数</Text>
                        <View style={styles.row}>
                          {[
                            { key: 1, label: '×1' },
                            { key: 2, label: '×2' },
                            { key: 3, label: '×3' },
                          ].map((opt) => {
                            const em = bd.eagleMultiplier ?? 2;
                            const on = em === opt.key;
                            return (
                              <Pressable
                                key={String(opt.key)}
                                onPress={() =>
                                  setBetDrafts((prev) =>
                                    prev.map((x) =>
                                      x.id === bd.id ? { ...x, eagleMultiplier: opt.key } : x,
                                    ),
                                  )
                                }
                                style={[styles.chip, on && styles.chipOn]}
                              >
                                <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{opt.label}</Text>
                              </Pressable>
                            );
                          })}
                        </View>

                        <View style={styles.vegasSwitchRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.label}>双柏忌翻倍</Text>
                            <Text style={{ color: GOLF.muted, fontSize: 12, marginTop: 2 }}>
                              一方双柏忌且对方没有时，分差翻倍（默认关）
                            </Text>
                          </View>
                          <Switch
                            value={Boolean(bd.doubleBogeyFlip)}
                            onValueChange={(v) =>
                              setBetDrafts((prev) =>
                                prev.map((x) => (x.id === bd.id ? { ...x, doubleBogeyFlip: v } : x)),
                              )
                            }
                            trackColor={{ false: '#2d3d32', true: '#3d5c2a' }}
                            thumbColor={bd.doubleBogeyFlip ? '#c9ff4a' : '#8a9a8e'}
                          />
                        </View>
                      </>
                    ) : null}

                    <Text style={styles.label}>单位金额（默认 1000）</Text>
                    <TextInput
                      style={styles.input}
                      value={bd.unitStr}
                      onChangeText={(v) => {
                        const unitStr = digitsOnly(v);
                        const uNum = Number(unitStr) || 1000;
                        setBetDrafts((prev) =>
                          prev.map((x) => {
                            if (x.id !== bd.id) return x;
                            const ec = x.eventConfig
                              ? patchEventAmountsFromUnit(x.eventConfig, uNum)
                              : defaultEventConfig(uNum);
                            return { ...x, unitStr, eventConfig: ec };
                          }),
                        );
                      }}
                      placeholder="1000"
                      placeholderTextColor={GOLF.muted}
                      keyboardType="number-pad"
                    />

                    <Pressable
                      onPress={() =>
                        setBetDrafts((prev) =>
                          prev.map((x) =>
                            x.id === bd.id
                              ? { ...x, hangSectionOpen: !(x.hangSectionOpen ?? true) }
                              : x,
                          ),
                        )
                      }
                      style={styles.hangFoldHead}
                    >
                      <Text style={styles.label}>
                        挂花设置 {(bd.hangSectionOpen ?? true) ? '▲' : '▼'}
                      </Text>
                      <Text style={{ color: GOLF.muted, fontSize: 11 }}>小鸟/老鹰等点对点零和</Text>
                    </Pressable>

                    {(bd.hangSectionOpen ?? true) && bd.eventConfig ? (
                      <View style={styles.hangBlock}>
                        {(
                          [
                            ['birdieEnabled', 'birdieAmount', '小鸟奖励'],
                            ['eagleEnabled', 'eagleAmount', '老鹰奖励'],
                            ['albatrossEnabled', 'albatrossAmount', '信天翁'],
                            ['sandSaveEnabled', 'sandSaveAmount', '沙坑救帕'],
                            ['parTrainEnabled', 'parTrainAmount', '帕连（≥N洞）'],
                            ['waterHazardEnabled', 'waterHazardAmount', '下水罚金'],
                            ['outOfBoundsEnabled', 'outOfBoundsAmount', '出界罚金'],
                          ]
                        ).map(([enKey, amtKey, label]) => (
                          <View key={enKey} style={styles.hangRow}>
                            <View style={{ flex: 1, minWidth: 120 }}>
                              <Text style={{ color: '#a8b5ac', fontSize: 13, fontWeight: '700' }}>{label}</Text>
                            </View>
                            <Switch
                              value={Boolean(bd.eventConfig[enKey])}
                              onValueChange={(on) =>
                                setBetDrafts((prev) =>
                                  prev.map((x) =>
                                    x.id === bd.id && x.eventConfig
                                      ? { ...x, eventConfig: { ...x.eventConfig, [enKey]: on } }
                                      : x,
                                  ),
                                )
                              }
                              trackColor={{ false: '#2d3d32', true: '#3d5c2a' }}
                              thumbColor={bd.eventConfig[enKey] ? '#c9ff4a' : '#8a9a8e'}
                            />
                            <TextInput
                              style={[styles.input, styles.hangAmtIn]}
                              value={String(bd.eventConfig[amtKey] ?? 0)}
                              onChangeText={(t) => {
                                const n = Math.max(0, Math.round(Number(digitsOnly(t)) || 0));
                                setBetDrafts((prev) =>
                                  prev.map((x) =>
                                    x.id === bd.id && x.eventConfig
                                      ? { ...x, eventConfig: { ...x.eventConfig, [amtKey]: n } }
                                      : x,
                                  ),
                                );
                              }}
                              keyboardType="number-pad"
                              placeholder="0"
                              placeholderTextColor={GOLF.muted}
                            />
                          </View>
                        ))}
                        {bd.eventConfig.parTrainEnabled ? (
                          <View style={styles.hangRow}>
                            <Text style={{ color: '#a8b5ac', fontSize: 13, fontWeight: '700', flex: 1 }}>
                              帕连最少洞数
                            </Text>
                            <TextInput
                              style={[styles.input, styles.hangAmtIn]}
                              value={String(bd.eventConfig.parTrainMinStreak ?? 3)}
                              onChangeText={(t) => {
                                const raw = Math.max(2, Math.min(18, Math.round(Number(digitsOnly(t)) || 3)));
                                setBetDrafts((prev) =>
                                  prev.map((x) =>
                                    x.id === bd.id && x.eventConfig
                                      ? { ...x, eventConfig: { ...x.eventConfig, parTrainMinStreak: raw } }
                                      : x,
                                  ),
                                );
                              }}
                              keyboardType="number-pad"
                            />
                          </View>
                        ) : null}
                      </View>
                    ) : null}

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
                    {
                      id: makeBetDraftId(),
                      fmt: 'solo',
                      gameType: 'match_play',
                      lasiScoreMode: null,
                      nassauScoreMode: 'holes',
                      unitStr: '1000',
                      settlementTiming: 'per_hole',
                      tieRule: 'void',
                      vegasTieRule: 'carry',
                      eagleMultiplier: 2,
                      doubleBogeyFlip: false,
                      hangSectionOpen: false,
                      eventConfig: defaultEventConfig(1000),
                    },
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
        ) : null}
      </ScrollView>

      {step === 1 ? (
        <View style={[styles.footer, isTab && styles.footerTab]}>
          <Pressable
            style={[styles.footerPrimarySolo, !canCreate && styles.disabled]}
            onPress={() => goStep(2)}
            disabled={!canCreate}
          >
            <Text style={styles.footerPrimaryTxt}>下一步 →</Text>
          </Pressable>
        </View>
      ) : null}

      {step === 2 ? (
        <View style={[styles.footer, isTab && styles.footerTab]}>
          <Pressable onPress={() => goStep(3)} style={styles.footerLinkWrap}>
            <Text style={styles.footerLink}>只记自己，跳过</Text>
          </Pressable>
          <View style={styles.footerRow}>
            <Pressable style={styles.footerGhost} onPress={() => goStep(1)}>
              <Text style={styles.footerGhostTxt}>← 上一步</Text>
            </Pressable>
            <Pressable style={styles.footerPrimary} onPress={() => goStep(3)}>
              <Text style={styles.footerPrimaryTxt}>下一步 →</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {step === 3 ? (
        <View style={[styles.footer, isTab && styles.footerTab]}>
          <Pressable
            onPress={() => {
              setMode('score');
              void onCreate({ scoreOnly: true });
            }}
            style={styles.footerLinkWrap}
            disabled={creating || !canCreate}
          >
            <Text style={[styles.footerLink, (creating || !canCreate) && styles.footerLinkDisabled]}>
              {creating ? '创建中…' : '不赌球，直接开始'}
            </Text>
          </Pressable>
          <View style={styles.footerRow}>
            <Pressable style={styles.footerGhost} onPress={() => goStep(2)} disabled={creating}>
              <Text style={styles.footerGhostTxt}>← 上一步</Text>
            </Pressable>
            <Pressable
              style={[styles.footerPrimary, (!canCreate || creating) && styles.disabled]}
              onPress={() => void onCreate()}
              disabled={!canCreate || creating}
            >
              {creating ? (
                <ActivityIndicator color="#07120b" />
              ) : (
                <Text style={styles.footerPrimaryTxt}>开始记分</Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : null}
    </KeyboardAvoidingView>

    <Modal
      visible={guestModalOpen}
      transparent
      animationType="fade"
      onRequestClose={() => {
        setGuestModalOpen(false);
        setGuestNameDraft('');
      }}
    >
      <Pressable
        style={styles.guestModalMask}
        onPress={() => {
          setGuestModalOpen(false);
          setGuestNameDraft('');
        }}
      >
        <Pressable style={styles.guestModalSheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.guestModalTit}>添加访客</Text>
          <Text style={styles.guestModalSub}>访客无需注册账号，仅本场记分使用</Text>
          <TextInput
            style={styles.input}
            value={guestNameDraft}
            onChangeText={setGuestNameDraft}
            placeholder="访客名字（必填）"
            placeholderTextColor={GOLF.muted}
            autoFocus
          />
          <View style={styles.guestModalActions}>
            <Pressable
              style={styles.guestModalBtnGhost}
              onPress={() => {
                setGuestModalOpen(false);
                setGuestNameDraft('');
              }}
            >
              <Text style={styles.guestModalBtnGhostTxt}>取消</Text>
            </Pressable>
            <Pressable style={styles.guestModalBtnOk} onPress={confirmAddGuest}>
              <Text style={styles.guestModalBtnOkTxt}>确认</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#0d1b11' },
  // Web(Tab 内) 原 paddingTop=44 会造成明显“顶端空白”；同时底部需要更大 padding 才不被 TabBar 遮挡
  scroll: {
    flexGrow: 1,
    padding: 16,
    paddingTop: STACK_SCREEN_TOP_PADDING,
    // Web：额外预留 TabBar + 一点呼吸区，避免“最后一项贴着 TabBar/被压住”的观感
    paddingBottom: (Platform.OS === 'web' ? 96 : 40) + TAB_BAR_SCROLL_EXTRA,
  },
  /** 开局 Tab：顶栏由 ScreenHeader 承担，滚动区不再叠标题顶距 */
  scrollTabBody: { paddingTop: 0, paddingHorizontal: 18 },
  scrollStep: { paddingBottom: 88 + TAB_BAR_SCROLL_EXTRA },
  stepBar: {
    backgroundColor: '#07120b',
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  stepColsRow: { flexDirection: 'row', alignItems: 'flex-start' },
  stepCol: { flex: 1, alignItems: 'center', paddingVertical: 2 },
  stepDot: { width: 10, height: 10, borderRadius: 5, marginBottom: 6 },
  stepDotActive: { backgroundColor: '#c9ff4a' },
  stepDotDone: { backgroundColor: '#8a9a8e' },
  stepDotReachable: {
    borderWidth: 1.5,
    borderColor: 'rgba(201,255,74,0.55)',
    backgroundColor: 'rgba(201,255,74,0.15)',
  },
  stepDotIdle: {
    borderWidth: 1.5,
    borderColor: '#5a6b5f',
    backgroundColor: 'transparent',
  },
  stepLabel: { color: '#8a9a8e', fontSize: 11, fontWeight: '700' },
  stepLabelActive: { color: '#c9ff4a', fontWeight: '800' },
  stepLabelReachable: { color: 'rgba(201,255,74,0.75)', fontWeight: '700' },
  footerTab: { paddingBottom: 12 + TAB_BAR_SCROLL_EXTRA },
  betModeHint: {
    backgroundColor: 'rgba(201,255,74,0.10)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(201,255,74,0.25)',
    padding: 10,
    marginBottom: 12,
  },
  betModeHintTxt: { color: '#c9ff4a', fontSize: 13, fontWeight: '700' },
  friendsEmptyHint: {
    color: '#5a6b5f',
    fontSize: 12,
    marginTop: 8,
    lineHeight: 17,
  },
  moreSettingsHead: { paddingVertical: 10, paddingHorizontal: 4, marginBottom: 6 },
  moreSettingsTxt: { color: '#c9ff4a', fontSize: 14, fontWeight: '800' },
  modeTabs: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    marginBottom: 12,
  },
  modeTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  modeTabOn: { borderBottomColor: '#c9ff4a' },
  modeTabTxt: { color: '#8a9a8e', fontSize: 15, fontWeight: '700' },
  modeTabTxtOn: { color: '#c9ff4a', fontWeight: '900' },
  fmtHorizScroll: { paddingVertical: 4, gap: 10, paddingRight: 8 },
  fmtHorizCard: {
    width: 110,
    height: 90,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#102018',
    marginRight: 10,
    overflow: 'hidden',
  },
  fmtHorizCardOn: {
    borderWidth: 1.5,
    borderColor: '#c9ff4a',
    backgroundColor: 'rgba(201,255,74,0.10)',
  },
  fmtHorizMain: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    paddingHorizontal: 6,
  },
  fmtHorizEmoji: { fontSize: 22, marginBottom: 4 },
  fmtHorizTitle: { color: '#e8f0e5', fontSize: 15, fontWeight: '800' },
  fmtHorizPlayers: { color: '#8a9a8e', fontSize: 11, fontWeight: '600', marginTop: 2 },
  fmtHelpHoriz: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    elevation: 20,
    backgroundColor: '#07120b',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingBottom: Platform.OS === 'web' ? 12 + TAB_BAR_SCROLL_EXTRA : 12,
  },
  footerRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  footerGhost: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  footerGhostTxt: { color: '#a8b5ac', fontSize: 15, fontWeight: '800' },
  footerPrimary: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#c9ff4a',
    paddingVertical: 14,
    alignItems: 'center',
  },
  footerPrimarySolo: {
    borderRadius: 12,
    backgroundColor: '#c9ff4a',
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
  },
  footerPrimaryTxt: { color: '#07120b', fontSize: 16, fontWeight: '900' },
  footerLinkWrap: { alignItems: 'center', marginBottom: 10 },
  footerLink: { color: '#c9ff4a', fontSize: 13, fontWeight: '700' },
  footerLinkDisabled: { opacity: 0.45 },
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
  vegasSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
    paddingVertical: 4,
  },
  hangFoldHead: { marginTop: 8, paddingVertical: 6 },
  hangBlock: { marginTop: 4, marginBottom: 4 },
  hangRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  hangAmtIn: { width: 88, marginBottom: 0, paddingVertical: 8, textAlign: 'right' },

  sectionTitle: { color: '#e8f0e5', fontSize: 15, fontWeight: '800' },
  sectionSub: { color: '#5a6b5f', marginTop: 4, lineHeight: 18, fontSize: 12 },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  searchInputFlex: { flex: 1, marginBottom: 0, minWidth: 120 },
  searchBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#c9ff4a',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  searchBtnTxt: { color: '#c9ff4a', fontWeight: '900', fontSize: 14 },
  guestAddBtn: {
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  guestAddBtnTxt: { color: '#c9ff4a', fontWeight: '800', fontSize: 13 },

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
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  pickRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  pickName: { color: '#e8f0e5', fontWeight: '700', flexShrink: 1 },
  pickMeta: { color: '#8a9a8e', fontWeight: '700' },
  pickedWrap: { marginTop: 12 },
  pickedTitle: { color: '#8a9a8e', fontWeight: '700', fontSize: 12, marginBottom: 6 },
  buddyAvReg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(201,255,74,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buddyAvGuest: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buddyAvTxt: { color: '#c9ff4a', fontSize: 15, fontWeight: '900' },
  buddyGuestIcon: { fontSize: 18 },
  badgeReg: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(201,255,74,0.14)',
  },
  badgeRegTxt: { color: '#c9ff4a', fontSize: 10, fontWeight: '800' },
  badgeGuest: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  badgeGuestTxt: { color: '#8a9a8e', fontSize: 10, fontWeight: '700' },
  groupSection: {
    marginTop: 16,
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  groupTitle: { fontSize: 13, fontWeight: '700', color: THEME.text2, marginBottom: 2 },
  groupHint: { fontSize: 11, color: THEME.text3, marginBottom: 12 },
  groupRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  groupName: { flex: 1, fontSize: 13, color: THEME.text2, fontWeight: '600' },
  groupChips: { flexDirection: 'row', gap: 6 },
  groupChipOn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupChipOff: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupChipTxtOn: { fontSize: 13, fontWeight: '800', color: '#07120b' },
  groupChipTxtOff: { fontSize: 13, fontWeight: '600', color: THEME.text3 },
  buddyPickedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  buddyPickedMid: { flex: 1, minWidth: 0 },
  buddyPickedNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  buddyPickedName: { color: '#e8f0e5', fontSize: 15, fontWeight: '700', flexShrink: 1 },
  buddyRemove: { color: '#f87171', fontSize: 13, fontWeight: '700' },
  guestModalMask: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 24,
  },
  guestModalSheet: {
    backgroundColor: '#16261c',
    borderRadius: 14,
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  guestModalTit: { color: '#e8f0e5', fontSize: 18, fontWeight: '900' },
  guestModalSub: { color: '#8a9a8e', fontSize: 13, marginTop: 6, marginBottom: 12, lineHeight: 18 },
  guestModalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 14 },
  guestModalBtnGhost: { paddingVertical: 10, paddingHorizontal: 16 },
  guestModalBtnGhostTxt: { color: '#8a9a8e', fontSize: 15, fontWeight: '700' },
  guestModalBtnOk: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: '#c9ff4a',
  },
  guestModalBtnOkTxt: { color: '#07120b', fontSize: 15, fontWeight: '900' },

  fmtCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#102018',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  fmtCardOn: {
    borderWidth: 1.5,
    borderColor: '#c9ff4a',
    backgroundColor: '#102018',
  },
  fmtCardDis: { opacity: 0.35 },
  fmtCardMain: { flex: 1, paddingRight: 8 },
  fmtTitle: { color: '#e8f0e5', fontSize: 16, fontWeight: '800' },
  fmtPlayers: { color: '#8a9a8e', fontSize: 13, fontWeight: '700', marginTop: 4 },
  fmtSub: { color: '#5a6b5f', fontSize: 12, marginTop: 4, lineHeight: 17 },
  fmtMuted: { opacity: 0.55 },
  fmtHelp: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  fmtHelpTxt: { color: '#c9ff4a', fontSize: 16, fontWeight: '900' },
  fmtPickedHint: { color: '#8a9a8e', fontSize: 13, fontWeight: '600', marginTop: 4, marginBottom: 8 },
  scoringRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
    marginBottom: 10,
  },
  scoreChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  scoreChipOn: {
    borderColor: '#c9ff4a',
    backgroundColor: 'rgba(201,255,74,0.12)',
  },
  scoreChipDis: { opacity: 0.35 },
  scoreChipTxt: { color: '#6b7a6f', fontSize: 13, fontWeight: '700' },
  scoreChipTxtOn: { color: '#c9ff4a', fontWeight: '800' },

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

