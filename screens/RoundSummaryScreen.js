import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { getRoundBundle, listBetsForRound, upsertBetResults } from '@/lib/scorecardApi';

function safeInt(x, fallback) {
  const n = Number(x);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

function buildSummaryText(round, rows, holeNums) {
  const head = `⛳ ${round.course_name || '球场'} · ${round.played_at} · ${round.tee_color} · ${round.holes}洞`;
  const body = rows
    .map((r, idx) => {
      const toPar = r.toPar === 0 ? 'E' : r.toPar > 0 ? `+${r.toPar}` : `${r.toPar}`;
      return `${idx + 1}. ${r.username} ${r.total}（${toPar}）`;
    })
    .join('\n');
  return `${head}\n\n${body}\n\n洞号：${holeNums.join(',')}`;
}

export default function RoundSummaryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const roundId = String(params.id ?? '');

  const [busy, setBusy] = useState(false);
  const [bundle, setBundle] = useState(null);
  const [bets, setBets] = useState([]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        try {
          setBusy(true);
          const b = await getRoundBundle(roundId);
          if (!alive) return;
          setBundle(b);
          const betList = await listBetsForRound(roundId).catch(() => []);
          if (alive) setBets(betList);
        } catch (e) {
          Alert.alert('成绩汇总', e instanceof Error ? e.message : '加载失败，请重试');
        } finally {
          if (alive) setBusy(false);
        }
      })();
      return () => {
        alive = false;
      };
    }, [roundId]),
  );

  const model = useMemo(() => {
    if (!bundle) return null;
    const holes = bundle.round.holes === 9 ? 9 : 18;
    const holeNums = Array.from({ length: holes }, (_, i) => i + 1);
    const scoreMap = new Map();
    const puttsMap = new Map();
    const parMap = new Map();
    (bundle.scores ?? []).forEach((s) => {
      scoreMap.set(`${s.user_id}:${s.hole_number}`, safeInt(s.strokes, 0));
      if (s.putts != null && s.putts !== '') puttsMap.set(`${s.user_id}:${s.hole_number}`, safeInt(s.putts, 0));
      if (!parMap.has(s.hole_number)) parMap.set(s.hole_number, safeInt(s.par, 4));
    });
    const rows = bundle.players
      .map((p) => {
        const strokesByHole = holeNums.map((h) => scoreMap.get(`${p.userId}:${h}`) ?? null);
        const puttsByHole = holeNums.map((h) => puttsMap.get(`${p.userId}:${h}`) ?? null);
        const total = strokesByHole.reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
        const totalPutts = puttsByHole.reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
        const totalPar = holeNums.reduce((a, h) => a + (parMap.get(h) ?? 4), 0);
        const hasAny = strokesByHole.some((x) => typeof x === 'number' && x > 0);
        const hasPutts = puttsByHole.some((x) => typeof x === 'number' && x > 0);
        return {
          userId: p.userId,
          username: p.username,
          strokesByHole,
          puttsByHole,
          total: hasAny ? total : 0,
          puttsTotal: hasPutts ? totalPutts : 0,
          hasPutts,
          toPar: hasAny ? total - totalPar : 0,
          hasAny,
        };
      })
      .sort((a, b) => (a.total || 9999) - (b.total || 9999));
    return { holeNums, parMap, rows };
  }, [bundle]);

  const betSettlement = useMemo(() => {
    if (!bundle || !model || bets.length === 0) return [];
    const players = bundle.players;
    const n = players.length;
    const holeNums = model.holeNums;

    const scoreMap = new Map();
    (bundle.scores ?? []).forEach((s) => {
      scoreMap.set(`${s.user_id}:${s.hole_number}`, safeInt(s.strokes, 0));
    });

    const holePayoutsMatchPlay = (unit, hole) => {
      const vals = players.map((p) => scoreMap.get(`${p.userId}:${hole}`) ?? null);
      if (vals.some((x) => x == null || x <= 0)) return null;
      const min = Math.min(...vals);
      const winners = vals.map((x, i) => (x === min ? i : -1)).filter((i) => i >= 0);
      if (winners.length !== 1) return Array.from({ length: n }, () => 0);
      const w = winners[0];
      const out = Array.from({ length: n }, () => -unit);
      out[w] = unit * (n - 1);
      return out;
    };
    const holePayoutsStrokePlay = (unit, hole) => {
      const vals = players.map((p) => scoreMap.get(`${p.userId}:${hole}`) ?? null);
      if (vals.some((x) => x == null || x <= 0)) return null;
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      return vals.map((s) => Math.round((mean - s) * unit));
    };

    return bets.map((b) => {
      const supported = b.bet_type === 'match_play' || b.bet_type === 'stroke_play';
      const net = new Map(players.map((p) => [p.userId, 0]));
      const perHole = [];
      if (supported) {
        for (const h of holeNums) {
          const pay =
            b.bet_type === 'match_play'
              ? holePayoutsMatchPlay(b.unit_amount, h)
              : holePayoutsStrokePlay(b.unit_amount, h);
          if (!pay) continue;
          perHole.push({ hole: h, payouts: pay });
          pay.forEach((amt, idx) => {
            const uid = players[idx].userId;
            net.set(uid, (net.get(uid) ?? 0) + (amt ?? 0));
          });
        }
      }
      return {
        bet: b,
        supported,
        rows: players.map((p) => ({ userId: p.userId, username: p.username, net: net.get(p.userId) ?? 0 })),
        perHole,
      };
    });
  }, [bets, bundle, model]);

  useEffect(() => {
    if (!bundle || !model || betSettlement.length === 0) return;
    // best-effort upsert; don't block UI
    betSettlement.forEach((s) => {
      if (!s.supported) return;
      void upsertBetResults(
        s.bet.id,
        s.rows.map((r) => ({
          userId: r.userId,
          netAmount: r.net,
          resultDetail: { betType: s.bet.bet_type, settlementTiming: s.bet.settlement_timing, perHole: s.perHole },
        })),
      ).catch(() => {});
    });
  }, [betSettlement, bundle, model]);

  async function onShare() {
    if (!bundle || !model) return;
    const text = buildSummaryText(bundle.round, model.rows, model.holeNums);
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({
          title: '成绩汇总',
          text,
        });
        return;
      }
    } catch {
      // user cancelled share or browser rejected; fallback to clipboard below
    }

    try {
      if (
        typeof navigator !== 'undefined' &&
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === 'function'
      ) {
        await navigator.clipboard.writeText(text);
        Alert.alert('分享成绩', '已复制到剪贴板');
        return;
      }
    } catch {
      // ignore and show generic message below
    }

    Alert.alert('分享成绩', '当前浏览器不支持分享/复制，请手动复制内容');
  }

  if (busy || !bundle || !model) {
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
          成绩汇总
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {bundle.round.course_name || '球场'} · {bundle.round.played_at}
        </Text>
        {bundle.round.weather || bundle.round.tee_time ? (
          <Text style={styles.sub} numberOfLines={2}>
            {bundle.round.weather ? `天气：${bundle.round.weather}` : ''}
            {bundle.round.weather && bundle.round.tee_time ? '  ·  ' : ''}
            {bundle.round.tee_time ? `开球：${bundle.round.tee_time}` : ''}
          </Text>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.tableCard}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              <View style={[styles.row, styles.rowHead]}>
                <Text style={[styles.cell, styles.cellName]}>球友</Text>
                {model.holeNums.map((h) => (
                  <Text key={h} style={[styles.cell, styles.cellHole]}>
                    {h}
                  </Text>
                ))}
                <Text style={[styles.cell, styles.cellTotal]}>总</Text>
                <Text style={[styles.cell, styles.cellTotal]}>推</Text>
                <Text style={[styles.cell, styles.cellTotal]}>±Par</Text>
              </View>
              {model.rows.map((r, idx) => {
                const toPar = r.toPar === 0 ? 'E' : r.toPar > 0 ? `+${r.toPar}` : `${r.toPar}`;
                return (
                  <View key={r.userId} style={[styles.row, idx === 0 && styles.rowWinner]}>
                    <Text style={[styles.cell, styles.cellName]} numberOfLines={1}>
                      {idx + 1}. {r.username}
                    </Text>
                    {model.holeNums.map((h, i) => (
                      <Text key={h} style={[styles.cell, styles.cellHole]}>
                        {r.strokesByHole[i] ?? '—'}
                      </Text>
                    ))}
                    <Text style={[styles.cell, styles.cellTotal]}>{r.hasAny ? r.total : '—'}</Text>
                    <Text style={[styles.cell, styles.cellTotal]}>{r.hasPutts ? r.puttsTotal : '—'}</Text>
                    <Text
                      style={[
                        styles.cell,
                        styles.cellTotal,
                        r.toPar < 0 ? styles.good : r.toPar > 0 ? styles.bad : null,
                      ]}
                    >
                      {r.hasAny ? toPar : '—'}
                    </Text>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>

        <Pressable style={styles.primary} onPress={onShare}>
          <Text style={styles.primaryTxt}>分享成绩</Text>
        </Pressable>

        {bets.length > 0 ? (
          <View style={[styles.tableCard, { marginTop: 12 }]}>
            <Text style={[styles.cell, { fontWeight: '900', marginBottom: 10 }]}>赌局结算</Text>
            {betSettlement.map((s) => (
              <View key={s.bet.id} style={{ marginBottom: 12 }}>
                <Text style={[styles.cell, { fontWeight: '900' }]}>
                  {s.bet.bet_type === 'match_play'
                    ? '比洞'
                    : s.bet.bet_type === 'stroke_play'
                      ? '比杆'
                      : '即将上线'}{' '}
                  · {s.bet.unit_amount} · {s.bet.settlement_timing === 'end_total' ? '打完一起算' : '一洞一算'}
                </Text>
                {!s.supported ? (
                  <Text style={[styles.cell, { color: GOLF.muted, marginTop: 6 }]}>该玩法即将上线</Text>
                ) : (
                  s.rows.map((r) => (
                    <View key={r.userId} style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                      <Text style={[styles.cell, { width: undefined, flex: 1 }]} numberOfLines={1}>
                        {r.username}
                      </Text>
                      <Text
                        style={[
                          styles.cell,
                          { width: undefined, fontWeight: '900' },
                          r.net > 0 ? { color: GOLF.accent } : r.net < 0 ? { color: '#f87171' } : null,
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
  tableCard: {
    backgroundColor: GOLF.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GOLF.border,
    padding: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowHead: { marginBottom: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  rowWinner: { backgroundColor: 'rgba(94,207,154,0.10)' },
  cell: { color: GOLF.text, fontSize: 12, paddingVertical: 8 },
  cellName: { width: 140, fontWeight: '900', paddingRight: 8 },
  cellHole: { width: 30, textAlign: 'center', color: GOLF.muted, fontWeight: '800' },
  cellTotal: { width: 56, textAlign: 'center', fontWeight: '900' },
  good: { color: GOLF.accent },
  bad: { color: '#f87171' },
  primary: { marginTop: 14, backgroundColor: GOLF.gold, borderRadius: 14, alignItems: 'center', paddingVertical: 14 },
  primaryTxt: { color: '#1a2e22', fontSize: 16, fontWeight: '900' },
});

