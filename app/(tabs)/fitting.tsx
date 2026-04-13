import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { TAB_BAR_SCROLL_EXTRA } from '@/constants/theme';

const BG = '#0d1f10';
const WHITE = '#ffffff';
const CARD = 'rgba(255,255,255,0.05)';
const CARD_BORDER = 'rgba(255,255,255,0.08)';
const TEXT_SECONDARY = 'rgba(255,255,255,0.55)';
const CHEVRON = 'rgba(255,255,255,0.3)';
const HEADER_SUB = 'rgba(255,255,255,0.5)';

type FittingEntry = {
  title: string;
  subtitle: string;
  /** Target path; asserted at navigation time until typed routes include all stacks. */
  href: string;
};

const ENTRIES: FittingEntry[] = [
  { title: 'AI 配杆顾问', subtitle: '基于档案的型号搭配建议', href: '/ai-advisor' },
  { title: '球杆推荐测验', subtitle: '一号木、铁杆、木杆等问卷入口', href: '/quiz/driver' },
  { title: '配杆工具', subtitle: '挥重、握把、距离间距', href: '/tools/swing-weight' },
  { title: '距离间距检查', subtitle: '球杆落点与杆间距离', href: '/tools/distance-gap' },
  { title: '我的球杆库', subtitle: '球杆参数与距离管理', href: '/my-bag' },
  { title: '装备库', subtitle: '浏览杆头、杆身与握把', href: '/(tabs)/products' },
  { title: '对比', subtitle: '最多 3 款产品并排对比', href: '/(tabs)/compare' },
  { title: '收藏', subtitle: '已保存的推荐方案', href: '/(tabs)/favorites' },
];

export default function FittingHubScreen() {
  const router = useRouter();

  return (
    <View style={[s.root, { backgroundColor: BG }]}>
      <View style={s.header}>
        <Text style={[s.headerTitle, { color: WHITE }]}>配杆</Text>
        <Text style={[s.headerSub, { color: HEADER_SUB }]}>GolfMate · 配杆中心</Text>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}>
        {ENTRIES.map((item) => (
          <TouchableOpacity
            key={item.title}
            style={[s.card, { backgroundColor: CARD, borderColor: CARD_BORDER }]}
            activeOpacity={0.86}
            onPress={() => router.push(item.href as Href)}>
            <View style={s.cardBody}>
              <Text style={[s.cardTitle, { color: WHITE }]}>{item.title}</Text>
              <Text style={[s.cardSub, { color: TEXT_SECONDARY }]}>{item.subtitle}</Text>
            </View>
            <Text style={[s.chevron, { color: CHEVRON }]}>›</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    backgroundColor: '#0d1f10',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 24, fontWeight: '700', marginBottom: 2 },
  headerSub: { fontSize: 12 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 24 + TAB_BAR_SCROLL_EXTRA, gap: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  cardBody: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  cardSub: { fontSize: 12, marginTop: 4 },
  chevron: { fontSize: 22, fontWeight: '600' },
});
