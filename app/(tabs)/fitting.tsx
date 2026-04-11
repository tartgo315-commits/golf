import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { TopTabNav } from '@/components/top-tab-nav';
import { TAB_BAR_SCROLL_EXTRA } from '@/constants/theme';

const HEADER_BG = '#101512';
const BG = '#f3f4f6';
const WHITE = '#ffffff';
const BORDER = '#e5e7eb';
const TEXT_PRIMARY = '#111827';
const TEXT_SECONDARY = '#6b7280';
const TEXT_TERTIARY = '#9ca3af';

type FittingEntry = {
  title: string;
  subtitle: string;
  /** Target path; asserted at navigation time until typed routes include all stacks. */
  href: string;
  emoji: string;
};

const ENTRIES: FittingEntry[] = [
  { title: 'AI 配杆顾问', subtitle: '基于档案的型号搭配建议', href: '/ai-advisor', emoji: '🤖' },
  { title: '球杆推荐测验', subtitle: '一号木、铁杆、木杆等问卷入口', href: '/quiz/driver', emoji: '📝' },
  { title: '配杆工具', subtitle: '挥重、握把、距离间距', href: '/tools/swing-weight', emoji: '🔧' },
  { title: '距离间距检查', subtitle: '球杆落点与杆间距离', href: '/tools/distance-gap', emoji: '📏' },
  { title: '我的球杆库', subtitle: '球杆参数与距离管理', href: '/my-bag', emoji: '🎒' },
  { title: '装备库', subtitle: '浏览杆头、杆身与握把', href: '/(tabs)/products', emoji: '📦' },
  { title: '对比', subtitle: '最多 3 款产品并排对比', href: '/(tabs)/compare', emoji: '📊' },
  { title: '收藏', subtitle: '已保存的推荐方案', href: '/(tabs)/favorites', emoji: '❤️' },
];

export default function FittingHubScreen() {
  const router = useRouter();

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Text style={s.headerTitle}>配杆</Text>
        <Text style={s.headerSub}>GolfMate · 配杆中心</Text>
      </View>

      <TopTabNav />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}>
        {ENTRIES.map((item) => (
          <TouchableOpacity
            key={item.title}
            style={s.card}
            activeOpacity={0.86}
            onPress={() => router.push(item.href as Href)}>
            <Text style={s.emoji} accessibilityLabel="">
              {item.emoji}
            </Text>
            <View style={s.cardBody}>
              <Text style={s.cardTitle}>{item.title}</Text>
              <Text style={s.cardSub}>{item.subtitle}</Text>
            </View>
            <Text style={s.chevron}>›</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: {
    backgroundColor: HEADER_BG,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'web' ? 50 : (StatusBar.currentHeight || 36) + 8,
    paddingBottom: 16,
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: WHITE },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 24 + TAB_BAR_SCROLL_EXTRA, gap: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: WHITE,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: BORDER,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  emoji: { fontSize: 26, width: 36, textAlign: 'center' },
  cardBody: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: TEXT_PRIMARY },
  cardSub: { fontSize: 12, color: TEXT_SECONDARY, marginTop: 4 },
  chevron: { fontSize: 22, color: TEXT_TERTIARY, fontWeight: '600' },
});
