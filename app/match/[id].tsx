import { useFocusEffect } from '@react-navigation/native';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Clipboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { buildParArray } from '@/lib/handicap';
import {
  buildMatchShareText,
  getMatchById,
  saveMatchRecord,
  saveQuickHandicapFromMatch,
} from '@/utils/liveMatchStorage';
import {
  calcMoneyResult,
  countConsecutiveHolesComplete,
  describeCurrentHoleMoney,
  holeNetGross,
  pairwiseDebtLines,
  payoutsYuanSingleHole,
  pickMvpPlayerIndex,
  upsertPlayerHole,
  type MatchRecord,
} from '@/utils/matchScoring';

const BG = '#0d1b11';
const CARD = '#16261c';
const ACCENT = '#b5ff3a';
const ON_ACCENT = '#0d1b11';
const MAIN = '#e8f0e5';
const SUB = '#8a9a8e';
const MUTED = '#5a6b5f';
const WIN = '#b5ff3a';
const LOSS = '#f87171';
const ROW_UNDER = 'rgba(59,130,246,0.14)';
const ROW_PAR = 'rgba(255,255,255,0.06)';
const ROW_OVER = 'rgba(248,113,113,0.12)';
const GOLD = '#e5c53a';

function alertCompat(title: string, msg?: string) {
  if (Platform.OS === 'web' && typeof globalThis.alert === 'function') {
    globalThis.alert(msg ? `${title}\n\n${msg}` : title);
    return;
  }
  if (msg) Alert.alert(title, msg);
  else Alert.alert(title);
}

function rowTone(gross: number, par: number): typeof ROW_UNDER | typeof ROW_PAR | typeof ROW_OVER {
  if (gross < par) return ROW_UNDER;
  if (gross > par) return ROW_OVER;
  return ROW_PAR;
}

export default function LiveMatchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [match, setMatch] = useState<MatchRecord | null>(null);
  const [currentHole, setCurrentHole] = useState(1);
  const [grossDraft, setGrossDraft] = useState<number[]>([]);
  const [summaryOpen, setSummaryOpen] = useState(false);

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

  /** 从历史打开已结束场次时直接弹出总结算 */
  useEffect(() => {
    if (match?.status === 'finished') setSummaryOpen(true);
  }, [match?.id, match?.status]);

  const parNow = pars[currentHole - 1] ?? 4;

  const persist = async (m: MatchRecord) => {
    await saveMatchRecord(m);
    setMatch(m);
  };

  const commitCurrentHole = useCallback(async (): Promise<MatchRecord | null> => {
    if (!match) return null;
    let m = match;
    const par = pars[currentHole - 1] ?? 4;
    match.players.forEach((_, idx) => {
      const g = grossDraft[idx] ?? par;
      const gg = Math.min(15, Math.max(1, Math.round(g)));
      m = upsertPlayerHole(m, idx, currentHole, par, gg);
    });
    await persist(m);
    return m;
  }, [match, currentHole, grossDraft, pars]);

  const onChangeGross = (idx: number, g: number) => {
    const nextG = Math.min(15, Math.max(1, Math.round(g)));
    setGrossDraft((prev) => {
      const next = [...prev];
      next[idx] = nextG;
      return next;
    });
  };

  const netsDraft = useMemo(() => {
    if (!match) return [];
    return grossDraft.map((g, pi) =>
      holeNetGross(match.players[pi]!, currentHole, match.holes, parNow, g),
    );
  }, [match, grossDraft, currentHole, parNow]);

  const holeLine = useMemo(() => {
    if (!match || match.unit <= 0 || match.players.length < 2) return '—';
    return describeCurrentHoleMoney(
      match.players.map((p) => p.name),
      payoutsYuanSingleHole(netsDraft, match.unit),
    );
  }, [match, netsDraft]);

  const through = match ? countConsecutiveHolesComplete(match) : 0;
  const money = match && match.unit > 0 ? calcMoneyResult(match, through) : null;

  const onPrevHole = async () => {
    if (!match || currentHole <= 1) return;
    await commitCurrentHole();
    setCurrentHole((h) => h - 1);
  };

  const onNextHole = async () => {
    if (!match) return;
    await commitCurrentHole();
    if (currentHole >= match.holes) return;
    setCurrentHole((h) => h + 1);
  };

  const openSummary = async () => {
    if (!match) return;
    const m = await commitCurrentHole();
    const done: MatchRecord = { ...(m ?? match), status: 'finished' };
    await persist(done);
    setSummaryOpen(true);
  };

  const dismissSummaryToBet = useCallback(() => {
    setSummaryOpen(false);
    router.replace('/bet' as Href);
  }, [router]);

  const onExitPress = () => {
    const go = async () => {
      await commitCurrentHole();
      router.replace('/bet' as Href);
    };
    if (Platform.OS === 'web' && typeof globalThis.confirm === 'function') {
      if (globalThis.confirm('退出比赛？当前洞将先保存。')) void go();
      return;
    }
    Alert.alert('退出比赛', '将返回开局页，当前洞会先保存。', [
      { text: '取消', style: 'cancel' },
      { text: '退出', style: 'destructive', onPress: () => void go() },
    ]);
  };

  const saveHandicap = () => {
    void (async () => {
      const m = await getMatchById(id ?? '');
      if (!m) return;
      const r = await saveQuickHandicapFromMatch(m, 0);
      if (!r.ok) {
        alertCompat('无法保存', r.message);
        return;
      }
      alertCompat('已保存', '已写入成绩记录（快速模式）');
    })();
  };

  const shareResult = async () => {
    const m = await getMatchById(id ?? '');
    if (!m) return;
    const text = buildMatchShareText(m);
    try {
      if (
        Platform.OS === 'web' &&
        typeof navigator !== 'undefined' &&
        navigator.clipboard?.writeText
      ) {
        await navigator.clipboard.writeText(text);
      } else {
        Clipboard.setString(text);
      }
      alertCompat('已复制', '文字摘要已复制到剪贴板');
    } catch {
      alertCompat('复制失败', text.slice(0, 400));
    }
  };

  if (!id || !match) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>未找到比赛</Text>
        <Pressable onPress={() => router.replace('/bet' as Href)} style={styles.link} hitSlop={12}>
          <Text style={styles.linkTxt}>返回</Text>
        </Pressable>
      </View>
    );
  }

  const isLast = currentHole >= match.holes;
  const finalMoney = match.status === 'finished' ? calcMoneyResult(match, match.holes) : null;
  const debtLines =
    finalMoney && match.players.length > 1
      ? pairwiseDebtLines(
          match.players.map((p) => p.name),
          finalMoney.payoutsYuan,
        )
      : [];

  const mvpIdx = pickMvpPlayerIndex(match, match.holes);
  const mvp = match.players[mvpIdx];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* 顶栏 */}
      <View style={styles.topBar}>
        <View style={styles.topTri}>
          <Text style={styles.topHoleTxt}>第 {currentHole} 洞</Text>
        </View>
        <View style={styles.topTriMid}>
          <Text style={styles.topParTxt}>Par {parNow}</Text>
        </View>
        <View style={styles.topTriRight}>
          <Text style={styles.topProgTxt}>
            {currentHole}/{match.holes}
          </Text>
          <Pressable
          style={styles.exitBtn}
          onPress={onExitPress}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="退出比赛"
        >
            <Text style={styles.exitBtnTxt}>✕</Text>
          </Pressable>
        </View>
      </View>

      {/* 记分区 */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollInner}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {match.players.map((pl, idx) => {
          const g = grossDraft[idx] ?? parNow;
          const bg = rowTone(g, parNow);
          const shortName = pl.name.trim() || (idx === 0 ? '我' : `玩家${idx + 1}`);
          return (
            <View key={idx} style={[styles.playerRow, { backgroundColor: bg }]}>
              <View style={styles.playerLeft}>
                <View style={[styles.miniAv, idx === 0 ? styles.miniAvMe : styles.miniAvOth]}>
                  <Text style={[styles.miniAvTxt, idx === 0 ? styles.miniAvTxtMe : styles.miniAvTxtOth]}>
                    {shortName.slice(0, 1)}
                  </Text>
                </View>
                <Text style={styles.playerName} numberOfLines={1}>
                  {shortName}
                </Text>
              </View>
              <Pressable
                style={styles.bigStep}
                onPress={() => onChangeGross(idx, g - 1)}
                accessibilityRole="button"
                accessibilityLabel="减一杆"
              >
                <Text style={styles.bigStepTxt}>−</Text>
              </Pressable>
              <Text style={styles.grossBig}>{g}</Text>
              <Pressable
                style={styles.bigStep}
                onPress={() => onChangeGross(idx, g + 1)}
                accessibilityRole="button"
                accessibilityLabel="加一杆"
              >
                <Text style={styles.bigStepTxt}>+</Text>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>

      {/* 底部 */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Text style={styles.holeResult}>{holeLine}</Text>
        {money && match.players.length > 1 ? (
          <View style={styles.runRow}>
            {match.players.map((pl, i) => {
              const amt = money.payoutsYuan[i] ?? 0;
              return (
                <Text key={i} style={styles.runTxt} numberOfLines={1}>
                  {pl.name.slice(0, 6)} {amt >= 0 ? '+' : '-'}¥{Math.abs(amt)}
                </Text>
              );
            })}
          </View>
        ) : (
          <Text style={styles.runMuted}>累计账单（打完各洞后更新）</Text>
        )}

        <View style={styles.navRow}>
          <Pressable
            style={[styles.navBtn, currentHole <= 1 && styles.navBtnDis]}
            onPress={() => void onPrevHole()}
            disabled={currentHole <= 1}
            accessibilityRole="button"
          >
            <Text style={[styles.navBtnTxt, currentHole <= 1 && styles.navBtnTxtDis]}>← 上一洞</Text>
          </Pressable>
          {!isLast ? (
            <Pressable
              style={styles.navBtnPrimary}
              onPress={() => void onNextHole()}
              accessibilityRole="button"
            >
              <Text style={styles.navBtnPrimaryTxt}>下一洞 →</Text>
            </Pressable>
          ) : (
            <Pressable
              style={styles.navBtnPrimary}
              onPress={() => void openSummary()}
              accessibilityRole="button"
            >
              <Text style={styles.navBtnPrimaryTxt}>查看总结算</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* 结算弹层 */}
      <Modal
        visible={summaryOpen}
        transparent
        animationType="slide"
        onRequestClose={dismissSummaryToBet}
      >
        <Pressable style={styles.modalMask} onPress={dismissSummaryToBet}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>本场结算</Text>
            {match.players.map((pl, i) => {
              const amt = finalMoney?.payoutsYuan[i] ?? 0;
              return (
                <Text
                  key={i}
                  style={[styles.modalBigAmt, amt >= 0 ? { color: WIN } : { color: LOSS }]}
                >
                  {pl.name}: {amt >= 0 ? '+' : '-'}¥{Math.abs(amt)}
                </Text>
              );
            })}
            {debtLines.length > 0 ? (
              <>
                <Text style={styles.modalSubTit}>债务清单</Text>
                {debtLines.map((line, i) => (
                  <Text key={i} style={styles.modalDebt}>
                    {line}
                  </Text>
                ))}
              </>
            ) : null}
            <Text style={styles.modalMvp}>
              MVP：<Text style={styles.modalMvpName}>{mvp?.name ?? '—'}</Text>
            </Text>
            <Pressable style={styles.modalSave} onPress={dismissSummaryToBet}>
              <Text style={styles.modalSaveTxt}>返回开局页</Text>
            </Pressable>
            <Pressable style={styles.modalAccent} onPress={saveHandicap}>
              <Text style={styles.modalAccentTxt}>保存记录</Text>
            </Pressable>
            <Pressable style={styles.modalGhost} onPress={() => void shareResult()}>
              <Text style={styles.modalGhostTxt}>分享结果</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  muted: { color: MUTED, marginBottom: 12 },
  link: { padding: 8 },
  linkTxt: { color: ACCENT, fontWeight: '700' },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  topTri: { flex: 1, justifyContent: 'center' },
  topTriMid: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topTriRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  topHoleTxt: { fontSize: 24, fontWeight: '800', color: MAIN },
  topParTxt: { fontSize: 16, fontWeight: '600', color: SUB },
  topProgTxt: { fontSize: 14, fontWeight: '700', color: MUTED, marginRight: 4 },
  exitBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exitBtnTxt: { fontSize: 18, fontWeight: '700', color: SUB },

  scroll: { flex: 1 },
  scrollInner: { paddingVertical: 8, paddingHorizontal: 12, paddingBottom: 16 },

  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  playerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
  miniAv: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniAvMe: { backgroundColor: ACCENT },
  miniAvOth: { backgroundColor: 'rgba(255,255,255,0.06)' },
  miniAvTxt: { fontSize: 15, fontWeight: '800' },
  miniAvTxtMe: { color: ON_ACCENT },
  miniAvTxtOth: { color: MAIN },
  playerName: { flex: 1, fontSize: 16, fontWeight: '700', color: MAIN },

  bigStep: {
    minWidth: 60,
    minHeight: 60,
    borderRadius: 16,
    backgroundColor: CARD,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  bigStepTxt: { fontSize: 28, fontWeight: '800', color: ACCENT },
  grossBig: {
    minWidth: 56,
    fontSize: 48,
    fontWeight: '800',
    color: MAIN,
    textAlign: 'center',
  },

  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    paddingTop: 12,
    backgroundColor: BG,
  },
  holeResult: {
    fontSize: 20,
    fontWeight: '800',
    color: MAIN,
    textAlign: 'center',
    marginBottom: 10,
  },
  runRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 12 },
  runTxt: { fontSize: 18, fontWeight: '700', color: SUB },
  runMuted: { fontSize: 13, fontWeight: '600', color: MUTED, textAlign: 'center', marginBottom: 12 },

  navRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  navBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  navBtnDis: { opacity: 0.45 },
  navBtnTxt: { fontSize: 15, fontWeight: '800', color: MAIN },
  navBtnTxtDis: { color: MUTED },
  navBtnPrimary: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT,
  },
  navBtnPrimaryTxt: { fontSize: 16, fontWeight: '800', color: ON_ACCENT },

  modalMask: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: CARD,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
    paddingBottom: 28,
    maxHeight: '88%',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: MAIN, marginBottom: 16, textAlign: 'center' },
  modalBigAmt: { fontSize: 28, fontWeight: '800', marginBottom: 10, textAlign: 'center' },
  modalSubTit: {
    fontSize: 14,
    fontWeight: '700',
    color: SUB,
    marginTop: 12,
    marginBottom: 8,
  },
  modalDebt: { fontSize: 15, fontWeight: '600', color: MAIN, marginBottom: 6 },
  modalMvp: { marginTop: 14, fontSize: 14, fontWeight: '600', color: SUB, textAlign: 'center' },
  modalMvpName: { color: GOLD, fontWeight: '800' },
  modalSave: {
    marginTop: 16,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  modalSaveTxt: { fontSize: 15, fontWeight: '700', color: MAIN },
  modalAccent: {
    marginTop: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: ACCENT,
  },
  modalAccentTxt: { fontSize: 16, fontWeight: '800', color: ON_ACCENT },
  modalGhost: { marginTop: 10, paddingVertical: 12, alignItems: 'center' },
  modalGhostTxt: { fontSize: 14, fontWeight: '600', color: SUB },
});
