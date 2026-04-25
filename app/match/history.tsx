import { useFocusEffect } from '@react-navigation/native';
import { type Href, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DARK_PAGE } from '@/constants/theme';
import { formatMatchHistoryRow, listMatchesNewestFirst } from '@/utils/liveMatchStorage';
import type { MatchRecord } from '@/utils/matchScoring';

const BG = DARK_PAGE.bg;
const CARD = DARK_PAGE.card;
const BORDER = DARK_PAGE.cardBorder;
const TEXT = DARK_PAGE.text;
const TEXT_SECONDARY = DARK_PAGE.textSecondary;
const ACCENT = DARK_PAGE.accent;
const LOSS = '#d94848';

export default function MatchHistoryScreen() {
  const router = useRouter();
  const [matches, setMatches] = useState<MatchRecord[]>([]);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        setMatches(await listMatchesNewestFirst());
      })();
      return () => {};
    }, []),
  );

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={10}
          accessibilityRole="button"
        >
          <Text style={styles.backTxt}>← 返回</Text>
        </Pressable>
        <Text style={styles.title}>历史比赛</Text>
        <Text style={styles.sub}>按时间由新到旧</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {matches.length === 0 ? (
          <Text style={styles.empty}>暂无记录。在「比赛设置」里开始一场实时记分吧。</Text>
        ) : (
          matches.map((item) => {
            const row = formatMatchHistoryRow(item);
            const moneyWin = row.moneyText.startsWith('+');
            const moneyLoss = row.moneyText.startsWith('-');
            return (
              <Pressable
                key={item.id}
                style={styles.row}
                onPress={() => router.push(`/match/${item.id}` as Href)}
              >
                <View style={styles.rowLeft}>
                  <Text style={styles.date}>{row.dateLabel}</Text>
                  <Text style={styles.course} numberOfLines={2}>
                    {row.course}
                  </Text>
                  <Text style={styles.meta}>
                    {item.holes}洞 · {item.mode} ·{' '}
                    {item.status === 'finished' ? '已结束' : '进行中'}
                  </Text>
                </View>
                <View style={styles.rowRight}>
                  <Text style={styles.result} numberOfLines={2}>
                    {row.result}
                  </Text>
                  <Text
                    style={[
                      styles.money,
                      row.moneyText === '—'
                        ? styles.moneyNeutral
                        : moneyWin
                          ? styles.moneyWin
                          : moneyLoss
                            ? styles.moneyLoss
                            : styles.moneyNeutral,
                    ]}
                  >
                    {row.moneyText}
                  </Text>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: {
    backgroundColor: BG,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'web' ? 44 : 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DARK_PAGE.divider,
  },
  backBtn: { alignSelf: 'flex-start', marginBottom: 8 },
  backTxt: { fontSize: 15, fontWeight: '600', color: TEXT_SECONDARY },
  title: { fontSize: 22, fontWeight: '800', color: TEXT, marginBottom: 4 },
  sub: { fontSize: 12, color: DARK_PAGE.textSubHeader },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  empty: { fontSize: 14, color: TEXT_SECONDARY, lineHeight: 22 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: BORDER,
  },
  rowLeft: { flex: 1, minWidth: 0, paddingRight: 8 },
  date: { fontSize: 12, color: TEXT_SECONDARY, marginBottom: 4 },
  course: { fontSize: 16, fontWeight: '700', color: TEXT, marginBottom: 6 },
  meta: { fontSize: 12, color: TEXT_SECONDARY, lineHeight: 18 },
  rowRight: { alignItems: 'flex-end', maxWidth: 120 },
  result: { fontSize: 13, fontWeight: '700', color: TEXT, textAlign: 'right', marginBottom: 6 },
  money: { fontSize: 15, fontWeight: '800' },
  moneyWin: { color: ACCENT },
  moneyLoss: { color: LOSS },
  moneyNeutral: { color: TEXT_SECONDARY },
});
