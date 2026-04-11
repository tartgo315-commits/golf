import { useFocusEffect } from '@react-navigation/native';
import { type Href, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { USER_PROFILE_KEY, type StoredUserProfile } from '@/lib/app-storage';
import { calcHandicapIndex, loadHandicapRecords, type HandicapRecord } from '@/lib/handicap';
import { readJson } from '@/lib/local-storage';

const GREEN = '#166534';
const HEADER_BG = '#1a3a1a';
const WHITE = '#ffffff';
const BG_PAGE = '#f3f4f6';
const BORDER = '#e5e7eb';
const TEXT_PRIMARY = '#111827';
const TEXT_SECONDARY = '#6b7280';
const TEXT_MUTED = '#9ca3af';

type ProfileJson = StoredUserProfile & { nickname?: string; name?: string };

function toDateMs(date: string) {
  return Number.isFinite(Date.parse(date)) ? Date.parse(date) : 0;
}

function grossStrokes(item: HandicapRecord): number {
  const hasHoles = item.holeDetails.length > 0;
  return hasHoles ? item.holeDetails.reduce((sum, h) => sum + h.strokes, 0) : item.adjustedGrossScore;
}

export default function HomeDashboardScreen() {
  const router = useRouter();
  const [handicapDisplay, setHandicapDisplay] = useState<string>('—');
  const [recentRounds, setRecentRounds] = useState<HandicapRecord[]>([]);
  const [profileLine, setProfileLine] = useState<string>('欢迎回来');

  useFocusEffect(
    useCallback(() => {
      const profile = readJson<ProfileJson | null>(USER_PROFILE_KEY, null);
      const nick = profile?.nickname?.trim() || profile?.name?.trim() || '';
      setProfileLine(nick ? `你好，${nick}` : '欢迎回来');

      const idx = calcHandicapIndex(loadHandicapRecords());
      setHandicapDisplay(typeof idx === 'number' ? idx.toFixed(1) : '待计算');

      const all = loadHandicapRecords();
      const sorted = [...all].sort((a, b) => toDateMs(b.date) - toDateMs(a.date));
      setRecentRounds(sorted.slice(0, 3));
      return () => {};
    }, []),
  );

  const hasRounds = recentRounds.length > 0;

  const subtitle = useMemo(() => {
    if (handicapDisplay === '待计算') return '记录满 3 场后自动生成 WHS 差点';
    return '基于最近成绩的差点指数';
  }, [handicapDisplay]);

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View style={s.headerTop}>
          <View>
            <Text style={s.brand}>GolfMate</Text>
            <Text style={s.greet}>{profileLine}</Text>
          </View>
          <TouchableOpacity style={s.iconBtn} onPress={() => router.push('/(tabs)/settings')} accessibilityRole="button">
            <Text style={s.iconBtnText}>设置</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false} bounces={false}>
        <TouchableOpacity
          style={s.heroCard}
          activeOpacity={0.9}
          onPress={() => router.push('/(tabs)/handicap' as Href)}>
          <Text style={s.heroLabel}>当前差点</Text>
          <Text style={s.heroValue}>{handicapDisplay}</Text>
          <Text style={s.heroHint}>{subtitle}</Text>
          <Text style={s.heroLink}>查看详情 →</Text>
        </TouchableOpacity>

        <Text style={s.sectionTitle}>最近成绩</Text>
        {hasRounds ? (
          <View style={s.card}>
            {recentRounds.map((r) => (
              <TouchableOpacity
                key={r.id}
                style={s.roundRow}
                onPress={() => router.push(`/handicap/${r.id}` as Href)}
                activeOpacity={0.86}>
                <View style={s.roundLeft}>
                  <Text style={s.roundDate}>{r.date}</Text>
                  <Text style={s.roundCourse} numberOfLines={1}>
                    {r.courseName}
                  </Text>
                </View>
                <Text style={s.roundScore}>{grossStrokes(r)} 杆</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={s.emptyCard}>
            <Text style={s.emptyText}>暂无成绩记录</Text>
            <Text style={s.emptySub}>录入球场成绩后，将在此显示最近几场。</Text>
          </View>
        )}

        <Text style={s.sectionTitle}>快捷入口</Text>
        <View style={s.quickRow}>
          <TouchableOpacity
            style={s.quickCard}
            onPress={() => router.push('/(tabs)/fitting' as Href)}
            activeOpacity={0.88}>
            <Text style={s.quickEmoji} accessibilityLabel="">
              ⛳
            </Text>
            <Text style={s.quickTitle}>进入配杆</Text>
            <Text style={s.quickSub}>测验、工具与装备库</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.quickCard}
            onPress={() => router.push('/handicap/add' as Href)}
            activeOpacity={0.88}>
            <Text style={s.quickEmoji} accessibilityLabel="">
              ✏️
            </Text>
            <Text style={s.quickTitle}>开始记成绩</Text>
            <Text style={s.quickSub}>新增一轮成绩卡</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG_PAGE },
  header: {
    backgroundColor: HEADER_BG,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'web' ? 50 : (StatusBar.currentHeight || 36) + 8,
    paddingBottom: 16,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  brand: { fontSize: 22, fontWeight: '800', color: WHITE },
  greet: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  iconBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  iconBtnText: { color: WHITE, fontSize: 13, fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 28, gap: 8 },
  heroCard: {
    backgroundColor: WHITE,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: BORDER,
    padding: 18,
    marginBottom: 8,
  },
  heroLabel: { fontSize: 12, color: TEXT_SECONDARY, fontWeight: '600' },
  heroValue: { fontSize: 40, lineHeight: 44, fontWeight: '800', color: GREEN, marginTop: 4 },
  heroHint: { fontSize: 13, color: TEXT_MUTED, marginTop: 6 },
  heroLink: { fontSize: 13, color: GREEN, fontWeight: '700', marginTop: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: TEXT_PRIMARY, marginTop: 8, marginBottom: 4 },
  card: {
    backgroundColor: WHITE,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: BORDER,
    overflow: 'hidden',
  },
  roundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BG_PAGE,
  },
  roundLeft: { flex: 1, minWidth: 0, paddingRight: 12 },
  roundDate: { fontSize: 12, color: TEXT_SECONDARY },
  roundCourse: { fontSize: 15, fontWeight: '600', color: TEXT_PRIMARY, marginTop: 2 },
  roundScore: { fontSize: 15, fontWeight: '700', color: TEXT_PRIMARY },
  emptyCard: {
    backgroundColor: WHITE,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: BORDER,
    padding: 18,
  },
  emptyText: { fontSize: 15, fontWeight: '600', color: TEXT_PRIMARY },
  emptySub: { fontSize: 13, color: TEXT_SECONDARY, marginTop: 6, lineHeight: 20 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, marginTop: 4 },
  quickCard: {
    width: '48%',
    backgroundColor: WHITE,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: BORDER,
    paddingVertical: 16,
    paddingHorizontal: 12,
    minHeight: 112,
  },
  quickEmoji: { fontSize: 26, marginBottom: 8 },
  quickTitle: { fontSize: 15, fontWeight: '700', color: TEXT_PRIMARY },
  quickSub: { fontSize: 12, color: TEXT_SECONDARY, marginTop: 4 },
});
