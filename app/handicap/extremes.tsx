import { useFocusEffect } from '@react-navigation/native';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { RoundDeepStats } from '@/components/RoundDeepStats';
import { DARK_PAGE } from '@/constants/theme';
import { loadHandicapRecords, type HandicapRecord } from '@/lib/handicap';

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

  return (
    <View style={styles.roundWrap}>
      <RoundDeepStats
        record={record}
        variant="page"
        title={title}
        showEquivBanner
        showHoleTable
        onPressOpenFull={onOpenFull}
        showOpenFullCta
      />
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
          与成绩分析页「单场深度」相同布局：含 vs Par、杆数分布、Par 分段均杆、三推、GIR、FIR、罚杆、连续洞数、逐洞表等。
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
  roundWrap: {},
  card: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: BORDER,
    padding: 14,
    marginBottom: 14,
  },
  cardTitle: { fontSize: 13, fontWeight: '800', color: SUB, marginBottom: 8, letterSpacing: 0.3 },
  muted: { fontSize: 14, fontWeight: '500', color: SUB, lineHeight: 20 },
});
