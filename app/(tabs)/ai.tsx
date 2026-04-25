import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { TAB_BAR_SCROLL_EXTRA } from '@/constants/theme';

const PAGE_BG = '#0d1b11';
const CARD_BG = '#16261c';
const ACCENT = '#b5ff3a';
const TEXT_MAIN = '#e8f0e5';
const TEXT_SEC = '#a8b5ac';
const TEXT_TERTIARY = '#8a9a8e';
const TEXT_MUTED = '#5a6b5f';
const DIVIDER = 'rgba(255,255,255,0.06)';

type HubRow = {
  title: string;
  sub: string;
  href: Href;
};

const ROWS: HubRow[] = [
  {
    title: 'AI 配杆顾问',
    sub: '对话式选配与搭配建议',
    href: '/ai-advisor',
  },
  {
    title: 'AI 练球分析',
    sub: '根据近期成绩生成短板与练习方向',
    href: '/ai-training',
  },
  {
    title: 'AI 下场策略',
    sub: '赛前目标、短板规避与节奏口诀',
    href: '/course-strategy',
  },
  {
    title: '训练计划与打卡',
    sub: '由建议生成的训练项与提醒',
    href: '/training',
  },
  {
    title: '比赛 · 战术与简报',
    sub: '球场 AI 流、赛前简报等',
    href: '/(tabs)/bet',
  },
  {
    title: '直接打开赛前简报',
    sub: '与首页「智能建议」联动入口一致',
    href: '/(tabs)/bet?openBriefing=1',
  },
  {
    title: '单场 AI 复盘',
    sub: '在成绩列表选一场，详情页底部可生成复盘',
    href: '/handicap/history',
  },
];

function SparkleIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2v4M12 18v4M2 12h4M18 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M5.6 18.4l2.8-2.8"
        stroke={ACCENT}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function AiHubScreen() {
  const router = useRouter();

  return (
    <View style={[s.root, { backgroundColor: PAGE_BG }]}>
      <View style={s.header}>
        <Text style={s.headerTitle}>AI</Text>
        <Text style={s.headerSub}>智能功能入口 · 统一从这里进入</Text>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={s.card}>
          {ROWS.map((item, i) => (
            <Pressable
              key={item.title}
              style={[s.row, i > 0 && s.rowBorder]}
              onPress={() => router.push(item.href)}
              accessibilityRole="button"
              accessibilityLabel={item.title}
            >
              <View style={s.iconWrap}>
                <SparkleIcon />
              </View>
              <View style={s.textCol}>
                <Text style={s.rowTitle}>{item.title}</Text>
                <Text style={s.rowSub}>{item.sub}</Text>
              </View>
              <Text style={s.chev}>›</Text>
            </Pressable>
          ))}
        </View>

        <Text style={s.footnote}>
          首页「今日智能建议」仍在首页展示；生成训练计划会进入训练计划页。
        </Text>
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
  scrollContent: { paddingHorizontal: 16, paddingBottom: 24 + TAB_BAR_SCROLL_EXTRA, gap: 14 },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: DIVIDER,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  rowBorder: { borderTopWidth: 1, borderTopColor: DIVIDER },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(181, 255, 58, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: TEXT_MAIN, marginBottom: 3 },
  rowSub: { fontSize: 12, fontWeight: '500', color: TEXT_SEC, lineHeight: 17 },
  chev: { fontSize: 20, fontWeight: '300', color: TEXT_MUTED, paddingLeft: 4 },
  footnote: {
    fontSize: 11,
    fontWeight: '500',
    color: TEXT_MUTED,
    lineHeight: 16,
    paddingHorizontal: 4,
  },
});
