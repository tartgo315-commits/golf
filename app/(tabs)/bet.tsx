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
  saveMatchRecord,
} from '@/utils/liveMatchStorage';
import type { MatchSideGame, SettlementMode, SideGameType } from '@/utils/matchGames.types';
import {
  SIDE_GAME_CATALOG,
  isPlayerCountOkForGame,
  sideGameTypeShortLabel,
  sideGameTypeToMatchMode,
  unitHintLines,
} from '@/utils/sideGameCatalog';
import { matchNeedsLottery } from '@/utils/matchLottery';
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

/** 本场先记杆数-only，或进入赌球规则 */
type SessionMode = 'score' | 'wager';

type PlayerRow = { name: string };

type WagerDraft = {
  id: string;
  gameType: SideGameType;
  unitStr: string;
  settlementMode: SettlementMode;
  trumpetExtraStr: string;
};

function makeWagerDraftId(): string {
  return `wd_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function digitsOnly(t: string): string {
  return t.replace(/[^0-9]/g, '');
}

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

export default function BetScreen() {
  const router = useRouter();
  const [roundHoles, setRoundHoles] = useState<9 | 18>(18);
  const [players, setPlayers] = useState<PlayerRow[]>([{ name: '' }, { name: '' }]);
  const [wagers, setWagers] = useState<WagerDraft[]>(() => [
    {
      id: makeWagerDraftId(),
      gameType: 'match_play',
      unitStr: '1000',
      settlementMode: 'per_hole',
      trumpetExtraStr: '500',
    },
  ]);
  const [recentMatches, setRecentMatches] = useState<MatchRecord[]>([]);
  const [sessionMode, setSessionMode] = useState<SessionMode>('score');

  // Legacy local bet system is deprecated; keep code but redirect away.
  useEffect(() => {
    router.replace('/rounds/new' as Href);
  }, [router]);

  useEffect(() => {
    void upsertMatchDayDraft({
      courseName: '',
      holes: roundHoles,
      mode:
        sessionMode === 'wager'
          ? wagers.map((w) => sideGameTypeShortLabel(w.gameType)).join(' + ')
          : '只记成绩',
      players: players.map((p) => ({ name: p.name, hcp: '' })),
    });
  }, [roundHoles, players, sessionMode, wagers]);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        setRecentMatches(await listRecentMatches(3));
      })();
      return () => {};
    }, []),
  );

  /** 每行都算一人；空名用占位，以便行数与开局玩法人数一致 */
  const collectPlayersForMatch = useCallback((): { name: string; handicap: number }[] => {
    if (players.length === 0) return [{ name: '我', handicap: 0 }];
    return players.map((row, i) => ({
      name: row.name.trim() || (i === 0 ? '我' : `玩家${i + 1}`),
      handicap: 0,
    }));
  }, [players]);

  const startLiveMatch = useCallback(async () => {
    const payload = collectPlayersForMatch();
    if (payload.length < 2) {
      Alert.alert('提示', '至少需要 2 位球友');
      return;
    }
    const n = payload.length;
    for (let i = 0; i < wagers.length; i += 1) {
      const w = wagers[i]!;
      if (!isPlayerCountOkForGame(w.gameType, n)) {
        const entry = SIDE_GAME_CATALOG.find((e) => e.type === w.gameType);
        Alert.alert(
          '提示',
          `赌局 ${i + 1}「${entry?.title ?? ''}」需要 ${entry?.playersLabel ?? '对应人数'}`,
        );
        return;
      }
      const unitParsed = parseInt(w.unitStr.replace(/\s|,|，/g, ''), 10);
      const u = Number.isFinite(unitParsed) && unitParsed > 0 ? unitParsed : 0;
      if (u <= 0) {
        Alert.alert('提示', `请输入赌局 ${i + 1} 的单位金额`);
        return;
      }
      if (w.gameType === 'trumpet') {
        const t2 = parseInt(w.trumpetExtraStr.replace(/\s|,|，/g, ''), 10);
        if (!Number.isFinite(t2) || t2 <= 0) {
          Alert.alert('提示', '喇叭花玩法请填写「乱拉每分」与「喇叭花每人」金额');
          return;
        }
      }
    }

    const games: MatchSideGame[] = wagers.map((wag) => {
      const unitAmount = Math.max(
        0,
        Math.round(parseInt(wag.unitStr.replace(/\s|,|，/g, ''), 10) || 0),
      );
      const secondary =
        wag.gameType === 'trumpet'
          ? Math.max(0, Math.round(parseInt(wag.trumpetExtraStr.replace(/\s|,|，/g, ''), 10) || 0))
          : undefined;
      return {
        id: `g_${wag.id}`,
        gameType: wag.gameType,
        unitAmount,
        settlementMode: wag.settlementMode,
        secondaryUnitAmount: wag.gameType === 'trumpet' ? secondary : undefined,
        ledger: Array.from({ length: n }, () => 0),
        scores: null,
      };
    });

    const first = wagers[0]!;
    const primaryUnit = Math.max(
      0,
      Math.round(parseInt(first.unitStr.replace(/\s|,|，/g, ''), 10) || 0),
    );

    const rec = buildNewMatchRecord({
      course: '',
      holes: roundHoles,
      mode: sideGameTypeToMatchMode(first.gameType),
      unit: primaryUnit,
      players: payload,
      settlementMode: first.settlementMode,
      games,
    });
    await saveMatchRecord(rec);
    if (matchNeedsLottery(rec)) {
      router.push(`/lottery/${rec.id}` as Href);
    } else {
      router.push(`/match/${rec.id}` as Href);
    }
  }, [collectPlayersForMatch, router, roundHoles, wagers]);

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
    setPlayers((p) => [...p, { name: '' }]);
  };

  const updatePlayerName = (index: number, value: string) => {
    setPlayers((p) => p.map((row, i) => (i === index ? { ...row, name: value } : row)));
  };

  const patchWager = useCallback((id: string, patch: Partial<WagerDraft>) => {
    setWagers((list) => list.map((w) => (w.id === id ? { ...w, ...patch } : w)));
  }, []);

  const addWager = useCallback(() => {
    setWagers((list) => {
      if (list.length >= 4) return list;
      return [
        ...list,
        {
          id: makeWagerDraftId(),
          gameType: 'match_play',
          unitStr: '1000',
          settlementMode: 'per_hole',
          trumpetExtraStr: '500',
        },
      ];
    });
  }, []);

  const removeWager = useCallback((id: string) => {
    setWagers((list) => {
      if (list.length <= 1) return list;
      return list.filter((w) => w.id !== id);
    });
  }, []);

  /** 玩法卡片人数：按当前球友「行数」，与是否填名无关（至少 1 行） */
  const effectivePlayerCount = useMemo(
    () => Math.max(players.length, 1),
    [players.length],
  );

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
          <Text style={s.sectionHeadMeta}>{players.length} 人</Text>
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
          <Pressable style={s.addPlayerBtn} onPress={addPlayer}>
            <Text style={s.addPlayerText}>+ 添加玩家</Text>
          </Pressable>
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
            <Text style={s.sectionLabel}>赌球规则</Text>
            <Text style={s.wagerIntro}>每场最多叠加 4 个赌局；人数不符的玩法卡片会置灰。</Text>

            {wagers.map((wag, wi) => (
              <View key={wag.id} style={s.wagerBlock}>
                <View style={s.wagerBlockHeader}>
                  <Text style={s.wagerBlockTitle}>赌局 {wi + 1}</Text>
                  {wagers.length > 1 ? (
                    <Pressable
                      onPress={() => removeWager(wag.id)}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel="删除赌局"
                    >
                      <Text style={s.wagerRemoveTxt}>✕</Text>
                    </Pressable>
                  ) : (
                    <View style={s.wagerRemovePlaceholder} />
                  )}
                </View>

                <View style={s.wagerCard}>
                  <Text style={s.subSectionLabel}>玩法选择</Text>
                  <View style={s.gameGrid}>
                    {SIDE_GAME_CATALOG.map((entry) => {
                      const ok = isPlayerCountOkForGame(entry.type, effectivePlayerCount);
                      const selected = wag.gameType === entry.type;
                      return (
                        <Pressable
                          key={entry.type}
                          style={[
                            s.gameCard,
                            selected && s.gameCardOn,
                            !ok && s.gameCardDisabled,
                          ]}
                          onPress={() => {
                            if (!ok) return;
                            patchWager(wag.id, { gameType: entry.type });
                          }}
                          accessibilityState={{ selected, disabled: !ok }}
                        >
                          <Text
                            style={[s.gameCardTitle, !ok && s.gameCardTitleDisabled]}
                            numberOfLines={1}
                          >
                            {entry.title}
                          </Text>
                          <Text
                            style={[s.gameCardBlurb, !ok && s.gameCardBlurbDisabled]}
                            numberOfLines={2}
                          >
                            {entry.blurb}
                          </Text>
                          <View style={s.gameCardTag}>
                            <Text style={[s.gameCardTagTxt, !ok && s.gameCardTagTxtDis]}>
                              {entry.playersLabel}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>

                  <Text style={s.subSectionLabel}>单位金额</Text>
                  {wag.gameType === 'trumpet' ? (
                    <>
                      <Text style={s.inputCaption}>乱拉每分</Text>
                      <TextInput
                        style={[s.unitInputFull, inputBase]}
                        keyboardType="number-pad"
                        placeholder="0"
                        placeholderTextColor={TEXT_MUTED}
                        value={wag.unitStr}
                        onChangeText={(t) =>
                          patchWager(wag.id, { unitStr: digitsOnly(t) })
                        }
                      />
                      <Text style={s.inputCaption}>喇叭花每人</Text>
                      <TextInput
                        style={[s.unitInputFull, inputBase]}
                        keyboardType="number-pad"
                        placeholder="0"
                        placeholderTextColor={TEXT_MUTED}
                        value={wag.trumpetExtraStr}
                        onChangeText={(t) =>
                          patchWager(wag.id, { trumpetExtraStr: digitsOnly(t) })
                        }
                      />
                    </>
                  ) : (
                    <TextInput
                      style={[s.unitInputFull, inputBase]}
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor={TEXT_MUTED}
                      value={wag.unitStr}
                      onChangeText={(t) => patchWager(wag.id, { unitStr: digitsOnly(t) })}
                    />
                  )}

                  {unitHintLines(
                    wag.gameType,
                    wag.unitStr.trim() || '0',
                    wag.trumpetExtraStr.trim() || '0',
                  ).map((line, li) => (
                    <Text key={li} style={s.unitDynamicHint}>
                      {line}
                    </Text>
                  ))}

                  <Text style={s.subSectionLabel}>结算节奏</Text>
                  <View style={s.settleRow}>
                    <Pressable
                      style={[
                        s.settleChip,
                        wag.settlementMode === 'per_hole' && s.settleChipOn,
                      ]}
                      onPress={() => patchWager(wag.id, { settlementMode: 'per_hole' })}
                    >
                      <Text
                        style={[
                          s.settleChipTxt,
                          wag.settlementMode === 'per_hole' && s.settleChipTxtOn,
                        ]}
                      >
                        ⚡ 一洞一算
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[
                        s.settleChip,
                        wag.settlementMode === 'end_total' && s.settleChipOn,
                      ]}
                      onPress={() => patchWager(wag.id, { settlementMode: 'end_total' })}
                    >
                      <Text
                        style={[
                          s.settleChipTxt,
                          wag.settlementMode === 'end_total' && s.settleChipTxtOn,
                        ]}
                      >
                        🏁 打完一起算
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}

            {wagers.length < 4 ? (
              <Pressable style={s.addWagerBtn} onPress={addWager} accessibilityRole="button">
                <Text style={s.addWagerBtnTxt}>+ 添加另一个赌局</Text>
              </Pressable>
            ) : null}

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

  wagerIntro: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_TERTIARY,
    lineHeight: 17,
    marginBottom: 10,
    marginTop: -4,
  },
  wagerBlock: { marginBottom: 8 },
  wagerBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  wagerBlockTitle: { fontSize: 13, fontWeight: '700', color: TEXT_SEC },
  wagerRemoveTxt: { fontSize: 18, fontWeight: '700', color: TEXT_MUTED, paddingHorizontal: 4 },
  wagerRemovePlaceholder: { width: 28 },
  wagerCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: CARD_BG,
    padding: 14,
    paddingTop: 12,
  },
  subSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: TEXT_TERTIARY,
    marginBottom: 8,
    marginTop: 4,
  },
  gameGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  gameCard: {
    width: '48%',
    marginBottom: 8,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: BORDER_SUB,
    backgroundColor: SEG_OUTER,
    paddingVertical: 10,
    paddingHorizontal: 10,
    minHeight: 88,
  },
  gameCardOn: {
    borderColor: ACCENT,
    backgroundColor: SEG_SELECTED,
  },
  gameCardDisabled: {
    opacity: 0.38,
  },
  gameCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: TEXT_MAIN,
    marginBottom: 4,
  },
  gameCardTitleDisabled: { color: TEXT_MUTED },
  gameCardBlurb: {
    fontSize: 11,
    fontWeight: '600',
    color: TEXT_SEC,
    lineHeight: 15,
  },
  gameCardBlurbDisabled: { color: TEXT_MUTED },
  gameCardTag: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  gameCardTagTxt: { fontSize: 10, fontWeight: '700', color: ACCENT },
  gameCardTagTxtDis: { color: TEXT_MUTED },
  unitInputFull: {
    fontSize: 22,
    fontWeight: '800',
    color: ACCENT,
    borderWidth: 1,
    borderRadius: 10,
    borderColor: INPUT_BORDER,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    marginBottom: 8,
  },
  inputCaption: {
    fontSize: 11,
    fontWeight: '600',
    color: TEXT_TERTIARY,
    marginBottom: 4,
  },
  unitDynamicHint: {
    fontSize: 11,
    fontWeight: '600',
    color: TEXT_SEC,
    lineHeight: 16,
    marginBottom: 4,
  },
  settleRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  settleChip: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER_SUB,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  settleChipOn: {
    backgroundColor: SEG_SELECTED,
    borderColor: SEG_SELECTED,
  },
  settleChipTxt: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_TERTIARY,
    textAlign: 'center',
  },
  settleChipTxtOn: { color: ACCENT },
  addWagerBtn: {
    marginTop: 4,
    marginBottom: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER_SUB,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  addWagerBtnTxt: { fontSize: 15, fontWeight: '800', color: ACCENT },

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
