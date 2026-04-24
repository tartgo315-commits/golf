import { useFocusEffect } from '@react-navigation/native';
import { type Href, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Polyline } from 'react-native-svg';

import { HandicapGoalModal } from '@/components/HandicapGoalModal';
import { RoundLockIndicator } from '@/components/RoundLockIndicator';
import { TAB_BAR_SCROLL_EXTRA } from '@/constants/theme';
import {
  buildHandicapTrend,
  calcHandicapIndex,
  fairwayPercent,
  loadHandicapRecords,
  recordHasPendingRoundStats,
  type HandicapRecord,
} from '@/lib/handicap';
import { appendMockHandicapRounds } from '@/lib/mock-handicap-rounds';
import {
  computeGoalProgressPercent,
  computeGoalStartHi,
  getHandicapGoal,
  isGoalAchieved,
  predictGoalMonths,
  setHandicapGoal,
} from '@/utils/handicapGoal';
import { ensureRegisteredOnServer, getFriendList, syncPublicHandicapToServer, type FriendListItem } from '@/utils/friendSystem';

const PAGE_BG = '#0d1b11';
const CARD_BG = '#16261c';
const ACCENT = '#b5ff3a';
const WARN_ORANGE = '#e89b3a';
const TEXT_MAIN = '#e8f0e5';
const TEXT_SEC = '#a8b5ac';
const TEXT_TERTIARY = '#8a9a8e';
const TEXT_MUTED = '#5a6b5f';
const DIVIDER = 'rgba(255,255,255,0.06)';
const BTN_BG = '#1e3a26';
const BTN_BORDER = '#2d5436';
const CHIP_BG = 'rgba(255,255,255,0.04)';
const WARN_BG = 'rgba(232, 155, 58, 0.06)';
const CHART_GRID = 'rgba(255,255,255,0.08)';

function recordListMetrics(item: HandicapRecord) {
  const hasHoles = item.holeDetails.length > 0;
  const gross = hasHoles ? item.holeDetails.reduce((s, h) => s + h.strokes, 0) : item.adjustedGrossScore;
  const putts = item.totalPutts != null && Number.isFinite(item.totalPutts) ? item.totalPutts : null;
  const fwPct = fairwayPercent(item.fairwaysHit, item.fairwaysTotal);
  const girPct =
    item.greensInRegulation != null && item.holes > 0
      ? Math.round((item.greensInRegulation / item.holes) * 100)
      : null;
  return { gross, putts, fwPct, girPct };
}

type StabilityWarning = {
  actualAvgRounded: number;
  expectedRounded: number;
  diffRounded: number;
};

function computeStabilityWarning(
  records: HandicapRecord[],
  handicapIndex: number | null,
): StabilityWarning | null {
  if (records.length === 0) return null;
  if (typeof handicapIndex !== 'number' || !Number.isFinite(handicapIndex)) return null;
  const sum = records.reduce((s, r) => s + r.adjustedGrossScore, 0);
  const actualAvg = sum / records.length;
  const expectedScore = 72 + handicapIndex;
  const diff = actualAvg - expectedScore;
  if (!(diff > 5)) return null;
  return {
    actualAvgRounded: Math.round(actualAvg * 10) / 10,
    expectedRounded: Math.round(expectedScore * 10) / 10,
    diffRounded: Math.round(diff * 10) / 10,
  };
}

function HeroSparkline({ values }: { values: readonly number[] }) {
  const w = 120;
  const h = 40;
  const pad = 4;
  if (values.length < 2) {
    return <View style={{ width: w, height: h }} />;
  }
  const vmin = Math.min(...values);
  const vmax = Math.max(...values);
  const span = vmax - vmin || 1;
  const n = values.length;
  const pts = values.map((v, i) => {
    const x = pad + (n === 1 ? (w - pad * 2) / 2 : (i / (n - 1)) * (w - pad * 2));
    const y = pad + (1 - (v - vmin) / span) * (h - pad * 2);
    return { x, y };
  });
  const linePts = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1]!;
  const areaPath = `M ${pad} ${h - pad} L ${pts.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L ')} L ${w - pad} ${h - pad} Z`;

  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <Path d={areaPath} fill={ACCENT} fillOpacity={0.08} />
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

function TrendChartBlock({ records }: { records: HandicapRecord[] }) {
  const width = 320;
  const height = 160;
  const pad = 20;
  const trend = buildHandicapTrend(records);
  const points = trend
    .map((item, idx) => ({ idx, date: item.date, index: item.index }))
    .filter((item): item is { idx: number; date: string; index: number } => typeof item.index === 'number');

  if (records.length < 4 || points.length < 2) {
    return (
      <Text style={styles.chartEmpty}>记录不足 4 场，暂无趋势曲线。</Text>
    );
  }

  const minY = Math.min(...points.map((p) => p.index));
  const maxY = Math.max(...points.map((p) => p.index));
  const yRange = Math.max(0.5, maxY - minY);
  const xMax = Math.max(1, trend.length - 1);

  const toX = (idx: number) => pad + ((width - pad * 2) * idx) / xMax;
  const toY = (value: number) => height - pad - ((height - pad * 2) * (value - minY)) / yRange;

  const linePts = points.map((p) => `${toX(p.idx)},${toY(p.index)}`).join(' ');
  const firstPt = points[0]!;
  const lastPt = points[points.length - 1]!;
  const areaD = [
    `M ${toX(firstPt.idx)} ${height - pad}`,
    ...points.map((p) => `L ${toX(p.idx)} ${toY(p.index)}`),
    `L ${toX(lastPt.idx)} ${height - pad}`,
    'Z',
  ].join(' ');

  const tickDates = (() => {
    const n = trend.length;
    if (n <= 4) return trend.map((t) => t.date);
    const ix = [0, Math.floor(n / 3), Math.floor((2 * n) / 3), n - 1];
    return ix.map((i) => trend[i]!.date);
  })();

  return (
    <View>
      <Svg width={width} height={height}>
        <Line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke={CHART_GRID} strokeWidth={1} />
        <Line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke={CHART_GRID} strokeWidth={1} />
        <Path d={areaD} fill={ACCENT} fillOpacity={0.08} />
        <Polyline points={linePts} fill="none" stroke={ACCENT} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p) => (
          <Circle key={`${p.date}-${p.idx}`} cx={toX(p.idx)} cy={toY(p.index)} r={3} fill={ACCENT} />
        ))}
      </Svg>
      <View style={styles.chartTicks}>
        {tickDates.map((d, i) => (
          <Text key={`${d}-${i}`} style={styles.chartTickTxt} numberOfLines={1}>
            {d.slice(5)}
          </Text>
        ))}
      </View>
    </View>
  );
}

function PencilIcon12() {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24">
      <Path
        d="M4 20h4l10-10-4-4L4 16v4z"
        fill="none"
        stroke="#5a6b5f"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path d="M14 6l4 4" stroke="#5a6b5f" strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function WarnTriangle() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" style={{ marginRight: 8 }}>
      <Path
        d="M12 3L2 20h20L12 3z"
        fill="none"
        stroke={WARN_ORANGE}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Path d="M12 9v4M12 17h.01" stroke={WARN_ORANGE} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

export default function HandicapIndexScreen() {
  const router = useRouter();
  const [records, setRecords] = useState<HandicapRecord[]>([]);
  const [goalValue, setGoalValue] = useState<number | null>(null);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [friendPeek, setFriendPeek] = useState<FriendListItem[]>([]);

  useFocusEffect(
    useCallback(() => {
      setRecords(loadHandicapRecords());
      void getHandicapGoal().then(setGoalValue);
      void ensureRegisteredOnServer();
      void syncPublicHandicapToServer();
      void getFriendList(false).then(setFriendPeek);
      return () => {};
    }, []),
  );

  const handicapIndex = useMemo(() => calcHandicapIndex(records), [records]);
  const recentCount = Math.min(records.length, 20);
  const needMore = Math.max(0, 3 - records.length);
  const stabilityWarning = useMemo(
    () => computeStabilityWarning(records, handicapIndex),
    [records, handicapIndex],
  );

  const trendSeries = useMemo(() => {
    const t = buildHandicapTrend(records);
    return t.map((x) => x.index).filter((v): v is number => typeof v === 'number');
  }, [records]);

  const deltaMark = useMemo(() => {
    if (trendSeries.length < 2) return null;
    const a = trendSeries[trendSeries.length - 2]!;
    const b = trendSeries[trendSeries.length - 1]!;
    const d = b - a;
    if (Math.abs(d) < 0.05) return null;
    const abs = Math.abs(d).toFixed(1);
    if (d < 0) return { text: `↓ ${abs}`, down: true };
    return { text: `↑ ${abs}`, down: false };
  }, [trendSeries]);

  const avgGrossAll = useMemo(() => {
    if (records.length === 0) return null;
    const s = records.reduce((acc, r) => acc + r.adjustedGrossScore, 0);
    return s / records.length;
  }, [records]);

  const showWarningCard =
    (records.length > 0 && records.length < 8) || stabilityWarning != null;

  const warningBody = [
    records.length > 0 && records.length < 8
      ? `当前仅 ${records.length} 场记录，建议累计至少 8 场后再参考差点稳定性。`
      : null,
    stabilityWarning
      ? `你的实际均杆约 ${stabilityWarning.actualAvgRounded}，差点对应预期成绩约 ${stabilityWarning.expectedRounded}，相差 ${stabilityWarning.diffRounded} 杆。场次较少时，一场异常好的成绩会拉低整体差点。`
      : null,
  ]
    .filter(Boolean)
    .join('\n\n');

  const startHi = useMemo(
    () => computeGoalStartHi(records, handicapIndex),
    [records, handicapIndex],
  );
  const goalAchieved = useMemo(
    () => goalValue != null && isGoalAchieved(handicapIndex, goalValue),
    [goalValue, handicapIndex],
  );
  const goalProgressPct = useMemo(() => {
    if (goalValue == null || typeof handicapIndex !== 'number' || typeof startHi !== 'number') return 0;
    return computeGoalProgressPercent(startHi, handicapIndex, goalValue);
  }, [goalValue, handicapIndex, startHi]);

  const goalPredictionText = useMemo(() => {
    if (goalValue == null || goalAchieved || typeof handicapIndex !== 'number') return null;
    const r = predictGoalMonths({ records, currentHi: handicapIndex, targetHi: goalValue });
    if (r.kind === 'insufficient') return '成绩再多一些就能预测啦';
    if (r.kind === 'flat') return '按当前趋势，短期内难以预计达成时间';
    return `按当前进度，预计 ${r.months} 个月后达成`;
  }, [goalValue, goalAchieved, handicapIndex, records]);

  const onSaveGoal = useCallback(async (v: number) => {
    await setHandicapGoal(v);
    setGoalValue(v);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: PAGE_BG }]}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        bounces={false}>
        <View style={styles.titleBar}>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>差点</Text>
            <Text style={styles.subtitle}>WHS 记录与趋势</Text>
          </View>
          <Pressable
            style={styles.addBtn}
            onPress={() => router.push('/handicap/add' as Href)}
            accessibilityRole="button"
            accessibilityLabel="添加成绩">
            <Text style={styles.addBtnTxt}>+ 添加</Text>
          </Pressable>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroLeft}>
            <Text style={styles.heroLab}>当前差点</Text>
            <Text style={styles.heroBig}>
              {typeof handicapIndex === 'number' ? handicapIndex.toFixed(1) : '—'}
            </Text>
            <Text style={styles.heroFoot}>
              {typeof handicapIndex === 'number'
                ? `基于最近 ${recentCount} 场成绩`
                : needMore > 0
                  ? `再记录 ${needMore} 场后生成差点`
                  : '—'}
            </Text>
          </View>
          <View style={styles.heroVLine} />
          <View style={styles.heroRight}>
            <View style={styles.heroDeltaRow}>
              <Text style={styles.heroDeltaPlaceholder} />
              {deltaMark ? (
                <Text style={[styles.heroDeltaTxt, deltaMark.down ? styles.deltaDown : styles.deltaUp]}>
                  {deltaMark.text}
                </Text>
              ) : (
                <View style={styles.heroDeltaSpacer} />
              )}
            </View>
            <HeroSparkline values={trendSeries} />
          </View>
        </View>

        <Pressable
          style={styles.friendEntry}
          onPress={() => router.push('/friends' as Href)}
          accessibilityRole="button"
          accessibilityLabel="好友差点对比">
          <View style={styles.friendAvatars}>
            {friendPeek.slice(0, 3).map((f, i) => (
              <View
                key={f.userId}
                style={[styles.friendPeekAvatar, { marginLeft: i > 0 ? -10 : 0, zIndex: 3 - i }]}>
                <Text style={styles.friendPeekLetter}>{f.name.slice(0, 1).toUpperCase()}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.friendEntryTxt}>{friendPeek.length ? '查看对比 ›' : '邀请好友 ›'}</Text>
        </Pressable>

        <View style={styles.goalCard}>
          {goalValue == null ? (
            <Pressable
              style={styles.goalSetBtn}
              onPress={() => setGoalModalOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="设定目标差点">
              <Text style={styles.goalSetBtnTxt}>设定目标差点</Text>
            </Pressable>
          ) : (
            <>
              <View style={styles.goalHeadRow}>
                <Text style={styles.goalHeadLab}>目标差点</Text>
                <Pressable
                  onPress={() => setGoalModalOpen(true)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="编辑目标差点">
                  <PencilIcon12 />
                </Pressable>
              </View>
              <View style={styles.goalNumRow}>
                <Text style={styles.goalNumCurrent}>
                  {typeof handicapIndex === 'number' ? handicapIndex.toFixed(1) : '—'}
                </Text>
                <Text style={styles.goalArrow}>→</Text>
                <Text style={styles.goalNumTarget}>{goalValue.toFixed(1)}</Text>
              </View>
              <View style={styles.goalTrack}>
                <View style={[styles.goalFill, { width: `${goalProgressPct}%` }]} />
              </View>
              <View style={styles.goalBadgeRow}>
                {goalAchieved ? (
                  <View style={styles.goalDoneBadge}>
                    <Text style={styles.goalDoneBadgeTxt}>已达成 🎯</Text>
                  </View>
                ) : null}
              </View>
              {goalPredictionText && !goalAchieved ? (
                <Text style={styles.goalPredict}>{goalPredictionText}</Text>
              ) : null}
            </>
          )}
        </View>

        <HandicapGoalModal
          visible={goalModalOpen}
          onRequestClose={() => setGoalModalOpen(false)}
          currentHi={handicapIndex}
          initialGoal={goalValue}
          onSave={(v) => void onSaveGoal(v)}
        />

        {showWarningCard ? (
          <View style={styles.warnCard}>
            <View style={styles.warnHeadRow}>
              <WarnTriangle />
              <Text style={styles.warnTitle}>差点参考价值有限</Text>
            </View>
            <Text style={styles.warnBody}>{warningBody}</Text>
          </View>
        ) : null}

        <Text style={styles.sectionHeading}>历史趋势</Text>
        <View style={styles.card}>
          <TrendChartBlock records={records} />
        </View>

        <View style={styles.recordsHead}>
          <Text style={styles.sectionHeading}>成绩记录</Text>
          {records.length ? (
            <Pressable onPress={() => router.push('/handicap/history' as Href)} hitSlop={8}>
              <Text style={styles.seeAll}>查看全部 ›</Text>
            </Pressable>
          ) : null}
        </View>

        {records.length ? (
          records.map((item) => {
            const { gross, putts, fwPct, girPct } = recordListMetrics(item);
            const belowAvg = avgGrossAll != null && gross <= avgGrossAll;
            const pending = recordHasPendingRoundStats(item);
            return (
              <Pressable
                key={item.id}
                style={styles.recordCard}
                onPress={() => router.push(`/handicap/${item.id}` as Href)}>
                <View style={styles.recordLockCorner} pointerEvents="box-none">
                  <RoundLockIndicator round={item} />
                </View>
                <View style={styles.recordTop}>
                  <View style={styles.recordTopLeft}>
                    <Text style={styles.recordDate}>{item.date}</Text>
                    <View style={styles.recordNameRow}>
                      <Text style={styles.recordCourse} numberOfLines={1}>
                        {item.courseName}
                      </Text>
                      {item.strokeIndexMap?.length ? (
                        <View style={styles.siBadge}>
                          <Text style={styles.siBadgeTxt}>精确</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <Text style={[styles.recordScoreBig, belowAvg ? styles.scoreGood : styles.scoreHigh]}>
                    {gross}
                  </Text>
                </View>
                <View style={styles.chipRow}>
                  <View style={styles.chip}>
                    <Text style={styles.chipTxt}>微差 {item.scoreDifferential.toFixed(1)}</Text>
                  </View>
                  {putts != null ? (
                    <View style={styles.chip}>
                      <Text style={styles.chipTxt}>推杆 {putts}</Text>
                    </View>
                  ) : null}
                  {fwPct != null ? (
                    <View style={styles.chip}>
                      <Text style={styles.chipTxt}>球道 {fwPct}%</Text>
                    </View>
                  ) : null}
                  {girPct != null ? (
                    <View style={styles.chip}>
                      <Text style={styles.chipTxt}>GIR {girPct}%</Text>
                    </View>
                  ) : null}
                </View>
                {pending ? <Text style={styles.statsPendingFooter}>统计待补填</Text> : null}
              </Pressable>
            );
          })
        ) : (
          <View style={styles.card}>
            <Text style={styles.empty}>还没有成绩，点击右上角添加首场记录。</Text>
          </View>
        )}

        {__DEV__ ? (
          <Pressable
            style={styles.devSeedBtn}
            onPress={() => {
              Alert.alert('导入模拟数据', '将追加 20 场随机 18 洞成绩到本机。确定？', [
                { text: '取消', style: 'cancel' },
                {
                  text: '导入',
                  onPress: () => {
                    const n = appendMockHandicapRounds(20);
                    setRecords(loadHandicapRecords());
                    Alert.alert('完成', `已追加 ${n} 场模拟成绩。`);
                  },
                },
              ]);
            }}>
            <Text style={styles.devSeedTxt}>（开发）导入 20 场模拟成绩</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    /** 与成绩 Tab 顶栏一致；Web 顶距由根布局 `safe-area-inset-top` 处理，避免重复垫高 */
    paddingTop: 16,
    paddingBottom: 24 + TAB_BAR_SCROLL_EXTRA,
    gap: 0,
  },
  titleBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 14,
    gap: 12,
  },
  titleBlock: { flex: 1, minWidth: 0 },
  title: { fontSize: 22, fontWeight: '800', color: TEXT_MAIN, marginBottom: 4, letterSpacing: -0.5 },
  subtitle: { fontSize: 12, fontWeight: '500', color: TEXT_TERTIARY, lineHeight: 17 },
  addBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: BTN_BG,
    borderWidth: 1,
    borderColor: BTN_BORDER,
  },
  addBtnTxt: { fontSize: 14, fontWeight: '700', color: ACCENT },

  heroCard: {
    flexDirection: 'row',
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    alignItems: 'stretch',
  },

  friendEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: CARD_BG,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  friendAvatars: { flexDirection: 'row', alignItems: 'center' },
  friendPeekAvatar: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(181,255,58,0.12)',
    borderWidth: 2,
    borderColor: CARD_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendPeekLetter: { fontSize: 11, fontWeight: '800', color: ACCENT },
  friendEntryTxt: { fontSize: 11, fontWeight: '700', color: ACCENT },
  goalCard: {
    backgroundColor: '#16261c',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  goalSetBtn: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2d5436',
    backgroundColor: 'transparent',
  },
  goalSetBtnTxt: { fontSize: 14, fontWeight: '700', color: ACCENT },
  goalHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  goalHeadLab: { fontSize: 11, fontWeight: '700', color: TEXT_TERTIARY },
  goalNumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 14,
  },
  goalNumCurrent: { fontSize: 22, fontWeight: '800', color: ACCENT },
  goalArrow: { fontSize: 18, fontWeight: '600', color: TEXT_MUTED },
  goalNumTarget: { fontSize: 22, fontWeight: '800', color: TEXT_MAIN },
  goalTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  goalFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: ACCENT,
  },
  goalBadgeRow: { marginTop: 8, minHeight: 22, alignItems: 'center' },
  goalDoneBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(181,255,58,0.12)',
  },
  goalDoneBadgeTxt: { fontSize: 11, fontWeight: '700', color: ACCENT },
  goalPredict: {
    marginTop: 10,
    fontSize: 11,
    fontWeight: '600',
    color: TEXT_TERTIARY,
    textAlign: 'center',
    lineHeight: 16,
  },
  heroLeft: { flex: 1, minWidth: 0 },
  heroLab: { fontSize: 11, fontWeight: '700', color: TEXT_TERTIARY, marginBottom: 6 },
  heroBig: {
    fontSize: 44,
    fontWeight: '800',
    color: ACCENT,
    letterSpacing: -1.2,
    lineHeight: 48,
  },
  heroFoot: { fontSize: 12, fontWeight: '500', color: TEXT_SEC, marginTop: 8, lineHeight: 18 },
  heroVLine: { width: 1, backgroundColor: DIVIDER, marginHorizontal: 10 },
  heroRight: { width: 128, justifyContent: 'flex-end' },
  heroDeltaRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', minHeight: 14, marginBottom: 4 },
  heroDeltaPlaceholder: { flex: 1 },
  heroDeltaSpacer: { height: 14 },
  heroDeltaTxt: { fontSize: 11, fontWeight: '800' },
  deltaUp: { color: WARN_ORANGE },
  deltaDown: { color: ACCENT },

  warnCard: {
    backgroundColor: WARN_BG,
    borderLeftWidth: 3,
    borderLeftColor: WARN_ORANGE,
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  warnHeadRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  warnTitle: { fontSize: 13, fontWeight: '700', color: WARN_ORANGE, flex: 1 },
  warnBody: { fontSize: 12, fontWeight: '500', color: TEXT_SEC, lineHeight: 19 },

  sectionHeading: { fontSize: 13, fontWeight: '700', color: TEXT_SEC, marginBottom: 8, marginTop: 4 },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  chartEmpty: { fontSize: 13, fontWeight: '500', color: TEXT_SEC, lineHeight: 20 },
  chartTicks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingHorizontal: 4,
  },
  chartTickTxt: { fontSize: 10, fontWeight: '600', color: TEXT_MUTED, flex: 1, textAlign: 'center' },

  recordsHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 8,
  },
  seeAll: { fontSize: 12, fontWeight: '600', color: ACCENT },

  recordCard: {
    position: 'relative',
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  recordLockCorner: { position: 'absolute', top: 10, right: 10, zIndex: 2 },
  recordTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    paddingRight: 22,
  },
  recordTopLeft: { flex: 1, minWidth: 0 },
  recordDate: { fontSize: 11, fontWeight: '600', color: TEXT_MUTED, marginBottom: 4 },
  recordNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  recordCourse: { fontSize: 14, fontWeight: '700', color: TEXT_MAIN, flexShrink: 1 },
  siBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(181,255,58,0.35)',
    backgroundColor: 'rgba(181,255,58,0.1)',
  },
  siBadgeTxt: { fontSize: 10, fontWeight: '700', color: ACCENT },
  recordScoreBig: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.6,
    minWidth: 40,
    textAlign: 'right',
  },
  scoreGood: { color: ACCENT },
  scoreHigh: { color: WARN_ORANGE },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: {
    backgroundColor: CHIP_BG,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipTxt: { fontSize: 11, fontWeight: '600', color: TEXT_SEC },
  statsPendingFooter: {
    marginTop: 10,
    fontSize: 10,
    fontWeight: '600',
    color: WARN_ORANGE,
  },
  empty: { fontSize: 13, fontWeight: '500', color: TEXT_SEC, lineHeight: 20 },
  devSeedBtn: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: DIVIDER,
  },
  devSeedTxt: { fontSize: 13, fontWeight: '600', color: TEXT_SEC },
});
