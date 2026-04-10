import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { loadMyClubBag, type MyClubItem } from '@/lib/my-club-bag';

const GREEN = '#166534';
const BG = '#f3f4f6';
const WHITE = '#ffffff';
const BORDER = '#e5e7eb';
const TEXT_PRIMARY = '#111827';
const TEXT_SECONDARY = '#6b7280';
const ORANGE = '#d97706';
const RED = '#dc2626';

type FilledClub = {
  id: string;
  name: string;
  order: number;
  distance: number;
};

type GapStatus = 'normal' | 'small' | 'large' | 'other';

export default function DistanceGapScreen() {
  const router = useRouter();
  const [clubs, setClubs] = useState<FilledClub[]>([]);

  useFocusEffect(
    useCallback(() => {
      const all = loadMyClubBag();
      const filled = all
        .filter((item): item is MyClubItem & { distance: number } => typeof item.distance === 'number' && Number.isFinite(item.distance))
        .sort((a, b) => a.order - b.order)
        .map((item) => ({ id: item.id, name: item.name, order: item.order, distance: item.distance }));
      setClubs(filled);
      return () => {};
    }, []),
  );

  const gaps = useMemo(() => {
    const values: number[] = [];
    for (let i = 1; i < clubs.length; i += 1) {
      values.push(Math.abs(clubs[i - 1].distance - clubs[i].distance));
    }
    return values;
  }, [clubs]);

  const summary = useMemo(() => {
    if (!gaps.length) return { avg: 0, issues: 0 };
    const avg = Math.round((gaps.reduce((sum, item) => sum + item, 0) / gaps.length) * 10) / 10;
    const issues = gaps.filter((item) => item < 10 || item > 20).length;
    return { avg, issues };
  }, [gaps]);

  function gapStatus(gap: number): GapStatus {
    if (gap >= 10 && gap <= 15) return 'normal';
    if (gap < 10) return 'small';
    if (gap > 20) return 'large';
    return 'other';
  }

  function gapText(gap: number, status: GapStatus) {
    if (status === 'normal') return `↓${gap}码 ✓`;
    if (status === 'small') return `↓${gap}码 ⚠ 太近`;
    if (status === 'large') return `↓${gap}码 △ 间距过大`;
    return `↓${gap}码`;
  }

  function gapColor(status: GapStatus) {
    if (status === 'normal') return GREEN;
    if (status === 'small') return RED;
    if (status === 'large') return ORANGE;
    return TEXT_SECONDARY;
  }

  const notEnough = clubs.length < 2;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} bounces={false}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backTxt}>← 返回</Text>
        </Pressable>

        <Text style={styles.title}>距离间距检查</Text>
        <Text style={styles.desc}>基于你的球杆库数据</Text>

        {notEnough ? (
          <View style={styles.card}>
            <Text style={styles.empty}>请先在球杆库中填写至少 2 支球杆的距离</Text>
            <Pressable style={styles.linkBtn} onPress={() => router.push('/my-bag')}>
              <Text style={styles.linkBtnText}>前往球杆库 &gt;</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.summaryText}>平均间距：{summary.avg}码 | 问题区间：{summary.issues}处</Text>
            </View>

            <View style={styles.card}>
              {clubs.map((club, index) => {
                const gap = index > 0 ? Math.abs(club.distance - clubs[index - 1].distance) : null;
                const status = typeof gap === 'number' ? gapStatus(gap) : null;
                return (
                  <View key={club.id} style={styles.row}>
                    <Text style={styles.clubName}>{club.name}</Text>
                    <Text style={styles.distance}>{club.distance}码</Text>
                    <Text style={[styles.gap, status ? { color: gapColor(status) } : styles.gapMuted]}>
                      {typeof gap === 'number' && status ? gapText(gap, status) : '—'}
                    </Text>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.updateBtn} onPress={() => router.push('/my-bag')}>
          <Text style={styles.updateBtnText}>更新距离数据</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  flex: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'web' ? 44 : 16,
    paddingBottom: 96,
  },
  backBtn: { marginBottom: 8, alignSelf: 'flex-start' },
  backTxt: { color: GREEN, fontWeight: '600' },
  title: { fontSize: 22, fontWeight: '700', color: TEXT_PRIMARY, marginBottom: 8 },
  desc: { fontSize: 13, color: TEXT_SECONDARY, lineHeight: 20, marginBottom: 12 },
  card: {
    backgroundColor: WHITE,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: BORDER,
    padding: 12,
    marginBottom: 10,
  },
  empty: { fontSize: 13, color: TEXT_SECONDARY, lineHeight: 20, marginBottom: 10 },
  linkBtn: {
    alignSelf: 'flex-start',
    borderWidth: 0.5,
    borderColor: GREEN,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: WHITE,
  },
  linkBtnText: { color: GREEN, fontSize: 13, fontWeight: '700' },
  summaryText: { fontSize: 14, color: TEXT_PRIMARY, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 0.5,
    borderBottomColor: BG,
    paddingVertical: 10,
    gap: 8,
  },
  clubName: { flex: 1, color: TEXT_PRIMARY, fontSize: 14, fontWeight: '600' },
  distance: { width: 72, color: TEXT_PRIMARY, fontSize: 13, textAlign: 'right', fontWeight: '600' },
  gap: { width: 122, fontSize: 12, textAlign: 'right', fontWeight: '700' },
  gapMuted: { color: TEXT_SECONDARY, fontWeight: '500' },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: WHITE,
    borderTopWidth: 0.5,
    borderTopColor: BORDER,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  updateBtn: {
    backgroundColor: GREEN,
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 13,
  },
  updateBtnText: { color: WHITE, fontSize: 16, fontWeight: '700' },
});
