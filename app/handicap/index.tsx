import { useFocusEffect } from '@react-navigation/native';
import { type Href, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Circle, Line, Polyline, Svg } from 'react-native-svg';

import { TAB_BAR_SCROLL_EXTRA } from '@/constants/theme';
import {
  buildHandicapTrend,
  calcHandicapIndex,
  fairwayPercent,
  loadHandicapRecords,
  type HandicapRecord,
} from '@/lib/handicap';
import { appendMockHandicapRounds } from '@/lib/mock-handicap-rounds';

const BG = '#0d1f10';
const WHITE = '#ffffff';
const CARD = 'rgba(255,255,255,0.05)';
const CARD_BORDER = 'rgba(255,255,255,0.08)';
const TEXT_SECONDARY = 'rgba(255,255,255,0.55)';
const TEXT_LABEL = 'rgba(255,255,255,0.35)';
const ACCENT = '#a3e635';
const ACCENT_TEXT = '#0d1f10';
const CHART_AXIS = 'rgba(255,255,255,0.35)';
const CHART_GRID = 'rgba(255,255,255,0.12)';
const DIVIDER = 'rgba(255,255,255,0.08)';
const HEADER_SUB = 'rgba(255,255,255,0.5)';
const WARN_CARD_BG = 'rgba(245, 158, 11, 0.12)';
const WARN_BORDER = 'rgba(245, 158, 11, 0.38)';
const WARN_TITLE = '#fcd34d';
const WARN_BODY = 'rgba(253, 224, 171, 0.9)';
const SI_BADGE_BORDER = 'rgba(163, 230, 53, 0.35)';
const SI_BADGE_BG = 'rgba(163, 230, 53, 0.12)';

function recordListMetrics(item: HandicapRecord) {
  const hasHoles = item.holeDetails.length > 0;
  const gross = hasHoles ? item.holeDetails.reduce((s, h) => s + h.strokes, 0) : item.adjustedGrossScore;
  const putts = hasHoles ? item.totalPutts : null;
  const fwPct = hasHoles && item.fairwaysTotal > 0 ? fairwayPercent(item.fairwaysHit, item.fairwaysTotal) : null;
  return { gross, putts, fwPct };
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

function TrendChart({ records }: { records: HandicapRecord[] }) {
  const width = 320;
  const height = 170;
  const pad = 24;
  const trend = buildHandicapTrend(records);
  const points = trend
    .map((item, idx) => ({ idx, date: item.date, index: item.index }))
    .filter((item): item is { idx: number; date: string; index: number } => typeof item.index === 'number');

  if (points.length < 2) {
    return (
      <Text style={[styles.chartEmpty, { color: TEXT_SECONDARY }]}>记录不足，暂无趋势曲线。</Text>
    );
  }

  const minY = Math.min(...points.map((p) => p.index));
  const maxY = Math.max(...points.map((p) => p.index));
  const yRange = Math.max(1, maxY - minY);
  const xMax = Math.max(1, trend.length - 1);

  const toX = (idx: number) => pad + ((width - pad * 2) * idx) / xMax;
  const toY = (value: number) => height - pad - ((height - pad * 2) * (value - minY)) / yRange;

  const polyline = points.map((p) => `${toX(p.idx)},${toY(p.index)}`).join(' ');
  const firstDate = trend[0]?.date ?? '';
  const lastDate = trend[trend.length - 1]?.date ?? '';

  return (
    <View>
      <Svg width={width} height={height}>
        <Line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke={CHART_GRID} strokeWidth="1" />
        <Line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke={CHART_GRID} strokeWidth="1" />
        <Polyline points={polyline} fill="none" stroke={ACCENT} strokeWidth="2.5" />
        {points.map((p) => (
          <Circle key={`${p.date}-${p.idx}`} cx={toX(p.idx)} cy={toY(p.index)} r="3.5" fill={ACCENT} />
        ))}
      </Svg>
      <View style={styles.chartBottom}>
        <Text style={[styles.chartAxis, { color: CHART_AXIS }]}>{firstDate}</Text>
        <Text style={[styles.chartAxis, { color: CHART_AXIS }]}>{lastDate}</Text>
      </View>
    </View>
  );
}

export default function HandicapIndexScreen() {
  const router = useRouter();
  const [records, setRecords] = useState<HandicapRecord[]>([]);

  function onBackOrHome() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.navigate('/(tabs)/index' as Href);
    }
  }

  useFocusEffect(
    useCallback(() => {
      setRecords(loadHandicapRecords());
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

  return (
    <View style={[styles.container, { backgroundColor: BG }]}>
      <View style={styles.topGreen}>
        <Text style={[styles.topGreenTitle, { color: WHITE }]}>差点</Text>
        <Text style={[styles.topGreenSub, { color: HEADER_SUB }]}>WHS 记录与趋势</Text>
      </View>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        bounces={false}>
        <View style={styles.headerRow}>
          <View style={styles.headerCol}>
            <Pressable onPress={onBackOrHome} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="返回">
              <Text style={[styles.sideText, { color: TEXT_SECONDARY }]}>← 返回</Text>
            </Pressable>
          </View>
          <View style={styles.headerColCenter}>
            <Text style={[styles.title, { color: WHITE }]}>我的差点</Text>
          </View>
          <View style={[styles.headerCol, styles.headerColRight]}>
            <Pressable style={styles.addBtn} onPress={() => router.push('/handicap/add')}>
              <Text style={[styles.addBtnText, { color: ACCENT_TEXT }]}>+ 添加</Text>
            </Pressable>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: CARD, borderColor: CARD_BORDER }]}>
          <Text style={[styles.indexNumber, { color: WHITE }]}>
            {typeof handicapIndex === 'number' ? handicapIndex.toFixed(1) : '暂无'}
          </Text>
          {typeof handicapIndex === 'number' ? (
            <Text style={[styles.indexSub, { color: TEXT_SECONDARY }]}>基于最近{recentCount}场成绩</Text>
          ) : (
            <Text style={[styles.indexSub, { color: TEXT_SECONDARY }]}>再记录{needMore}场后生成差点</Text>
          )}
        </View>

        {stabilityWarning ? (
          <View style={[styles.warnCard, { backgroundColor: WARN_CARD_BG, borderColor: WARN_BORDER }]}>
            <Text style={[styles.warnTitle, { color: WARN_TITLE }]}>⚠️ 差点参考价值有限</Text>
            <Text style={[styles.warnBody, { color: WARN_BODY }]}>
              你的实际均杆约 {stabilityWarning.actualAvgRounded}，但差点对应预期成绩约{' '}
              {stabilityWarning.expectedRounded}，相差 {stabilityWarning.diffRounded}{' '}
              杆。场次较少时，一场异常好的成绩会拉低整体差点，建议累计更多场次后参考。
            </Text>
          </View>
        ) : null}

        <View style={[styles.card, { backgroundColor: CARD, borderColor: CARD_BORDER }]}>
          <Text style={[styles.sectionTitle, { color: WHITE }]}>历史趋势</Text>
          <TrendChart records={records} />
        </View>

        <View style={[styles.card, { backgroundColor: CARD, borderColor: CARD_BORDER }]}>
          <Text style={[styles.sectionTitle, { color: WHITE }]}>成绩记录</Text>
          {records.length ? (
            records.map((item) => {
              const { gross, putts, fwPct } = recordListMetrics(item);
              return (
                <Pressable
                  key={item.id}
                  style={[styles.recordRow, { borderBottomColor: DIVIDER }]}
                  onPress={() => router.push(`/handicap/${item.id}`)}>
                  <View style={styles.recordLeft}>
                    <Text style={[styles.recordDate, { color: WHITE }]}>{item.date}</Text>
                    <View style={styles.recordCourseRow}>
                      <Text style={[styles.recordCourse, { color: WHITE }]} numberOfLines={1}>
                        {item.courseName}
                      </Text>
                      {item.strokeIndexMap?.length ? (
                        <View style={styles.siBadge}>
                          <Text style={styles.siBadgeTxt}>精确</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <View style={styles.recordRight}>
                    <Text style={[styles.recordScore, { color: WHITE }]}>{gross}杆</Text>
                    <Text style={[styles.recordMeta, { color: TEXT_SECONDARY }]}>
                      {putts !== null ? `推杆${putts}次` : '推杆 —'}
                    </Text>
                    <Text style={[styles.recordMeta, { color: TEXT_SECONDARY }]}>
                      {fwPct !== null ? `球道${fwPct}%` : '球道 —'}
                    </Text>
                    <Text style={[styles.recordDiff, { color: TEXT_SECONDARY }]}>
                      微差 {item.scoreDifferential.toFixed(1)}
                    </Text>
                  </View>
                </Pressable>
              );
            })
          ) : (
            <Text style={[styles.empty, { color: TEXT_LABEL }]}>还没有成绩，点击右上角添加首场记录。</Text>
          )}
        </View>

        {__DEV__ ? (
          <Pressable
            style={[styles.devSeedBtn, { borderColor: CARD_BORDER, backgroundColor: CARD }]}
            onPress={() => {
              Alert.alert('导入模拟数据', '将追加 20 场随机 18 洞成绩到本机（不影响账号云端）。确定？', [
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
            <Text style={[styles.devSeedTxt, { color: TEXT_SECONDARY }]}>（开发）导入 20 场模拟成绩</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topGreen: {
    backgroundColor: '#0d1f10',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
  },
  topGreenTitle: { fontSize: 24, fontWeight: '700', marginBottom: 2 },
  topGreenSub: { fontSize: 12 },
  flex: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'web' ? 44 : 16,
    paddingBottom: 20 + TAB_BAR_SCROLL_EXTRA,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  headerCol: { flex: 1, justifyContent: 'center', alignItems: 'flex-start' },
  headerColCenter: { flex: 2, alignItems: 'center' },
  headerColRight: { flex: 1, alignItems: 'flex-end', paddingRight: 16 },
  backBtn: { alignSelf: 'flex-start' },
  title: { textAlign: 'center', fontSize: 20, fontWeight: '700' },
  addBtn: {
    alignSelf: 'flex-end',
    backgroundColor: ACCENT,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addBtnText: { fontSize: 13, fontWeight: '800' },
  sideText: { fontSize: 13, fontWeight: '600' },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  indexNumber: { fontSize: 44, lineHeight: 48, fontWeight: '800' },
  indexSub: { marginTop: 6, fontSize: 13 },
  warnCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  warnTitle: { fontSize: 15, fontWeight: '800', marginBottom: 8 },
  warnBody: { fontSize: 13, lineHeight: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10 },
  chartBottom: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -2 },
  chartAxis: { fontSize: 11 },
  chartEmpty: { fontSize: 13, lineHeight: 20 },
  recordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  recordLeft: { flex: 1, minWidth: 0 },
  recordDate: { fontSize: 12, marginBottom: 2 },
  recordCourseRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  recordCourse: { fontSize: 14, fontWeight: '600', flexShrink: 1 },
  siBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: SI_BADGE_BORDER,
    backgroundColor: SI_BADGE_BG,
  },
  siBadgeTxt: { fontSize: 10, fontWeight: '700', color: ACCENT },
  recordRight: { alignItems: 'flex-end', maxWidth: '52%' },
  recordScore: { fontSize: 13, fontWeight: '700' },
  recordMeta: { marginTop: 2, fontSize: 11 },
  recordDiff: { marginTop: 2, fontSize: 12 },
  empty: { fontSize: 13, lineHeight: 20 },
  devSeedBtn: {
    marginTop: 8,
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  devSeedTxt: { fontSize: 13, fontWeight: '600' },
});
