import { useFocusEffect } from '@react-navigation/native';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { RoundLockIndicator } from '@/components/RoundLockIndicator';
import { DARK_PAGE, STACK_SCREEN_TOP_PADDING, fontSize } from '@/constants/theme';
import {
  compareHandicapRecordsChronologicalAsc,
  fairwayPercent,
  loadHandicapRecords,
  normalizeHandicapRecords,
  type HandicapRecord,
} from '@/lib/handicap';
import { loadSupabaseHandicapRecords } from '@/lib/supabaseToHandicap';
import {
  pickFromParam,
  returnHrefForFrom,
  TABS_ROOT_HREF,
} from '@/utils/tabReturnFrom';

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
  const gross = hasHoles
    ? item.holeDetails.reduce((s, h) => s + h.strokes, 0)
    : item.adjustedGrossScore;
  const putts =
    item.totalPutts != null && Number.isFinite(item.totalPutts) ? item.totalPutts : null;
  const fwPct = fairwayPercent(item.fairwaysHit, item.fairwaysTotal);
  return { gross, putts, fwPct };
}

export default function HandicapHistoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: string | string[] }>();
  const returnHref = useMemo(() => returnHrefForFrom(pickFromParam(params.from)), [params.from]);
  const listOrigin = pickFromParam(params.from) ?? 'score';
  const [records, setRecords] = useState<HandicapRecord[]>([]);

  const onBack = useCallback(() => {
    if (returnHref) {
      router.replace(returnHref);
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(TABS_ROOT_HREF);
  }, [router, returnHref]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void (async () => {
        const normalized = await loadHandicapRecords();
        if (!alive) return;
        const localIds = new Set(normalized.map((r) => r.id));
        const cloudIds = new Set(
          normalized
            .map((r) => r.cloudRoundId)
            .filter((id): id is string => typeof id === 'string' && id.length > 0),
        );
        let merged = normalized;
        try {
          const supabaseRecords = await loadSupabaseHandicapRecords();
          if (!alive) return;
          const newRecords = supabaseRecords.filter((r) => {
            const rid = r.id.replace(/^supabase_/, '');
            if (cloudIds.has(rid)) return false;
            return !localIds.has(rid);
          });
          merged = normalizeHandicapRecords([...normalized, ...newRecords]);
        } catch {
          merged = normalized;
        }
        const sorted = [...merged].sort(compareHandicapRecordsChronologicalAsc).reverse();
        if (alive) setRecords(sorted);
      })();
      return () => {
        alive = false;
      };
    }, []),
  );

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable
          onPress={onBack}
          style={styles.backBtn}
          hitSlop={10}
          accessibilityRole="button"
        >
          <Text style={styles.backTxt}>← 返回</Text>
        </Pressable>
        <Text style={styles.title}>全部场次</Text>
        <Text style={styles.sub}>按时间由新到旧</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {records.length === 0 ? (
          <Text style={styles.empty}>暂无记录，请到「统计」页右上角记一轮。</Text>
        ) : (
          records.map((item) => {
            const { gross, putts, fwPct } = rowMetrics(item);
            return (
              <Pressable
                key={item.id}
                style={styles.row}
                onPress={() =>
                  router.push(
                    `/handicap/${item.id}?from=history&hf=${encodeURIComponent(listOrigin)}` as Href,
                  )
                }
              >
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
                  <View style={styles.grossRow}>
                    <RoundLockIndicator round={item} />
                    <Text style={styles.gross}>{gross}</Text>
                  </View>
                  <Text style={styles.grossLabel}>总杆</Text>
                  <Text style={styles.diff}>微差 {item.scoreDifferential.toFixed(1)}</Text>
                  <Text style={styles.small}>
                    {putts != null ? `推杆 ${putts}` : ''}
                    {putts != null && fwPct != null ? ' · ' : ''}
                    {fwPct != null ? `球道 ${fwPct}%` : ''}
                    {putts == null && fwPct == null ? '—' : ''}
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
    paddingTop: STACK_SCREEN_TOP_PADDING,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DARK_PAGE.divider,
  },
  backBtn: { alignSelf: 'flex-start', marginBottom: 8 },
  backTxt: { fontSize: 15, fontWeight: '600', color: TEXT_SECONDARY },
  title: { fontSize: 22, fontWeight: '800', color: TEXT, marginBottom: 4 },
  sub: { fontSize: fontSize.sm, color: DARK_PAGE.textSubHeader },
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
  rowLeft: { flex: 1, minWidth: 0, paddingRight: 8 },
  date: { fontSize: 12, color: TEXT_SECONDARY, marginBottom: 4 },
  course: { fontSize: 16, fontWeight: '700', color: TEXT, marginBottom: 6 },
  meta: { fontSize: 12, color: TEXT_SECONDARY, lineHeight: 18 },
  rowRight: { alignItems: 'flex-end', minWidth: 88 },
  grossRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  gross: { fontSize: 22, fontWeight: '800', color: ACCENT },
  grossLabel: { fontSize: 11, color: TEXT_SECONDARY, marginTop: 2 },
  diff: { fontSize: 12, color: TEXT_SECONDARY, marginTop: 6 },
  small: { fontSize: 11, color: TEXT_SECONDARY, marginTop: 4, textAlign: 'right', maxWidth: 140 },
});
