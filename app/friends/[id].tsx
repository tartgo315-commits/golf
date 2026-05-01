import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { HandicapCompareChart, type HiPoint } from '@/components/HandicapCompareChart';
import {
  buildHandicapTrend,
  calcHandicapIndex,
  equivalent18AdjustedGross,
  equivalent18FromGrossAndHoles,
  loadHandicapRecords,
} from '@/lib/handicap';
import {
  getFriendPublicProfile,
  removeFriend,
  syncPublicHandicapToServer,
  type PublicUserProfile,
} from '@/utils/friendSystem';
import { THEME } from '@/constants/theme';

const BG = THEME.bg;
const CARD = THEME.card;
const ACCENT = THEME.accent;
const MAIN = THEME.text2;
const SUB = THEME.text3;
const MUTED = THEME.text3;
const ORANGE = '#e89b3a';
const GOLD = '#e5c53a';
const LAB = THEME.text3;

function avgGrossFromRounds(rows: { gross: number }[]): number | null {
  if (!rows.length) return null;
  const s = rows.reduce((a, r) => a + r.gross, 0);
  return Math.round((s / rows.length) * 10) / 10;
}

function bestGross(rows: { gross: number }[]): number | null {
  if (!rows.length) return null;
  return Math.min(...rows.map((r) => r.gross));
}

export default function FriendDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [friend, setFriend] = useState<PublicUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartRange, setChartRange] = useState<5 | 10 | 20>(10);

  const myRecords = loadHandicapRecords();
  const myHi = calcHandicapIndex(myRecords);
  const myPoints: HiPoint[] = (() => {
    const t = buildHandicapTrend(myRecords);
    return t
      .filter((x): x is { date: string; index: number } => typeof x.index === 'number')
      .map((x) => ({ date: x.date, hi: x.index }));
  })();
  const myRecent = [...myRecords]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, 3)
    .map((r) => ({ date: r.date, gross: r.adjustedGrossScore }));

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    await syncPublicHandicapToServer();
    const f = await getFriendPublicProfile(id);
    setFriend(f);
    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {};
    }, [load]),
  );

  const friendPoints: HiPoint[] = useMemo(() => friend?.trendPoints ?? [], [friend]);

  const friendRecent = useMemo(() => {
    const r = friend?.recentRounds ?? [];
    return [...r].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, 3);
  }, [friend]);

  const myAvg = avgGrossFromRounds(myRecords.map((r) => ({ gross: equivalent18AdjustedGross(r) })));
  const myBest = bestGross(myRecords.map((r) => ({ gross: equivalent18AdjustedGross(r) })));
  const myCount = myRecords.length;
  const frAvg = avgGrossFromRounds(
    (friend?.recentRounds ?? []).map((row) => ({
      gross: equivalent18FromGrossAndHoles(row.gross, row.holes),
    })),
  );
  const frBest = bestGross(
    (friend?.recentRounds ?? []).map((row) => ({
      gross: equivalent18FromGrossAndHoles(row.gross, row.holes),
    })),
  );

  const leadLine = useMemo(() => {
    if (
      typeof myHi !== 'number' ||
      !friend ||
      friend.handicap == null ||
      !Number.isFinite(friend.handicap)
    ) {
      return null;
    }
    const d = friend.handicap - myHi;
    if (Math.abs(d) < 0.05) return '双方差点持平';
    if (d > 0) return `你领先 ${d.toFixed(1)} 杆`;
    return `对方领先 ${(-d).toFixed(1)} 杆`;
  }, [myHi, friend]);

  const onMenu = () => {
    if (!id || !friend) return;
    Alert.alert(friend.name, undefined, [
      {
        text: '删除好友',
        style: 'destructive',
        onPress: () => {
          Alert.alert('确认删除', `将删除与 ${friend.name} 的好友关系`, [
            { text: '取消', style: 'cancel' },
            {
              text: '删除',
              style: 'destructive',
              onPress: async () => {
                const ok = await removeFriend(id);
                if (ok) router.back();
                else Alert.alert('提示', '删除失败');
              },
            },
          ]);
        },
      },
      { text: '取消', style: 'cancel' },
    ]);
  };

  if (!id) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>无效链接</Text>
      </View>
    );
  }

  if (loading && !friend) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={ACCENT} />
      </View>
    );
  }

  if (!friend) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>未找到该好友</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 12 }}>
          <Text style={styles.link}>返回</Text>
        </Pressable>
      </View>
    );
  }

  const myBetterHi = typeof myHi === 'number' && friend.handicap != null && myHi < friend.handicap;
  const frBetterHi = typeof myHi === 'number' && friend.handicap != null && friend.handicap < myHi;
  const myBetterAvg = myAvg != null && frAvg != null && myAvg < frAvg;
  const frBetterAvg = myAvg != null && frAvg != null && frAvg < myAvg;
  const myBetterBest = myBest != null && frBest != null && myBest < frBest;
  const frBetterBest = myBest != null && frBest != null && frBest < myBest;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backWrap}>
          <Text style={styles.back}>‹ 返回</Text>
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {friend.name}
        </Text>
        <Pressable onPress={onMenu} hitSlop={12} style={styles.menuHit}>
          <Text style={styles.menu}>⋯</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroCol}>
            <Text style={styles.heroLab}>我</Text>
            <View style={styles.heroNumRow}>
              <Text style={[styles.heroHiMe, myBetterHi && styles.crownPad]}>
                {typeof myHi === 'number' ? myHi.toFixed(1) : '—'}
              </Text>
              {myBetterHi ? <View style={styles.crownDot} /> : <View style={styles.crownSpacer} />}
            </View>
          </View>
          <Text style={styles.vs}>VS</Text>
          <View style={styles.heroCol}>
            <Text style={styles.heroLab}>{friend.name}</Text>
            <View style={styles.heroNumRow}>
              <Text style={[styles.heroHiFr, frBetterHi && styles.crownPad]}>
                {friend.handicap != null ? friend.handicap.toFixed(1) : '—'}
              </Text>
              {frBetterHi ? <View style={styles.crownDot} /> : <View style={styles.crownSpacer} />}
            </View>
          </View>
        </View>
        {leadLine ? <Text style={styles.lead}>{leadLine}</Text> : null}

        <View style={styles.seg}>
          {([5, 10, 20] as const).map((n) => (
            <Pressable
              key={n}
              style={[styles.segChip, chartRange === n && styles.segChipOn]}
              onPress={() => setChartRange(n)}
            >
              <Text style={[styles.segTxt, chartRange === n && styles.segTxtOn]}>近 {n} 场</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.chartCard}>
          <HandicapCompareChart
            myPoints={myPoints}
            friendPoints={friendPoints}
            myName="我"
            friendName={friend.name}
            range={chartRange}
          />
        </View>

        <View style={styles.statCard}>
          <View style={styles.statRow}>
            <Text style={styles.statH}>近期均杆</Text>
            <Text style={styles.statH}>最佳成绩</Text>
            <Text style={styles.statH}>总场次</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={[styles.statMe, myBetterAvg && styles.statBetter]}>
              {myAvg != null ? myAvg : '—'}
            </Text>
            <Text style={[styles.statMe, myBetterBest && styles.statBetter]}>
              {myBest != null ? myBest : '—'}
            </Text>
            <Text style={styles.statMe}>{myCount}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={[styles.statFr, frBetterAvg && styles.statBetter]}>
              {frAvg != null ? frAvg : '—'}
            </Text>
            <Text style={[styles.statFr, frBetterBest && styles.statBetter]}>
              {frBest != null ? frBest : '—'}
            </Text>
            <Text style={styles.statFr}>{friend.roundsCount}</Text>
          </View>
        </View>

        <Text style={styles.sectionLab}>最近成绩</Text>
        <View style={styles.recentRow}>
          <View style={styles.recentCol}>
            <Text style={styles.recentColLab}>我</Text>
            {myRecent.map((r, i) => {
              const o = friendRecent[i];
              const better = o ? r.gross < o.gross : false;
              const worse = o ? r.gross > o.gross : false;
              return (
                <View key={r.date} style={styles.recentLine}>
                  <Text style={styles.recentDate}>{r.date.slice(5)}</Text>
                  <Text
                    style={[
                      styles.recentGross,
                      better && styles.grossGood,
                      worse && styles.grossBad,
                    ]}
                  >
                    {r.gross}
                  </Text>
                </View>
              );
            })}
          </View>
          <View style={styles.recentCol}>
            <Text style={styles.recentColLab}>{friend.name}</Text>
            {friendRecent.map((r, i) => {
              const o = myRecent[i];
              const better = o ? r.gross < o.gross : false;
              const worse = o ? r.gross > o.gross : false;
              return (
                <View key={r.date} style={styles.recentLine}>
                  <Text style={styles.recentDate}>{r.date.slice(5)}</Text>
                  <Text
                    style={[
                      styles.recentGross,
                      better && styles.grossGood,
                      worse && styles.grossBad,
                    ]}
                  >
                    {r.gross}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  muted: { color: MUTED, fontSize: 14, fontWeight: '600' },
  link: { color: ACCENT, fontWeight: '700' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'web' ? 44 : 12,
    paddingBottom: 10,
    gap: 8,
  },
  backWrap: { width: 56 },
  back: { color: SUB, fontSize: 15, fontWeight: '700' },
  title: { flex: 1, fontSize: 22, fontWeight: '800', color: '#fff' },
  menuHit: { width: 40, alignItems: 'flex-end' },
  menu: { fontSize: 22, fontWeight: '800', color: SUB, lineHeight: 24 },
  scroll: { padding: 16, paddingBottom: 40 },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
  },
  heroCol: { flex: 1, alignItems: 'center' },
  heroLab: { fontSize: 12, fontWeight: '600', color: SUB, marginBottom: 8 },
  heroNumRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  heroHiMe: { fontSize: 28, fontWeight: '800', color: ACCENT },
  heroHiFr: { fontSize: 28, fontWeight: '800', color: MAIN },
  crownPad: {},
  crownDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: GOLD,
  },
  crownSpacer: { width: 10, height: 10 },
  vs: { fontSize: 14, fontWeight: '700', color: MUTED, paddingHorizontal: 6 },
  lead: { fontSize: 12, fontWeight: '600', color: SUB, textAlign: 'center', marginBottom: 16 },
  seg: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  segChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  segChipOn: { backgroundColor: 'rgba(181,255,58,0.12)' },
  segTxt: { fontSize: 12, fontWeight: '600', color: SUB },
  segTxtOn: { color: ACCENT, fontWeight: '800' },
  chartCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  statCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
  },
  statRow: { flexDirection: 'row', marginBottom: 8 },
  statH: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: LAB,
    textAlign: 'center',
  },
  statMe: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: ACCENT,
    textAlign: 'center',
  },
  statFr: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: MAIN,
    textAlign: 'center',
  },
  statBetter: { textDecorationLine: 'underline', textDecorationColor: GOLD },
  sectionLab: { fontSize: 13, fontWeight: '700', color: LAB, marginBottom: 10 },
  recentRow: { flexDirection: 'row', gap: 12 },
  recentCol: { flex: 1, backgroundColor: CARD, borderRadius: 12, padding: 12 },
  recentColLab: { fontSize: 11, fontWeight: '700', color: SUB, marginBottom: 10 },
  recentLine: { marginBottom: 10 },
  recentDate: { fontSize: 11, fontWeight: '600', color: MUTED },
  recentGross: { fontSize: 16, fontWeight: '800', color: MAIN, marginTop: 2 },
  grossGood: { color: ACCENT },
  grossBad: { color: ORANGE },
});
