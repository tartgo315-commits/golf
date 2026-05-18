import { useFocusEffect } from '@react-navigation/native';
import { type Href, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  LayoutChangeEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

import { RoundLockIndicator } from '@/components/RoundLockIndicator';
import {
  ScoreAnalyticsTabContent,
  type ScoreAnalyticsTabId,
} from '@/components/ScoreAnalyticsTabContent';
import {
  buildHandicapTrend,
  calcHandicapIndex,
  equivalent18AdjustedGross,
  loadHandicapRecords,
  normalizeHandicapRecords,
  type HandicapRecord,
} from '@/lib/handicap';
import { loadSupabaseHandicapRecords } from '@/lib/supabaseToHandicap';
import {
  fontSize,
  fontSizeData,
  TAB_BAR_SCROLL_EXTRA,
  TAB_SCREEN_TOP_PADDING,
  THEME,
} from '@/constants/theme';
import {
  computeAllStats,
  filterRounds,
  migrateOldData,
  validateRound,
  type RoundData,
  type RoundWindow,
} from '@/src/utils/statsEngine';

const showTermInfo = (title: string, message: string) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

const PAGE_BG = THEME.bg;
const CARD_BG = THEME.card;
const ACCENT = THEME.accent;
const WHITE = THEME.text1;
const SUBTITLE = THEME.text3;
const MUTED = THEME.text3;
const BTN_BG = '#1e3a26';
const BTN_BORDER = '#2d5436';
const SEG_OUTER = THEME.bg;
const SEG_SELECTED = '#2d5436';
const DIVIDER = 'rgba(255,255,255,0.08)';
const TAB_BORDER = 'rgba(255,255,255,0.06)';
const BEST = THEME.text2;
const WORST = THEME.text3;
const SLASH = '#4a5a51';
const TEXT_MAIN = THEME.text2;
const SECTION_TITLE = THEME.text3;
const ROW_META = THEME.text3;
const CHIP_MUTED = 'rgba(255,255,255,0.04)';
const CHIP_ACCENT_BG = THEME.accentBg;

const WINDOW_OPTIONS: RoundWindow[] = ['all', 'last5', 'last10', 'last20'];

const ANALYTICS_TABS: { id: ScoreAnalyticsTabId; label: string }[] = [
  { id: 'overview', label: '总览' },
  { id: 'tee', label: '开球' },
  { id: 'approach', label: '进攻' },
  { id: 'short', label: '短杆' },
  { id: 'putting', label: '推杆' },
  { id: 'sg', label: '失分' },
];

const SCROLL_TAB_ITEM_WIDTH = 56;

/** 差点 trend：数据层暂无序列时由页面传入空数组，不绘制折线 */
const HCP_TREND_PLACEHOLDER: readonly number[] = [];

function toDateMs(date: string): number {
  const t = Date.parse(date);
  return Number.isFinite(t) ? t : 0;
}

function windowButtonLabel(window: RoundWindow, roundsNewestFirst: RoundData[]): string {
  if (window === 'all') return '全部';
  const fr = filterRounds(roundsNewestFirst, window);
  const base = window === 'last5' ? '近5场' : window === 'last10' ? '近10场' : '近20场';
  if (fr.actualCount < fr.requestedCount) return `${base}(${fr.actualCount})`;
  return base;
}

function formatRoundDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  if (!Number.isFinite(d.getTime())) return dateStr;
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 有逐洞数据时计算本场 GIR%；与首页单场展示口径一致 */
function roundGirPct(r: RoundData): number | null {
  if (!r.holes?.length) return null;
  const n = r.holes.length;
  if (n <= 0) return null;
  const gir = r.holes.filter((h) => h.girHit).length;
  return Math.round((gir / n) * 100);
}

function HandicapSparkline({ values }: { values: readonly number[] }) {
  const [w, setW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const next = e.nativeEvent.layout.width;
    if (next > 0) setW(next);
  };

  const h = 32;
  const padX = 2;
  const padY = 4;
  const plotH = h - padY * 2;

  if (values.length < 2 || w <= 0) {
    return <View style={styles.sparkSlot} onLayout={onLayout} />;
  }

  const vmin = Math.min(...values);
  const vmax = Math.max(...values);
  const span = vmax - vmin || 1;
  const n = values.length;
  const pts = values.map((v, i) => {
    const x = padX + (n === 1 ? w / 2 : (i / (n - 1)) * (w - padX * 2));
    const y = padY + (1 - (v - vmin) / span) * plotH;
    return { x, y };
  });
  const pointsStr = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1]!;

  return (
    <View style={styles.sparkSlot} onLayout={onLayout}>
      <Svg width={w} height={h}>
        <Polyline
          points={pointsStr}
          fill="none"
          stroke={ACCENT}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Circle cx={last.x} cy={last.y} r={2.5} fill={ACCENT} />
      </Svg>
    </View>
  );
}

/** 底部「统计」Tab：Header + Hero（含时间窗口）+ 维度 Tab + 滚动内容 */
export default function ScoreScreen() {
  const router = useRouter();

  const [rounds, setRounds] = useState<RoundData[]>([]);
  const [hcpRecords, setHcpRecords] = useState<HandicapRecord[]>([]);
  const [windowKey, setWindowKey] = useState<RoundWindow>('all');
  const [activeTab, setActiveTab] = useState<ScoreAnalyticsTabId>('overview');

  const reloadFromStorage = useCallback(() => {
    void (async () => {
      const normalized = normalizeHandicapRecords(await loadHandicapRecords());

      setHcpRecords(normalized);
      const nextLocal: RoundData[] = [];
      for (const rec of normalized) {
        const round = migrateOldData([rec])[0];
        if (validateRound(round).ok) nextLocal.push(round);
      }
      nextLocal.sort((a, b) => toDateMs(b.date) - toDateMs(a.date));
      setRounds(nextLocal);

      // 异步加载 Supabase 成绩并合并
      void loadSupabaseHandicapRecords().then(async (supabaseRecords) => {
        const localIds = new Set(normalized.map((r) => r.id));
        const newRecords = supabaseRecords.filter((r) => !localIds.has(r.id.replace('supabase_', '')));
        const merged = normalizeHandicapRecords([...normalized, ...newRecords]);
        setHcpRecords(merged);
        const next: RoundData[] = [];
        for (const rec of merged) {
          const round = migrateOldData([rec])[0];
          if (validateRound(round).ok) next.push(round);
        }
        next.sort((a, b) => toDateMs(b.date) - toDateMs(a.date));
        setRounds(next);
      });
    })();
  }, []);

  useFocusEffect(
    useCallback(() => {
      reloadFromStorage();
      return () => {};
    }, [reloadFromStorage]),
  );

  const selectTab = useCallback((id: ScoreAnalyticsTabId) => {
    setActiveTab(id);
  }, []);

  const stats = useMemo(() => computeAllStats(rounds, windowKey), [rounds, windowKey]);
  const { scoring } = stats;

  useEffect(() => {
    if (__DEV__) {
      try {
        console.log('[ScoreAnalytics] computeAllStats', JSON.stringify(stats));
      } catch {
        console.log('[ScoreAnalytics] computeAllStats (skip stringify)');
      }
    }
  }, [stats]);

  const rc = scoring.roundCount;

  /** 统计引擎未纳入的场次（逐洞未过校验等）仍可从存盘差点记录回退展示 Hero */
  const heroFromRecords = useMemo(() => {
    if (hcpRecords.length === 0) return null;
    const scores = hcpRecords.map((r) => equivalent18AdjustedGross(r)).filter((s) => Number.isFinite(s));
    if (scores.length === 0) return null;
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const avgR = Math.round(avg * 10) / 10;
    let bestS = Infinity;
    let worstS = -Infinity;
    let bestId: string | null = null;
    let worstId: string | null = null;
    for (const r of hcpRecords) {
      const s = equivalent18AdjustedGross(r);
      if (!Number.isFinite(s)) continue;
      if (s < bestS) {
        bestS = s;
        bestId = r.id;
      }
      if (s > worstS) {
        worstS = s;
        worstId = r.id;
      }
    }
    const hi = calcHandicapIndex(hcpRecords);
    const hiStr = typeof hi === 'number' && Number.isFinite(hi) ? hi.toFixed(1) : null;
    return {
      avg: avgR,
      best: Number.isFinite(bestS) ? Math.round(bestS * 10) / 10 : null,
      worst: Number.isFinite(worstS) ? Math.round(worstS * 10) / 10 : null,
      bestId,
      worstId,
      hiStr,
      count: hcpRecords.length,
    };
  }, [hcpRecords]);

  const hiDisplay =
    scoring.handicapIndex != null
      ? scoring.handicapIndex.toFixed(1)
      : heroFromRecords?.hiStr ?? '—';
  const avgScoreDisplay =
    scoring.avgScore != null
      ? scoring.avgScore.toFixed(1)
      : heroFromRecords != null
        ? String(heroFromRecords.avg)
        : '—';
  const roundsLabel =
    rc > 0
      ? `${rc} 场`
      : heroFromRecords != null && rounds.length === 0
        ? `${heroFromRecords.count} 场`
        : '—';

  const bestNum =
    scoring.bestScore != null && Number.isFinite(scoring.bestScore)
      ? String(scoring.bestScore)
      : heroFromRecords?.best != null
        ? String(heroFromRecords.best)
        : '—';
  const worstNum =
    scoring.worstScore != null && Number.isFinite(scoring.worstScore)
      ? String(scoring.worstScore)
      : heroFromRecords?.worst != null
        ? String(heroFromRecords.worst)
        : '—';

  const extremesIds =
    rounds.length > 0
      ? {
          bestId: stats.scoring.bestRound?.roundId ?? null,
          worstId: stats.scoring.worstRound?.roundId ?? null,
        }
      : heroFromRecords?.bestId && heroFromRecords?.worstId
        ? { bestId: heroFromRecords.bestId, worstId: heroFromRecords.worstId }
        : { bestId: null as string | null, worstId: null as string | null };
  const canOpenExtremes = Boolean(
    extremesIds.bestId &&
      extremesIds.worstId &&
      extremesIds.bestId !== extremesIds.worstId,
  );

  const heroHcpSparkValues = useMemo(() => {
    const t = buildHandicapTrend(hcpRecords);
    const idxs = t.map((x) => x.index).filter((v): v is number => v != null);
    return idxs.slice(-8);
  }, [hcpRecords]);

  const hasMain = rounds.length > 0 || hcpRecords.length > 0;
  const showAnalyticsHero = hcpRecords.length > 0;

  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>统计分析</Text>
          <Text style={styles.subtitle}>自动汇总 · 含 9/18 洞</Text>
        </View>
        <Pressable
          style={styles.recordBtn}
          onPress={() => router.push('/handicap/add?from=score' as Href)}
          accessibilityRole="button"
          accessibilityLabel="记录成绩"
        >
          <Text style={styles.recordBtnTxt}>+ 记成绩</Text>
        </Pressable>
      </View>

      {hasMain ? (
        <View style={styles.mainColumn}>
          {showAnalyticsHero ? (
            <View style={styles.heroCard}>
              <View style={styles.heroColumns}>
                <View style={styles.heroColNarrow}>
                  <Text style={styles.heroMiniLab}>平均杆数</Text>
                  <Text
                    style={styles.heroSummaryNum}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {avgScoreDisplay}
                  </Text>
                  <Text style={styles.heroMeta}>{roundsLabel}</Text>
                </View>
                <View style={styles.heroVLine} />
                <View style={styles.heroColWide}>
                  <View style={styles.heroHcpLabelRow}>
                    <Text style={styles.heroDeltaRowLab} numberOfLines={1}>
                      {hcpRecords.length < 8 ? '参考差点' : '当前差点'}
                    </Text>
                    <TouchableOpacity
                      onPress={() =>
                        showTermInfo(
                          'WHS 差点指数',
                          '取最近20场成绩中最好的8个微差，\n乘以0.96得出。\n数字越低说明球技越好。\n职业球手约0-5，业余初学者约30-36',
                        )
                      }
                      hitSlop={{ top: 6, bottom: 6, left: 4, right: 6 }}
                      accessibilityRole="button"
                      accessibilityLabel="WHS 差点指数说明"
                    >
                      <Text style={styles.termHintIcon}>ⓘ</Text>
                    </TouchableOpacity>
                  </View>
                  <Pressable
                    style={styles.heroColTappableInner}
                    onPress={() => router.push('/handicap?from=score' as Href)}
                    accessibilityRole="button"
                    accessibilityLabel="查看差点详细分析"
                    android_ripple={null}
                  >
                    <Text
                      style={styles.heroSummaryNum}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.7}
                    >
                      {hiDisplay}
                    </Text>
                    {hcpRecords.length > 0 && hcpRecords.length < 8 ? (
                      <Text
                        style={{
                          fontSize: 10,
                          color: '#e89b3a',
                          fontWeight: '600',
                          marginTop: 2,
                        }}
                      >
                        仅 {hcpRecords.length} 场，8 场后更准确
                      </Text>
                    ) : null}
                    <HandicapSparkline
                      values={
                        heroHcpSparkValues.length >= 2 ? heroHcpSparkValues : HCP_TREND_PLACEHOLDER
                      }
                    />
                    <Text style={styles.heroCornerChev} pointerEvents="none">
                      ›
                    </Text>
                  </Pressable>
                </View>
                <View style={styles.heroVLine} />
                <Pressable
                  style={[
                    styles.heroColNarrow,
                    styles.heroColTappable,
                    !canOpenExtremes ? styles.heroBestWorstDisabled : null,
                  ]}
                  disabled={!canOpenExtremes}
                  onPress={() => {
                    const b = extremesIds.bestId;
                    const w = extremesIds.worstId;
                    if (!b || !w) return;
                    router.push(
                      `/handicap/extremes?bestId=${encodeURIComponent(b)}&worstId=${encodeURIComponent(w)}` as Href,
                    );
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="查看最好与最差场次详情"
                  android_ripple={null}
                >
                  <Text style={styles.heroMiniLab}>最好 / 最差</Text>
                  <View style={styles.bestWorstStack}>
                    <Text
                      style={styles.heroSummaryBestNum}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.7}
                    >
                      {bestNum}
                    </Text>
                    <Text style={styles.slashBetween}>/</Text>
                    <Text
                      style={styles.heroSummaryWorstNum}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.7}
                    >
                      {worstNum}
                    </Text>
                  </View>
                  <Text style={styles.heroCornerChev} pointerEvents="none">
                    ›
                  </Text>
                </Pressable>
              </View>
              <View style={styles.segOuter}>
                {WINDOW_OPTIONS.map((w) => {
                  const selected = windowKey === w;
                  return (
                    <Pressable
                      key={w}
                      onPress={() => setWindowKey(w)}
                      style={[styles.segChip, selected && styles.segChipOn]}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                    >
                      <Text style={[styles.segChipTxt, selected && styles.segChipTxtOn]}>
                        {windowButtonLabel(w, rounds)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {hcpRecords.length !== rounds.length ? (
                <Text style={styles.statsCoverageHint}>
                  本地存盘 {hcpRecords.length} 场；下方图表与分布仅统计「逐洞校验通过」的 {rounds.length}{' '}
                  场。其余可在差点页查看，或打开对应场次详情补全逐洞数据。
                </Text>
              ) : rounds.length > 0 && rounds.every((r) => (r.holes?.length ?? 0) === 0) ? (
                <Text style={styles.statsCoverageHint}>
                  当前参与统计的场次暂无逐洞杆数，「成绩分布」「分段均杆」等会显示为 0 或「—」。请在每场详情中补录逐洞或重新保存记分。
                </Text>
              ) : null}
            </View>
          ) : null}

          <View style={styles.tabBarScrollClip}>
            <ScrollView
              horizontal
              style={styles.tabBarScrollOuter}
              showsHorizontalScrollIndicator={false}
              bounces={false}
              nestedScrollEnabled
              contentContainerStyle={styles.tabBarScrollContent}
            >
              {ANALYTICS_TABS.map((t) => {
                const selected = activeTab === t.id;
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => selectTab(t.id)}
                    style={styles.tabItemScroll}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                  >
                    <Text style={[styles.tabItemTxt, selected && styles.tabItemTxtSelected]}>
                      {t.label}
                    </Text>
                    {selected ? <View style={styles.tabUnderline} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <ScrollView
            style={styles.tabBodyScroll}
            contentContainerStyle={styles.tabBodyContent}
            showsVerticalScrollIndicator={false}
            bounces
          >
            <View style={styles.tabBodyStack}>
              <ScoreAnalyticsTabContent
                stats={stats}
                activeTab={activeTab}
                onOpenHandicapTab={() => router.push('/handicap?from=score' as Href)}
                showHandicapOverviewCta={rounds.length > 0 || hcpRecords.length > 0}
              />
              {rounds.length > 0 ? (
                <View style={styles.histSection}>
                  <View style={styles.histSectionHead}>
                    <Text style={styles.histSectionTitle}>场次记录</Text>
                    <Pressable
                      onPress={() => router.push('/handicap/history?from=score' as Href)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="查看全部场次记录"
                    >
                      <Text style={styles.histSeeAll}>查看全部 ›</Text>
                    </Pressable>
                  </View>
                  {rounds.slice(0, 5).map((r) => {
                    const diff = r.scoreDifferential;
                    const girPct = roundGirPct(r);
                    const fullRec = hcpRecords.find((h) => h.id === r.roundId) ?? null;
                    return (
                      <Pressable
                        key={r.roundId}
                        style={styles.histRow}
                        onPress={() =>
                          router.push(`/handicap/${r.roundId}?from=score` as Href)
                        }
                        accessibilityRole="button"
                        accessibilityLabel={`${r.courseName} ${r.totalScore} 杆`}
                      >
                        <View style={styles.histRowTop}>
                          <View style={styles.histRowLeft}>
                            <Text style={styles.histRowMeta}>
                              {formatRoundDateLabel(r.date)} · {r.holeCount} 洞
                            </Text>
                            <Text style={styles.histRowCourse} numberOfLines={1}>
                              {r.courseName}
                            </Text>
                          </View>
                          <View style={styles.histRowScoreWrap}>
                            {fullRec ? <RoundLockIndicator round={fullRec} /> : null}
                            <Text style={styles.histRowScore}>{r.totalScore}</Text>
                          </View>
                        </View>
                        <View style={styles.histChips}>
                          {typeof diff === 'number' && Number.isFinite(diff) ? (
                            <View style={[styles.histChip, styles.histChipAccent]}>
                              <Text style={styles.histChipAccentTxt}>微差 {diff.toFixed(1)}</Text>
                            </View>
                          ) : null}
                          {fullRec != null && fullRec.totalPutts != null ? (
                            <View style={styles.histChip}>
                              <Text style={styles.histChipTxt}>推杆 {fullRec.totalPutts}</Text>
                            </View>
                          ) : null}
                          {girPct != null ? (
                            <View style={styles.histChip}>
                              <Text style={styles.histChipTxt}>GIR {girPct}%</Text>
                            </View>
                          ) : null}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </View>
          </ScrollView>
        </View>
      ) : (
        <ScrollView
          style={styles.tabBodyScroll}
          contentContainerStyle={styles.tabBodyContent}
          showsVerticalScrollIndicator={false}
          bounces
        >
          <View style={styles.emptyBody}>
            <Text style={styles.emptyTitle}>开始记录你的第一场成绩</Text>
            <Text style={styles.emptySub}>
              保存逐洞成绩后，这里会汇总差点、开球、进攻、短杆与推杆。
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PAGE_BG },
  /** 统计主体：Hero + 子 Tab + 内容区，约束 flex 链，避免 Web 上内容区盖住子 Tab */
  mainColumn: { flex: 1, minHeight: 0, minWidth: 0 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: TAB_SCREEN_TOP_PADDING,
    paddingBottom: 12,
    gap: 12,
    backgroundColor: PAGE_BG,
  },
  titleBlock: { flex: 1, minWidth: 0 },
  title: { fontSize: fontSize.lg, fontWeight: '800', color: WHITE, marginBottom: 4, letterSpacing: -0.5 },
  subtitle: { fontSize: fontSize.sm, fontWeight: '500', color: SUBTITLE, lineHeight: 17 },
  recordBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: BTN_BG,
    borderWidth: 1,
    borderColor: BTN_BORDER,
  },
  recordBtnTxt: { fontSize: 14, fontWeight: '700', color: ACCENT },

  heroCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: CARD_BG,
    gap: 14,
  },
  heroColumns: { flexDirection: 'row', alignItems: 'flex-start' },
  heroColNarrow: { flex: 1, minWidth: 0, alignItems: 'center', overflow: 'hidden' },
  heroColTappable: { position: 'relative', alignSelf: 'stretch' },
  /** 与「当前差点」ⓘ 分离，避免嵌套 Pressable/TouchableOpacity 抢事件或影响布局 */
  heroColTappableInner: {
    alignSelf: 'stretch',
    position: 'relative',
    alignItems: 'center',
    minWidth: 0,
  },
  heroCornerChev: {
    position: 'absolute',
    right: 0,
    top: 0,
    fontSize: 14,
    fontWeight: '300',
    color: MUTED,
    lineHeight: 16,
  },
  heroBestWorstDisabled: { opacity: 0.45 },
  heroColWide: { flex: 1, minWidth: 0, alignItems: 'stretch', justifyContent: 'flex-start', overflow: 'hidden' },
  heroVLine: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: DIVIDER,
    marginHorizontal: 6,
  },
  heroMiniLab: {
    fontSize: 11,
    fontWeight: '700',
    color: SUBTITLE,
    letterSpacing: -0.3,
    marginBottom: 4,
    alignSelf: 'center',
  },
  heroHcpLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 2,
    maxWidth: '100%',
    gap: 0,
  },
  heroDeltaRowLab: {
    fontSize: 11,
    fontWeight: '700',
    color: SUBTITLE,
    letterSpacing: -0.3,
    marginBottom: 0,
    flexShrink: 1,
  },
  termHintIcon: { fontSize: 11, color: MUTED, marginLeft: 4, fontWeight: '600' },
  heroSummaryNum: {
    fontSize: 32,
    fontWeight: '800',
    color: ACCENT,
    letterSpacing: -0.8,
    lineHeight: 38,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  heroSummaryBestNum: {
    fontSize: 32,
    fontWeight: '800',
    color: BEST,
    letterSpacing: -0.5,
    lineHeight: 38,
    flexShrink: 1,
    maxWidth: '46%',
    textAlign: 'right',
  },
  heroSummaryWorstNum: {
    fontSize: 32,
    fontWeight: '800',
    color: WORST,
    letterSpacing: -0.5,
    lineHeight: 38,
    flexShrink: 1,
    maxWidth: '46%',
    textAlign: 'left',
  },
  heroMeta: { fontSize: 11, fontWeight: '600', color: MUTED, marginTop: 4 },
  sparkSlot: { height: 32, width: '100%', marginTop: 6 },
  bestWorstStack: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    gap: 2,
    flexWrap: 'nowrap',
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  slashBetween: { fontSize: fontSize.sm, fontWeight: '600', color: SLASH, lineHeight: 20 },

  segOuter: {
    flexDirection: 'row',
    backgroundColor: SEG_OUTER,
    borderRadius: 9,
    padding: 3,
    gap: 4,
  },
  segChip: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  segChipOn: { backgroundColor: SEG_SELECTED },
  segChipTxt: { fontSize: 12, fontWeight: '600', color: SUBTITLE },
  segChipTxtOn: { fontWeight: '700', color: ACCENT },
  statsCoverageHint: {
    fontSize: 11,
    lineHeight: 16,
    color: '#e89b3a',
    fontWeight: '600',
    marginTop: 10,
  },

  /** 固定高度；zIndex/elevation 防止 Web 下层纵向 ScrollView 叠在上面吞点击 */
  tabBarScrollClip: {
    height: 44,
    overflow: 'hidden',
    zIndex: 2,
    elevation: 4,
    position: 'relative',
    backgroundColor: PAGE_BG,
  },
  tabBarScrollOuter: {
    height: 44,
    borderBottomWidth: 1,
    borderBottomColor: TAB_BORDER,
    backgroundColor: PAGE_BG,
    zIndex: 2,
  },
  tabBarScrollContent: {
    paddingHorizontal: 8,
    alignItems: 'center',
    minHeight: 44,
  },
  tabItemScroll: {
    position: 'relative',
    width: SCROLL_TAB_ITEM_WIDTH,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabItemTxt: { fontSize: fontSize.md, fontWeight: '600', color: SUBTITLE },
  tabItemTxtSelected: { fontWeight: '700', color: ACCENT },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 10,
    right: 10,
    height: 2,
    borderRadius: 1,
    backgroundColor: ACCENT,
  },
  tabBodyScroll: { flex: 1, minHeight: 0, zIndex: 0 },
  /**
   * Web：ScrollView 的 content 用 flexGrow:0 时，若内层再参与 flex 分配，Yoga 会把整块内容顶出一段顶部空白。
   * Web 用 flexGrow:1 + justifyContent:flex-start，内层 tabBodyStack 用 flex:1，让剩余高度落在底部而非挤在 Tab 下。
   * 原生保持 flexGrow:0，行为与现网一致。
   */
  tabBodyStack: {
    width: '100%',
    maxWidth: '100%',
    ...Platform.select({
      web: { flex: 1, minHeight: 0 },
      default: {},
    }),
  },
  tabBodyContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: TAB_BAR_SCROLL_EXTRA + 32,
    ...Platform.select({
      web: {
        flexGrow: 1,
        justifyContent: 'flex-start',
        alignItems: 'stretch',
      },
      default: { flexGrow: 0 },
    }),
  },
  emptyBody: { paddingVertical: 24, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: WHITE, letterSpacing: -0.5 },
  emptySub: { fontSize: 14, fontWeight: '600', color: SUBTITLE, lineHeight: 21 },

  histSection: { marginTop: 28, gap: 10 },
  histSectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  histSectionTitle: { fontSize: 13, fontWeight: '700', color: SECTION_TITLE },
  histSeeAll: { fontSize: 11, fontWeight: '700', color: ACCENT },
  histRow: {
    position: 'relative',
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 14,
  },
  histRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 8,
  },
  histRowLeft: { flex: 1, minWidth: 0, paddingRight: 8 },
  histRowScoreWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    flexShrink: 0,
  },
  histRowMeta: { fontSize: 11, fontWeight: '600', color: ROW_META, marginBottom: 3 },
  histRowCourse: { fontSize: 14, fontWeight: '700', color: TEXT_MAIN },
  histRowScore: {
    fontSize: fontSizeData.number,
    fontWeight: '800',
    color: ACCENT,
    letterSpacing: -0.5,
    lineHeight: 28,
  },
  histChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  histChip: {
    backgroundColor: CHIP_MUTED,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  histChipAccent: { backgroundColor: CHIP_ACCENT_BG },
  histChipTxt: { fontSize: 11, fontWeight: '600', color: SUBTITLE },
  histChipAccentTxt: { fontSize: 11, fontWeight: '800', color: ACCENT },
});
