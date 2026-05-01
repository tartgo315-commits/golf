import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Polyline, Rect } from 'react-native-svg';

import { TAB_BAR_SCROLL_EXTRA } from '@/constants/theme';
import { AI_TRAINING_CACHE_KEY } from '@/utils/aiCacheKeys';
import { parseAITrainingResult, trainingWeaknessSummary } from '@/utils/parseAiStructured';
import { THEME } from '@/constants/theme';

const PAGE_BG = THEME.bg;
const CARD_BG = THEME.card;
const ACCENT = THEME.accent;
const ON_ACCENT = THEME.textOnAccent;
const TEXT_MAIN = THEME.text1;
const TEXT_MAIN_SOFT = THEME.text2;
const TEXT_SEC = THEME.text2;
const TEXT_TERTIARY = THEME.text3;
const TEXT_MUTED = THEME.text3;
const HERO_BORDER = THEME.accentBorder;
const HERO_ICON_BG = 'rgba(201,255,74,0.14)';
const ICON_BG_GRID = THEME.accentBg;
const ICON_BG_LIST = THEME.accentBg;
const GRID_GAP = 10;
const SECTION_LABEL = THEME.text3;
const LIST_BORDER = 'rgba(255,255,255,0.06)';
const STROKE_ICON = THEME.accent;

type TrainingCache = { text: string; source: string; generatedAt: number; recordCount: number };

/** 与 ai-training 缓存一致：优先「主要短板」首句，否则用全文前 50 字 */
function trainingCacheHeroSummary(c: Pick<TrainingCache, 'text'>): string | null {
  const text = typeof c.text === 'string' ? c.text.trim() : '';
  if (!text) return null;
  const parsed = parseAITrainingResult(text);
  const w = parsed.weakness?.trim() ?? '';
  if (w) {
    const line = trainingWeaknessSummary(w).trim();
    if (line) return line;
  }
  return text.length <= 50 ? text : `${text.slice(0, 50)}…`;
}

/** 仅用直线/圆，避免部分 RN-SVG 对复杂 arc 解析异常 */
function IconLampHero() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3v3M12 18v3M4 12h3M17 12h3M6.5 6.5l2 2M15.5 15.5l2 2M17.5 6.5l-2 2M6.5 17.5l2-2"
        stroke={STROKE_ICON}
        strokeWidth={1.7}
        strokeLinecap="round"
      />
      <Path
        d="M9 17h6v1a1 1 0 01-1 1h-4a1 1 0 01-1-1v-1zM10 17V12a2 2 0 114 0v5"
        stroke={STROKE_ICON}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function IconLineChart() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Polyline
        points="4,16 9,11 14,14 20,6"
        stroke={STROKE_ICON}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M4 20h16" stroke={STROKE_ICON} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function IconClock() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 21a9 9 0 100-18 9 9 0 000 18z"
        stroke={STROKE_ICON}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Path d="M12 7v5l3 2" stroke={STROKE_ICON} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function IconCheck() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 6L9 17l-5-5"
        stroke={STROKE_ICON}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function IconDoc() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 4h7l4 4v14a1 1 0 01-1 1H7a1 1 0 01-1-1V5a1 1 0 011-1z"
        stroke={STROKE_ICON}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Path d="M14 4v4h4M8 12h8M8 16h6" stroke={STROKE_ICON} strokeWidth={1.7} strokeLinecap="round" />
    </Svg>
  );
}

function IconTrainingPlan() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Rect x="2" y="2" width="12" height="12" rx="1.5" stroke={STROKE_ICON} strokeWidth={1.4} fill="none" />
      <Path d="M5 6h6M5 9h4" stroke={STROKE_ICON} strokeWidth={1.3} strokeLinecap="round" />
      <Path d="M10.5 11l1.5-1.5" stroke={STROKE_ICON} strokeWidth={1.3} strokeLinecap="round" />
    </Svg>
  );
}

function IconChatAdvisor() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"
        stroke={STROKE_ICON}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M8 10h8M8 13h5" stroke={STROKE_ICON} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

export default function AiHubScreen() {
  const router = useRouter();
  const [heroSummary, setHeroSummary] = useState<string | null>(null);

  const loadHero = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(AI_TRAINING_CACHE_KEY);
      if (!raw) {
        setHeroSummary(null);
        return;
      }
      const c = JSON.parse(raw) as TrainingCache;
      if (!c || typeof c.text !== 'string') {
        setHeroSummary(null);
        return;
      }
      setHeroSummary(trainingCacheHeroSummary(c));
    } catch {
      setHeroSummary(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadHero();
    }, [loadHero]),
  );

  return (
    <View style={[s.root, { backgroundColor: PAGE_BG }]}>
      <View style={s.header}>
        <Text style={s.headerTitle}>AI 助手</Text>
        <Text style={s.headerSub}>智能分析 · 策略建议 · 训练计划</Text>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={s.heroCard}>
          <View style={s.heroTopRow}>
            <View style={s.heroIconBlock}>
              <IconLampHero />
            </View>
            <View style={s.heroTextCol}>
              <Text style={s.heroLabel}>今日智能建议</Text>
              <Text style={s.heroHeadline}>结合近期成绩与球杆库</Text>
            </View>
          </View>

          {heroSummary ? (
            <View style={s.heroBody}>
              <Text style={s.heroSummary} numberOfLines={2}>
                {heroSummary}
              </Text>
              <Pressable
                onPress={() => router.push('/ai-training' as Href)}
                accessibilityRole="button"
                hitSlop={6}
              >
                <Text style={s.heroLinkTxt}>查看完整分析 →</Text>
              </Pressable>
            </View>
          ) : (
            <View style={s.heroBody}>
              <Text style={s.heroHint}>基于你的成绩数据生成</Text>
              <Pressable
                style={s.heroPrimaryBtn}
                onPress={() => router.push('/ai-training' as Href)}
                accessibilityRole="button"
              >
                <Text style={s.heroPrimaryBtnTxt}>生成今日建议 →</Text>
              </Pressable>
            </View>
          )}
        </View>

        <Text style={s.sectionTitle}>分析与复盘</Text>
        <View style={s.gridRow}>
          <Pressable
            style={s.gridCell}
            onPress={() => router.push('/ai-training' as Href)}
            accessibilityRole="button"
          >
            <View style={s.gridIconWrap}>
              <IconLineChart />
            </View>
            <Text style={s.gridTitle}>练球分析</Text>
            <Text style={s.gridSub}>成绩驱动的短板与计划</Text>
          </Pressable>
          <Pressable
            style={s.gridCell}
            onPress={() => router.push('/training' as Href)}
            accessibilityRole="button"
          >
            <View style={s.gridIconWrap}>
              <IconTrainingPlan />
            </View>
            <Text style={s.gridTitle}>训练计划</Text>
            <Text style={s.gridSub}>由建议生成的训练项与提醒</Text>
          </Pressable>
        </View>

        <Text style={[s.sectionTitle, s.sectionSp]}>赛前准备</Text>
        <View style={s.gridRow}>
          <Pressable
            style={s.gridCell}
            onPress={() => router.push('/course-strategy' as Href)}
            accessibilityRole="button"
          >
            <View style={s.gridIconWrap}>
              <IconCheck />
            </View>
            <Text style={s.gridTitle}>下场策略</Text>
            <Text style={s.gridSub}>赛前目标与节奏口诀</Text>
          </Pressable>
          <Pressable
            style={s.gridCell}
            onPress={() => router.push('/(tabs)/bet?openBriefing=1' as Href)}
            accessibilityRole="button"
          >
            <View style={s.gridIconWrap}>
              <IconDoc />
            </View>
            <Text style={s.gridTitle}>赛前简报</Text>
            <Text style={s.gridSub}>比赛页打开简报</Text>
          </Pressable>
        </View>

        <Text style={[s.sectionTitle, s.sectionSp]}>更多工具</Text>
        <View style={s.moreCard}>
          <Pressable
            style={s.moreRow}
            onPress={() => router.push('/handicap/history?from=ai' as Href)}
            accessibilityRole="button"
          >
            <View style={s.moreIconWrap}>
              <IconClock />
            </View>
            <View style={s.moreTextCol}>
              <Text style={s.moreRowTitle}>单场复盘</Text>
              <Text style={s.moreRowSub}>成绩详情内 AI 复盘</Text>
            </View>
            <Text style={s.moreChev}>›</Text>
          </Pressable>
          <Pressable
            style={[s.moreRow, s.moreRowBorder]}
            onPress={() => router.push('/ai-advisor' as Href)}
            accessibilityRole="button"
          >
            <View style={s.moreIconWrap}>
              <IconChatAdvisor />
            </View>
            <View style={s.moreTextCol}>
              <Text style={s.moreRowTitle}>AI 配杆顾问</Text>
              <Text style={s.moreRowSub}>对话式选配与搭配建议</Text>
            </View>
            <Text style={s.moreChev}>›</Text>
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
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: TEXT_MAIN,
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  headerSub: { fontSize: 12, fontWeight: '500', color: TEXT_TERTIARY, lineHeight: 17 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 24 + TAB_BAR_SCROLL_EXTRA, gap: 0 },
  heroCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: HERO_BORDER,
    padding: 16,
    marginBottom: 20,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  heroIconBlock: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: HERO_ICON_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTextCol: { flex: 1, minWidth: 0 },
  heroLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: TEXT_TERTIARY,
    marginBottom: 4,
  },
  heroHeadline: {
    fontSize: 15,
    fontWeight: '800',
    color: TEXT_MAIN,
    lineHeight: 21,
  },
  heroBody: { marginTop: 14, alignSelf: 'stretch' },
  heroSummary: {
    fontSize: 12,
    fontWeight: '500',
    color: TEXT_SEC,
    lineHeight: 18,
    marginBottom: 10,
  },
  heroLinkTxt: { fontSize: 11, fontWeight: '700', color: ACCENT },
  heroHint: {
    fontSize: 12,
    fontWeight: '500',
    color: TEXT_TERTIARY,
    lineHeight: 18,
    marginBottom: 12,
  },
  heroPrimaryBtn: {
    alignSelf: 'stretch',
    backgroundColor: ACCENT,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPrimaryBtnTxt: {
    fontSize: 14,
    fontWeight: '800',
    color: ON_ACCENT,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: SECTION_LABEL,
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  sectionSp: { marginTop: 8 },
  gridRow: {
    flexDirection: 'row',
    gap: GRID_GAP,
    marginBottom: 8,
  },
  gridCell: {
    flex: 1,
    minWidth: 0,
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 14,
    minHeight: 104,
  },
  gridIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: ICON_BG_GRID,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_MAIN_SOFT,
    marginTop: 10,
    marginBottom: 3,
  },
  gridSub: { fontSize: 11, fontWeight: '500', color: TEXT_TERTIARY, lineHeight: 16 },
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
  moreRowBorder: { borderTopWidth: 1, borderTopColor: LIST_BORDER },
  moreIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: ICON_BG_LIST,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreTextCol: { flex: 1, minWidth: 0 },
  moreRowTitle: { fontSize: 14, fontWeight: '700', color: TEXT_MAIN_SOFT, marginBottom: 2 },
  moreRowSub: { fontSize: 11, fontWeight: '600', color: TEXT_TERTIARY },
  moreChev: { fontSize: 20, fontWeight: '600', color: TEXT_MUTED },
});
