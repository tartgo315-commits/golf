import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getMatchById, saveMatchRecord } from '@/utils/liveMatchStorage';
import {
  lotteryScenario,
  matchNeedsLottery,
  randomLandlordIndex,
  shuffleHoleOneRanks,
} from '@/utils/matchLottery';
import type { LotteryDraw, MatchRecord } from '@/utils/matchScoring';

const BG = '#0d1b11';
const CARD = '#16261c';
const ACCENT = '#b5ff3a';
const MAIN = '#e8f0e5';
const SUB = '#8a9a8e';
const MUTED = '#5a6b5f';
const BORDER = 'rgba(255,255,255,0.08)';

type DeckState =
  | { matchId: string; kind: 'landlord'; landlordIdx: number }
  | { matchId: string; kind: 'ranks'; ranks: number[] };

function shortPlayerName(pl: { name: string }, index: number): string {
  const raw = pl.name.trim();
  if (raw.length > 0) return raw;
  return index === 0 ? '我' : `玩家${index + 1}`;
}

export default function MatchLotteryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { matchId } = useLocalSearchParams<{ matchId?: string }>();
  const [match, setMatch] = useState<MatchRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState<boolean[]>([]);
  const [deck, setDeck] = useState<DeckState | null>(null);

  const reload = useCallback(async () => {
    if (!matchId) return;
    setLoading(true);
    const m = await getMatchById(matchId);
    setMatch(m);
    setLoading(false);
  }, [matchId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const scenario = match ? lotteryScenario(match) : null;

  useEffect(() => {
    if (!match || !scenario) {
      setDeck(null);
      return;
    }
    setDeck((prev) => {
      if (prev?.matchId === match.id) return prev;
      const n = match.players.length;
      if (scenario === 'landlord') {
        return { matchId: match.id, kind: 'landlord', landlordIdx: randomLandlordIndex(n) };
      }
      return { matchId: match.id, kind: 'ranks', ranks: shuffleHoleOneRanks(n) };
    });
  }, [match, scenario]);

  useEffect(() => {
    if (!match?.players.length) return;
    setRevealed(Array(match.players.length).fill(false));
  }, [match?.id, match?.players.length]);

  useEffect(() => {
    if (loading || !matchId) return;
    let cancelled = false;
    void (async () => {
      const m = await getMatchById(matchId);
      if (cancelled || !m || matchNeedsLottery(m)) return;
      router.replace(`/match/${m.id}` as Href);
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, matchId, router]);

  const flip = useCallback((index: number) => {
    setRevealed((prev) => {
      if (!prev[index]) {
        const next = [...prev];
        next[index] = true;
        return next;
      }
      return prev;
    });
  }, []);

  const allRevealed =
    revealed.length > 0 &&
    revealed.length === (match?.players.length ?? 0) &&
    revealed.every(Boolean);

  const onConfirm = useCallback(async () => {
    if (!match || !deck || !scenario || !allRevealed) return;
    let lotteryDraw: LotteryDraw;
    if (scenario === 'landlord' && deck.kind === 'landlord') {
      lotteryDraw = { landlordPlayerIndex: deck.landlordIdx };
    } else if (deck.kind === 'ranks') {
      lotteryDraw = { holeOneRanks: deck.ranks };
    } else {
      return;
    }
    const next: MatchRecord = { ...match, lotteryDraw };
    await saveMatchRecord(next);
    router.replace(`/match/${match.id}` as Href);
  }, [allRevealed, deck, match, router, scenario]);

  if (!matchId) {
    return (
      <View style={[styles.center, { paddingTop: insets.top, backgroundColor: BG }]}>
        <Text style={styles.muted}>缺少场次</Text>
        <Pressable onPress={() => router.replace('/bet' as Href)} hitSlop={12}>
          <Text style={styles.link}>返回</Text>
        </Pressable>
      </View>
    );
  }

  if (loading || match === null) {
    return (
      <View style={[styles.center, { paddingTop: insets.top, backgroundColor: BG }]}>
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={styles.hintBelow}>加载中…</Text>
      </View>
    );
  }

  if (!matchNeedsLottery(match)) {
    return (
      <View style={[styles.center, { paddingTop: insets.top, backgroundColor: BG }]}>
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }

  if (!scenario || !deck) {
    return (
      <View style={[styles.center, { paddingTop: insets.top, backgroundColor: BG }]}>
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }

  const subtitle =
    scenario === 'landlord'
      ? '每人一张牌，翻开前无人知：仅 1 张「地主」，其余「农民」。'
      : '每人一张数字牌，翻开为第 1 洞出发顺位（1 最先、数字越大越靠后）。';

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: BG }]}>
      <View style={styles.head}>
        <Text style={styles.title}>抓阄</Text>
        <Text style={styles.sub}>{subtitle}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollInner}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.progress}>
          已翻开 {revealed.filter(Boolean).length} / {match.players.length}
        </Text>

        <View style={styles.grid}>
          {match.players.map((pl, idx) => {
            const open = revealed[idx];
            const name = shortPlayerName(pl, idx);
            let faceMain = '';
            let faceSub = '';
            if (scenario === 'landlord' && deck.kind === 'landlord') {
              faceMain = deck.landlordIdx === idx ? '地主👑' : '农民';
            } else if (deck.kind === 'ranks') {
              faceMain = String(deck.ranks[idx] ?? '');
              faceSub = '第 1 洞顺位';
            }

            return (
              <Pressable
                key={idx}
                style={[styles.tile, open && styles.tileOpen]}
                onPress={() => flip(idx)}
                accessibilityRole="button"
                accessibilityLabel={`${name}，${open ? `已翻开 ${faceMain}` : '翻扣，点击翻开'}`}
              >
                {!open ? (
                  <>
                    <Text style={styles.tileBackLabel}>{name}</Text>
                    <Text style={styles.tileHint}>点击翻开</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.tileName}>{name}</Text>
                    <Text
                      style={[
                        styles.tileFace,
                        scenario === 'landlord' ? styles.tileFaceLandlord : styles.tileFaceRank,
                      ]}
                    >
                      {faceMain}
                    </Text>
                    {faceSub ? <Text style={styles.tileFaceSub}>{faceSub}</Text> : null}
                  </>
                )}
              </Pressable>
            );
          })}
        </View>

        <Pressable
          style={[styles.confirmBtn, !allRevealed && styles.confirmBtnDisabled]}
          onPress={() => void onConfirm()}
          disabled={!allRevealed}
          accessibilityRole="button"
          accessibilityLabel="确认并开始记分"
        >
          <Text style={[styles.confirmTxt, !allRevealed && styles.confirmTxtDisabled]}>
            确认并开始记分
          </Text>
        </Pressable>

        <Pressable
          style={styles.cancelRow}
          onPress={() => router.replace('/bet' as Href)}
          hitSlop={12}
        >
          <Text style={styles.cancelTxt}>取消返回上场</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  muted: { color: MUTED, fontSize: 15, fontWeight: '600' },
  link: { marginTop: 12, color: ACCENT, fontSize: 16, fontWeight: '700' },
  hintBelow: { marginTop: 12, color: SUB, fontSize: 13, fontWeight: '600' },

  head: { paddingHorizontal: 16, paddingBottom: 12 },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: MAIN,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  sub: { fontSize: 13, fontWeight: '600', color: SUB, lineHeight: 19 },

  scroll: { flex: 1 },
  scrollInner: { paddingHorizontal: 16, paddingBottom: 32 },

  progress: {
    fontSize: 13,
    fontWeight: '700',
    color: ACCENT,
    marginBottom: 14,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  tile: {
    width: '48%',
    minHeight: 140,
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: BORDER,
    backgroundColor: CARD,
    padding: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tileOpen: {
    borderColor: ACCENT,
    backgroundColor: '#1a3220',
  },
  tileBackLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: MAIN,
    marginBottom: 8,
    textAlign: 'center',
  },
  tileHint: { fontSize: 12, fontWeight: '600', color: MUTED },
  tileName: {
    fontSize: 12,
    fontWeight: '700',
    color: SUB,
    marginBottom: 8,
    textAlign: 'center',
  },
  tileFace: {
    fontWeight: '900',
    color: ACCENT,
    textAlign: 'center',
  },
  tileFaceLandlord: { fontSize: 22 },
  tileFaceRank: { fontSize: 36 },
  tileFaceSub: { fontSize: 11, fontWeight: '600', color: SUB, marginTop: 6, textAlign: 'center' },

  confirmBtn: {
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: ACCENT,
    marginBottom: 12,
  },
  confirmBtnDisabled: { opacity: 0.45 },
  confirmTxt: { fontSize: 17, fontWeight: '800', color: '#0d1b11' },
  confirmTxtDisabled: { color: '#0d1b11' },

  cancelRow: { paddingVertical: 8, alignItems: 'center' },
  cancelTxt: { fontSize: 14, fontWeight: '600', color: SUB },
});
