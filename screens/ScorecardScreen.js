import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { GOLF } from '@/constants/golfTheme';
import { STACK_SCREEN_TOP_PADDING } from '@/constants/theme';
import { listMyRounds } from '@/lib/scorecardApi';

function formatDate(d) {
  try {
    const x = new Date(d);
    if (Number.isNaN(x.getTime())) return String(d ?? '');
    return x.toLocaleDateString();
  } catch {
    return String(d ?? '');
  }
}

function calcTotalForRound(roundId, scores) {
  const rows = scores.filter((s) => s.round_id === roundId);
  if (rows.length === 0) return null;
  return rows.reduce((a, b) => a + (Number(b.strokes) || 0), 0);
}

export default function ScorecardScreen() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState([]);
  const [scoresCache, setScoresCache] = useState([]); // optional (if later we want totals)

  const display = useMemo(() => {
    return rows.map((r) => {
      const total = calcTotalForRound(r.id, scoresCache);
      return { ...r, total };
    });
  }, [rows, scoresCache]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        try {
          setBusy(true);
          const list = await listMyRounds();
          if (!alive) return;
          setRows(list);
        } catch (e) {
          if (!alive) return;
          Alert.alert('记分', e instanceof Error ? e.message : '加载失败，请重试');
        } finally {
          if (alive) setBusy(false);
        }
      })();
      return () => {
        alive = false;
      };
    }, []),
  );

  return (
    <View style={styles.root}>
      <View style={styles.topRow}>
        <Text style={styles.title}>我的记录</Text>
        <Pressable
          style={styles.newBtn}
          onPress={() => router.push('/rounds/new')}
          accessibilityRole="button"
          accessibilityLabel="新建一局"
        >
          <Text style={styles.newBtnTxt}>＋ 新建一局</Text>
        </Pressable>
      </View>

      {busy ? (
        <View style={styles.center}>
          <ActivityIndicator color={GOLF.accent} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {display.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>暂无记分记录</Text>
              <Text style={styles.emptySub}>点击右上角「新建一局」开始记分</Text>
            </View>
          ) : null}

          {display.map((r) => {
            const statusLabel = r.status === 'completed' ? '已完成' : '进行中';
            return (
              <Pressable
                key={r.id}
                style={styles.card}
                onPress={() => router.push(`/rounds/${r.id}`)}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {r.course_name || '未命名球场'}
                  </Text>
                  <View style={[styles.badge, r.status === 'completed' ? styles.badgeDone : styles.badgeLive]}>
                    <Text style={styles.badgeTxt}>{statusLabel}</Text>
                  </View>
                </View>
                <Text style={styles.cardSub}>
                  {formatDate(r.played_at)} · {r.tee_color || '—'} · {r.holes || 18} 洞
                </Text>
                <Text style={styles.cardMeta}>
                  总杆：{typeof r.total === 'number' ? r.total : '—'}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: GOLF.bg, padding: 16, paddingTop: STACK_SCREEN_TOP_PADDING },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  title: { color: GOLF.text, fontSize: 22, fontWeight: '800' },
  newBtn: {
    backgroundColor: GOLF.accentDark,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  newBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingVertical: 14, paddingBottom: 40 },
  empty: {
    borderWidth: 1,
    borderColor: GOLF.border,
    borderRadius: 16,
    padding: 18,
    backgroundColor: GOLF.bgCard,
    marginBottom: 12,
  },
  emptyTitle: { color: GOLF.text, fontSize: 16, fontWeight: '800' },
  emptySub: { color: GOLF.muted, marginTop: 6, lineHeight: 20 },
  card: {
    backgroundColor: GOLF.bgCard,
    borderWidth: 1,
    borderColor: GOLF.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  cardTitle: { color: GOLF.text, fontSize: 16, fontWeight: '800', flex: 1 },
  cardSub: { color: GOLF.muted, marginTop: 6, fontSize: 13 },
  cardMeta: { color: GOLF.muted, marginTop: 10, fontSize: 13, fontWeight: '700' },
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  badgeLive: { backgroundColor: 'rgba(94,207,154,0.14)', borderColor: 'rgba(94,207,154,0.35)' },
  badgeDone: { backgroundColor: 'rgba(212,175,55,0.14)', borderColor: 'rgba(212,175,55,0.35)' },
  badgeTxt: { color: GOLF.text, fontSize: 12, fontWeight: '800' },
});

