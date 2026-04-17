import { useFocusEffect } from '@react-navigation/native';
import { type Href, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

import { ScoreAnalyticsTabContent, type ScoreAnalyticsTabId } from '@/components/ScoreAnalyticsTabContent';
import { loadHandicapRecords, normalizeHandicapRecords } from '@/lib/handicap';
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

const WINDOW_OPTIONS: RoundWindow[] = ['all', 'last5', 'last10', 'last20'];

const TABS: { id: ScoreAnalyticsTabId; label: string }[] = [
  { id: 'overview', label: '总览' },
  { id: 'tee', label: '开球' },
  { id: 'approach', label: '进攻' },
  { id: 'short', label: '短杆' },
  { id: 'putting', label: '推杆' },
  { id: 'sg', label: 'SG' },
];

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
  const [windowKey, setWindowKey] = useState<RoundWindow>('all');
  const [activeTab, setActiveTab] = useState<ScoreAnalyticsTabId>('overview');

  useFocusEffect(
    useCallback(() => {
      const normalized = normalizeHandicapRecords(loadHandicapRecords());
      const next: RoundData[] = [];
      for (const rec of normalized) {
        const round = migrateOldData([rec])[0];
        if (validateRound(round).ok) next.push(round);
      }
      next.sort((a, b) => toDateMs(b.date) - toDateMs(a.date));
      setRounds(next);
      return () => {};
    }, []),
  );

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
    scoring.bestScore != null && Number.isFinite(scoring.bestScore) ? String(scoring.bestScore) : '—';
  const worstNum =
    scoring.worstScore != null && Number.isFinite(scoring.worstScore) ? String(scoring.worstScore) : '—';

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
          accessibilityLabel="记录成绩">
          <Text style={styles.recordBtnTxt}>+ 记成绩</Text>
        </Pressable>
      </View>

      {rounds.length > 0 ? (
        <>
          <View style={styles.heroCard}>
            <View style={styles.heroColumns}>
              <View style={styles.heroColNarrow}>
                <Text style={styles.heroMiniLab}>平均杆数</Text>
                <Text style={styles.heroBigNum}>{avgScoreDisplay}</Text>
                <Text style={styles.heroMeta}>{roundsLabel}</Text>
              </View>
              <View style={styles.heroVLine} />
              <View style={styles.heroColWide}>
                <View style={styles.heroMidTop}>
                  <Text style={styles.heroDeltaRowLab}>当前差点</Text>
                  <View style={styles.heroDeltaPlaceholder} />
                </View>
                <Text style={styles.heroBigNum}>{hiDisplay}</Text>
                <HandicapSparkline values={HCP_TREND_PLACEHOLDER} />
              </View>
              <View style={styles.heroVLine} />
              <View style={styles.heroColNarrow}>
                <Text style={styles.heroMiniLab}>最好 / 最差</Text>
                <View style={styles.bestWorstStack}>
                  <Text style={styles.bestNum}>{bestNum}</Text>
                  <Text style={styles.slashBetween}>/</Text>
                  <Text style={styles.worstNum}>{worstNum}</Text>
                </View>
              </View>
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
                    accessibilityState={{ selected }}>
                    <Text style={[styles.segChipTxt, selected && styles.segChipTxtOn]}>
                      {windowButtonLabel(w, rounds)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.tabBarWrap}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              bounces={false}
              contentContainerStyle={styles.tabBarScrollContent}>
              {TABS.map((t) => {
                const selected = activeTab === t.id;
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => setActiveTab(t.id)}
                    style={styles.tabItem}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}>
                    <Text style={[styles.tabItemTxt, selected && styles.tabItemTxtSelected]}>{t.label}</Text>
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
            bounces>
            <ScoreAnalyticsTabContent stats={stats} activeTab={activeTab} />
          </ScrollView>
        </>
      ) : (
        <ScrollView
          style={styles.tabBodyScroll}
          contentContainerStyle={styles.tabBodyContent}
          showsVerticalScrollIndicator={false}
          bounces>
          <View style={styles.emptyBody}>
            <Text style={styles.emptyTitle}>开始记录你的第一场成绩</Text>
            <Text style={styles.emptySub}>保存逐洞成绩后，这里会汇总差点、开球、进攻、短杆与推杆。</Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PAGE_BG },
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
  heroMeta: { fontSize: 11, fontWeight: '600', color: MUTED, marginTop: 4 },
  heroMidTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  heroDeltaPlaceholder: { minWidth: 1, minHeight: 14 },
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

  tabBarWrap: {
    height: 44,
    borderBottomWidth: 1,
    borderBottomColor: TAB_BORDER,
    backgroundColor: PAGE_BG,
  },
  tabBarScrollContent: {
    paddingHorizontal: 8,
    alignItems: 'center',
    minHeight: 44,
  },
  tabItem: {
    position: 'relative',
    minWidth: 56,
    height: 44,
    paddingHorizontal: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabItemTxt: { fontSize: 14, fontWeight: '600', color: SUBTITLE },
  tabItemTxtSelected: { fontWeight: '700', color: ACCENT },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 8,
    right: 8,
    height: 2,
    borderRadius: 1,
    backgroundColor: ACCENT,
  },

  tabBodyScroll: { flex: 1 },
  tabBodyContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 28 + TAB_BAR_SCROLL_EXTRA,
    flexGrow: 1,
  },
  emptyBody: { paddingVertical: 24, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: WHITE, letterSpacing: -0.5 },
  emptySub: { fontSize: 14, fontWeight: '600', color: SUBTITLE, lineHeight: 21 },
});
