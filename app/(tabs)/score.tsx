import { useFocusEffect } from '@react-navigation/native';
import { type Href, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ScoreAnalyticsTabContent, type ScoreAnalyticsTabId } from '@/components/ScoreAnalyticsTabContent';
import {
  calcHandicapIndex,
  loadHandicapRecords,
  normalizeHandicapRecords,
  type HandicapRecord,
} from '@/lib/handicap';
import { adjustedGrossCoreSummary, summaryBarAdjustedSlice } from '@/lib/scoreScreenSummary';
import { TAB_BAR_SCROLL_EXTRA } from '@/constants/theme';
import {
  computeAllStats,
  filterRounds,
  migrateOldData,
  validateRound,
  type RoundData,
  type RoundWindow,
} from '@/src/utils/statsEngine';

const BG = '#0d1f10';
const WHITE = '#ffffff';
const PRIMARY_GREEN = '#166534';
const LIME = '#a3e635';
const MUTED = 'rgba(255,255,255,0.55)';
const MUTED2 = 'rgba(255,255,255,0.42)';
const BORDER = 'rgba(255,255,255,0.08)';

const WINDOW_OPTIONS: RoundWindow[] = ['all', 'last5', 'last10', 'last20'];

const TABS: { id: ScoreAnalyticsTabId; label: string }[] = [
  { id: 'overview', label: '总览' },
  { id: 'tee', label: '开球' },
  { id: 'approach', label: '进攻' },
  { id: 'short', label: '短杆' },
  { id: 'putting', label: '推杆' },
  { id: 'sg', label: 'SG' },
];

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

/** 底部「成绩」Tab：顶部固定 + 时间窗口 + 核心数据 + 横向 Tab + 可滚动内容区 */
export default function ScoreScreen() {
  const router = useRouter();
  const [rounds, setRounds] = useState<RoundData[]>([]);
  /** 与 rounds 顺序一致（新→旧），用于与首页相同的 WHS 差点（calcHandicapIndex + scoreDifferential） */
  const [handicapRecordsValid, setHandicapRecordsValid] = useState<HandicapRecord[]>([]);
  const [windowKey, setWindowKey] = useState<RoundWindow>('all');
  const [activeTab, setActiveTab] = useState<ScoreAnalyticsTabId>('overview');

  useFocusEffect(
    useCallback(() => {
      const normalized = normalizeHandicapRecords(loadHandicapRecords());
      const paired: { rec: HandicapRecord; round: RoundData }[] = [];
      for (const rec of normalized) {
        const round = migrateOldData([rec])[0];
        if (validateRound(round).ok) paired.push({ rec, round });
      }
      paired.sort((a, b) => toDateMs(b.round.date) - toDateMs(a.round.date));
      setRounds(paired.map((p) => p.round));
      setHandicapRecordsValid(paired.map((p) => p.rec));
      return () => {};
    }, []),
  );

  const stats = useMemo(() => computeAllStats(rounds, windowKey), [rounds, windowKey]);
  const { scoring } = stats;

  /**
   * 顶栏差点：与首页相同 → `calcHandicapIndex` + 存盘 `scoreDifferential`（勿用 statsEngine 内简化 HI）。
   * 切片规则与 `filterRounds(rounds)` 一致，保证与 Tab 的 `computeAllStats` 使用同一窗口场次数。
   */
  const windowedForHcp = useMemo(
    () => filterRounds(handicapRecordsValid as unknown as RoundData[], windowKey),
    [handicapRecordsValid, windowKey],
  );
  const officialHcp = useMemo(
    () => calcHandicapIndex(windowedForHcp.rounds as unknown as HandicapRecord[]),
    [windowedForHcp.rounds],
  );

  /** 顶栏均杆/极值：与首页「近期」口径一致 → adjusted gross；「全部」时仅最近 20 场（见 lib/scoreScreenSummary） */
  const coreSummary = useMemo(() => {
    const slice = summaryBarAdjustedSlice(
      windowedForHcp.rounds as unknown as HandicapRecord[],
      windowKey,
    );
    return adjustedGrossCoreSummary(slice);
  }, [windowKey, windowedForHcp.rounds]);

  /** 开发环境打印完整 stats，便于核对时间窗口与 Tab 数据是否同步刷新 */
  useEffect(() => {
    if (__DEV__) {
      console.log('[ScoreAnalytics] computeAllStats', JSON.stringify(stats));
    }
  }, [stats]);

  const wc = windowedForHcp.actualCount;

  const hiDisplay = officialHcp != null ? officialHcp.toFixed(1) : '—';
  const hiSub =
    wc === 0
      ? '暂无场次'
      : officialHcp != null
        ? `${wc}场·WHS`
        : wc < 3
          ? '需3场+'
          : '需有效差点记录';

  const avgScoreDisplay =
    coreSummary.avg != null
      ? String(coreSummary.avg)
      : scoring.avgScore != null
        ? scoring.avgScore.toFixed(1)
        : '—';

  const bw =
    coreSummary.best != null && coreSummary.worst != null
      ? `${coreSummary.best}/${coreSummary.worst}`
      : scoring.bestScore != null && scoring.worstScore != null
        ? `${scoring.bestScore}/${scoring.worstScore}`
        : '—';

  return (
    <View style={styles.root}>
      {/* 1 标题栏 */}
      <View style={styles.titleBar}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>成绩分析</Text>
          <Text style={styles.subtitle}>自动汇总·含9/18洞</Text>
        </View>
        <Pressable
          style={styles.recordBtn}
          onPress={() => router.push('/handicap/add' as Href)}
          accessibilityRole="button"
          accessibilityLabel="记录成绩">
          <Text style={styles.recordBtnTxt}>记成绩</Text>
        </Pressable>
      </View>

      {/* 2 时间窗口 */}
      <View style={styles.filterRow}>
        {WINDOW_OPTIONS.map((w) => {
          const selected = windowKey === w;
          return (
            <Pressable
              key={w}
              onPress={() => setWindowKey(w)}
              style={[styles.filterChip, selected && styles.filterChipSelected]}
              accessibilityRole="button"
              accessibilityState={{ selected }}>
              <Text style={[styles.filterChipTxt, selected && styles.filterChipTxtSelected]}>
                {windowButtonLabel(w, rounds)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* 3 核心数据条 */}
      <View style={styles.coreRow}>
        <View style={styles.coreCol}>
          <Text style={styles.coreBig}>{hiDisplay}</Text>
          <Text style={styles.coreSmall}>{hiSub}</Text>
        </View>
        <View style={[styles.coreCol, styles.coreColBorder]}>
          <Text style={styles.coreBig}>{avgScoreDisplay}</Text>
          <Text style={styles.coreSmall}>Avg Score</Text>
        </View>
        <View style={styles.coreCol}>
          <Text style={styles.coreBig}>{bw}</Text>
          <Text style={styles.coreSmall}>Best/Worst</Text>
        </View>
      </View>

      {/* 4 Tab 栏（横向滚动） */}
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

      {/* 5 Tab 内容区（仅此处纵向滚动） */}
      <ScrollView
        style={styles.tabBodyScroll}
        contentContainerStyle={styles.tabBodyContent}
        showsVerticalScrollIndicator={false}
        bounces>
        {rounds.length === 0 ? (
          <View style={styles.emptyBody}>
            <Text style={styles.emptyTitle}>开始记录你的第一场成绩</Text>
            <Text style={styles.emptySub}>保存逐洞成绩后，这里会汇总差点、开球、进攻、短杆与推杆。</Text>
          </View>
        ) : (
          <ScoreAnalyticsTabContent stats={stats} activeTab={activeTab} />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  titleBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
    backgroundColor: BG,
  },
  titleBlock: { flex: 1, minWidth: 0 },
  title: { fontSize: 24, fontWeight: '800', color: WHITE, marginBottom: 4 },
  subtitle: { fontSize: 13, color: MUTED, lineHeight: 18 },
  recordBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(163,230,53,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(163,230,53,0.45)',
  },
  recordBtnTxt: { fontSize: 14, fontWeight: '800', color: LIME },

  filterRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
    backgroundColor: BG,
  },
  filterChip: {
    flex: 1,
    minWidth: 72,
    maxWidth: 120,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
  },
  filterChipSelected: {
    backgroundColor: PRIMARY_GREEN,
    borderColor: PRIMARY_GREEN,
  },
  filterChipTxt: { fontSize: 13, fontWeight: '700', color: MUTED2 },
  filterChipTxtSelected: { color: WHITE },

  coreRow: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
    backgroundColor: BG,
  },
  coreCol: { flex: 1, alignItems: 'center', justifyContent: 'center', minWidth: 0 },
  coreColBorder: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
  },
  coreBig: { fontSize: 26, fontWeight: '900', color: LIME, letterSpacing: -0.5 },
  coreSmall: { fontSize: 10, color: MUTED, marginTop: 6, textAlign: 'center' },

  tabBarWrap: {
    height: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
    backgroundColor: BG,
  },
  tabBarScrollContent: {
    paddingHorizontal: 8,
    alignItems: 'center',
    minHeight: 44,
  },
  tabItem: {
    position: 'relative',
    minWidth: 60,
    height: 44,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabItemTxt: { fontSize: 14, fontWeight: '700', color: MUTED },
  tabItemTxtSelected: { color: WHITE },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 8,
    right: 8,
    height: 2,
    borderRadius: 1,
    backgroundColor: PRIMARY_GREEN,
  },

  tabBodyScroll: { flex: 1 },
  tabBodyContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 28 + TAB_BAR_SCROLL_EXTRA,
    flexGrow: 1,
  },
  emptyBody: { paddingVertical: 24, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: WHITE },
  emptySub: { fontSize: 14, color: MUTED, lineHeight: 21 },
});
