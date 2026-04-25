import { useFocusEffect } from '@react-navigation/native';
import { type Href, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LayoutChangeEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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
  loadHandicapRecords,
  normalizeHandicapRecords,
  type HandicapRecord,
} from '@/lib/handicap';
import { TAB_BAR_SCROLL_EXTRA } from '@/constants/theme';
import {
  computeAllStats,
  filterRounds,
  migrateOldData,
  validateRound,
  type RoundData,
  type RoundWindow,
} from '@/src/utils/statsEngine';

const PAGE_BG = '#0d1b11';
const CARD_BG = '#16261c';
const ACCENT = '#b5ff3a';
const WHITE = '#ffffff';
const SUBTITLE = '#8a9a8e';
const MUTED = '#5a6b5f';
const BTN_BG = '#1e3a26';
const BTN_BORDER = '#2d5436';
const SEG_OUTER = '#0d1b11';
const SEG_SELECTED = '#2d5436';
const DIVIDER = 'rgba(255,255,255,0.08)';
const TAB_BORDER = 'rgba(255,255,255,0.06)';
const BEST = '#e8f0e5';
const WORST = '#a8b5ac';
const SLASH = '#4a5a51';
const TEXT_MAIN = '#e8f0e5';
const SECTION_TITLE = '#a8b5ac';
const ROW_META = '#5a6b5f';
const CHIP_MUTED = 'rgba(255,255,255,0.04)';
const CHIP_ACCENT_BG = 'rgba(181,255,58,0.10)';

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

  const h = 20;
  const padX = 2;
  const padY = 2;
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

/** 底部「成绩」Tab：Header + Hero（含时间窗口）+ 维度 Tab + 滚动内容 */
export default function ScoreScreen() {
  const router = useRouter();

  const [rounds, setRounds] = useState<RoundData[]>([]);
  const [hcpRecords, setHcpRecords] = useState<HandicapRecord[]>([]);
  const [windowKey, setWindowKey] = useState<RoundWindow>('all');
  const [activeTab, setActiveTab] = useState<ScoreAnalyticsTabId>('overview');

  const reloadFromStorage = useCallback(() => {
    const normalized = normalizeHandicapRecords(loadHandicapRecords());
    setHcpRecords(normalized);
    const next: RoundData[] = [];
    for (const rec of normalized) {
      const round = migrateOldData([rec])[0];
      if (validateRound(round).ok) next.push(round);
    }
    next.sort((a, b) => toDateMs(b.date) - toDateMs(a.date));
    setRounds(next);
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
      console.log('[ScoreAnalytics] computeAllStats', JSON.stringify(stats));
    }
  }, [stats]);

  const rc = scoring.roundCount;
  const hiDisplay = scoring.handicapIndex != null ? scoring.handicapIndex.toFixed(1) : '—';
  const avgScoreDisplay = scoring.avgScore != null ? scoring.avgScore.toFixed(1) : '—';
  const roundsLabel = rc > 0 ? `${rc} 场` : '—';

  const bestNum =
    scoring.bestScore != null && Number.isFinite(scoring.bestScore)
      ? String(scoring.bestScore)
      : '—';
  const worstNum =
    scoring.worstScore != null && Number.isFinite(scoring.worstScore)
      ? String(scoring.worstScore)
      : '—';

  const heroHcpSparkValues = useMemo(() => {
    const t = buildHandicapTrend(hcpRecords);
    const idxs = t.map((x) => x.index).filter((v): v is number => v != null);
    return idxs.slice(-8);
  }, [hcpRecords]);

  const hasMain = rounds.length > 0 || hcpRecords.length > 0;
  const showAnalyticsHero = rounds.length > 0;

  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>成绩分析</Text>
          <Text style={styles.subtitle}>自动汇总 · 含 9/18 洞</Text>
        </View>
        <Pressable
          style={styles.recordBtn}
          onPress={() => router.push('/handicap/add' as Href)}
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
                  <Text style={styles.heroBigNum}>{avgScoreDisplay}</Text>
                  <Text style={styles.heroMeta}>{roundsLabel}</Text>
                </View>
                <View style={styles.heroVLine} />
                <Pressable
                  style={styles.heroColWide}
                  onPress={() => router.push('/handicap' as Href)}
                  accessibilityRole="button"
                  accessibilityLabel="查看差点详细分析"
                >
                  <View style={styles.heroMidTop}>
                    <Text style={styles.heroDeltaRowLab}>
                      {hcpRecords.length < 8 ? '参考差点' : '当前差点'}
                    </Text>
                    <Text style={styles.heroNavHint}>详细 ›</Text>
                  </View>
                  <Text style={styles.heroBigNum}>{hiDisplay}</Text>
                  {hcpRecords.length > 0 && hcpRecords.length < 8 ? (
                    <Text style={styles.heroHcpThinHint}>
                      仅 {hcpRecords.length} 场，8 场后更准确
                    </Text>
                  ) : null}
                  <HandicapSparkline
                    values={
                      heroHcpSparkValues.length >= 2 ? heroHcpSparkValues : HCP_TREND_PLACEHOLDER
                    }
                  />
                </Pressable>
                <View style={styles.heroVLine} />
                <Pressable
                  style={({ pressed }) => [
                    styles.heroColNarrow,
                    styles.heroBestWorstPress,
                    pressed && styles.heroBestWorstPressIn,
                    !stats.scoring.bestRound?.roundId ? styles.heroBestWorstDisabled : null,
                  ]}
                  disabled={!stats.scoring.bestRound?.roundId || !stats.scoring.worstRound?.roundId}
                  onPress={() => {
                    const b = stats.scoring.bestRound?.roundId;
                    const w = stats.scoring.worstRound?.roundId;
                    if (!b || !w) return;
                    router.push(
                      `/handicap/extremes?bestId=${encodeURIComponent(b)}&worstId=${encodeURIComponent(w)}` as Href,
                    );
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="查看最好与最差场次详情"
                >
                  <Text style={styles.heroMiniLab}>最好 / 最差</Text>
                  <View style={styles.bestWorstStack}>
                    <Text style={styles.bestNum}>{bestNum}</Text>
                    <Text style={styles.slashBetween}>/</Text>
                    <Text style={styles.worstNum}>{worstNum}</Text>
                  </View>
                  <Text style={styles.heroBestWorstHint}>详情 ›</Text>
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
                onOpenHandicapTab={() => router.push('/handicap' as Href)}
                showHandicapOverviewCta={rounds.length > 0 || hcpRecords.length > 0}
              />
              {rounds.length > 0 ? (
                <View style={styles.histSection}>
                  <View style={styles.histSectionHead}>
                    <Text style={styles.histSectionTitle}>成绩记录</Text>
                    <Pressable
                      onPress={() => router.push('/handicap/history' as Href)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="查看全部成绩记录"
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
                        onPress={() => router.push(`/handicap/${r.roundId}` as Href)}
                        accessibilityRole="button"
                        accessibilityLabel={`${r.courseName} ${r.totalScore} 杆`}
                      >
                        {fullRec ? (
                          <View style={styles.histLockCorner} pointerEvents="box-none">
                            <RoundLockIndicator round={fullRec} />
                          </View>
                        ) : null}
                        <View style={styles.histRowTop}>
                          <View style={styles.histRowLeft}>
                            <Text style={styles.histRowMeta}>
                              {formatRoundDateLabel(r.date)} · {r.holeCount} 洞
                            </Text>
                            <Text style={styles.histRowCourse} numberOfLines={1}>
                              {r.courseName}
                            </Text>
                          </View>
                          <Text style={styles.histRowScore}>{r.totalScore}</Text>
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
  /** 成绩主体：Hero + 子 Tab + 内容区，约束 flex 链，避免 Web 上内容区盖住子 Tab */
  mainColumn: { flex: 1, minHeight: 0, minWidth: 0 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 12,
    backgroundColor: PAGE_BG,
  },
  titleBlock: { flex: 1, minWidth: 0 },
  title: { fontSize: 22, fontWeight: '800', color: WHITE, marginBottom: 4, letterSpacing: -0.5 },
  subtitle: { fontSize: 12, fontWeight: '500', color: SUBTITLE, lineHeight: 17 },
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
  heroColumns: { flexDirection: 'row', alignItems: 'stretch' },
  heroColNarrow: { flex: 1, minWidth: 0, alignItems: 'center' },
  heroBestWorstPress: { alignSelf: 'stretch' },
  heroBestWorstPressIn: { opacity: 0.88 },
  heroBestWorstDisabled: { opacity: 0.45 },
  heroBestWorstHint: { fontSize: 10, fontWeight: '800', color: ACCENT, marginTop: 4 },
  heroColWide: { flex: 1.22, minWidth: 0, alignItems: 'stretch', justifyContent: 'flex-start' },
  heroVLine: { width: 1, backgroundColor: DIVIDER, marginHorizontal: 6 },
  heroMiniLab: {
    fontSize: 11,
    fontWeight: '700',
    color: SUBTITLE,
    letterSpacing: -0.3,
    marginBottom: 4,
    alignSelf: 'center',
  },
  heroDeltaRowLab: {
    fontSize: 11,
    fontWeight: '700',
    color: SUBTITLE,
    letterSpacing: -0.3,
  },
  heroBigNum: {
    fontSize: 30,
    fontWeight: '800',
    color: ACCENT,
    letterSpacing: -0.8,
    lineHeight: 34,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  heroHcpThinHint: {
    fontSize: 10,
    color: '#e89b3a',
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  heroMeta: { fontSize: 11, fontWeight: '600', color: MUTED, marginTop: 4 },
  heroMidTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  heroNavHint: { fontSize: 10, fontWeight: '800', color: ACCENT },
  sparkSlot: { height: 20, width: '100%', marginTop: 6 },
  bestWorstStack: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    gap: 4,
    flexWrap: 'nowrap',
  },
  bestNum: { fontSize: 18, fontWeight: '800', color: BEST, letterSpacing: -0.5 },
  slashBetween: { fontSize: 14, fontWeight: '600', color: SLASH, lineHeight: 20 },
  worstNum: { fontSize: 18, fontWeight: '800', color: WORST, letterSpacing: -0.5 },

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
  tabItemTxt: { fontSize: 14, fontWeight: '600', color: SUBTITLE },
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
    paddingBottom: 28 + TAB_BAR_SCROLL_EXTRA,
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
  histLockCorner: { position: 'absolute', top: 10, right: 10, zIndex: 2 },
  histRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
    paddingRight: 22,
  },
  histRowLeft: { flex: 1, minWidth: 0, paddingRight: 10 },
  histRowMeta: { fontSize: 11, fontWeight: '600', color: ROW_META, marginBottom: 3 },
  histRowCourse: { fontSize: 14, fontWeight: '700', color: TEXT_MAIN },
  histRowScore: {
    fontSize: 26,
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
