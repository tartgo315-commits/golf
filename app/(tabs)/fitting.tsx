import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { TAB_BAR_SCROLL_EXTRA } from '@/constants/theme';

const PAGE_BG = '#0d1b11';
const CARD_BG = '#16261c';
const ACCENT = '#b5ff3a';
const ACCENT_DARK = '#0d1b11';
const TEXT_MAIN = '#e8f0e5';
const TEXT_SEC = '#a8b5ac';
const TEXT_TERTIARY = '#8a9a8e';
const TEXT_MUTED = '#5a6b5f';
const DIVIDER = 'rgba(255,255,255,0.04)';
const HERO_BORDER = 'rgba(181, 255, 58, 0.18)';
const ICON_BG = 'rgba(181, 255, 58, 0.12)';
const ICON_BG_SM = 'rgba(181, 255, 58, 0.1)';

function ChatBubbleIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"
        stroke={ACCENT}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M8 10h8M8 14h5" stroke={ACCENT} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

function GridIcon({ type }: { type: 'quiz' | 'tool' | 'bag' | 'compare' }) {
  const common = {
    stroke: ACCENT,
    strokeWidth: 1.7,
    fill: 'none' as const,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  if (type === 'quiz')
    return (
      <Svg width={20} height={20} viewBox="0 0 24 24">
        <Path d="M9 11l3 3L22 4" {...common} />
        <Path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" {...common} />
      </Svg>
    );
  if (type === 'tool')
    return (
      <Svg width={20} height={20} viewBox="0 0 24 24">
        <Path
          d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"
          {...common}
        />
      </Svg>
    );
  if (type === 'bag')
    return (
      <Svg width={20} height={20} viewBox="0 0 24 24">
        <Path d="M6 7h12v14H6z" {...common} />
        <Path d="M9 7V5a3 3 0 016 0v2" {...common} />
      </Svg>
    );
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" {...common} />
    </Svg>
  );
}

function RowIcon({ type }: { type: 'gap' | 'shop' | 'star' }) {
  const common = {
    stroke: ACCENT,
    strokeWidth: 1.7,
    fill: 'none' as const,
    strokeLinecap: 'round' as const,
  };
  if (type === 'gap')
    return (
      <Svg width={20} height={20} viewBox="0 0 24 24">
        <Path d="M3 12h4l2-8 4 16 2-8h6" {...common} />
      </Svg>
    );
  if (type === 'shop')
    return (
      <Svg width={20} height={20} viewBox="0 0 24 24">
        <Path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" {...common} />
        <Path d="M9 22V12h6v10" {...common} />
      </Svg>
    );
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        {...common}
      />
    </Svg>
  );
}

const CORE: {
  title: string;
  sub: string;
  href: string;
  icon: 'quiz' | 'tool' | 'bag' | 'compare';
}[] = [
  { title: '球杆推荐测验', sub: '一号木、铁杆等问卷', href: '/quiz/driver', icon: 'quiz' },
  { title: '配杆工具', sub: '挥重、握把、距离间距', href: '/tools/swing-weight', icon: 'tool' },
  { title: '我的球杆库', sub: '参数与距离管理', href: '/my-bag', icon: 'bag' },
  { title: '对比', sub: '最多 3 款产品并排', href: '/(tabs)/compare', icon: 'compare' },
];

const MORE: { title: string; sub: string; href: string; icon: 'gap' | 'shop' | 'star' }[] = [
  { title: '距离间距检查', sub: '落点与杆间距离', href: '/tools/distance-gap', icon: 'gap' },
  { title: '装备库', sub: '浏览杆头、杆身与握把', href: '/(tabs)/products', icon: 'shop' },
  { title: '收藏', sub: '已保存的推荐方案', href: '/(tabs)/favorites', icon: 'star' },
];

export default function FittingHubScreen() {
  const router = useRouter();

  return (
    <View style={[s.root, { backgroundColor: PAGE_BG }]}>
      <View style={s.header}>
        <Text style={s.headerTitle}>配杆</Text>
        <Text style={s.headerSub}>GolfMate · 配杆中心</Text>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <Pressable
          style={s.heroCard}
          onPress={() => router.push('/ai-advisor' as Href)}
          accessibilityRole="button"
          accessibilityLabel="AI 配杆顾问"
        >
          <View style={s.heroTop}>
            <View style={s.heroIconWrap}>
              <ChatBubbleIcon />
            </View>
            <View style={s.heroTextCol}>
              <Text style={s.heroTitle}>AI 配杆顾问</Text>
              <Text style={s.heroSub}>基于档案的型号搭配建议</Text>
            </View>
          </View>
          <View style={s.heroCta}>
            <Text style={s.heroCtaTxt}>开始咨询 →</Text>
          </View>
        </Pressable>

        <Text style={s.sectionTitle}>核心功能</Text>
        <View style={s.grid2}>
          {CORE.map((item) => (
            <Pressable
              key={item.href}
              style={s.gridCard}
              onPress={() => router.push(item.href as Href)}
              accessibilityRole="button"
            >
              <View style={s.gridIconWrap}>
                <GridIcon type={item.icon} />
              </View>
              <Text style={s.gridCardTitle}>{item.title}</Text>
              <Text style={s.gridCardSub}>{item.sub}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={s.sectionTitle}>更多工具</Text>
        <View style={s.moreCard}>
          {MORE.map((item, i) => (
            <Pressable
              key={item.href}
              style={[s.moreRow, i > 0 && s.moreRowBorder]}
              onPress={() => router.push(item.href as Href)}
            >
              <View style={s.moreIconWrap}>
                <RowIcon type={item.icon} />
              </View>
              <View style={s.moreTextCol}>
                <Text style={s.moreRowTitle}>{item.title}</Text>
                <Text style={s.moreRowSub}>{item.sub}</Text>
              </View>
              <Text style={s.moreChev}>›</Text>
            </Pressable>
          ))}
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
  scrollContent: { paddingHorizontal: 16, paddingBottom: 24 + TAB_BAR_SCROLL_EXTRA, gap: 0 },

  heroCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: HERO_BORDER,
    marginBottom: 16,
  },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  heroIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: ICON_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTextCol: { flex: 1, minWidth: 0 },
  heroTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: TEXT_MAIN,
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  heroSub: { fontSize: 11, fontWeight: '600', color: TEXT_TERTIARY, lineHeight: 16 },
  heroCta: {
    marginTop: 16,
    backgroundColor: ACCENT,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  heroCtaTxt: { fontSize: 15, fontWeight: '800', color: ACCENT_DARK, letterSpacing: -0.3 },

  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_SEC,
    marginBottom: 10,
    marginTop: 4,
  },
  grid2: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
    justifyContent: 'space-between',
  },
  gridCard: {
    width: '48%',
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 14,
    minHeight: 120,
  },
  gridIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: ICON_BG_SM,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  gridCardTitle: { fontSize: 14, fontWeight: '700', color: TEXT_MAIN, marginBottom: 4 },
  gridCardSub: { fontSize: 11, fontWeight: '600', color: TEXT_TERTIARY, lineHeight: 15 },

  moreCard: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
  },
  moreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  moreRowBorder: { borderTopWidth: 1, borderTopColor: DIVIDER },
  moreIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: ICON_BG_SM,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreTextCol: { flex: 1, minWidth: 0 },
  moreRowTitle: { fontSize: 14, fontWeight: '700', color: TEXT_MAIN, marginBottom: 2 },
  moreRowSub: { fontSize: 11, fontWeight: '600', color: TEXT_TERTIARY },
  moreChev: { fontSize: 20, fontWeight: '600', color: TEXT_MUTED },
});
