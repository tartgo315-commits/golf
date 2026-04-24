import { useFocusEffect } from '@react-navigation/native';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Clipboard, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { HoleScoreInput } from '@/components/HoleScoreInput';
import { Scoreboard } from '@/components/Scoreboard';
import { buildParArray } from '@/lib/handicap';
import {
  buildMatchShareText,
  getMatchById,
  saveMatchRecord,
  saveQuickHandicapFromMatch,
} from '@/utils/liveMatchStorage';
import {
  calcMatchPlayResult,
  calcMoneyResult,
  calcNassauResult,
  countConsecutiveHolesComplete,
  pickMvpPlayerIndex,
  totalNetThrough,
  totalParThrough,
  upsertPlayerHole,
  vsParLabel,
  type MatchRecord,
} from '@/utils/matchScoring';

const BG = '#0d1b11';
const CARD = '#16261c';
const ACCENT = '#b5ff3a';
const ON = '#0d1b11';
const MAIN = '#e8f0e5';
const SUB = '#8a9a8e';
const MUTED = '#5a6b5f';
const WIN = '#b5ff3a';
const LOSS = '#d94848';
const GOLD = '#e5c53a';

function alertCompat(title: string, msg?: string) {
  if (Platform.OS === 'web' && typeof globalThis.alert === 'function') {
    globalThis.alert(msg ? `${title}\n\n${msg}` : title);
    return;
  }
  if (msg) Alert.alert(title, msg);
  else Alert.alert(title);
}

export default function LiveMatchScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [match, setMatch] = useState<MatchRecord | null>(null);
  const [currentHole, setCurrentHole] = useState(1);
  const [grossDraft, setGrossDraft] = useState<number[]>([]);

  const reload = useCallback(async () => {
    if (!id) return;
    const m = await getMatchById(id);
    setMatch(m);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void reload();
      return () => {};
    }, [reload]),
  );

  const pars = useMemo(() => {
    if (!match) return [] as number[];
    return buildParArray('72', match.holes);
  }, [match]);

  useEffect(() => {
    if (!match) return;
    setGrossDraft(
      match.players.map((pl) => {
        const ex = pl.scores.find((s) => s.hole === currentHole);
        return ex ? ex.gross : pars[currentHole - 1] ?? 4;
      }),
    );
  }, [match, currentHole, pars]);

  const through = match ? countConsecutiveHolesComplete(match) : 0;
  const money = match && match.unit > 0 ? calcMoneyResult(match, through) : null;

  const persist = async (m: MatchRecord) => {
    await saveMatchRecord(m);
    setMatch(m);
  };

  const onChangeGross = (idx: number, g: number) => {
    setGrossDraft((prev) => {
      const next = [...prev];
      next[idx] = g;
      return next;
    });
  };

  const onNextHole = async () => {
    if (!match) return;
    let m = match;
    const par = pars[currentHole - 1] ?? 4;
    match.players.forEach((_, idx) => {
      const g = grossDraft[idx] ?? par;
      m = upsertPlayerHole(m, idx, currentHole, par, g);
    });
    await persist(m);
    if (currentHole >= match.holes) {
      const done: MatchRecord = { ...m, status: 'finished' };
      await persist(done);
      return;
    }
    setCurrentHole((h) => h + 1);
  };

  const finalizeEarly = async () => {
    if (!match) return;
    const done: MatchRecord = { ...match, status: 'finished' };
    await persist(done);
  };

  const onEndPress = () => {
    const go = () => void finalizeEarly();
    if (Platform.OS === 'web' && typeof globalThis.confirm === 'function') {
      if (globalThis.confirm('确认结束？成绩将保存到历史记录')) go();
      return;
    }
    Alert.alert('确认结束？', '成绩将保存到历史记录', [
      { text: '取消', style: 'cancel' },
      { text: '结束', style: 'destructive', onPress: go },
    ]);
  };

  const onCompletePress = () => {
    if (!match) return;
    const th = countConsecutiveHolesComplete(match);
    if (th < match.holes) {
      alertCompat('提示', '请先录完全部球洞，或使用「结束比赛」提前结束。');
      return;
    }
    void (async () => {
      const done: MatchRecord = { ...match, status: 'finished' };
      await persist(done);
    })();
  };

  const shareResult = async () => {
    if (!match) return;
    const text = buildMatchShareText(match);
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        Clipboard.setString(text);
      }
      alertCompat('已复制', '文字摘要已复制到剪贴板');
    } catch {
      alertCompat('复制失败', text.slice(0, 400));
    }
  };

  const saveHandicap = () => {
    if (!match) return;
    void (async () => {
      const r = await saveQuickHandicapFromMatch(match, 0);
      if (!r.ok) {
        alertCompat('无法保存', r.message);
        return;
      }
      alertCompat('已保存', '已写入成绩记录（快速模式）');
    })();
  };

  if (!id || !match) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>未找到比赛</Text>
        <Pressable onPress={() => router.back()} style={styles.link}>
          <Text style={styles.linkTxt}>返回</Text>
        </Pressable>
      </View>
    );
  }

  const th = through;
  const isLast = currentHole >= match.holes;
  const p0 = match.players[0]!;
  const p1 = match.players[1];

  let headline: { main: string; sub: string; nassau?: { front: string; back: string; total: string } } = {
    main: '—',
    sub: `已打 ${th} 洞，剩余 ${Math.max(0, match.holes - th)} 洞`,
  };

  if (match.mode === 'matchplay' && match.players.length > 2) {
    headline = { main: '比洞进行中', sub: `已打 ${th} 洞，剩余 ${Math.max(0, match.holes - th)} 洞` };
  } else if (match.mode === 'matchplay' && p1) {
    const r = calcMatchPlayResult(p0, p1, th, match.holes);
    headline = {
      main: r.text,
      sub: `已打 ${th} 洞，剩余 ${Math.max(0, match.holes - th)} 洞`,
    };
  } else if (match.mode === 'matchplay') {
    headline = { main: '练习记分', sub: `已打 ${th} 洞，剩余 ${Math.max(0, match.holes - th)} 洞` };
  } else if (match.mode === 'nassau' && p1) {
    const n = calcNassauResult(p0, p1, match.holes);
    headline = {
      main: n.total,
      sub: `已打 ${th} 洞，剩余 ${Math.max(0, match.holes - th)} 洞`,
      nassau: n,
    };
  } else if (match.mode === 'nassau') {
    headline = { main: '练习记分', sub: `已打 ${th} 洞，剩余 ${Math.max(0, match.holes - th)} 洞` };
  } else if (match.mode === 'stableford') {
    const pts = match.players.map((pl) =>
      pl.scores.filter((s) => s.hole <= th).reduce((a, s) => a + s.stablefordPoints, 0),
    );
    headline = {
      main: pts.map((p) => String(p)).join(' : '),
      sub: `积分（已打 ${th} 洞）`,
    };
  } else if (match.mode === 'stroke') {
    const parT = totalParThrough(pars, th);
    headline = {
      main: match.players
        .map((pl) => {
          const nt = totalNetThrough(pl, th);
          return `${pl.name.slice(0, 4)} ${vsParLabel(nt, parT)}`;
        })
        .join('  ·  '),
      sub: `净杆 vs Par（已打 ${th} 洞）`,
    };
  }

  const mvpIdx = pickMvpPlayerIndex(match, th);
  const mvp = match.players[mvpIdx];

  const moneyLine =
    money && match.players.length > 1
      ? (() => {
          const me = money.payoutsYuan[0] ?? 0;
          if (me > 0) return { txt: `当前盈亏 +¥${me}`, win: true };
          if (me < 0) return { txt: `当前盈亏 -¥${Math.abs(me)}`, win: false };
          return { txt: '当前盈亏 ¥0', win: true };
        })()
      : null;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={onEndPress} hitSlop={8}>
          <Text style={styles.headerLeft}>‹ 结束比赛</Text>
        </Pressable>
        <Text style={styles.headerMid} numberOfLines={1}>
          {match.course || '比赛'}
        </Text>
        <Pressable onPress={onCompletePress} hitSlop={8}>
          <Text style={styles.headerRight}>完成</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.scoreCard}>
          <Text style={[styles.bigScore, headline.main === 'AS' ? { color: MAIN } : { color: ACCENT }]}>
            {headline.main}
          </Text>
          <Text style={styles.subScore}>{headline.sub}</Text>
          {headline.nassau ? (
            <View style={styles.nassauRow}>
              <Text style={styles.nassauTxt}>前九 {headline.nassau.front}</Text>
              <Text style={styles.nassauTxt}>后九 {headline.nassau.back}</Text>
              <Text style={styles.nassauTxt}>全场 {headline.nassau.total}</Text>
            </View>
          ) : null}
          {match.mode === 'stableford' ? (
            <View style={styles.sfRow}>
              {match.players.map((pl, i) => {
                const pts = pl.scores.filter((s) => s.hole <= th).reduce((a, s) => a + s.stablefordPoints, 0);
                const max = Math.max(
                  ...match.players.map((x) =>
                    x.scores.filter((s) => s.hole <= th).reduce((a, s) => a + s.stablefordPoints, 0),
                  ),
                  0,
                );
                const hi = pts === max && max > 0;
                return (
                  <Text key={i} style={[styles.sfNum, hi ? styles.sfHi : styles.sfLo]}>
                    {pl.name}: {pts}
                  </Text>
                );
              })}
            </View>
          ) : null}
          {moneyLine ? (
            <Text style={[styles.money, moneyLine.win ? { color: WIN } : { color: LOSS }]}>{moneyLine.txt}</Text>
          ) : null}
        </View>

        <Scoreboard match={match} pars={pars} currentHole={currentHole} onPickHole={(h) => setCurrentHole(h)} />

        {match.status === 'active' ? (
          <HoleScoreInput
            match={match}
            pars={pars}
            hole={currentHole}
            grossDraft={grossDraft}
            onChangeGross={onChangeGross}
            onNext={() => void onNextHole()}
            isLastHole={isLast}
          />
        ) : null}

        {match.status === 'finished' ? (
          <View style={styles.settle}>
            <Text style={styles.settleTitle}>本场结算</Text>
            <Text style={styles.settleBig}>{headline.main}</Text>
            {match.players.map((pl, i) => {
              const amt = money?.payoutsYuan[i] ?? 0;
              return (
                <Text key={i} style={[styles.settleAmt, amt >= 0 ? { color: WIN } : { color: LOSS }]}>
                  {pl.name}: {amt >= 0 ? '+' : '-'}¥{Math.abs(amt)}
                </Text>
              );
            })}
            <Text style={styles.mvp}>
              本场 MVP：<Text style={styles.mvpName}>{mvp?.name ?? '—'}</Text>
            </Text>
            <Pressable style={styles.btn} onPress={saveHandicap}>
              <Text style={styles.btnTxt}>保存到成绩记录</Text>
            </Pressable>
            <Pressable style={styles.btnOutline} onPress={() => void shareResult()}>
              <Text style={styles.btnOutlineTxt}>分享结果</Text>
            </Pressable>
            <Pressable style={styles.btnGhost} onPress={() => router.replace('/(tabs)' as Href)}>
              <Text style={styles.btnGhostTxt}>返回首页</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  muted: { color: MUTED, marginBottom: 12 },
  link: { padding: 8 },
  linkTxt: { color: ACCENT, fontWeight: '700' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'web' ? 44 : 14,
    paddingBottom: 10,
  },
  headerLeft: { fontSize: 13, fontWeight: '600', color: SUB, width: 100 },
  headerMid: { flex: 1, textAlign: 'center', fontSize: 14, fontWeight: '700', color: MAIN },
  headerRight: { width: 56, textAlign: 'right', fontSize: 14, fontWeight: '700', color: ACCENT },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 32 },
  scoreCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  bigScore: { fontSize: 30, fontWeight: '800', textAlign: 'center' },
  subScore: { marginTop: 8, fontSize: 11, fontWeight: '600', color: MUTED, textAlign: 'center' },
  nassauRow: { marginTop: 10, gap: 4 },
  nassauTxt: { fontSize: 11, fontWeight: '600', color: SUB, textAlign: 'center' },
  sfRow: { marginTop: 10, gap: 6 },
  sfNum: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  sfHi: { color: ACCENT },
  sfLo: { color: MAIN },
  money: { marginTop: 12, fontSize: 14, fontWeight: '800', textAlign: 'center' },
  settle: {
    marginTop: 20,
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 16,
  },
  settleTitle: { fontSize: 15, fontWeight: '800', color: MAIN, marginBottom: 10 },
  settleBig: { fontSize: 26, fontWeight: '800', color: ACCENT, textAlign: 'center', marginBottom: 12 },
  settleAmt: { fontSize: 15, fontWeight: '700', marginBottom: 6 },
  mvp: { marginTop: 10, fontSize: 13, fontWeight: '600', color: SUB, textAlign: 'center' },
  mvpName: { color: GOLD, fontWeight: '800' },
  btn: {
    marginTop: 14,
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnTxt: { fontSize: 15, fontWeight: '800', color: ON },
  btnOutline: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnOutlineTxt: { fontSize: 14, fontWeight: '700', color: MAIN },
  btnGhost: { marginTop: 10, paddingVertical: 12, alignItems: 'center' },
  btnGhostTxt: { fontSize: 14, fontWeight: '600', color: SUB },
});
