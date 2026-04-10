import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Circle, Line, Polyline, Svg } from 'react-native-svg';

import { buildHandicapTrend, calcHandicapIndex, loadHandicapRecords, type HandicapRecord } from '@/lib/handicap';

const GREEN = '#166534';
const BG = '#f3f4f6';
const WHITE = '#ffffff';
const BORDER = '#e5e7eb';
const TEXT_PRIMARY = '#111827';
const TEXT_SECONDARY = '#6b7280';
const LIGHT_GREEN = '#dcfce7';

function TrendChart({ records }: { records: HandicapRecord[] }) {
  const width = 320;
  const height = 170;
  const pad = 24;
  const trend = buildHandicapTrend(records);
  const points = trend
    .map((item, idx) => ({ idx, date: item.date, index: item.index }))
    .filter((item): item is { idx: number; date: string; index: number } => typeof item.index === 'number');

  if (points.length < 2) {
    return <Text style={styles.chartEmpty}>记录不足，暂无趋势曲线。</Text>;
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
        <Line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke="#d1d5db" strokeWidth="1" />
        <Line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="#d1d5db" strokeWidth="1" />
        <Polyline points={polyline} fill="none" stroke={GREEN} strokeWidth="2.5" />
        {points.map((p) => (
          <Circle key={`${p.date}-${p.idx}`} cx={toX(p.idx)} cy={toY(p.index)} r="3.5" fill={GREEN} />
        ))}
      </Svg>
      <View style={styles.chartBottom}>
        <Text style={styles.chartAxis}>{firstDate}</Text>
        <Text style={styles.chartAxis}>{lastDate}</Text>
      </View>
    </View>
  );
}

export default function HandicapIndexScreen() {
  const router = useRouter();
  const [records, setRecords] = useState<HandicapRecord[]>([]);

  useFocusEffect(
    useCallback(() => {
      setRecords(loadHandicapRecords());
      return () => {};
    }, []),
  );

  const handicapIndex = useMemo(() => calcHandicapIndex(records), [records]);
  const recentCount = Math.min(records.length, 20);
  const needMore = Math.max(0, 3 - records.length);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} bounces={false}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>我的差点</Text>
          <Pressable style={styles.addBtn} onPress={() => router.push('/handicap/add')}>
            <Text style={styles.addBtnText}>+ 添加成绩</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.indexNumber}>{typeof handicapIndex === 'number' ? handicapIndex.toFixed(1) : '暂无'}</Text>
          {typeof handicapIndex === 'number' ? (
            <Text style={styles.indexSub}>基于最近{recentCount}场成绩</Text>
          ) : (
            <Text style={styles.indexSub}>再记录{needMore}场后生成差点</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>历史趋势</Text>
          <TrendChart records={records} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>成绩记录</Text>
          {records.length ? (
            records.map((item) => (
              <Pressable key={item.id} style={styles.recordRow} onPress={() => router.push(`/handicap/${item.id}`)}>
                <View style={styles.recordLeft}>
                  <Text style={styles.recordDate}>{item.date}</Text>
                  <Text style={styles.recordCourse} numberOfLines={1}>
                    {item.courseName}
                  </Text>
                </View>
                <View style={styles.recordRight}>
                  <Text style={styles.recordScore}>{item.adjustedGrossScore}杆</Text>
                  <Text style={styles.recordDiff}>微差 {item.scoreDifferential.toFixed(1)}</Text>
                </View>
              </Pressable>
            ))
          ) : (
            <Text style={styles.empty}>还没有成绩，点击右上角添加首场记录。</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  flex: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'web' ? 44 : 16,
    paddingBottom: 20,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8 },
  title: { fontSize: 22, fontWeight: '700', color: TEXT_PRIMARY },
  addBtn: {
    borderWidth: 0.5,
    borderColor: GREEN,
    borderRadius: 10,
    backgroundColor: LIGHT_GREEN,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  addBtnText: { color: GREEN, fontSize: 13, fontWeight: '700' },
  card: {
    backgroundColor: WHITE,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: BORDER,
    padding: 14,
    marginBottom: 10,
  },
  indexNumber: { fontSize: 44, lineHeight: 48, color: GREEN, fontWeight: '800' },
  indexSub: { marginTop: 6, fontSize: 13, color: TEXT_SECONDARY },
  sectionTitle: { fontSize: 15, color: TEXT_PRIMARY, fontWeight: '700', marginBottom: 10 },
  chartBottom: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -2 },
  chartAxis: { fontSize: 11, color: TEXT_SECONDARY },
  chartEmpty: { fontSize: 13, color: TEXT_SECONDARY, lineHeight: 20 },
  recordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: BG,
    gap: 10,
  },
  recordLeft: { flex: 1, minWidth: 0 },
  recordDate: { fontSize: 12, color: TEXT_SECONDARY, marginBottom: 2 },
  recordCourse: { fontSize: 14, color: TEXT_PRIMARY, fontWeight: '600' },
  recordRight: { alignItems: 'flex-end' },
  recordScore: { fontSize: 13, color: TEXT_PRIMARY, fontWeight: '700' },
  recordDiff: { marginTop: 2, fontSize: 12, color: TEXT_SECONDARY },
  empty: { fontSize: 13, color: TEXT_SECONDARY, lineHeight: 20 },
});
