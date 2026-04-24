import { useFocusEffect } from '@react-navigation/native';
import { type Href, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { RoundLockIndicator } from '@/components/RoundLockIndicator';
import { DARK_PAGE } from '@/constants/theme';
import { fairwayPercent, loadHandicapRecords, type HandicapRecord } from '@/lib/handicap';

const BG = DARK_PAGE.bg;
const CARD = DARK_PAGE.card;
const BORDER = DARK_PAGE.cardBorder;
const TEXT = DARK_PAGE.text;
const TEXT_SECONDARY = DARK_PAGE.textSecondary;
const ACCENT = DARK_PAGE.accent;

function daysSince(dateStr: string) {
  const d = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  return d === 0 ? '今天' : d === 1 ? '昨天' : `${d}天前`;
}

function rowMetrics(item: HandicapRecord) {
  const hasHoles = item.holeDetails.length > 0;
  const gross = hasHoles ? item.holeDetails.reduce((s, h) => s + h.strokes, 0) : item.adjustedGrossScore;
  const putts = hasHoles ? item.totalPutts : null;
  const fwPct = hasHoles && item.fairwaysTotal > 0 ? fairwayPercent(item.fairwaysHit, item.fairwaysTotal) : null;
  return { gross, putts, fwPct };
}

export default function HandicapHistoryScreen() {
  const router = useRouter();
  const [records, setRecords] = useState<HandicapRecord[]>([]);

  useFocusEffect(
    useCallback(() => {
      setRecords(loadHandicapRecords());
      return () => {};
    }, []),
  );

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10} accessibilityRole="button">
          <Text style={styles.backTxt}>← 返回</Text>
        </Pressable>
        <Text style={styles.title}>全部成绩</Text>
        <Text style={styles.sub}>按时间由新到旧</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}>
        {records.length === 0 ? (
          <Text style={styles.empty}>暂无记录，去「成绩」里记一轮吧。</Text>
        ) : (
          records.map((item) => {
            const { gross, putts, fwPct } = rowMetrics(item);
            return (
              <Pressable
                key={item.id}
                style={styles.row}
                onPress={() => router.push(`/handicap/${item.id}` as Href)}>
                <View style={styles.rowLockCorner} pointerEvents="box-none">
                  <RoundLockIndicator round={item} />
                </View>
                <View style={styles.rowLeft}>
                  <Text style={styles.date}>{item.date}</Text>
                  <Text style={styles.course} numberOfLines={2}>
                    {item.courseName}
                  </Text>
                  <Text style={styles.meta}>
                    {item.holes}洞 · {daysSince(item.date)}
                    {item.strokeIndexMap?.length ? ' · 精确 SI' : ''}
                  </Text>
                </View>
                <View style={styles.rowRight}>
                  <Text style={styles.gross}>{gross}</Text>
                  <Text style={styles.grossLabel}>总杆</Text>
                  <Text style={styles.diff}>微差 {item.scoreDifferential.toFixed(1)}</Text>
                  <Text style={styles.small}>
                    {putts !== null ? `推杆 ${putts}` : '推杆 —'}
                    {fwPct !== null ? ` · 球道 ${fwPct}%` : ''}
                  </Text>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: {
    backgroundColor: BG,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'web' ? 44 : 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DARK_PAGE.divider,
  },
  backBtn: { alignSelf: 'flex-start', marginBottom: 8 },
  backTxt: { fontSize: 15, fontWeight: '600', color: TEXT_SECONDARY },
  title: { fontSize: 22, fontWeight: '800', color: TEXT, marginBottom: 4 },
  sub: { fontSize: 12, color: DARK_PAGE.textSubHeader },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  empty: { fontSize: 14, color: TEXT_SECONDARY, lineHeight: 22 },
  row: {
    position: 'relative',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: BORDER,
  },
  rowLockCorner: { position: 'absolute', top: 10, right: 10, zIndex: 2 },
  rowLeft: { flex: 1, minWidth: 0, paddingRight: 20 },
  date: { fontSize: 12, color: TEXT_SECONDARY, marginBottom: 4 },
  course: { fontSize: 16, fontWeight: '700', color: TEXT, marginBottom: 6 },
  meta: { fontSize: 12, color: TEXT_SECONDARY, lineHeight: 18 },
  rowRight: { alignItems: 'flex-end', minWidth: 88 },
  gross: { fontSize: 22, fontWeight: '800', color: ACCENT },
  grossLabel: { fontSize: 11, color: TEXT_SECONDARY, marginTop: 2 },
  diff: { fontSize: 12, color: TEXT_SECONDARY, marginTop: 6 },
  small: { fontSize: 11, color: TEXT_SECONDARY, marginTop: 4, textAlign: 'right', maxWidth: 140 },
});
