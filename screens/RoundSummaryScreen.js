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

import { ScreenHeader } from '@/components/ScreenHeader';
import { GOLF } from '@/constants/golfTheme';
import { THEME } from '@/constants/theme';
import {
  getRoundBundle,
  getRoundConfirmations,
  listBetsForRound,
  requestScoreConfirmation,
  setRoundStatus,
  upsertBetResults,
} from '@/lib/scorecardApi';
import { supabase } from '@/lib/supabase';
import {
  mergeEventPayoutsIntoBase,
  defaultEventConfig,
  cumulativeEventPayouts,
} from '@/utils/matchEventModifiers';
import { cumulativeWolfPayouts, wolfIndexForHole } from '@/utils/wolfScoring';

function safeInt(x, fallback) {
  const n = Number(x);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

function guestPlayersFromRound(round) {
  const rawGuests = round?.guest_companions;
  if (!Array.isArray(rawGuests)) return [];
  return rawGuests
    .filter((g) => g?.type === 'guest' && typeof g.id === 'string')
    .map((g) => ({
      userId: g.id,
      username: typeof g.name === 'string' && g.name.trim() ? g.name.trim() : '访客',
      isGuest: true,
      groupNumber: typeof g.group_number === 'number' ? Math.max(1, Math.round(g.group_number)) : 1,
    }));
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

  const [loading, setLoading] = useState(true);
  const [bundle, setBundle] = useState(null);
  const [roundPlayers, setRoundPlayers] = useState([]);
  const [soloPlayer, setSoloPlayer] = useState(null);
  const [bets, setBets] = useState([]);
  const [confirmations, setConfirmations] = useState([]);
  const [requesting, setRequesting] = useState(false);
  const [groupTab, setGroupTab] = useState('all');

  /** 渲染用球员列表：优先 bundle.players（已含 solo 回退），否则 soloPlayer */
  const summaryPlayers = useMemo(() => {
    if (bundle?.players?.length) return bundle.players;
    if (soloPlayer) {
      return [
        {
          userId: soloPlayer.user_id,
          username: soloPlayer.username,
          isGuest: false,
          groupNumber: soloPlayer.group_number ?? 1,
        },
      ];
    }
    return [];
  }, [bundle, soloPlayer]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        try {
          setLoading(true);
          setSoloPlayer(null);
          setRoundPlayers([]);
          setBundle(null);

          const { data: playersData, error: rpErr } = await supabase
            .from('round_players')
            .select('*')
            .eq('round_id', roundId);
          if (rpErr) console.error('load round_players error:', rpErr);
          const rows = playersData ?? [];
          setRoundPlayers(rows);

          const raw = await getRoundBundle(roundId);

          let solo = null;
          if (rows.length === 0 && raw.round.created_by) {
            const fromBundle = raw.players.find(
              (p) => !p.isGuest && p.userId === raw.round.created_by,
            );
            if (fromBundle) {
              solo = {
                user_id: fromBundle.userId,
                username: fromBundle.username,
                group_number: fromBundle.groupNumber ?? 1,
              };
            } else {
              const { data: creatorProfile } = await supabase
                .from('profiles')
                .select('username')
                .eq('id', raw.round.created_by)
                .maybeSingle();
              solo = {
                user_id: raw.round.created_by,
                username: (creatorProfile?.username || '').trim() || '球友',
                group_number: 1,
              };
            }
            setSoloPlayer(solo);
          } else {
            setSoloPlayer(null);
          }

          const players =
            raw.players.length > 0
              ? raw.players
              : solo
                ? [
                    {
                      userId: solo.user_id,
                      username: solo.username,
                      isGuest: false,
                      groupNumber: solo.group_number ?? 1,
                    },
                    ...guestPlayersFromRound(raw.round),
                  ]
                : guestPlayersFromRound(raw.round);

          const b = {
            round: raw.round,
            players,
            scores: raw.scores ?? [],
            soloPlayer: solo,
            roundPlayers: rows,
          };
          setBundle(b);

          const confs = await getRoundConfirmations(roundId).catch(() => []);
          if (alive) setConfirmations(confs);
          if (alive && confs.length > 0 && confs.every((c) => c.status === 'confirmed')) {
            void checkAndLock(b);
          }
          const betList = await listBetsForRound(roundId).catch(() => []);
          if (alive) setBets(betList);
        } catch (e) {
          console.error('load round summary error:', e);
          Alert.alert('成绩汇总', e instanceof Error ? e.message : '加载失败，请重试');
        } finally {
          setLoading(false);
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
    const girMap = new Map();
    const firMap = new Map();
    const sandMap = new Map();
    const penaltyMap = new Map();
    (bundle.scores ?? []).forEach((s) => {
      scoreMap.set(`${s.user_id}:${s.hole_number}`, safeInt(s.strokes, 0));
      if (s.putts != null && s.putts !== '') puttsMap.set(`${s.user_id}:${s.hole_number}`, safeInt(s.putts, 0));
      if (!parMap.has(s.hole_number)) parMap.set(s.hole_number, safeInt(s.par, 4));
      const k = `${s.user_id}:${s.hole_number}`;
      if (s.gir != null) girMap.set(k, s.gir);
      if (s.fir != null) firMap.set(k, s.fir);
      if (s.sand != null) sandMap.set(k, s.sand);
      if (s.penalty != null) penaltyMap.set(k, s.penalty);
    });
    const rows = summaryPlayers
      .map((p) => {
        const strokesByHole = holeNums.map((h) => scoreMap.get(`${p.userId}:${h}`) ?? null);
        const puttsByHole = holeNums.map((h) => puttsMap.get(`${p.userId}:${h}`) ?? null);
        const total = strokesByHole.reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
        const totalPutts = puttsByHole.reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
        const totalPar = holeNums.reduce((a, h) => a + (parMap.get(h) ?? 4), 0);
        const hasAny = strokesByHole.some((x) => typeof x === 'number' && x > 0);
        const hasPutts = puttsByHole.some((x) => typeof x === 'number' && x > 0);
        const girHoles = holeNums.filter((h) => girMap.get(`${p.userId}:${h}`) === true).length;
        const totalGirHoles = holeNums.length;
        const par45Holes = holeNums.filter((h) => (parMap.get(h) ?? 4) >= 4);
        const firHoles = par45Holes.filter((h) => firMap.get(`${p.userId}:${h}`) === 'hit').length;
        const sandHoles = holeNums.filter((h) => sandMap.get(`${p.userId}:${h}`) === true).length;
        const penaltyHoles = holeNums.filter((h) => {
          const v = penaltyMap.get(`${p.userId}:${h}`);
          return v === 'water' || v === 'ob';
        }).length;
        const sandSaves = holeNums.filter((h) => {
          if (!sandMap.get(`${p.userId}:${h}`)) return false;
          const strk = scoreMap.get(`${p.userId}:${h}`) ?? 0;
          const par = parMap.get(h) ?? 4;
          return strk > 0 && strk <= par;
        }).length;
        const holeColors = holeNums.map((h) => {
          const strk = scoreMap.get(`${p.userId}:${h}`);
          if (!strk) return 'neutral';
          const par = parMap.get(h) ?? 4;
          const diff = strk - par;
          if (diff <= -2) return 'eagle';
          if (diff === -1) return 'birdie';
          if (diff === 0) return 'par';
          if (diff === 1) return 'bogey';
          return 'double';
        });
        const front9Sum = holeNums.slice(0, 9).reduce((a, h) => a + (scoreMap.get(`${p.userId}:${h}`) ?? 0), 0);
        const back9Sum =
          holeNums.length === 18
            ? holeNums.slice(9).reduce((a, h) => a + (scoreMap.get(`${p.userId}:${h}`) ?? 0), 0)
            : null;
        return {
          userId: p.userId,
          username: p.username,
          groupNumber: p.groupNumber ?? 1,
          strokesByHole,
          puttsByHole,
          total: hasAny ? total : 0,
          puttsTotal: hasPutts ? totalPutts : 0,
          hasPutts,
          toPar: hasAny ? total - totalPar : 0,
          hasAny,
          girPct: totalGirHoles > 0 ? Math.round((girHoles / totalGirHoles) * 100) : null,
          firPct: par45Holes.length > 0 ? Math.round((firHoles / par45Holes.length) * 100) : null,
          sandSavePct: sandHoles > 0 ? Math.round((sandSaves / sandHoles) * 100) : null,
          penaltyCount: penaltyHoles,
          holeColors,
          front9: front9Sum > 0 ? front9Sum : null,
          back9: back9Sum != null && back9Sum > 0 ? back9Sum : null,
        };
      })
      .sort((a, b) => (a.total || 9999) - (b.total || 9999));
    return { holeNums, parMap, rows };
  }, [bundle, summaryPlayers]);

  const distinctGroups = useMemo(() => {
    const set = new Set(summaryPlayers.map((p) => p.groupNumber ?? 1));
    return Array.from(set).sort((a, b) => a - b);
  }, [summaryPlayers]);

  const showGroupTabs = distinctGroups.length > 1;

  const displayRows = useMemo(() => {
    if (!model) return [];
    if (groupTab === 'all') return model.rows;
    const g = Number(groupTab);
    return model.rows.filter((r) => r.groupNumber === g);
  }, [model, groupTab]);

  const betSettlement = useMemo(() => {
    if (!bundle || !model || bets.length === 0) return [];
    // 结算始终基于本场全部球员（跨组），不按分组过滤
    const players = bundle.players;
    const n = players.length;
    const holeNums = model.holeNums;
    const parMap = model.parMap;

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
      const eventsForBet = Array.isArray(b.events) ? b.events : [];
      const cfg = b.event_config ?? defaultEventConfig(b.unit_amount);
      const flowerNets =
        eventsForBet.length > 0
          ? cumulativeEventPayouts(
              eventsForBet,
              holeNums[holeNums.length - 1] ?? 18,
              n,
              cfg,
            )
          : null;

      if (b.bet_type === 'wolf') {
        const decisions = Array.isArray(b.wolf_decisions) ? b.wolf_decisions : [];
        const tieRule = b.tie_rule === 'carry' || b.tie_rule === 'double' ? b.tie_rule : 'void';
        const wolfNets = cumulativeWolfPayouts(
          decisions,
          (hole) =>
            players.map((p) => {
              const s = scoreMap.get(`${p.userId}:${hole}`);
              return s && s > 0 ? s - (parMap.get(hole) ?? 4) : null;
            }),
          holeNums[holeNums.length - 1] ?? 18,
          b.unit_amount,
          tieRule,
        );
        return {
          bet: b,
          supported: true,
          rows: players.map((p, i) => ({
            userId: p.userId,
            username: p.username,
            net: wolfNets[i] ?? 0,
          })),
          perHole: [],
          flowerNets,
        };
      }

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

      const baseNets = players.map((p) => Math.round(net.get(p.userId) ?? 0));
      const lastHole = Math.max(...perHole.map((ph) => ph.hole), 0);
      const merged = mergeEventPayoutsIntoBase(
        baseNets,
        eventsForBet,
        lastHole || holeNums.length,
        n,
        cfg,
      );
      const rows = players.map((p, i) => ({
        userId: p.userId,
        username: p.username,
        net: merged[i] ?? 0,
      }));

      return {
        bet: b,
        supported,
        rows,
        perHole,
        flowerNets,
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

  async function onRequestConfirmation() {
    if (!bundle) return;
    const myId = (await supabase.auth.getUser()).data.user?.id ?? '';
    const friendIds = bundle.players.map((p) => p.userId).filter((id) => id !== myId);
    if (friendIds.length === 0) {
      Alert.alert('无法发起', '场内暂无其他已注册球友');
      return;
    }
    try {
      setRequesting(true);
      await requestScoreConfirmation(roundId, friendIds);
      Alert.alert('已发送', '确认请求已发送给同场球友，等待对方确认后成绩将被标记为已验证');
      const confs = await getRoundConfirmations(roundId);
      setConfirmations(confs);
      if (confs.length > 0 && confs.every((c) => c.status === 'confirmed')) {
        void checkAndLock();
      }
    } catch (e) {
      Alert.alert('发送失败', e instanceof Error ? e.message : '请稍后重试');
    } finally {
      setRequesting(false);
    }
  }

  async function checkAndLock(latestBundle) {
    const rb = latestBundle ?? bundle;
    if (!rb || rb.round.status === 'locked') return;
    try {
      const confs = await getRoundConfirmations(roundId);
      if (confs.length > 0 && confs.every((c) => c.status === 'confirmed')) {
        await setRoundStatus(roundId, 'locked');
        setBundle((prev) => (prev ? { ...prev, round: { ...prev.round, status: 'locked' } } : prev));
      }
    } catch {
      /* 静默 */
    }
  }

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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={GOLF.accent} />
      </View>
    );
  }

  if (!bundle) {
    return (
      <View style={styles.center}>
        <Text style={{ color: GOLF.muted, fontSize: 14 }}>加载失败，请返回重试</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenHeader
        variant="stack"
        title="成绩汇总"
        subtitle={`${bundle.round.course_name || '球场'} · ${bundle.round.played_at}`}
        onBack={() => router.back()}
      />
      {(bundle.round.status === 'completed' || bundle.round.status === 'locked') ? (
        <View style={styles.badgeWrap}>
          <View
            style={[
              styles.completedBadge,
              bundle.round.status === 'locked' && {
                borderColor: '#60a5fa',
                backgroundColor: 'rgba(96,165,250,0.12)',
              },
            ]}
          >
            <Text
              style={[
                styles.completedTxt,
                bundle.round.status === 'locked' && { color: '#60a5fa' },
              ]}
            >
              {bundle.round.status === 'locked' ? '🔒 已锁定' : '✓ 已完成'}
            </Text>
          </View>
        </View>
      ) : null}
      {bundle.round.status === 'locked' ? (
        <View style={styles.lockBanner}>
          <Text style={styles.lockBannerTxt}>🔒 成绩已锁定 · 全员确认</Text>
        </View>
      ) : null}
      {bundle.round.weather || bundle.round.tee_time ? (
        <Text style={styles.metaSub} numberOfLines={2}>
          {bundle.round.weather ? `天气：${bundle.round.weather}` : ''}
          {bundle.round.weather && bundle.round.tee_time ? '  ·  ' : ''}
          {bundle.round.tee_time ? `开球：${bundle.round.tee_time}` : ''}
        </Text>
      ) : null}

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {showGroupTabs ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.groupTabScroll}
            contentContainerStyle={styles.groupTabRow}
          >
            <Pressable
              onPress={() => setGroupTab('all')}
              style={[styles.groupTabChip, groupTab === 'all' && styles.groupTabChipOn]}
            >
              <Text style={[styles.groupTabTxt, groupTab === 'all' && styles.groupTabTxtOn]}>全部</Text>
            </Pressable>
            {distinctGroups.map((g) => (
              <Pressable
                key={g}
                onPress={() => setGroupTab(g)}
                style={[styles.groupTabChip, groupTab === g && styles.groupTabChipOn]}
              >
                <Text style={[styles.groupTabTxt, groupTab === g && styles.groupTabTxtOn]}>第{g}组</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

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
              {displayRows.map((r, idx) => {
                const toPar = r.toPar === 0 ? 'E' : r.toPar > 0 ? `+${r.toPar}` : `${r.toPar}`;
                return (
                  <View key={r.userId}>
                    <View style={[styles.row, idx === 0 && styles.rowWinner]}>
                      <Text style={[styles.cell, styles.cellName]} numberOfLines={1}>
                        {idx + 1}. {r.username}
                        {showGroupTabs && groupTab === 'all' ? (
                          <Text style={styles.groupBadge}> G{r.groupNumber}</Text>
                        ) : null}
                      </Text>
                      {model.holeNums.map((h, i) => {
                        const color = r.holeColors?.[i];
                        const colorStyle =
                          color === 'eagle'
                            ? styles.scoreEagle
                            : color === 'birdie'
                              ? styles.scoreBirdie
                              : color === 'par'
                                ? styles.scorePar
                                : color === 'bogey'
                                  ? styles.scoreBogey
                                  : color === 'double'
                                    ? styles.scoreDouble
                                    : null;
                        return (
                          <Text key={h} style={[styles.cell, styles.cellHole, colorStyle]}>
                            {r.strokesByHole[i] ?? '—'}
                          </Text>
                        );
                      })}
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
                    {(r.girPct != null ||
                      r.firPct != null ||
                      r.sandSavePct != null ||
                      r.penaltyCount > 0 ||
                      r.puttsTotal > 0) && (
                      <View style={styles.statRow}>
                        {r.girPct != null ? <Text style={styles.statChip}>GIR {r.girPct}%</Text> : null}
                        {r.firPct != null ? <Text style={styles.statChip}>FIR {r.firPct}%</Text> : null}
                        {r.sandSavePct != null ? <Text style={styles.statChip}>沙救 {r.sandSavePct}%</Text> : null}
                        {r.penaltyCount > 0 ? (
                          <Text style={[styles.statChip, styles.statBad]}>罚 {r.penaltyCount}次</Text>
                        ) : null}
                        {r.puttsTotal > 0 ? <Text style={styles.statChip}>推 {r.puttsTotal}</Text> : null}
                      </View>
                    )}
                    {(r.front9 || r.back9) ? (
                      <View style={styles.statRow}>
                        {r.front9 ? <Text style={styles.statChip}>前9: {r.front9}</Text> : null}
                        {r.back9 ? <Text style={styles.statChip}>后9: {r.back9}</Text> : null}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>

        <Pressable style={styles.primary} onPress={onShare}>
          <Text style={styles.primaryTxt}>分享成绩</Text>
        </Pressable>

        <Pressable
          style={[
            styles.primary,
            { backgroundColor: GOLF.bgCard, borderWidth: 1, borderColor: GOLF.accent, marginTop: 8 },
          ]}
          onPress={() => router.push(`/rounds/${roundId}/review`)}
        >
          <Text style={[styles.primaryTxt, { color: GOLF.accent }]}>🤖 AI 单场复盘</Text>
        </Pressable>

        {bundle?.round.status === 'completed' ? (
          <View style={[styles.tableCard, { marginTop: 12 }]}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 10,
              }}
            >
              <Text style={{ color: GOLF.text, fontWeight: '900', fontSize: 14 }}>👥 好友确认</Text>
              {confirmations.length === 0 ? (
                <Pressable
                  onPress={() => void onRequestConfirmation()}
                  disabled={requesting}
                  style={{
                    borderWidth: 1,
                    borderColor: GOLF.accent,
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    opacity: requesting ? 0.5 : 1,
                  }}
                >
                  <Text style={{ color: GOLF.accent, fontWeight: '800', fontSize: 12 }}>
                    {requesting ? '发送中…' : '发起确认'}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {confirmations.length === 0 ? (
              <Text style={{ color: GOLF.muted, fontSize: 13, lineHeight: 20 }}>
                邀请同场球友确认成绩，确认后成绩将被标记为「已验证」，更具公信力。
              </Text>
            ) : (
              confirmations.map((c) => (
                <View
                  key={c.confirmerId}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: 8,
                  }}
                >
                  <Text style={{ color: GOLF.text, flex: 1 }}>{c.confirmerName}</Text>
                  <View
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 20,
                      backgroundColor:
                        c.status === 'confirmed'
                          ? 'rgba(201,255,74,0.12)'
                          : c.status === 'disputed'
                            ? 'rgba(248,113,113,0.12)'
                            : 'rgba(255,255,255,0.06)',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '800',
                        color:
                          c.status === 'confirmed'
                            ? GOLF.accent
                            : c.status === 'disputed'
                              ? '#f87171'
                              : GOLF.muted,
                      }}
                    >
                      {c.status === 'confirmed'
                        ? '✓ 已确认'
                        : c.status === 'disputed'
                          ? '✗ 有异议'
                          : '待确认'}
                    </Text>
                  </View>
                </View>
              ))
            )}

            {confirmations.length > 0 && confirmations.every((c) => c.status === 'confirmed') ? (
              <View
                style={{
                  marginTop: 12,
                  paddingTop: 12,
                  borderTopWidth: 1,
                  borderTopColor: 'rgba(255,255,255,0.08)',
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: GOLF.accent, fontWeight: '900', fontSize: 14 }}>
                  ✅ 所有球友已确认，成绩已锁定
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <Pressable
          style={[
            styles.primary,
            {
              backgroundColor: 'transparent',
              borderWidth: 1,
              borderColor: GOLF.muted,
              marginTop: 8,
            },
          ]}
          onPress={() =>
            Alert.alert(
              '申请修改',
              '如需修改已完成成绩，请联系同场球友重新确认后解锁。\n\n（好友确认功能即将上线）',
              [{ text: '知道了' }],
            )
          }
        >
          <Text style={[styles.primaryTxt, { color: GOLF.muted }]}>申请修改</Text>
        </Pressable>

        {bets.length > 0 ? (
          <View style={[styles.tableCard, { marginTop: 12 }]}>
            <Text style={[styles.cell, { fontWeight: '900', marginBottom: 10 }]}>赌局结算</Text>
            {betSettlement.map((s) => {
              const betLabel =
                {
                  match_play: '比洞',
                  stroke_play: '比杆',
                  wolf: '🐺 Wolf',
                  skins: 'Skins',
                  nassau_pack: 'Nassau',
                  stableford: '积分赛',
                  fixed_lasi: '固拉',
                  rotating_lasi: '乱拉',
                  landlord: '斗地主',
                  trumpet: '喇叭花',
                }[s.bet.bet_type] ?? s.bet.bet_type;
              return (
                <View key={s.bet.id} style={{ marginBottom: 12 }}>
                  <Text style={[styles.cell, { fontWeight: '900' }]}>
                    {betLabel} · {s.bet.unit_amount} ·{' '}
                    {s.bet.settlement_timing === 'end_total' ? '打完一起算' : '一洞一算'}
                  </Text>
                  {!s.supported ? (
                    <Text style={[styles.cell, { color: GOLF.muted, marginTop: 6 }]}>该玩法即将上线</Text>
                  ) : (
                    s.rows.map((r) => (
                      <View
                        key={r.userId}
                        style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}
                      >
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
                  {s.flowerNets && s.flowerNets.some((v) => v !== 0) ? (
                    <View
                      style={{
                        marginTop: 6,
                        paddingTop: 6,
                        borderTopWidth: 1,
                        borderTopColor: 'rgba(255,255,255,0.06)',
                      }}
                    >
                      <Text style={[styles.cell, { color: GOLF.muted, fontSize: 11 }]}>含挂花</Text>
                      {bundle.players.map((p, i) => (
                        <View
                          key={p.userId}
                          style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}
                        >
                          <Text style={[styles.cell, { flex: 1 }]}>{p.username}</Text>
                          <Text
                            style={[
                              styles.cell,
                              {
                                fontWeight: '900',
                                color:
                                  s.flowerNets[i] > 0
                                    ? GOLF.accent
                                    : s.flowerNets[i] < 0
                                      ? '#f87171'
                                      : GOLF.muted,
                              },
                            ]}
                          >
                            {s.flowerNets[i] > 0 ? `+${s.flowerNets[i]}` : String(s.flowerNets[i])}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: GOLF.bg },
  center: { flex: 1, backgroundColor: GOLF.bg, alignItems: 'center', justifyContent: 'center' },
  badgeWrap: { paddingHorizontal: 16, paddingBottom: 8 },
  metaSub: { color: GOLF.muted, marginTop: 0, marginBottom: 8, paddingHorizontal: 16 },
  scroll: { padding: 16, paddingBottom: 40 },
  groupTabScroll: { marginBottom: 10, flexGrow: 0 },
  groupTabRow: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  groupTabChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: GOLF.border,
    backgroundColor: GOLF.bgCard,
  },
  groupTabChipOn: {
    borderColor: THEME.accent,
    backgroundColor: THEME.accentBg,
  },
  groupTabTxt: { color: GOLF.muted, fontSize: 13, fontWeight: '700' },
  groupTabTxtOn: { color: THEME.accent, fontWeight: '900' },
  groupBadge: { color: GOLF.muted, fontSize: 11, fontWeight: '700' },
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
  scoreEagle: { color: '#FFD700', fontWeight: '900' },
  scoreBirdie: { color: '#f87171', fontWeight: '900' },
  scorePar: { color: GOLF.text },
  scoreBogey: { color: '#60a5fa' },
  scoreDouble: { color: '#6a7a70' },
  statRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 4,
    paddingBottom: 6,
  },
  statChip: {
    color: GOLF.muted,
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  statBad: { color: '#f87171' },
  completedBadge: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(201,255,74,0.12)',
    borderWidth: 1,
    borderColor: GOLF.accent,
  },
  completedTxt: { color: GOLF.accent, fontSize: 12, fontWeight: '800' },
  lockBanner: {
    backgroundColor: 'rgba(201,255,74,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(201,255,74,0.28)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 14,
    marginHorizontal: 16,
    alignItems: 'center',
  },
  lockBannerTxt: {
    fontSize: 13,
    fontWeight: '700',
    color: '#c9ff4a',
    letterSpacing: 0.2,
  },
});

