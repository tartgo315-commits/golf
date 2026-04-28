import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { GOLF } from '@/constants/golfTheme';
import { getRoundBundle, setRoundStatus, upsertScoreCell } from '@/lib/scorecardApi';

function safeInt(x, fallback) {
  const n = Number(String(x ?? '').trim());
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.round(n));
}

function keyOf(roundId, userId, hole) {
  return `${roundId}:${userId}:${hole}`;
}

export default function RoundScoreScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const roundId = String(params.id ?? '');

  const [busy, setBusy] = useState(false);
  const [round, setRound] = useState(null);
  const [players, setPlayers] = useState([]); // { userId, username }
  const [parByHole, setParByHole] = useState({}); // hole -> par
  const [strokes, setStrokes] = useState({}); // key -> string
  const [completing, setCompleting] = useState(false);

  const timersRef = useRef(new Map());

  const holesCount = round?.holes === 9 ? 9 : 18;

  const holeNums = useMemo(() => Array.from({ length: holesCount }, (_, i) => i + 1), [holesCount]);

  const computeTotals = useMemo(() => {
    const totals = new Map();
    const toPar = new Map();
    players.forEach((p) => {
      let t = 0;
      let tp = 0;
      holeNums.forEach((h) => {
        const k = keyOf(roundId, p.userId, h);
        const s = safeInt(strokes[k], 0);
        const par = safeInt(parByHole[h], 4);
        if (s > 0) {
          t += s;
          tp += s - par;
        }
      });
      totals.set(p.userId, t > 0 ? t : null);
      toPar.set(p.userId, t > 0 ? tp : null);
    });
    return { totals, toPar };
  }, [players, holeNums, strokes, parByHole, roundId]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        try {
          setBusy(true);
          const b = await getRoundBundle(roundId);
          if (!alive) return;
          setRound(b.round);
          setPlayers(b.players);

          const nextPar = {};
          const nextStrokes = {};
          (b.scores ?? []).forEach((s) => {
            nextPar[s.hole_number] = String(s.par ?? 4);
            nextStrokes[keyOf(roundId, s.user_id, s.hole_number)] = String(s.strokes ?? '');
          });
          // ensure defaults
          for (let h = 1; h <= (b.round.holes === 9 ? 9 : 18); h += 1) {
            if (nextPar[h] == null) nextPar[h] = '4';
          }
          setParByHole(nextPar);
          setStrokes(nextStrokes);
        } catch (e) {
          Alert.alert('记分', e instanceof Error ? e.message : '加载失败，请重试');
        } finally {
          if (alive) setBusy(false);
        }
      })();
      return () => {
        alive = false;
      };
    }, [roundId]),
  );

  function scheduleUpsert(cell) {
    const k = keyOf(roundId, cell.userId, cell.holeNumber);
    const existing = timersRef.current.get(k);
    if (existing) clearTimeout(existing);

    const t = setTimeout(async () => {
      timersRef.current.delete(k);
      try {
        await upsertScoreCell(cell);
      } catch {
        // silent retry once
        setTimeout(() => {
          void upsertScoreCell(cell).catch(() => {});
        }, 1200);
      }
    }, 350);
    timersRef.current.set(k, t);
  }

  function onChangePar(hole, v) {
    setParByHole((prev) => ({ ...prev, [hole]: v }));
    // update all players cells using this par for consistent diff; save with next strokes when they change.
  }

  function onChangeStroke(userId, hole, v) {
    const k = keyOf(roundId, userId, hole);
    setStrokes((prev) => ({ ...prev, [k]: v }));
    const s = safeInt(v, 0);
    const par = safeInt(parByHole[hole], 4);
    if (s > 0) {
      scheduleUpsert({ roundId, userId, holeNumber: hole, strokes: s, par });
    }
  }

  async function onComplete() {
    if (!round) return;
    try {
      setCompleting(true);
      await setRoundStatus(round.id, 'completed');
      router.replace(`/rounds/${round.id}/summary`);
    } catch (e) {
      Alert.alert('完成记分', e instanceof Error ? e.message : '操作失败，请重试');
    } finally {
      setCompleting(false);
    }
  }

  if (busy || !round) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={GOLF.accent} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.back}>‹ 返回</Text>
        </Pressable>
        <Text style={styles.h1} numberOfLines={1}>
          {round.course_name || '记分'}
        </Text>
        <Text style={styles.sub}>{round.played_at} · {round.tee_color} · {round.holes} 洞</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {holeNums.map((h) => (
          <View key={h} style={styles.holeCard}>
            <View style={styles.holeTop}>
              <Text style={styles.holeTitle}>第 {h} 洞</Text>
              <View style={styles.parRow}>
                <Text style={styles.parLabel}>Par</Text>
                <TextInput
                  style={styles.parInput}
                  value={String(parByHole[h] ?? '4')}
                  onChangeText={(v) => onChangePar(h, v)}
                  keyboardType="number-pad"
                  placeholderTextColor={GOLF.muted}
                />
              </View>
            </View>

            {players.map((p) => {
              const k = keyOf(roundId, p.userId, h);
              const total = computeTotals.totals.get(p.userId);
              const delta = computeTotals.toPar.get(p.userId);
              return (
                <View key={p.userId} style={styles.row}>
                  <Text style={styles.name} numberOfLines={1}>
                    {p.username}
                  </Text>
                  <TextInput
                    style={styles.strokeInput}
                    value={strokes[k] ?? ''}
                    onChangeText={(v) => onChangeStroke(p.userId, h, v)}
                    keyboardType="number-pad"
                    placeholder="—"
                    placeholderTextColor={GOLF.muted}
                  />
                  <Text style={styles.miniMeta}>
                    {typeof total === 'number' ? `总${total}` : '总—'}{' '}
                    {typeof delta === 'number' ? (delta === 0 ? 'E' : delta > 0 ? `+${delta}` : `${delta}`) : ''}
                  </Text>
                </View>
              );
            })}
          </View>
        ))}

        <Pressable
          style={[styles.primary, completing && styles.disabled]}
          onPress={onComplete}
          disabled={completing}
        >
          <Text style={styles.primaryTxt}>{completing ? '提交中…' : '完成记分'}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: GOLF.bg },
  center: { flex: 1, backgroundColor: GOLF.bg, alignItems: 'center', justifyContent: 'center' },
  header: { padding: 16, paddingTop: 18 },
  back: { color: GOLF.accent, fontWeight: '800', fontSize: 16 },
  h1: { color: GOLF.text, fontSize: 20, fontWeight: '900', marginTop: 10 },
  sub: { color: GOLF.muted, marginTop: 6 },
  scroll: { padding: 16, paddingBottom: 40 },
  holeCard: {
    backgroundColor: GOLF.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GOLF.border,
    padding: 12,
    marginBottom: 12,
  },
  holeTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  holeTitle: { color: GOLF.text, fontWeight: '900' },
  parRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  parLabel: { color: GOLF.muted, fontWeight: '800' },
  parInput: {
    width: 54,
    textAlign: 'center',
    backgroundColor: GOLF.inputBg,
    borderWidth: 1,
    borderColor: GOLF.border,
    borderRadius: 10,
    paddingVertical: 8,
    color: GOLF.text,
    fontWeight: '900',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  name: { color: GOLF.text, flex: 1, fontWeight: '800' },
  strokeInput: {
    width: 64,
    textAlign: 'center',
    backgroundColor: GOLF.inputBg,
    borderWidth: 1,
    borderColor: GOLF.border,
    borderRadius: 10,
    paddingVertical: 10,
    color: GOLF.text,
    fontWeight: '900',
  },
  miniMeta: { color: GOLF.muted, width: 88, textAlign: 'right', fontWeight: '700' },
  primary: {
    backgroundColor: GOLF.gold,
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 6,
  },
  primaryTxt: { color: '#1a2e22', fontSize: 16, fontWeight: '900' },
  disabled: { opacity: 0.6 },
});

