import { useFocusEffect } from '@react-navigation/native';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DARK_PAGE } from '@/constants/theme';
import {
  equivalent18FromGrossAndHoles,
  formatRoundDurationMinutes,
  loadHandicapRecords,
  roundGirPctDisplay,
  roundPuttsDisplayCount,
  type HandicapRecord,
} from '@/lib/handicap';

const BG = DARK_PAGE.bg;
const CARD = DARK_PAGE.card;
const BORDER = DARK_PAGE.cardBorder;
const TEXT = DARK_PAGE.text;
const SUB = DARK_PAGE.textSecondary;
const ACCENT = DARK_PAGE.accent;

function paramOne(v: string | string[] | undefined): string | undefined {
  if (v == null) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

function equiv18Label(r: HandicapRecord): string {
  const eq = equivalent18FromGrossAndHoles(r.adjustedGrossScore, r.holes);
  if (!Number.isFinite(eq)) return '—';
  return `${eq % 1 === 0 ? eq : eq.toFixed(1)} 杆（等效 18 洞）`;
}

function RoundBlock({
  title,
  record,
  onOpenFull,
}: {
  title: string;
  record: HandicapRecord | null;
  onOpenFull: (id: string) => void;
}) {
  if (!record) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.muted}>未找到该场记录（可能已删除）。</Text>
      </View>
    );
  }

  const partners = (record.playingPartners ?? []).map((p) => p.name).filter(Boolean);
  const hasHoles = record.holeDetails.length === record.holes && record.holes > 0;
  const puttsN = roundPuttsDisplayCount(record);
  const girPct = roundGirPctDisplay(record);
  const puttsLabel = puttsN != null ? `${puttsN} 推` : '—';
  const girLabel = girPct != null ? `${girPct.toFixed(1)}%` : '—';

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.bigScore}>{equiv18Label(record)}</Text>
      <Text style={styles.rowLab}>球场</Text>
      <Text style={styles.rowVal}>{record.courseName}</Text>
      <Text style={styles.rowLab}>日期</Text>
      <Text style={styles.rowVal}>{record.date}</Text>
      <Text style={styles.rowLab}>上场天气（回顾）</Text>
      <Text style={styles.rowVal}>{record.weather?.trim() ? record.weather.trim() : '—'}</Text>
      <Text style={styles.rowLab}>同组</Text>
      <Text style={styles.rowVal}>{partners.length > 0 ? partners.join('、') : '—'}</Text>
      <Text style={styles.rowFoot}>
        未使用本应用的同组不会自动看到本场；已注册且经应用内同场记分时，同步支持后对方账户也会出现本场。
      </Text>
      <Text style={styles.rowLab}>本场总杆（调整后）</Text>
      <Text style={styles.rowVal}>{record.adjustedGrossScore} 杆 · {record.holes} 洞</Text>

      <Text style={styles.rowLab}>开球时间</Text>
      <Text style={styles.rowVal}>{record.teeTime?.trim() ? record.teeTime.trim() : '—'}</Text>
      <Text style={styles.rowLab}>总时长</Text>
      <Text style={styles.rowVal}>{formatRoundDurationMinutes(record.durationTotalMinutes)}</Text>
      {record.holes === 18 ? (
        <>
          <Text style={styles.rowLab}>前 9 用时</Text>
          <Text style={styles.rowVal}>{formatRoundDurationMinutes(record.durationFront9Minutes)}</Text>
          <Text style={styles.rowLab}>后 9 用时</Text>
          <Text style={styles.rowVal}>{formatRoundDurationMinutes(record.durationBack9Minutes)}</Text>
        </>
      ) : null}
      <Text style={styles.rowLab}>推杆数</Text>
      <Text style={styles.rowVal}>{puttsLabel}</Text>
      <Text style={styles.rowLab}>标 on 率（GIR）</Text>
      <Text style={styles.rowVal}>{girLabel}</Text>

      {hasHoles ? (
        <>
          <Text style={[styles.rowLab, styles.tableGap]}>逐洞成绩</Text>
          <View style={styles.tableHead}>
            <Text style={styles.thHole}>洞</Text>
            <Text style={styles.thPar}>Par</Text>
            <Text style={styles.thScore}>杆</Text>
            <Text style={styles.thPutt}>推</Text>
          </View>
          {record.holeDetails.map((h) => (
            <View key={h.holeNumber} style={styles.tableRow}>
              <Text style={styles.tdHole}>{h.holeNumber}</Text>
              <Text style={styles.tdPar}>{h.par}</Text>
              <Text style={styles.tdScore}>{h.strokes}</Text>
              <Text style={styles.tdPutt}>{h.putts}</Text>
            </View>
          ))}
        </>
      ) : (
        <Text style={styles.muted}>本场为快速录入或无逐洞数据，可点击下方查看详情页。</Text>
      )}

      <Pressable
        style={styles.cta}
        onPress={() => onOpenFull(record.id)}
        accessibilityRole="button"
        accessibilityLabel="打开该场完整成绩">
        <Text style={styles.ctaTxt}>完整成绩与复盘 ›</Text>
      </Pressable>
    </View>
  );
}

export default function HandicapExtremesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ bestId?: string; worstId?: string }>();
  const bestId = paramOne(params.bestId);
  const worstId = paramOne(params.worstId);

  const [records, setRecords] = useState<HandicapRecord[]>([]);

  useFocusEffect(
    useCallback(() => {
      setRecords(loadHandicapRecords());
    }, []),
  );

  const best = useMemo(() => (bestId ? records.find((r) => r.id === bestId) ?? null : null), [records, bestId]);
  const worst = useMemo(() => (worstId ? records.find((r) => r.id === worstId) ?? null : null), [records, worstId]);
  const sameRound = Boolean(bestId && worstId && bestId === worstId);

  const openFull = useCallback(
    (id: string) => {
      router.push(`/handicap/${id}` as Href);
    },
    [router],
  );

  return (
    <View style={styles.root}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button">
          <Text style={styles.backTxt}>← 返回</Text>
        </Pressable>
        <Text style={styles.title}>最好 / 最差场次</Text>
        <Text style={styles.subtitle}>
          来自成绩存档：球场、上场天气（便于回忆风速湿度等）、同组（手填或多人记分同步）与逐洞杆数。等效 18
          洞与成绩分析页「最好 / 最差」一致。
        </Text>
        {sameRound ? (
          <Text style={styles.sameHint}>当前窗口内仅此一场有效数据，最好与最差为同一场。</Text>
        ) : null}

        <RoundBlock title="最好一场" record={best} onOpenFull={openFull} />
        <RoundBlock title="最差一场" record={worst} onOpenFull={openFull} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  backBtn: { alignSelf: 'flex-start', marginBottom: 8 },
  backTxt: { fontSize: 15, fontWeight: '600', color: SUB },
  title: { fontSize: 22, fontWeight: '800', color: TEXT, letterSpacing: -0.4, marginBottom: 6 },
  subtitle: { fontSize: 13, fontWeight: '500', color: SUB, lineHeight: 19, marginBottom: 10 },
  sameHint: {
    fontSize: 12,
    fontWeight: '600',
    color: ACCENT,
    marginBottom: 12,
    lineHeight: 17,
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: BORDER,
    padding: 14,
    marginBottom: 14,
  },
  cardTitle: { fontSize: 13, fontWeight: '800', color: SUB, marginBottom: 8, letterSpacing: 0.3 },
  bigScore: { fontSize: 22, fontWeight: '800', color: ACCENT, marginBottom: 12 },
  rowLab: { fontSize: 11, fontWeight: '700', color: SUB, marginTop: 8 },
  rowVal: { fontSize: 15, fontWeight: '600', color: TEXT, marginTop: 2 },
  rowFoot: { fontSize: 11, fontWeight: '500', color: SUB, lineHeight: 16, marginTop: 8 },
  muted: { fontSize: 14, fontWeight: '500', color: SUB, lineHeight: 20 },
  tableGap: { marginTop: 14 },
  tableHead: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
    paddingBottom: 6,
    marginTop: 6,
  },
  tableRow: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BORDER },
  thHole: { width: 36, fontSize: 11, fontWeight: '700', color: SUB },
  thPar: { width: 40, fontSize: 11, fontWeight: '700', color: SUB },
  thScore: { flex: 1, fontSize: 11, fontWeight: '700', color: SUB },
  thPutt: { width: 44, fontSize: 11, fontWeight: '700', color: SUB, textAlign: 'right' },
  tdHole: { width: 36, fontSize: 14, fontWeight: '700', color: TEXT },
  tdPar: { width: 40, fontSize: 14, fontWeight: '600', color: SUB },
  tdScore: { flex: 1, fontSize: 14, fontWeight: '800', color: TEXT },
  tdPutt: { width: 44, fontSize: 14, fontWeight: '600', color: SUB, textAlign: 'right' },
  cta: { marginTop: 14, paddingVertical: 10 },
  ctaTxt: { fontSize: 14, fontWeight: '800', color: ACCENT },
});
