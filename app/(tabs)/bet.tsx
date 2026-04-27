import { useFocusEffect } from '@react-navigation/native';
import { type Href, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { TAB_BAR_SCROLL_EXTRA } from '@/constants/theme';
import { upsertMatchDayDraft } from '@/utils/matchDayRecord';
import {
  buildNewMatchRecord,
  formatMatchHistoryRow,
  listRecentMatches,
  mapBetModeToMatchMode,
  saveMatchRecord,
} from '@/utils/liveMatchStorage';
import type { MatchRecord } from '@/utils/matchScoring';

const PAGE_BG = '#0d1b11';
const CARD_BG = '#16261c';
const ACCENT = '#b5ff3a';
const ACCENT_TEXT = '#0d1b11';
const TEXT_MAIN = '#e8f0e5';
const TEXT_SEC = '#a8b5ac';
const TEXT_TERTIARY = '#8a9a8e';
const TEXT_MUTED = '#5a6b5f';
const BORDER_SUB = 'rgba(255,255,255,0.08)';
const INPUT_BG = '#0d1b11';
const INPUT_BORDER = 'rgba(255,255,255,0.06)';
const PLACEHOLDER = '#5a6b5f';
const SEG_OUTER = '#0d1b11';
const SEG_SELECTED = '#2d5436';
const DIVIDER = 'rgba(255,255,255,0.06)';
const WIN = '#b5ff3a';
const LOSS = '#f87171';
const AVATAR_OTHER_BG = 'rgba(255,255,255,0.04)';

type BetMode = 'match' | 'nassau' | 'stableford' | 'stroke';

/** 本场先记杆数-only，或进入赌球规则 */
type SessionMode = 'score' | 'wager';

type PlayerRow = { name: string };

type UnitPreset = '500' | '1000' | '2000' | 'custom';

function detectUnitPreset(str: string): UnitPreset {
  const n = parseInt(str.replace(/\s|,|，/g, ''), 10);
  if (!Number.isFinite(n)) return 'custom';
  if (n === 500) return '500';
  if (n === 1000) return '1000';
  if (n === 2000) return '2000';
  return 'custom';
}

const MODE_LABELS = [
  { id: 'match' as const, title: '比洞', sub: 'Match' },
  { id: 'nassau' as const, title: 'Nassau', sub: '(3x9)' },
  { id: 'stableford' as const, title: '积分赛', sub: 'Stableford' },
  { id: 'stroke' as const, title: '比杆', sub: 'Stroke' },
] as const;

function PlayerAvatar({ index, name }: { index: number; name: string }) {
  const isMe = index === 0;
  const raw = name.trim();
  const letter = raw.length > 0 ? raw.charAt(0).toUpperCase() : '我';
  const label = isMe ? letter : String(index + 1);
  return (
    <View style={[s.avatar, isMe ? s.avatarMe : s.avatarOther]}>
      <Text style={[s.avatarTxt, isMe ? s.avatarTxtMe : s.avatarTxtOther]}>{label}</Text>
    </View>
  );
}

function modeLabel(id: BetMode): string {
  const m = MODE_LABELS.find((x) => x.id === id);
  return m?.title ?? id;
}

export default function BetScreen() {
  const router = useRouter();
  const [roundHoles, setRoundHoles] = useState<9 | 18>(18);
  const [players, setPlayers] = useState<PlayerRow[]>([{ name: '' }, { name: '' }]);
  const [mode, setMode] = useState<BetMode>('match');
  const [unitStr, setUnitStr] = useState('1000');
  const [unitPreset, setUnitPreset] = useState<UnitPreset>('1000');
  const [recentMatches, setRecentMatches] = useState<MatchRecord[]>([]);
  const [sessionMode, setSessionMode] = useState<SessionMode>('score');

  const canAddPlayer = players.length < 4;

  useEffect(() => {
    void upsertMatchDayDraft({
      courseName: '',
      holes: roundHoles,
      mode: modeLabel(mode),
      players: players.map((p) => ({ name: p.name, hcp: '' })),
    });
  }, [roundHoles, mode, players]);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        setRecentMatches(await listRecentMatches(3));
      })();
      return () => {};
    }, []),
  );

  const collectPlayersForMatch = useCallback((): { name: string; handicap: number }[] => {
    const rows: { name: string; handicap: number }[] = [];
    for (let i = 0; i < players.length; i++) {
      const rawName = players[i]!.name.trim();
      if (i === 0 || rawName.length > 0) {
        rows.push({ name: rawName || (i === 0 ? '我' : `玩家${i + 1}`), handicap: 0 });
      }
    }
    if (rows.length === 0) rows.push({ name: '我', handicap: 0 });
    return rows;
  }, [players]);

  const startLiveMatch = useCallback(async () => {
    const unitParsed = parseInt(unitStr.replace(/\s|,|，/g, ''), 10);
    const u = Number.isFinite(unitParsed) && unitParsed > 0 ? unitParsed : 0;
    const payload = collectPlayersForMatch();
    if (payload.length < 2) {
      Alert.alert('提示', '至少需要 2 位球友');
      return;
    }
    if (u <= 0) {
      Alert.alert('提示', '请输入单位金额（每洞）');
      return;
    }
    const rec = buildNewMatchRecord({
      course: '',
      holes: roundHoles,
      mode: mapBetModeToMatchMode(mode),
      unit: u,
      players: payload,
    });
    await saveMatchRecord(rec);
    router.push(`/match/${rec.id}` as Href);
  }, [collectPlayersForMatch, mode, router, roundHoles, unitStr]);

  const partnersLinePreset = useCallback((): string => {
    const parts: string[] = [];
    for (let i = 1; i < players.length; i++) {
      const n = players[i]!.name.trim();
      if (n.length > 0) parts.push(n);
    }
    return parts.join('，');
  }, [players]);

  const goToScoreEntry = useCallback(() => {
    const qs = new URLSearchParams();
    qs.set('from', 'bet');
    qs.set('holes', String(roundHoles));
    const pl = partnersLinePreset();
    if (pl.length > 0) qs.set('partners', pl);
    const q = qs.toString();
    router.push(`/handicap/add${q.length > 0 ? `?${q}` : ''}` as Href);
  }, [partnersLinePreset, router, roundHoles]);

  const addPlayer = () => {
    if (players.length >= 4) return;
    setPlayers((p) => [...p, { name: '' }]);
  };

  const updatePlayerName = (index: number, value: string) => {
    setPlayers((p) => p.map((row, i) => (i === index ? { ...row, name: value } : row)));
  };

  const applyUnitPreset = (p: UnitPreset) => {
    if (p === 'custom') {
      setUnitPreset('custom');
      return;
    }
    const map = { '500': '500', '1000': '1000', '2000': '2000' } as const;
    setUnitStr(map[p]);
    setUnitPreset(p);
  };

  const onUnitTextChange = (t: string) => {
    const next = t.replace(/[^0-9]/g, '');
    setUnitStr(next);
    setUnitPreset(detectUnitPreset(next));
  };

  const inputBase = {
    backgroundColor: INPUT_BG,
    borderColor: INPUT_BORDER,
    color: TEXT_MAIN,
  };

  return (
    <View style={[s.root, { backgroundColor: PAGE_BG }]}>
      <View style={s.header}>
        <Text style={s.headerTitle}>下场记分</Text>
        <Text style={s.headerSub}>选人数与规则；只记成绩或赌球开局</Text>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={s.sectionLabel}>打几洞</Text>
        <View style={s.card}>
          <View style={s.holePickRow}>
            <Pressable
              style={[s.holeChip, roundHoles === 9 && s.holeChipOn]}
              onPress={() => setRoundHoles(9)}
            >
              <Text style={[s.holeChipTxt, roundHoles === 9 && s.holeChipTxtOn]}>9 洞</Text>
            </Pressable>
            <Pressable
              style={[s.holeChip, roundHoles === 18 && s.holeChipOn]}
              onPress={() => setRoundHoles(18)}
            >
              <Text style={[s.holeChipTxt, roundHoles === 18 && s.holeChipTxtOn]}>18 洞</Text>
            </Pressable>
          </View>
        </View>

        <Text style={s.sectionLabel}>本场</Text>
        <View style={s.sessionModeRow}>
          <Pressable
            style={[s.sessionModeChip, sessionMode === 'score' && s.sessionModeChipOn]}
            onPress={() => setSessionMode('score')}
            accessibilityRole="button"
            accessibilityState={{ selected: sessionMode === 'score' }}
          >
            <Text style={[s.sessionModeTitle, sessionMode === 'score' && s.sessionModeTitleOn]}>
              只记成绩
            </Text>
            <Text style={[s.sessionModeSub, sessionMode === 'score' && s.sessionModeSubOn]}>
              差点与统计
            </Text>
          </Pressable>
          <Pressable
            style={[s.sessionModeChip, sessionMode === 'wager' && s.sessionModeChipOn]}
            onPress={() => setSessionMode('wager')}
            accessibilityRole="button"
            accessibilityState={{ selected: sessionMode === 'wager' }}
          >
            <Text style={[s.sessionModeTitle, sessionMode === 'wager' && s.sessionModeTitleOn]}>
              赌球
            </Text>
            <Text style={[s.sessionModeSub, sessionMode === 'wager' && s.sessionModeSubOn]}>
              比洞 · 结算
            </Text>
          </Pressable>
        </View>

        <View style={s.sectionHead}>
          <Text style={s.sectionHeadTitle}>本局球友</Text>
          <Text style={s.sectionHeadMeta}>{players.length} / 4</Text>
        </View>
        <View style={s.card}>
          {players.map((pl, idx) => (
            <View key={idx} style={s.playerRow}>
              <PlayerAvatar index={idx} name={pl.name} />
              <TextInput
                style={[s.inputNameFull, inputBase]}
                placeholder="名字"
                placeholderTextColor={PLACEHOLDER}
                value={pl.name}
                onChangeText={(t) => updatePlayerName(idx, t)}
              />
            </View>
          ))}
          {canAddPlayer ? (
            <Pressable style={s.addPlayerBtn} onPress={addPlayer}>
              <Text style={s.addPlayerText}>+ 添加玩家</Text>
            </Pressable>
          ) : null}
        </View>

        {sessionMode === 'score' ? (
          <>
            <Pressable style={s.startScoreBtn} onPress={goToScoreEntry} accessibilityRole="button">
              <Text style={s.startScoreBtnTxt}>开始记分</Text>
            </Pressable>
            <Text style={s.startScoreHint}>打开记分卡录入杆数；球场与同组可在下一页填写。</Text>
          </>
        ) : (
          <>
            <Text style={s.sectionLabel}>玩法</Text>
            <View style={s.segOuter}>
              {MODE_LABELS.map((m) => {
                const active = mode === m.id;
                return (
                  <Pressable
                    key={m.id}
                    style={[s.segChip, active && s.segChipOn]}
                    onPress={() => setMode(m.id)}
                  >
                    <Text style={[s.segTitle, active && s.segTitleOn]}>{m.title}</Text>
                    <Text style={[s.segSub, active && s.segSubOn]}>{m.sub}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={s.sectionLabel}>单位金额</Text>
            <View style={s.card}>
              <View style={s.unitRow}>
                <Text style={s.unitYen}>¥</Text>
                <TextInput
                  style={s.unitInput}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={TEXT_MUTED}
                  value={unitStr}
                  onChangeText={onUnitTextChange}
                />
                <Text style={s.unitSuffix}>/ 洞</Text>
              </View>
              <View style={s.unitPills}>
                {(
                  [
                    { id: '500' as const, label: '500' },
                    { id: '1000' as const, label: '1000' },
                    { id: '2000' as const, label: '2000' },
                    { id: 'custom' as const, label: '自定义' },
                  ] as const
                ).map((pill) => {
                  const sel = unitPreset === pill.id;
                  return (
                    <Pressable
                      key={pill.id}
                      style={[s.unitPill, sel && s.unitPillOn]}
                      onPress={() => applyUnitPreset(pill.id)}
                    >
                      <Text style={[s.unitPillTxt, sel && s.unitPillTxtOn]}>{pill.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <Pressable
              style={s.teeOffBtn}
              onPress={() => void startLiveMatch()}
              accessibilityRole="button"
              accessibilityLabel="开球"
            >
              <Text style={s.teeOffBtnTxt}>⛳ 开球</Text>
            </Pressable>
            <Text style={s.teeOffHint}>进入全屏实时记分；总杆比洞（差点可后续再加）</Text>
          </>
        )}

        <Text style={s.sectionLabel}>历史比赛</Text>
        <View style={s.card}>
          {recentMatches.length === 0 ? (
            <Text style={s.historyEmpty}>暂无历史，完成一场实时记分后将显示在这里。</Text>
          ) : (
            recentMatches.map((m, mi) => {
              const row = formatMatchHistoryRow(m);
              const loss = row.moneyText.startsWith('-');
              const win = row.moneyText.startsWith('+');
              const last = mi === recentMatches.length - 1;
              return (
                <Pressable
                  key={m.id}
                  style={[s.historyRow, last && { borderBottomWidth: 0 }]}
                  onPress={() => router.push(`/match/${m.id}` as Href)}
                >
                  <View style={s.historyRowLeft}>
                    <Text style={s.historyDate}>{row.dateLabel}</Text>
                    <Text style={s.historyCourse} numberOfLines={1}>
                      {row.course || '本场'}
                    </Text>
                    <Text style={s.historyResult} numberOfLines={1}>
                      {row.result}
                    </Text>
                  </View>
                  <Text
                    style={[
                      s.historyMoney,
                      win ? s.historyMoneyWin : loss ? s.historyMoneyLoss : s.historyMoneyNeu,
                    ]}
                  >
                    {row.moneyText}
                  </Text>
                </Pressable>
              );
            })
          )}
          <Pressable
            style={s.historyAll}
            onPress={() => router.push('/match/history' as Href)}
            hitSlop={6}
          >
            <Text style={s.historyAllTxt}>查看全部 ›</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: PAGE_BG,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: TEXT_MAIN,
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  headerSub: { fontSize: 12, fontWeight: '600', color: TEXT_TERTIARY, lineHeight: 17 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 32 + TAB_BAR_SCROLL_EXTRA,
  },

  sessionModeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
  },
  sessionModeChip: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER_SUB,
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  sessionModeChipOn: {
    backgroundColor: SEG_SELECTED,
    borderColor: SEG_SELECTED,
  },
  sessionModeTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: TEXT_TERTIARY,
  },
  sessionModeTitleOn: { color: ACCENT },
  sessionModeSub: {
    fontSize: 11,
    fontWeight: '600',
    color: TEXT_MUTED,
    marginTop: 4,
    textAlign: 'center',
  },
  sessionModeSubOn: { color: ACCENT },

  startScoreBtn: {
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: ACCENT,
    marginBottom: 8,
  },
  startScoreBtnTxt: { fontSize: 17, fontWeight: '800', color: ACCENT_TEXT },
  startScoreHint: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_SEC,
    lineHeight: 18,
    marginBottom: 12,
    textAlign: 'center',
    paddingHorizontal: 4,
  },

  teeOffBtn: {
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: ACCENT,
    marginBottom: 8,
  },
  teeOffBtnTxt: { fontSize: 20, fontWeight: '800', color: ACCENT_TEXT },
  teeOffHint: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_SEC,
    lineHeight: 18,
    marginBottom: 12,
    textAlign: 'center',
    paddingHorizontal: 4,
  },

  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginTop: 4,
  },
  sectionHeadTitle: { fontSize: 13, fontWeight: '700', color: TEXT_SEC },
  sectionHeadMeta: { fontSize: 11, fontWeight: '600', color: TEXT_MUTED },

  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_SEC,
    marginBottom: 8,
    marginTop: 12,
  },
  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: CARD_BG,
    padding: 14,
    marginBottom: 4,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarMe: { backgroundColor: ACCENT },
  avatarOther: { backgroundColor: AVATAR_OTHER_BG },
  avatarTxt: { fontSize: 14, fontWeight: '800' },
  avatarTxtMe: { color: ACCENT_TEXT },
  avatarTxtOther: { color: TEXT_SEC },
  inputNameFull: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 14,
    fontWeight: '600',
  },
  addPlayerBtn: {
    marginTop: 4,
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  addPlayerText: { fontSize: 14, fontWeight: '700', color: ACCENT },

  segOuter: {
    flexDirection: 'row',
    backgroundColor: SEG_OUTER,
    borderRadius: 9,
    padding: 3,
    gap: 4,
    marginBottom: 8,
  },
  segChip: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 10,
    paddingHorizontal: 2,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  segChipOn: { backgroundColor: SEG_SELECTED },
  segTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_TERTIARY,
    textAlign: 'center',
  },
  segTitleOn: { fontWeight: '800', color: ACCENT },
  segSub: {
    fontSize: 10,
    fontWeight: '600',
    color: TEXT_TERTIARY,
    opacity: 0.75,
    marginTop: 2,
    textAlign: 'center',
  },
  segSubOn: { color: ACCENT, opacity: 0.85 },

  unitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  unitYen: { fontSize: 18, fontWeight: '700', color: TEXT_MUTED },
  unitInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '800',
    color: ACCENT,
    letterSpacing: -1,
    paddingVertical: 4,
    minWidth: 0,
  },
  unitSuffix: { fontSize: 13, fontWeight: '600', color: TEXT_SEC },
  unitPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  unitPill: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER_SUB,
    backgroundColor: 'transparent',
  },
  unitPillOn: {
    backgroundColor: SEG_SELECTED,
    borderColor: SEG_SELECTED,
  },
  unitPillTxt: { fontSize: 13, fontWeight: '700', color: TEXT_TERTIARY },
  unitPillTxtOn: { fontWeight: '800', color: ACCENT },

  holePickRow: { flexDirection: 'row', gap: 10 },
  holeChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER_SUB,
    backgroundColor: 'transparent',
  },
  holeChipOn: { backgroundColor: SEG_SELECTED, borderColor: SEG_SELECTED },
  holeChipTxt: { fontSize: 13, fontWeight: '700', color: TEXT_TERTIARY },
  holeChipTxtOn: { color: ACCENT, fontWeight: '800' },

  historyEmpty: { fontSize: 13, fontWeight: '600', color: TEXT_MUTED, lineHeight: 20 },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DIVIDER,
  },
  historyRowLeft: { flex: 1, minWidth: 0, paddingRight: 8 },
  historyDate: { fontSize: 11, fontWeight: '600', color: TEXT_MUTED },
  historyCourse: { fontSize: 14, fontWeight: '700', color: TEXT_MAIN, marginTop: 2 },
  historyResult: { fontSize: 12, fontWeight: '600', color: TEXT_SEC, marginTop: 4 },
  historyMoney: { fontSize: 14, fontWeight: '800', marginLeft: 8 },
  historyMoneyWin: { color: WIN },
  historyMoneyLoss: { color: LOSS },
  historyMoneyNeu: { color: TEXT_SEC },
  historyAll: { marginTop: 4, paddingVertical: 10, alignItems: 'center' },
  historyAllTxt: { fontSize: 14, fontWeight: '700', color: ACCENT },
});
