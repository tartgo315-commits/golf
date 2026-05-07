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
import { getRoundBundle, listBetsForRound, setRoundStatus, upsertScoreCell } from '@/lib/scorecardApi';

function safeInt(x, fallback) {
  const n = Number(String(x ?? '').trim());
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.round(n));
}

function keyOf(roundId, userId, hole) {
  return `${roundId}:${userId}:${hole}`;
}

function puttsKeyOf(roundId, userId, hole) {
  return `${roundId}:${userId}:${hole}:putts`;
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
  const [putts, setPutts] = useState({}); // key -> string
  const [gir, setGir] = useState({}); // key -> true | false | undefined
  const [fir, setFir] = useState({}); // key -> 'hit' | 'left' | 'right' | undefined
  const [sand, setSand] = useState({}); // key -> true | false | undefined
  const [penalty, setPenalty] = useState({}); // key -> 'water' | 'ob' | undefined
  const [completing, setCompleting] = useState(false);
  const [bets, setBets] = useState([]);
  const [betsOpen, setBetsOpen] = useState(false);

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
          const betList = await listBetsForRound(roundId).catch(() => []);
          if (alive) setBets(betList);

          const nextPar = {};
          const nextStrokes = {};
          const nextPutts = {};
          const nextGir = {};
          const nextFir = {};
          const nextSand = {};
          const nextPenalty = {};
          (b.scores ?? []).forEach((s) => {
            const cellKey = keyOf(roundId, s.user_id, s.hole_number);
            nextPar[s.hole_number] = String(s.par ?? 4);
            nextStrokes[cellKey] = String(s.strokes ?? '');
            if (s.putts != null && s.putts !== '') {
              nextPutts[puttsKeyOf(roundId, s.user_id, s.hole_number)] = String(s.putts);
            }
            if (typeof s.gir === 'boolean') nextGir[cellKey] = s.gir;
            if (s.fir === 'hit' || s.fir === 'left' || s.fir === 'right') nextFir[cellKey] = s.fir;
            if (typeof s.sand === 'boolean') nextSand[cellKey] = s.sand;
            if (s.penalty === 'water' || s.penalty === 'ob') nextPenalty[cellKey] = s.penalty;
          });
          // ensure defaults
          for (let h = 1; h <= (b.round.holes === 9 ? 9 : 18); h += 1) {
            if (nextPar[h] == null) nextPar[h] = '4';
          }
          setParByHole(nextPar);
          setStrokes(nextStrokes);
          setPutts(nextPutts);
          setGir(nextGir);
          setFir(nextFir);
          setSand(nextSand);
          setPenalty(nextPenalty);
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

  const betStandings = useMemo(() => {
    const n = players.length;
    if (n < 2 || bets.length === 0) return [];
    const holeMax = round?.holes === 9 ? 9 : 18;
    const holeNums = Array.from({ length: holeMax }, (_, i) => i + 1);

    const scoreFor = (userId, hole) => {
      const v = strokes[keyOf(roundId, userId, hole)];
      const s = safeInt(v, 0);
      return s > 0 ? s : null;
    };
    const parFor = (hole) => {
      const p = safeInt(parByHole[hole], 4);
      return p > 0 ? p : 4;
    };

    const calcMatchPlayHole = (unit, hole) => {
      const vals = players.map((p) => scoreFor(p.userId, hole));
      if (vals.some((x) => x == null)) return null;
      const nums = vals.map((x) => x);
      const min = Math.min(...nums);
      const winners = nums
        .map((x, i) => ({ x, i }))
        .filter((r) => r.x === min)
        .map((r) => r.i);
      if (winners.length !== 1) return Array.from({ length: n }, () => 0);
      const w = winners[0];
      const out = Array.from({ length: n }, () => -unit);
      out[w] = unit * (n - 1);
      return out;
    };

    const calcStrokePlayHole = (unit, hole) => {
      const vals = players.map((p) => scoreFor(p.userId, hole));
      if (vals.some((x) => x == null)) return null;
      const nums = vals;
      const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
      return nums.map((s) => Math.round((mean - s) * unit));
    };

    return bets.map((b) => {
      const supported = b.bet_type === 'match_play' || b.bet_type === 'stroke_play';
      const byUser = new Map(players.map((p) => [p.userId, 0]));
      const perHole = [];

      if (supported) {
        for (const h of holeNums) {
          const pay =
            b.bet_type === 'match_play'
              ? calcMatchPlayHole(b.unit_amount, h)
              : calcStrokePlayHole(b.unit_amount, h);
          if (!pay) continue;
          perHole.push({ hole: h, payouts: pay });
          pay.forEach((amt, idx) => {
            const uid = players[idx].userId;
            byUser.set(uid, (byUser.get(uid) ?? 0) + (amt ?? 0));
          });
        }
      }

      const rows = players.map((p) => ({
        userId: p.userId,
        username: p.username,
        net: Math.round(byUser.get(p.userId) ?? 0),
      }));

      return {
        bet: b,
        supported,
        rows,
      };
    });
  }, [bets, parByHole, players, round?.holes, roundId, strokes]);

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

  function buildStatsPayload(userId, hole, patch) {
    const k = keyOf(roundId, userId, hole);
    const pk = puttsKeyOf(roundId, userId, hole);
    const has = (key) => Object.prototype.hasOwnProperty.call(patch, key);
    const girVal = has('gir') ? patch.gir : gir[k];
    const firVal = has('fir') ? patch.fir : fir[k];
    const sandVal = has('sand') ? patch.sand : sand[k];
    const penaltyVal = has('penalty') ? patch.penalty : penalty[k];
    return {
      gir: typeof girVal === 'boolean' ? girVal : null,
      fir: firVal === 'hit' || firVal === 'left' || firVal === 'right' ? firVal : null,
      sand: typeof sandVal === 'boolean' ? sandVal : null,
      penalty: penaltyVal === 'water' || penaltyVal === 'ob' ? penaltyVal : null,
    };
  }

  function persistAfterStatsChange(userId, hole, patch = {}) {
    const k = keyOf(roundId, userId, hole);
    const pk = puttsKeyOf(roundId, userId, hole);
    const s = safeInt(strokes[k], 0);
    if (s <= 0) return;
    const par = safeInt(parByHole[hole], 4);
    const p = safeInt(putts[pk], 0);
    const stats = buildStatsPayload(userId, hole, patch);
    scheduleUpsert({
      roundId,
      userId,
      holeNumber: hole,
      strokes: s,
      par,
      putts: p > 0 ? p : null,
      ...stats,
    });
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
      const pk = puttsKeyOf(roundId, userId, hole);
      const p = safeInt(putts[pk], 0);
      const stats = buildStatsPayload(userId, hole, {});
      scheduleUpsert({
        roundId,
        userId,
        holeNumber: hole,
        strokes: s,
        par,
        putts: p > 0 ? p : null,
        ...stats,
      });
    }
  }

  function onChangePutts(userId, hole, v) {
    const pk = puttsKeyOf(roundId, userId, hole);
    setPutts((prev) => ({ ...prev, [pk]: v }));
    const s = safeInt(strokes[keyOf(roundId, userId, hole)], 0);
    const par = safeInt(parByHole[hole], 4);
    const p = safeInt(v, 0);
    if (s > 0) {
      const stats = buildStatsPayload(userId, hole, {});
      scheduleUpsert({
        roundId,
        userId,
        holeNumber: hole,
        strokes: s,
        par,
        putts: p > 0 ? p : null,
        ...stats,
      });
    }
  }

  function onToggleGir(userId, hole, mode) {
    const k = keyOf(roundId, userId, hole);
    const cur = gir[k];
    let next;
    if (mode === 'yes') {
      next = cur === true ? undefined : true;
    } else {
      next = cur === false ? undefined : false;
    }
    setGir((prev) => ({ ...prev, [k]: next }));
    persistAfterStatsChange(userId, hole, { gir: next });
  }

  function onToggleFir(userId, hole, val) {
    const k = keyOf(roundId, userId, hole);
    const cur = fir[k];
    const next = cur === val ? undefined : val;
    setFir((prev) => ({ ...prev, [k]: next }));
    persistAfterStatsChange(userId, hole, { fir: next });
  }

  function onToggleSand(userId, hole, val) {
    const k = keyOf(roundId, userId, hole);
    const cur = sand[k];
    const next = cur === val ? undefined : val;
    setSand((prev) => ({ ...prev, [k]: next }));
    persistAfterStatsChange(userId, hole, { sand: next });
  }

  function onTogglePenalty(userId, hole, val) {
    const k = keyOf(roundId, userId, hole);
    const cur = penalty[k];
    let next;
    if (val == null) {
      next = undefined;
    } else if (cur === val) {
      next = undefined;
    } else {
      next = val;
    }
    setPenalty((prev) => ({ ...prev, [k]: next }));
    persistAfterStatsChange(userId, hole, { penalty: next });
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
        {bets.length > 0 ? (
          <View style={styles.betPanel}>
            <Pressable onPress={() => setBetsOpen((x) => !x)} style={styles.betPanelHead}>
              <Text style={styles.betPanelTitle}>赌局面板</Text>
              <Text style={styles.betPanelHint}>{betsOpen ? '收起' : '展开'}</Text>
            </Pressable>
            {betsOpen ? (
              <View style={{ marginTop: 10 }}>
                {betStandings.map((x) => (
                  <View key={x.bet.id} style={styles.betBlock}>
                    <View style={styles.betRowHead}>
                      <Text style={styles.betName}>
                        {x.bet.bet_type === 'match_play'
                          ? '比洞'
                          : x.bet.bet_type === 'stroke_play'
                            ? '比杆'
                            : '即将上线'}
                        {'  '}
                        {x.bet.unit_amount}/{x.bet.bet_type === 'stroke_play' ? '洞' : '洞'}
                      </Text>
                      <Text style={styles.betMeta}>
                        {x.bet.settlement_timing === 'end_total' ? '打完一起算' : '一洞一算'}
                      </Text>
                    </View>
                    {!x.supported ? (
                      <Text style={styles.betSoon}>该玩法即将上线</Text>
                    ) : (
                      x.rows.map((r) => (
                        <View key={r.userId} style={styles.betLine}>
                          <Text style={styles.betUser} numberOfLines={1}>
                            {r.username}
                          </Text>
                          <Text
                            style={[
                              styles.betAmt,
                              r.net > 0 ? styles.good : r.net < 0 ? styles.bad : null,
                            ]}
                          >
                            {r.net > 0 ? `+${r.net}` : String(r.net)}
                          </Text>
                        </View>
                      ))
                    )}
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

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

            {players.map((p, idx) => {
              const k = keyOf(roundId, p.userId, h);
              const pk = puttsKeyOf(roundId, p.userId, h);
              const total = computeTotals.totals.get(p.userId);
              const delta = computeTotals.toPar.get(p.userId);
              const parH = safeInt(parByHole[h], 4);
              const girYes = gir[k] === true;
              const girNo = gir[k] === false;
              const firLeft = fir[k] === 'left';
              const firHit = fir[k] === 'hit';
              const firRight = fir[k] === 'right';
              const sandNo = sand[k] === false;
              const sandYes = sand[k] === true;
              const penNone = penalty[k] == null;
              const penWater = penalty[k] === 'water';
              const penOb = penalty[k] === 'ob';
              return (
                <View key={p.userId} style={[styles.playerBlock, idx === 0 && styles.playerBlockFirst]}>
                  <View style={styles.row}>
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
                    <TextInput
                      style={styles.puttInput}
                      value={putts[pk] ?? ''}
                      onChangeText={(v) => onChangePutts(p.userId, h, v)}
                      keyboardType="number-pad"
                      placeholder="推—"
                      placeholderTextColor={GOLF.muted}
                    />
                    <Text style={styles.miniMeta}>
                      {typeof total === 'number' ? `总${total}` : '总—'}{' '}
                      {typeof delta === 'number'
                        ? delta === 0
                          ? 'E'
                          : delta > 0
                            ? `+${delta}`
                            : `${delta}`
                        : ''}
                    </Text>
                  </View>

                  <View style={styles.statsWrap}>
                    <View style={styles.statRow}>
                      <Pressable
                        onPress={() => onToggleGir(p.userId, h, 'yes')}
                        style={[styles.statChip, girYes && styles.statChipOn]}
                      >
                        <Text style={[styles.statChipTxt, girYes && styles.statChipTxtOn]}>✓ GIR</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => onToggleGir(p.userId, h, 'no')}
                        style={[styles.statChip, girNo && styles.statChipOn]}
                      >
                        <Text style={[styles.statChipTxt, girNo && styles.statChipTxtOn]}>✗ 未中</Text>
                      </Pressable>
                    </View>

                    {parH >= 4 ? (
                      <View style={styles.statRow}>
                        <Pressable
                          onPress={() => onToggleFir(p.userId, h, 'left')}
                          style={[styles.statChip, firLeft && styles.statChipOn]}
                        >
                          <Text style={[styles.statChipTxt, firLeft && styles.statChipTxtOn]}>左偏</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => onToggleFir(p.userId, h, 'hit')}
                          style={[styles.statChip, firHit && styles.statChipOn]}
                        >
                          <Text style={[styles.statChipTxt, firHit && styles.statChipTxtOn]}>✓ 球道</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => onToggleFir(p.userId, h, 'right')}
                          style={[styles.statChip, firRight && styles.statChipOn]}
                        >
                          <Text style={[styles.statChipTxt, firRight && styles.statChipTxtOn]}>右偏</Text>
                        </Pressable>
                      </View>
                    ) : (
                      <Text style={styles.firNa}>N/A · Par 3</Text>
                    )}

                    <View style={styles.statRow}>
                      <Pressable
                        onPress={() => onToggleSand(p.userId, h, false)}
                        style={[styles.statChip, sandNo && styles.statChipOn]}
                      >
                        <Text style={[styles.statChipTxt, sandNo && styles.statChipTxtOn]}>无沙</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => onToggleSand(p.userId, h, true)}
                        style={[styles.statChip, sandYes && styles.statChipOn]}
                      >
                        <Text style={[styles.statChipTxt, sandYes && styles.statChipTxtOn]}>进沙</Text>
                      </Pressable>
                    </View>

                    <View style={styles.statRow}>
                      <Pressable
                        onPress={() => onTogglePenalty(p.userId, h, null)}
                        style={[styles.statChip, penNone && styles.statChipOn]}
                      >
                        <Text style={[styles.statChipTxt, penNone && styles.statChipTxtOn]}>无</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => onTogglePenalty(p.userId, h, 'water')}
                        style={[styles.statChip, penWater && styles.statChipOn]}
                      >
                        <Text style={[styles.statChipTxt, penWater && styles.statChipTxtOn]}>下水 💧</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => onTogglePenalty(p.userId, h, 'ob')}
                        style={[styles.statChip, penOb && styles.statChipOn]}
                      >
                        <Text style={[styles.statChipTxt, penOb && styles.statChipTxtOn]}>出界 🚫</Text>
                      </Pressable>
                    </View>
                  </View>
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
  betPanel: {
    backgroundColor: GOLF.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GOLF.border,
    padding: 12,
    marginBottom: 12,
  },
  betPanelHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  betPanelTitle: { color: GOLF.text, fontWeight: '900' },
  betPanelHint: { color: GOLF.muted, fontWeight: '900' },
  betBlock: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  betRowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  betName: { color: GOLF.text, fontWeight: '900' },
  betMeta: { color: GOLF.muted, fontWeight: '800' },
  betSoon: { color: GOLF.muted, marginTop: 6, fontWeight: '800' },
  betLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, gap: 10 },
  betUser: { color: GOLF.text, fontWeight: '800', flex: 1 },
  betAmt: { color: GOLF.muted, fontWeight: '900' },
  good: { color: GOLF.accent },
  bad: { color: '#f87171' },
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
  playerBlock: { marginTop: 12 },
  playerBlockFirst: { marginTop: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { color: GOLF.text, flex: 1, fontWeight: '800' },
  statsWrap: { marginTop: 8, gap: 6 },
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  statChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3a4a40',
    backgroundColor: 'transparent',
  },
  statChipOn: {
    backgroundColor: '#1e3a26',
    borderColor: '#c9ff4a',
  },
  statChipTxt: { color: '#6a7a70', fontSize: 13, fontWeight: '700' },
  statChipTxtOn: { color: '#c9ff4a', fontSize: 13, fontWeight: '700' },
  firNa: { color: '#6a7a70', fontSize: 13, fontWeight: '600', marginLeft: 2 },
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
  puttInput: {
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

