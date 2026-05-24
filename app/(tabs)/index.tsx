import { useFocusEffect } from '@react-navigation/native';
import { type Href, router } from 'expo-router';

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useAuth } from '@/contexts/auth-context';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type TextStyle,
} from 'react-native';
import Svg, { Circle, Line, Path, Polygon, Polyline } from 'react-native-svg';

import { RoundLockIndicator } from '@/components/RoundLockIndicator';
import { ScreenHeader } from '@/components/ScreenHeader';
import { fontSize, fontSizeData, TAB_BAR_SCROLL_EXTRA, THEME } from '@/constants/theme';
import {
  buildHandicapTrend,
  calcHandicapIndex,
  compareHandicapRecordsChronologicalAsc,
  equivalent18AdjustedGross,
  loadHandicapRecords,
  normalizeHandicapRecords,
  recordHasPendingRoundStats,
  type HandicapRecord,
} from '@/lib/handicap';
import { getHandicapGoal, isGoalAchieved } from '@/utils/handicapGoal';
import { getTodayBriefingHomeState } from '@/utils/matchDayRecord';
import type { AmendmentRequest } from '@/utils/amendmentTypes';
import { getPendingVotes } from '@/utils/amendmentRequest';
import { isTimeTampered, warmServerTime } from '@/utils/serverTime';
import { AI_TRAINING_CACHE_KEY } from '@/utils/aiCacheKeys';
import { trainingHomeFromLongCache } from '@/utils/parseAiStructured';
import { getAppUserId } from '@/utils/userIdentity';
import { supabase } from '@/lib/supabase';
import { getFollowingFeed, getNearbyFeed } from '@/lib/followsApi';
import { loadSupabaseHandicapRecords } from '@/lib/supabaseToHandicap';

const PAGE_BG = THEME.bg;
const CARD = THEME.card;
const ACCENT = THEME.accent;
const ON_ACCENT = THEME.textOnAccent;
const TEXT_MAIN = THEME.text2;
const TEXT_SEC = THEME.text2;
const TEXT_TER = THEME.text3;
const TEXT_MUTED = THEME.text3;
const WARN = '#e89b3a';
const HERO_BORDER = THEME.accentBorder;
const DIVIDER = 'rgba(255,255,255,0.06)';
const CHIP_MUTED = 'rgba(255,255,255,0.04)';
const CHIP_ACCENT_BG = THEME.accentBg;

const BET_QUICK_PICKS = ['固拉', '乱拉', '斗地主', '喇叭花', 'Nassau', 'Skins'] as const;

const BET_MODE_MAP = {
  固拉: 'las_vegas',
  乱拉: 'random_pair',
  斗地主: 'landlord',
  喇叭花: 'flower',
  Nassau: 'nassau',
  Skins: 'skins',
} as const;

const HERO_MAIN_NUM_LINE = Math.round(fontSizeData.hero * 1.2);
const HERO_GRID_NUM_LINE = Math.round(fontSizeData.heroSecondary * 1.2);
const androidNumPad = Platform.OS === 'android' ? { includeFontPadding: false as const } : {};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return '早上好';
  if (h < 18) return '下午好';
  return '晚上好';
}

function daysSinceLastRoundLabel(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  const d = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (d <= 0) return '今天';
  return `${d} 天`;
}

/** 最近成绩卡片顶行：日期 + 洞数 */
function formatRoundDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  if (!Number.isFinite(d.getTime())) return dateStr;
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

const WEEKDAY_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const;

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

/** WHS 差点：取时间上新近至多 20 场，再在其中按规则取若干最低微差；与 `calcHandicapIndex` 一致 */
function handicapIndexFootnote(totalRounds: number): string {
  if (totalRounds <= 0) return '暂无成绩';
  if (totalRounds < 3) return '至少录入 3 场后可计算差点指数';
  const window = Math.min(totalRounds, 20);
  return `基于近 ${window} 场 · WHS`;
}

function SparkHero({ values }: { values: number[] }) {
  const w = 100;
  const h = 36;
  const padY = 4;
  const plotH = h - padY * 2;
  if (values.length < 2) {
    return <View style={{ width: w, height: h }} />;
  }
  const vmin = Math.min(...values);
  const vmax = Math.max(...values);
  const span = Math.max(vmax - vmin, 0.01);
  const n = values.length;
  const pts = values.map((v, i) => {
    const x = (i / (n - 1)) * w;
    const y = padY + (1 - (v - vmin) / span) * plotH;
    return { x, y };
  });
  const linePts = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaPts = `0,${h} ${linePts} ${w},${h}`;
  const last = pts[pts.length - 1]!;

  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <Polygon points={areaPts} fill={ACCENT} opacity={0.1} />
      <Polyline
        points={linePts}
        fill="none"
        stroke={ACCENT}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={last.x} cy={last.y} r={2.4} fill={ACCENT} />
    </Svg>
  );
}

function IconClock() {
  return (
    <Svg width={12} height={12} viewBox="0 0 12 12">
      <Circle cx={6} cy={6} r={4.5} stroke={TEXT_TER} strokeWidth={1.2} fill="none" />
      <Path
        d="M6 3.5 L6 6 L8 7"
        stroke={TEXT_TER}
        strokeWidth={1.2}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

function IconLamp() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Path
        d="M9 2.5 C 6.5 2.5 5 4.5 5 6.5 C 5 7.8 5.7 8.8 6.3 9.6 L 6.3 11 L 11.7 11 L 11.7 9.6 C 12.3 8.8 13 7.8 13 6.5 C 13 4.5 11.5 2.5 9 2.5 Z"
        stroke={ACCENT}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      <Line
        x1={6.5}
        y1={12.5}
        x2={11.5}
        y2={12.5}
        stroke={ACCENT}
        strokeWidth={1.4}
        strokeLinecap="round"
      />
      <Line
        x1={7.5}
        y1={14.5}
        x2={10.5}
        y2={14.5}
        stroke={ACCENT}
        strokeWidth={1.4}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function IconPlusRound() {
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14">
      <Line
        x1={7}
        y1={2}
        x2={7}
        y2={12}
        stroke={ON_ACCENT}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
      <Line
        x1={2}
        y1={7}
        x2={12}
        y2={7}
        stroke={ON_ACCENT}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** 建议正文：关键数字用强调色（与现有文案数据源一致，仅样式拆分） */
function AiBodyWithHighlights({ body, textStyle }: { body: string; textStyle?: TextStyle }) {
  const parts: ReactNode[] = [];
  const re = /\d+(?:\.\d+)?%?/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(body)) !== null) {
    if (m.index > last) {
      parts.push(<Text key={`t-${k++}`}>{body.slice(last, m.index)}</Text>);
    }
    parts.push(
      <Text key={`n-${k++}`} style={s.aiBodyHighlight}>
        {m[0]}
      </Text>,
    );
    last = m.index + m[0].length;
  }
  if (last < body.length) {
    parts.push(<Text key={`t-${k++}`}>{body.slice(last)}</Text>);
  }
  return <Text style={[s.aiBody, textStyle]}>{parts}</Text>;
}

export default function HomeScreen() {
  const { session } = useAuth();
  const [records, setRecords] = useState<HandicapRecord[]>([]);
  const [displayName, setDisplayName] = useState<string>('');
  const [handicapGoal, setHandicapGoal] = useState<number | null>(null);
  const [briefingPending, setBriefingPending] = useState(false);
  const [timeTamperWarn, setTimeTamperWarn] = useState(false);
  const [timeTamperDismissed, setTimeTamperDismissed] = useState(false);
  const [pendingAmend, setPendingAmend] = useState<AmendmentRequest | null>(null);
  const [trainingCacheText, setTrainingCacheText] = useState<string | null>(null);
  const [activityFeed, setActivityFeed] = useState<any[]>([]);
  const [followingFeed, setFollowingFeed] = useState<any[]>([]);
  const [nearbyFeed, setNearbyFeed] = useState<any[]>([]);
  const [feedTab, setFeedTab] = useState<'all' | 'following' | 'nearby'>('all');
  const [weather, setWeather] = useState<{ label: string; tempC: string } | null>(null);
  const [tipsExpanded, setTipsExpanded] = useState(false);
  const [feedRefreshing, setFeedRefreshing] = useState(false);

  const reloadActivityFeeds = useCallback(async () => {
    const feedSelect =
      'id, course_name, played_at, holes, status, created_at, created_by, profiles!rounds_created_by_fkey(username), scores(hole_number, strokes, user_id)';
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { data: data7 } = await supabase
      .from('rounds')
      .select(feedSelect)
      .eq('visibility', 'public')
      .gte('played_at', sevenDaysAgo)
      .order('created_at', { ascending: false })
      .limit(8);
    let rows = data7 ?? [];
    if (!rows.length) {
      const { data: data30 } = await supabase
        .from('rounds')
        .select(feedSelect)
        .eq('visibility', 'public')
        .gte('played_at', thirtyDaysAgo)
        .order('created_at', { ascending: false })
        .limit(8);
      rows = data30 ?? [];
    }
    setActivityFeed(rows);
    try {
      setFollowingFeed(await getFollowingFeed());
    } catch {
      setFollowingFeed([]);
    }
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      await new Promise<void>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            try {
              setNearbyFeed(await getNearbyFeed(pos.coords.latitude, pos.coords.longitude));
            } catch {
              setNearbyFeed([]);
            }
            resolve();
          },
          () => resolve(),
          { timeout: 5000 },
        );
      });
    }
  }, []);

  const onRefreshFeeds = useCallback(async () => {
    setFeedRefreshing(true);
    try {
      await reloadActivityFeeds();
    } catch {
      /* ignore */
    } finally {
      setFeedRefreshing(false);
    }
  }, [reloadActivityFeeds]);

  useEffect(() => {
    warmServerTime();
    void isTimeTampered().then(setTimeTamperWarn);
    void (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
        const { latitude, longitude } = loc.coords;
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weathercode&timezone=auto`;
        const res = await fetch(url);
        const json = await res.json();
        const temp = Math.round(json.current.temperature_2m);
        const code: number = json.current.weathercode;
        const label = code === 0 ? '晴' : code <= 3 ? '多云' : code <= 67 ? '雨' : code <= 77 ? '雪' : '阴';
        setWeather({ label, tempC: String(temp) });
      } catch { /* ignore */ }
    })();
    // 从 Supabase Profile 读取用户名
    void (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', user.id)
            .maybeSingle();
          if (data?.username) setDisplayName(data.username);
          else if (user.email) setDisplayName(user.email.split('@')[0]);
          else setDisplayName('球友');
        }
      } catch { /* ignore */ }
    })();
  }, []);

  useFocusEffect(
    useCallback(() => {
      let alive = true;

      void (async () => {
        const initial = await loadHandicapRecords();
        if (!alive) return;
        setRecords(initial);
      })();

      // 异步合并 Supabase 成绩
      void loadSupabaseHandicapRecords().then(async (supabaseRecords) => {
        if (!alive) return;
        const local = await loadHandicapRecords();
        const localIds = new Set(local.map((r) => r.id));
        const newOnly = supabaseRecords.filter((r) => !localIds.has(r.id.replace('supabase_', '')));
        if (newOnly.length > 0) setRecords([...local, ...newOnly]);
      });
      void getHandicapGoal().then(setHandicapGoal);
      void getTodayBriefingHomeState().then((x) => {
        if (alive) setBriefingPending(x.pendingBriefing);
      });
      void (async () => {
        const uid = await getAppUserId(session);
        const list = await getPendingVotes(uid);
        if (alive) setPendingAmend(list[0] ?? null);
      })();
      void (async () => {
        try {
          const raw = await AsyncStorage.getItem(AI_TRAINING_CACHE_KEY);
          if (!alive) return;
          if (!raw) {
            setTrainingCacheText(null);
            return;
          }
          const c = JSON.parse(raw) as { text?: unknown };
          setTrainingCacheText(typeof c.text === 'string' ? c.text : null);
        } catch {
          if (alive) setTrainingCacheText(null);
        }
      })();
      void (async () => {
        if (!alive) return;
        try {
          await reloadActivityFeeds();
        } catch { /* ignore */ }
      })();

      return () => {
        alive = false;
      };
    }, [session, reloadActivityFeeds]),
  );

  const normalized = useMemo(() => normalizeHandicapRecords(records), [records]);
  const sorted = useMemo(
    () => [...normalized].sort((a, b) => compareHandicapRecordsChronologicalAsc(b, a)),
    [normalized],
  );
  /** 时间正序，用于「少一场」对比（同日多场按 id 稳定） */
  const sortedAsc = useMemo(
    () => [...normalized].sort(compareHandicapRecordsChronologicalAsc),
    [normalized],
  );
  const lastDate = sorted[0]?.date;

  const hcpIndex = calcHandicapIndex(normalized);
  const hcpStr = typeof hcpIndex === 'number' ? hcpIndex.toFixed(1) : null;
  const heroGoalBadge =
    handicapGoal != null && typeof hcpIndex === 'number' && Number.isFinite(hcpIndex)
      ? isGoalAchieved(hcpIndex, handicapGoal)
        ? { kind: 'done' as const }
        : { kind: 'gap' as const, gap: (hcpIndex - handicapGoal).toFixed(1) }
      : null;

  const trend = useMemo(() => buildHandicapTrend(normalized), [normalized]);
  const trendSeries = useMemo(() => {
    const idxs = trend.map((t) => t.index).filter((x): x is number => x != null);
    return idxs.slice(-8);
  }, [trend]);

  /** 当前指数 vs 去掉时间线上最近一场后的指数（WHS 至少 3 场才有值，故涨跌至少需 4 场） */
  const hiDeltaMeta = useMemo(() => {
    const hiNow = calcHandicapIndex(normalized);
    if (typeof hiNow !== 'number') {
      return {
        delta: null as null | { dir: 'down' | 'up' | 'flat'; abs: number },
        hintLine: null as string | null,
      };
    }
    const rest = sortedAsc.slice(0, -1);
    const hiPrev = rest.length >= 3 ? calcHandicapIndex(rest) : null;
    if (hiPrev == null) {
      return {
        delta: null,
        hintLine: sortedAsc.length === 3 ? '再录入 1 场成绩后，可显示相对上一场登记前的涨跌' : null,
      };
    }
    const d = hiNow - hiPrev;
    const flat = Math.abs(d) < 0.05;
    const delta = flat
      ? { dir: 'flat' as const, abs: 0 }
      : { dir: d < 0 ? ('down' as const) : ('up' as const), abs: round1(Math.abs(d)) };
    return {
      delta,
      hintLine: '较录入上一场登记前',
    };
  }, [normalized, sortedAsc]);

  /** 与成绩页「全部」窗口一致：全部场次参与首页三项滚动统计（不限 20 场） */
  const avgEqGross =
    sorted.length > 0
      ? sorted.reduce((s, r) => s + equivalent18AdjustedGross(r), 0) / sorted.length
      : null;
  const avgScore =
    avgEqGross != null && Number.isFinite(avgEqGross) ? Math.round(avgEqGross * 10) / 10 : null;
  const bestScore =
    sorted.length > 0 ? Math.min(...sorted.map((r) => equivalent18AdjustedGross(r))) : null;
  const puttEligible = sorted.filter(
    (r) => r.holes > 0 && r.totalPutts != null && Number.isFinite(r.totalPutts),
  );
  const avgPutts = puttEligible.length
    ? Math.round(
        puttEligible.reduce((s, r) => s + (r.totalPutts as number), 0) / puttEligible.length,
      )
    : null;
  const avgPuttsPerHoleMini = puttEligible.length
    ? puttEligible.reduce((s, r) => s + (r.totalPutts as number) / r.holes, 0) / puttEligible.length
    : null;
  const girRounds = sorted.filter(
    (r) => r.holes > 0 && r.greensInRegulation != null && Number.isFinite(r.greensInRegulation),
  );
  const avgGir = girRounds.length
    ? Math.round(
        girRounds.reduce((s, r) => s + ((r.greensInRegulation as number) / r.holes) * 100, 0) /
          girRounds.length,
      )
    : null;

  const trainingHomeCache = useMemo(
    () => (trainingCacheText ? trainingHomeFromLongCache(trainingCacheText) : null),
    [trainingCacheText],
  );

  /** AI 建议卡：近 5 场推杆均值（用于动态标题） */
  const avgPuttsForAiCard = useMemo(
    () =>
      sorted.length
        ? sorted.slice(0, 5).reduce((sum, r) => sum + (r.totalPutts ?? 37), 0) / Math.min(sorted.length, 5)
        : 37,
    [sorted],
  );

  /** 与练球分析页同源逻辑：由近期成绩推导建议（无成绩时不展示卡片） */
  const smartBlock = useMemo(() => {
    if (sorted.length === 0) return null;
    if (avgGir != null && avgGir < 38) {
      return {
        title: '加强进攻果岭稳定性',
        body: `近阶段平均 GIR 约 ${avgGir}%，可优先练 100 码内进攻与半挥杆节奏。`,
      };
    }
    if (avgPutts != null && avgPutts > 34) {
      return {
        title: '推杆与短杆效率',
        body: `平均推杆 ${avgPutts}，建议加入节奏一致的推杆练习与距离控制。`,
      };
    }
    if (avgScore != null && avgScore > 88) {
      return {
        title: '稳定全挥杆与开球',
        body: '总杆偏高时，可先巩固开球方向与铁杆击球稳定性。',
      };
    }
    return {
      title: '练 52° 挖起杆距离控制',
      body: '保持近期数据更新，系统会持续根据短板给出训练侧重点。',
    };
  }, [sorted.length, avgGir, avgPutts, avgScore]);

  const defaultSmartCardTitle = trainingHomeCache
    ? '练球分析要点'
    : (smartBlock?.title ?? '');

  const insightSmartCardTitle = useMemo(() => {
    if (avgPuttsForAiCard > 36) return '推杆是当前最大失分点';
    const latest = sorted[0];
    if (
      typeof hcpIndex === 'number' &&
      latest != null &&
      latest.adjustedGrossScore - 72 - hcpIndex > 5
    ) {
      return '实际成绩高于预期，稳定性待提升';
    }
    return defaultSmartCardTitle;
  }, [avgPuttsForAiCard, hcpIndex, sorted, defaultSmartCardTitle]);

  const smartCardTitle = briefingPending ? '赛前战术简报待生成' : insightSmartCardTitle;
  const smartCardBody =
    briefingPending && smartBlock
      ? smartBlock.body
      : briefingPending
        ? '今日已在比赛设置中填写球场，可一键生成针对玩法与同组的赛前简报。'
        : trainingHomeCache
          ? trainingHomeCache.summary
          : (smartBlock?.body ?? '');
  const smartCardGoalLine =
    !briefingPending && trainingHomeCache ? (trainingHomeCache.goal ?? null) : null;
  const smartCardHint = briefingPending
    ? '今日已填写球场，可生成赛前战术'
    : trainingHomeCache
      ? '基于近期练球分析'
      : '基于近期成绩分析';
  const showSmartCard = briefingPending || smartBlock != null;

  const activeFeedList =
    feedTab === 'all' ? activityFeed : feedTab === 'following' ? followingFeed : nearbyFeed;

  const feedEmptyState = useMemo(() => {
    if (feedTab === 'following') {
      return {
        title: '还没有关注的球友动态',
        sub: '去关注球友，一起记录每一轮',
        action: '去关注 →',
        href: '/friends' as Href,
      };
    }
    if (feedTab === 'nearby') {
      let wx = '';
      if (weather) {
        const parts: string[] = [];
        if (weather.label) parts.push(weather.label);
        if (weather.tempC) parts.push(`${weather.tempC}°`);
        if (parts.length) wx = `，今日 ${parts.join(' ')}，适合出去打一场`;
      }
      return {
        title: '附近暂无球友在打球',
        sub: `附近 50km 内暂时没有公开球局${wx}`,
        action: '记录 →',
        href: '/rounds/new' as Href,
      };
    }
    const title = `📍 附近今日${weather?.label ? ` ${weather.label}` : ''}${weather?.tempC ? ` ${weather.tempC}°` : ''}`;
    return {
      title,
      sub: '还没有公开球局，先去记录一轮？',
      action: '记录 →',
      href: '/rounds/new' as Href,
    };
  }, [feedTab, weather]);

  const initial = displayName.charAt(0).toUpperCase();

  return (
    <View style={s.root}>
      <ScreenHeader
        title={`${greeting()}，${displayName}`}
        trailing={
          <View style={s.avatarWrap}>
            <Pressable
              onPress={() => router.push('/settings' as Href)}
              style={s.avatarCircle}
              accessibilityRole="button"
              accessibilityLabel="账户与设置"
            >
              <Text style={s.avatarLetter}>{initial}</Text>
            </Pressable>
            {hcpStr ? (
              <Pressable
                style={s.hcpBadge}
                onPress={() => router.push('/handicap?from=index' as Href)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="查看差点详情"
              >
                <Text style={s.hcpBadgeText}>{hcpStr}</Text>
              </Pressable>
            ) : null}
          </View>
        }
        style={s.homeHeader}
      />
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces
        nestedScrollEnabled
        refreshControl={
          <RefreshControl
            refreshing={feedRefreshing}
            onRefresh={onRefreshFeeds}
            tintColor={ACCENT}
            colors={[ACCENT]}
          />
        }
      >
        {/* 今日状态条；天气为占位，TODO: 接入天气 API */}
        <View style={s.statusStrip}>
          <IconClock />
          <View style={s.statusStripTextCol}>
            <Text style={s.statusStripInner}>
              距上次下场{' '}
              <Text style={s.statusStripStrong}>
                {lastDate ? daysSinceLastRoundLabel(lastDate) : '—'}
              </Text>
              {' · 差点 '}
            </Text>
            <Pressable
              onPress={() => router.push('/handicap?from=index' as Href)}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="查看差点趋势"
            >
              {hiDeltaMeta.delta ? (
                hiDeltaMeta.delta.dir === 'flat' ? (
                  <Text style={[s.deltaInStrip, { color: TEXT_MUTED }]}>持平</Text>
                ) : (
                  <Text
                    style={[
                      s.deltaInStrip,
                      hiDeltaMeta.delta.dir === 'down' ? { color: ACCENT } : { color: WARN },
                    ]}
                  >
                    {hiDeltaMeta.delta.dir === 'down' ? '↓' : '↑'} {hiDeltaMeta.delta.abs}
                  </Text>
                )
              ) : (
                <Text style={[s.deltaInStrip, { color: TEXT_MAIN }]}>{hcpStr ?? '—'}</Text>
              )}
            </Pressable>
            <Text style={s.statusStripInner}>
              {' · '}
              {WEEKDAY_CN[new Date().getDay()]} {weather?.label ?? '—'}{' '}
              <Text style={s.statusStripStrong}>{weather ? `${weather.tempC}°` : ''}</Text>
            </Text>
          </View>
        </View>

        {timeTamperWarn && !timeTamperDismissed ? (
          <View style={s.timeTamperBar}>
            <Text style={s.timeTamperTxt}>检测到设备时间异常，成绩锁定功能可能不准确</Text>
            <Pressable
              hitSlop={10}
              onPress={() => setTimeTamperDismissed(true)}
              accessibilityLabel="关闭时间异常提示"
              accessibilityRole="button"
            >
              <Text style={s.timeTamperClose}>×</Text>
            </Pressable>
          </View>
        ) : null}

        {pendingAmend ? (
          <Pressable
            style={s.amendPendingBar}
            onPress={() => router.push(`/amendment/${pendingAmend.id}` as Href)}
          >
            <Text style={s.amendPendingTxt} numberOfLines={2}>
              {pendingAmend.requesterName} 申请修改 {formatRoundDateLabel(pendingAmend.roundDate)}{' '}
              的成绩，请确认
            </Text>
            <Text style={s.amendPendingChev}>›</Text>
          </Pressable>
        ) : null}

        {/* Hero WHS */}
        <TouchableOpacity
          style={s.heroCard}
          activeOpacity={0.92}
          onPress={() => router.push('/handicap?from=index' as Href)}
        >
          <View style={s.heroTop}>
            <View style={s.heroLeft}>
              <Text style={s.heroLabel}>WHS 差点</Text>
              <View style={s.heroNumRow}>
                <View style={s.heroNumMainCol}>
                  <View style={s.heroBigRow}>
                    <Text style={s.heroBig}>{hcpStr ?? '—'}</Text>
                    {heroGoalBadge?.kind === 'gap' ? (
                      <View style={s.heroGoalPill} accessibilityLabel={`距目标 ${heroGoalBadge.gap}`}>
                        <Text style={s.heroGoalPillTxt}>距目标 {heroGoalBadge.gap}</Text>
                      </View>
                    ) : heroGoalBadge?.kind === 'done' ? (
                      <View style={s.heroGoalPillDone} accessibilityLabel="目标已达成">
                        <Text style={s.heroGoalPillDoneTxt}>目标已达成</Text>
                      </View>
                    ) : null}
                  </View>
                  {sorted.length > 0 && sorted.length < 8 ? (
                    <Text style={s.heroHcpHint}>
                      仅 {sorted.length} 场数据，建议累积 8 场以上
                    </Text>
                  ) : null}
                </View>
                {hiDeltaMeta.delta ? (
                  hiDeltaMeta.delta.dir === 'flat' ? (
                    <Text style={[s.heroDelta, { color: TEXT_MUTED }]}>持平</Text>
                  ) : (
                    <Text
                      style={[
                        s.heroDelta,
                        hiDeltaMeta.delta.dir === 'down' ? { color: ACCENT } : { color: WARN },
                      ]}
                    >
                      {hiDeltaMeta.delta.dir === 'down' ? '↓' : '↑'} {hiDeltaMeta.delta.abs}
                    </Text>
                  )
                ) : null}
              </View>
              <Text style={s.heroFoot}>{handicapIndexFootnote(sorted.length)}</Text>
            </View>
            <View style={s.heroRight}>
              <SparkHero values={trendSeries} />
              <Text style={s.sparkCaption}>指数走势</Text>
            </View>
          </View>
          <View style={s.heroDivider} />
          <View style={s.heroGrid}>
            <Pressable style={s.heroCell} onPress={() => router.push('/(tabs)/score' as Href)}>
              <Text style={s.heroCellLab}>近期均杆</Text>
              <Text style={s.heroCellNum}>
                {avgScore == null
                  ? '—'
                  : Number.isInteger(avgScore)
                    ? String(avgScore)
                    : avgScore.toFixed(1)}
              </Text>
              <Text style={s.heroCellSub}>
                最佳{' '}
                {bestScore == null
                  ? '—'
                  : Number.isInteger(bestScore)
                    ? String(bestScore)
                    : bestScore.toFixed(1)}
              </Text>
            </Pressable>
            <Pressable style={s.heroCell} onPress={() => router.push('/(tabs)/score' as Href)}>
              <Text style={s.heroCellLab}>平均推杆</Text>
              <Text style={s.heroCellNum}>
                {avgPutts != null && Number.isFinite(avgPutts) ? String(avgPutts) : '—'}
              </Text>
              <Text style={s.heroCellSub}>
                每洞{' '}
                {avgPuttsPerHoleMini != null && Number.isFinite(avgPuttsPerHoleMini)
                  ? avgPuttsPerHoleMini.toFixed(2)
                  : '—'}
              </Text>
            </Pressable>
            <Pressable style={s.heroCell} onPress={() => router.push('/(tabs)/score' as Href)}>
              <Text style={s.heroCellLab}>平均 GIR</Text>
              <View style={s.girRow}>
                <Text style={s.heroCellNum}>{avgGir != null ? String(avgGir) : '—'}</Text>
                {avgGir != null ? <Text style={s.girPct}>%</Text> : null}
              </View>
              <Text style={s.heroCellSub}>{girRounds.length} 场</Text>
            </Pressable>
          </View>
          {sorted.length === 0 ? (
            <Text style={s.heroOnboardHint}>录入 3 场成绩后，均杆 · 推杆 · GIR 自动计算</Text>
          ) : null}
        </TouchableOpacity>

        {/* 动态流 */}
        <>
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>⛳ 近期动态</Text>
            <TouchableOpacity onPress={() => router.push('/handicap/history?from=index' as Href)}>
              <Text style={s.seeAll}>查看全部 ›</Text>
            </TouchableOpacity>
          </View>
          <View style={s.feedTabs}>
            {(['all', 'following', 'nearby'] as const).map((t) => (
              <Pressable
                key={t}
                style={[s.feedTabBtn, feedTab === t && s.feedTabBtnOn]}
                onPress={() => setFeedTab(t)}
              >
                <Text style={[s.feedTabTxt, feedTab === t && s.feedTabTxtOn]}>
                  {t === 'all' ? '全部' : t === 'following' ? '关注' : '附近'}
                </Text>
              </Pressable>
            ))}
          </View>
          {activeFeedList.length === 0 ? (
            <View style={s.feedCard}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.feedName} numberOfLines={2}>
                  {feedEmptyState.title}
                </Text>
                <Text style={s.feedMeta}>{feedEmptyState.sub}</Text>
              </View>
              <Pressable
                onPress={() => router.push(feedEmptyState.href)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={feedEmptyState.action}
              >
                <Text style={s.feedEmptyAction}>{feedEmptyState.action}</Text>
              </Pressable>
            </View>
          ) : (
            activeFeedList.map((round: any) => {
              const profile = Array.isArray(round.profiles) ? round.profiles[0] : round.profiles;
              const username = profile?.username ?? '球友';
              const initial = username.charAt(0).toUpperCase();
              const scores: any[] = round.scores ?? [];
              const holesPlayed = new Set(scores.map((s: any) => s.hole_number)).size;
              const totalStrokes = scores.reduce((sum: number, sc: any) => sum + (sc.strokes ?? 0), 0);
              const isLive = round.status === 'in_progress';
              return (
                <TouchableOpacity
                  key={round.id}
                  style={s.feedCard}
                  activeOpacity={0.88}
                  onPress={() => router.push(`/rounds/${round.id}` as Href)}
                >
                  <View style={s.feedAvatarCircle}>
                    <Text style={s.feedAvatarLetter}>{initial}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={s.feedName} numberOfLines={1}>{username}</Text>
                      {isLive ? (
                        <View style={s.liveBadge}>
                          <Text style={s.liveBadgeTxt}>进行中</Text>
                        </View>
                      ) : (
                        <View style={s.doneBadge}>
                          <Text style={s.doneBadgeTxt}>已完成</Text>
                        </View>
                      )}
                    </View>
                    <Text style={s.feedCourse} numberOfLines={1}>{round.course_name || '未命名球场'}</Text>
                    <Text style={s.feedMeta}>
                      {round.holes} 洞 · 已打 {holesPlayed} 洞
                      {totalStrokes > 0 ? ` · 总杆 ${totalStrokes}` : ''}
                      {feedTab === 'nearby' && round.distanceKm != null
                        ? ` · ${round.distanceKm < 1 ? '<1' : Math.round(round.distanceKm)} km`
                        : ''}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </>

        {/* 最近成绩 */}
        <View style={s.sectionHead}>
          <Text style={s.sectionTitle}>最近成绩</Text>
          {sorted.length > 0 ? (
            <TouchableOpacity onPress={() => router.push('/handicap/history?from=index' as Href)}>
              <Text style={s.seeAll}>查看全部 ›</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {sorted.length === 0 ? (
          <View style={s.onboardWrap}>
            <Pressable
              style={[s.onboardCard, s.onboardCardActive]}
              onPress={() => router.push('/settings/profile' as Href)}
              accessibilityRole="button"
              accessibilityLabel="填写个人档案"
            >
              <View style={[s.onboardStepCircle, s.onboardStepCircleOn]}>
                <Text style={s.onboardStepNumOn}>1</Text>
              </View>
              <View style={s.onboardTextCol}>
                <Text style={s.onboardTitle}>填写个人档案</Text>
                <Text style={s.onboardSub}>差点、身高、挥速，让 AI 更了解你</Text>
              </View>
              <Text style={s.onboardChev}>›</Text>
            </Pressable>
            <Pressable
              style={s.onboardCard}
              onPress={() => router.push('/rounds/new' as Href)}
              accessibilityRole="button"
              accessibilityLabel="记录第一场成绩"
            >
              <View style={[s.onboardStepCircle, s.onboardStepCircleMuted]}>
                <Text style={s.onboardStepNumMuted}>2</Text>
              </View>
              <View style={s.onboardTextCol}>
                <Text style={[s.onboardTitle, s.onboardTitleMuted]}>记录第一场成绩</Text>
                <Text style={s.onboardSub}>打完球后录入总杆数，差点自动计算</Text>
              </View>
              <Text style={s.onboardChev}>›</Text>
            </Pressable>
            <Pressable
              style={s.onboardCard}
              onPress={() => router.push('/ai' as Href)}
              accessibilityRole="button"
              accessibilityLabel="获取 AI 建议"
            >
              <View style={[s.onboardStepCircle, s.onboardStepCircleMuted]}>
                <Text style={s.onboardStepNumMuted}>3</Text>
              </View>
              <View style={s.onboardTextCol}>
                <Text style={[s.onboardTitle, s.onboardTitleMuted]}>获取 AI 建议</Text>
                <Text style={s.onboardSub}>3 场成绩后，AI 开始分析你的弱项</Text>
              </View>
              <Text style={s.onboardChev}>›</Text>
            </Pressable>
          </View>
        ) : (
          sorted.slice(0, 3).map((r) => {
            const girPct =
              r.greensInRegulation != null && r.holes
                ? Math.round((r.greensInRegulation / r.holes) * 100)
                : null;
            const fwPct =
              r.fairwaysHit != null &&
              r.fairwaysTotal != null &&
              r.fairwaysTotal > 0 &&
              Number.isFinite(r.fairwaysHit) &&
              Number.isFinite(r.fairwaysTotal)
                ? Math.round((r.fairwaysHit / r.fairwaysTotal) * 100)
                : null;
            const pending = recordHasPendingRoundStats(r);
            return (
              <TouchableOpacity
                key={r.id}
                style={s.roundCard}
                activeOpacity={0.9}
                onPress={() => router.push(`/handicap/${r.id}?from=index` as Href)}
              >
                <View style={s.roundTop}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Text style={s.roundMeta}>
                        {formatRoundDateLabel(r.date)} · {r.holes} 洞
                      </Text>
                      {r.sourceRoundStatus === 'in_progress' ? (
                        <View style={s.liveBadge}>
                          <Text style={s.liveBadgeTxt}>进行中</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={s.courseName} numberOfLines={1}>
                      {r.courseName}
                    </Text>
                  </View>
                  <View style={s.scoreCol}>
                    <View style={s.scoreRow}>
                      <RoundLockIndicator round={r} />
                      <Text style={s.scoreHuge}>{r.adjustedGrossScore}</Text>
                    </View>
                  </View>
                </View>
                <View style={s.chipsRow}>
                  <View style={[s.chip, s.chipAccent]}>
                    <Text style={s.chipAccentTxt}>微差 {r.scoreDifferential.toFixed(1)}</Text>
                  </View>
                  {r.totalPutts != null ? (
                    <View style={s.chip}>
                      <Text style={s.chipTxt}>推杆 {r.totalPutts}</Text>
                    </View>
                  ) : null}
                  {girPct != null ? (
                    <View style={s.chip}>
                      <Text style={s.chipTxt}>GIR {girPct}%</Text>
                    </View>
                  ) : null}
                  {fwPct != null ? (
                    <View style={s.chip}>
                      <Text style={s.chipTxt}>球道 {fwPct}%</Text>
                    </View>
                  ) : null}
                </View>
                {pending ? (
                  <Pressable
                    onPress={() => router.push(`/handicap/${r.id}?from=index` as Href)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="补充统计"
                  >
                    <Text style={s.statsPendingFooter}>+ 补充统计</Text>
                  </Pressable>
                ) : null}
              </TouchableOpacity>
            );
          })
        )}

        {/* 主 CTA */}
        <TouchableOpacity
          style={[s.recordCta, s.recordCtaSecondary]}
          onPress={() => router.push('/rounds/new' as Href)}
          activeOpacity={0.9}
        >
          <Text style={s.recordCtaSecondaryTxt}>+ 记录新一轮</Text>
        </TouchableOpacity>

        <Pressable
          style={s.tipsSectionHead}
          onPress={() => setTipsExpanded((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={tipsExpanded ? '收起今日建议' : '展开今日建议'}
        >
          <View style={s.tipsSectionHeadRow}>
            <Text style={s.tipsSectionHeadLeft}>💡 今日建议</Text>
            <View style={s.tipsSectionHeadRight}>
              {showSmartCard ? (
                <Text style={s.tipsSectionHeadBadge}>基于 {sorted.length} 场</Text>
              ) : null}
              <Text style={s.tipsSectionHeadChev}>{tipsExpanded ? '▼' : '›'}</Text>
            </View>
          </View>
        </Pressable>

        {tipsExpanded ? (
          <>
            {showSmartCard ? (
              <View style={s.aiCard}>
                <View style={s.aiTop}>
                  <View style={s.aiIconWrap}>
                    <IconLamp />
                  </View>
                  <View style={s.aiTextCol}>
                    <Text style={s.aiEyebrow}>📊 基于近期 {sorted.length} 场分析</Text>
                    <Text style={s.aiHint}>{smartCardHint}</Text>
                    <Text style={s.aiTitle}>{smartCardTitle}</Text>
                  </View>
                </View>
                <AiBodyWithHighlights
                  body={smartCardBody}
                  textStyle={{ marginBottom: smartCardGoalLine ? 8 : 12 }}
                />
                {smartCardGoalLine ? (
                  <Text style={s.aiRoundGoal}>→ 下场目标：{smartCardGoalLine}</Text>
                ) : null}
                <TouchableOpacity
                  style={s.aiCta}
                  onPress={() =>
                    briefingPending
                      ? router.push('/(tabs)/bet?openBriefing=1' as Href)
                      : router.push('/training' as Href)
                  }
                  activeOpacity={0.9}
                >
                  <Text style={s.aiCtaTxt}>
                    {briefingPending ? '查看赛前简报 →' : '查看训练建议 →'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <View style={s.betQuickCard}>
              <View style={s.betQuickHead}>
                <Text style={s.betQuickLabel}>🎲 赌法快选</Text>
                <Pressable
                  onPress={() => router.push('/rounds/new' as Href)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="去开局"
                >
                  <Text style={s.betQuickLink}>去开局 ›</Text>
                </Pressable>
              </View>
              <View style={s.betQuickScrollWrap}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.betQuickScroll}
                >
                  {BET_QUICK_PICKS.map((label) => (
                    <Pressable
                      key={label}
                      style={s.betQuickChip}
                      onPress={() =>
                        router.push({
                          pathname: '/rounds/new',
                          params: { betMode: BET_MODE_MAP[label] },
                        } as Href)
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`开局 ${label}`}
                    >
                      <Text style={s.betQuickChipTxt}>{label}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <View style={s.betQuickFade} pointerEvents="none">
                  <View style={[s.betQuickFadeSlice, { opacity: 0 }]} />
                  <View style={[s.betQuickFadeSlice, { opacity: 0.2 }]} />
                  <View style={[s.betQuickFadeSlice, { opacity: 0.45 }]} />
                  <View style={[s.betQuickFadeSlice, { opacity: 0.7 }]} />
                  <View style={[s.betQuickFadeSlice, { opacity: 0.92 }]} />
                  <View style={[s.betQuickFadeSlice, { opacity: 1 }]} />
                </View>
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: PAGE_BG },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 0,
    paddingBottom: 24 + TAB_BAR_SCROLL_EXTRA,
  },
  homeHeader: { paddingBottom: 6 },
  avatarWrap: { position: 'relative' },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(201,255,74,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(201,255,74,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { fontSize: 16, fontWeight: '800', color: ACCENT },
  hcpBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: ACCENT,
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: '#0d1b11',
  },
  hcpBadgeText: { fontSize: 11, fontWeight: '800', color: ON_ACCENT },

  statusStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  statusStripTextCol: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 0,
    rowGap: 2,
  },
  statusStripInner: { fontSize: 11, color: TEXT_TER, fontWeight: '600', lineHeight: 16 },
  statusStripStrong: { color: TEXT_MAIN, fontWeight: '800' },
  deltaInStrip: { fontWeight: '800' },

  timeTamperBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(217,72,72,0.08)',
    borderLeftWidth: 3,
    borderLeftColor: '#d94848',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  timeTamperTxt: { flex: 1, fontSize: 12, fontWeight: '600', color: '#d94848', lineHeight: 17 },
  timeTamperClose: { fontSize: 18, fontWeight: '700', color: '#d94848', paddingHorizontal: 4 },

  amendPendingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(232,155,58,0.08)',
    borderLeftWidth: 3,
    borderLeftColor: '#e89b3a',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  amendPendingTxt: { flex: 1, fontSize: 12, fontWeight: '600', color: '#e89b3a', lineHeight: 17 },
  amendPendingChev: { fontSize: 20, fontWeight: '600', color: '#e89b3a' },

  heroCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 0,
  },
  heroLeft: { flex: 1, minWidth: 0 },
  heroLabel: { fontSize: 11, color: TEXT_TER, marginBottom: 6, fontWeight: '700' },
  heroNumRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' },
  heroNumMainCol: { flex: 1, minWidth: 0 },
  heroBigRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 8,
  },
  heroGoalPill: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    maxWidth: 120,
    alignSelf: 'center',
  },
  heroGoalPillTxt: { fontSize: 9, fontWeight: '600', color: TEXT_TER },
  heroGoalPillDone: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    maxWidth: 140,
    alignSelf: 'center',
  },
  heroGoalPillDoneTxt: { fontSize: 9, fontWeight: '700', color: ACCENT },
  heroBig: {
    fontSize: fontSizeData.hero,
    fontWeight: '800',
    color: ACCENT,
    lineHeight: HERO_MAIN_NUM_LINE,
    letterSpacing: -1.2,
    ...androidNumPad,
  },
  heroHcpHint: {
    fontSize: 10,
    fontWeight: '600',
    color: '#e89b3a',
    marginTop: 4,
  },
  heroDelta: { fontSize: 11, fontWeight: '800' },
  heroFoot: { fontSize: 10, color: TEXT_MUTED, marginTop: 6, fontWeight: '600' },
  heroRight: { alignItems: 'flex-end', paddingTop: 4 },
  sparkCaption: { fontSize: 10, color: TEXT_MUTED, marginTop: 2, fontWeight: '600' },
  heroDivider: {
    height: 1,
    backgroundColor: DIVIDER,
    marginVertical: 14,
    marginHorizontal: -4,
  },
  heroGrid: { flexDirection: 'row', gap: 12, overflow: 'visible' },
  heroOnboardHint: {
    fontSize: 11,
    color: TEXT_MUTED,
    textAlign: 'center',
    paddingTop: 10,
    paddingBottom: 4,
    fontWeight: '600',
  },
  heroCell: { flex: 1, minWidth: 0, overflow: 'visible' },
  heroCellLab: { fontSize: 10, color: TEXT_MUTED, marginBottom: 4, fontWeight: '700' },
  heroCellNum: {
    fontSize: fontSizeData.heroSecondary,
    fontWeight: '800',
    color: TEXT_MAIN,
    letterSpacing: -0.5,
    lineHeight: HERO_GRID_NUM_LINE,
    ...androidNumPad,
  },
  heroCellSub: { fontSize: 10, color: TEXT_MUTED, marginTop: 5, fontWeight: '600' },
  girRow: { flexDirection: 'row', alignItems: 'baseline', gap: 1 },
  girPct: { fontSize: 13, color: TEXT_MUTED, fontWeight: '700' },

  aiCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: HERO_BORDER,
  },
  aiTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  aiIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: 'rgba(181,255,58,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiTextCol: { flex: 1, minWidth: 0 },
  aiEyebrow: { fontSize: 11, color: TEXT_TER, fontWeight: '700' },
  aiHint: { fontSize: 11, color: TEXT_TER, marginTop: 1 },
  aiTitle: { fontSize: 15, fontWeight: '800', color: '#ffffff', marginTop: 2 },
  aiBody: { fontSize: 12, color: TEXT_SEC, lineHeight: 19.2, fontWeight: '500' },
  aiBodyHighlight: { fontSize: 12, color: WARN, fontWeight: '800', lineHeight: 19.2 },
  aiRoundGoal: {
    fontSize: 12,
    fontWeight: '700',
    color: ACCENT,
    lineHeight: 18,
    marginBottom: 12,
  },
  aiCta: {
    width: '100%',
    backgroundColor: ACCENT,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  aiCtaTxt: { fontSize: 12, fontWeight: '800', color: ON_ACCENT },

  betQuickCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  betQuickHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  betQuickLabel: { fontSize: 13, color: TEXT_TER, fontWeight: '700' },
  betQuickLink: { fontSize: 12, color: ACCENT, fontWeight: '700' },
  betQuickScroll: { paddingRight: 4 },
  betQuickChip: {
    backgroundColor: 'rgba(201,255,74,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(201,255,74,0.25)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 8,
  },
  betQuickChipTxt: { fontSize: 13, fontWeight: '700', color: ACCENT },

  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  sectionTitle: { fontSize: fontSizeData.cardTitle, color: TEXT_SEC, fontWeight: '700' },
  seeAll: { fontSize: 11, color: ACCENT, fontWeight: '700' },

  roundCard: {
    position: 'relative',
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  roundTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 8,
  },
  scoreCol: { alignItems: 'flex-end', flexShrink: 0 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  roundMeta: { fontSize: 11, color: TEXT_MUTED, fontWeight: '600', marginBottom: 3 },
  courseName: { fontSize: 14, fontWeight: '700', color: TEXT_MAIN },
  scoreHuge: {
    fontSize: fontSizeData.number,
    fontWeight: '800',
    color: ACCENT,
    letterSpacing: -0.5,
    lineHeight: Math.round(fontSizeData.number * 1.2),
    ...androidNumPad,
  },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    backgroundColor: CHIP_MUTED,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  chipAccent: { backgroundColor: CHIP_ACCENT_BG },
  chipTxt: { fontSize: 11, color: TEXT_SEC, fontWeight: '600' },
  chipAccentTxt: { fontSize: 11, color: ACCENT, fontWeight: '800' },
  statsPendingFooter: {
    marginTop: 8,
    fontSize: 10,
    fontWeight: '700',
    color: ACCENT,
  },
  tipsSectionHead: {
    backgroundColor: CHIP_ACCENT_BG,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 8,
    marginBottom: 10,
  },
  tipsSectionHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  tipsSectionHeadLeft: { fontSize: 14, color: ACCENT, fontWeight: '800' },
  tipsSectionHeadRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tipsSectionHeadBadge: { fontSize: 11, color: TEXT_MUTED, fontWeight: '600' },
  tipsSectionHeadChev: { fontSize: 14, color: ACCENT, fontWeight: '800' },
  betQuickScrollWrap: { position: 'relative' },
  betQuickFade: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 32,
    flexDirection: 'row',
  },
  betQuickFadeSlice: {
    flex: 1,
    backgroundColor: CARD,
  },
  feedEmptyAction: { fontSize: 13, color: ACCENT, fontWeight: '800' },

  recordCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 16,
  },
  recordCtaTxt: { fontSize: 14, fontWeight: '800', color: ON_ACCENT },
  recordCtaSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: ACCENT,
    borderRadius: 14,
  },
  recordCtaSecondaryTxt: { fontSize: 14, fontWeight: '800', color: ACCENT },

  onboardWrap: { gap: 10, marginBottom: 16 },
  onboardCard: {
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#5a6b5f',
  },
  onboardCardActive: {
    borderLeftColor: ACCENT,
  },
  onboardStepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onboardStepCircleOn: {
    backgroundColor: ACCENT,
  },
  onboardStepCircleMuted: {
    backgroundColor: '#2d5436',
  },
  onboardStepNumOn: {
    color: ON_ACCENT,
    fontSize: 14,
    fontWeight: '800',
  },
  onboardStepNumMuted: {
    color: ACCENT,
    fontSize: 14,
    fontWeight: '800',
  },
  onboardTextCol: { flex: 1, minWidth: 0 },
  onboardTitle: {
    color: TEXT_MAIN,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 3,
  },
  onboardTitleMuted: {
    color: TEXT_MAIN,
  },
  onboardSub: {
    color: TEXT_TER,
    fontSize: 12,
    fontWeight: '500',
  },
  onboardChev: { color: TEXT_MUTED, fontSize: 18 },
  emptyText: {
    textAlign: 'center',
    color: TEXT_MUTED,
    fontSize: 13,
    paddingVertical: 20,
    fontWeight: '600',
  },

  feedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  feedAvatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(181,255,58,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedAvatarLetter: { fontSize: 15, fontWeight: '800', color: ACCENT },
  feedName: { fontSize: 14, fontWeight: '700', color: TEXT_MAIN, flex: 1 },
  feedCourse: { fontSize: 12, color: TEXT_SEC, fontWeight: '500', marginTop: 2 },
  feedMeta: { fontSize: 11, color: TEXT_MUTED, fontWeight: '600', marginTop: 3 },
  liveBadge: {
    backgroundColor: 'rgba(181,255,58,0.15)',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  liveBadgeTxt: { fontSize: 10, fontWeight: '700', color: ACCENT },
  doneBadge: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  doneBadgeTxt: { fontSize: 10, fontWeight: '600', color: TEXT_MUTED },

  feedTabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  feedTabBtn: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  feedTabBtnOn: { backgroundColor: 'rgba(181,255,58,0.15)' },
  feedTabTxt: { fontSize: 12, fontWeight: '600', color: TEXT_MUTED },
  feedTabTxtOn: { color: ACCENT, fontWeight: '800' },
  feedEmpty: { paddingVertical: 20, alignItems: 'center' },
  feedEmptyTxt: { fontSize: 13, color: TEXT_MUTED, fontWeight: '600' },
});
