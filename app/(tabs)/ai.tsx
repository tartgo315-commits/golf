import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Polyline } from 'react-native-svg';

import { TAB_BAR_SCROLL_EXTRA } from '@/constants/theme';
import { AI_TRAINING_CACHE_KEY } from '@/utils/aiCacheKeys';
import { parseAITrainingResult, trainingWeaknessSummary } from '@/utils/parseAiStructured';

const PAGE_BG = '#0d1b11';
const CARD_BG = '#16261c';
const ACCENT = '#b5ff3a';
const TEXT_MAIN = '#ffffff';
const TEXT_SEC = '#a8b5ac';
const TEXT_TERTIARY = '#8a9a8e';
const TEXT_MUTED = '#5a6b5f';
const HERO_BORDER = 'rgba(181,255,58,0.18)';
const OUTLINE_BORDER = '#2d5436';
const GRID_GAP = 10;
const SECTION_LABEL = '#8a9a8e';
const ICON_BG = 'rgba(181, 255, 58, 0.1)';
const LIST_BORDER = 'rgba(255,255,255,0.06)';

type TrainingCache = { text: string; source: string; generatedAt: number; recordCount: number };

function IconLineChart() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Polyline
        points="4,16 9,11 14,14 20,6"
        stroke={ACCENT}
        strokeWidth={1.8}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M4 20h16" stroke={ACCENT} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

function IconClock() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 21a9 9 0 100-18 9 9 0 000 18z"
        stroke={ACCENT}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <Path d="M12 7v5l3 2" stroke={ACCENT} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function IconCheck() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 6L9 17l-5-5"
        stroke={ACCENT}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function IconDoc() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 4h7l4 4v14a1 1 0 01-1 1H7a1 1 0 01-1-1V5a1 1 0 011-1z"
        stroke={ACCENT}
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
      <Path d="M14 4v4h4M8 12h8M8 16h6" stroke={ACCENT} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

function IconChevron() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M9 6l6 6-6 6" stroke={TEXT_MUTED} strokeWidth={2} strokeLinecap="round" />
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
      if (!c?.text) {
        setHeroSummary(null);
        return;
      }
      const p = parseAITrainingResult(c.text);
      if (p.ok && p.weakness) {
        const sum = trainingWeaknessSummary(p.weakness);
        setHeroSummary(sum || null);
      } else {
        setHeroSummary(null);
      }
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
          <Text style={s.heroLab}>今日智能建议</Text>
          {heroSummary ? (
            <>
              <Text style={s.heroSum} numberOfLines={4}>
                {heroSummary}
              </Text>
              <Pressable
                style={s.heroLink}
                onPress={() => router.push('/ai-training' as Href)}
                accessibilityRole="button"
              >
                <Text style={s.heroLinkTxt}>查看完整分析 ›</Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              style={s.heroOutline}
              onPress={() => router.push('/ai-training' as Href)}
              accessibilityRole="button"
            >
              <Text style={s.heroOutlineTxt}>去生成今日建议</Text>
            </Pressable>
          )}
        </View>

        <Text style={s.sectionTitle}>分析与复盘</Text>
        <View style={s.gridRow}>
          <Pressable
            style={s.gridCell}
            onPress={() => router.push('/ai-training' as Href)}
            accessibilityRole="button"
          >
            <View style={s.iconWrap}>
              <IconLineChart />
            </View>
            <Text style={s.gridTitle}>练球分析</Text>
            <Text style={s.gridSub}>成绩驱动的短板与计划</Text>
          </Pressable>
          <Pressable
            style={s.gridCell}
            onPress={() => router.push('/handicap/history?from=ai' as Href)}
            accessibilityRole="button"
          >
            <View style={s.iconWrap}>
              <IconClock />
            </View>
            <Text style={s.gridTitle}>单场复盘</Text>
            <Text style={s.gridSub}>成绩详情内 AI 复盘</Text>
          </Pressable>
        </View>

        <Text style={[s.sectionTitle, s.sectionSp]}>赛前准备</Text>
        <View style={s.gridRow}>
          <Pressable
            style={s.gridCell}
            onPress={() => router.push('/course-strategy' as Href)}
            accessibilityRole="button"
          >
            <View style={s.iconWrap}>
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
            <View style={s.iconWrap}>
              <IconDoc />
            </View>
            <Text style={s.gridTitle}>赛前简报</Text>
            <Text style={s.gridSub}>比赛页打开简报</Text>
          </Pressable>
        </View>

        <Text style={[s.sectionTitle, s.sectionSp]}>更多工具</Text>
        <View style={s.listCard}>
          <Pressable
            style={[s.listRow, s.listRowBorder]}
            onPress={() => router.push('/training' as Href)}
            accessibilityRole="button"
          >
            <Text style={s.listTitle}>训练计划与打卡</Text>
            <IconChevron />
          </Pressable>
          <Pressable
            style={s.listRow}
            onPress={() => router.push('/ai-advisor' as Href)}
            accessibilityRole="button"
          >
            <Text style={s.listTitle}>AI 配杆顾问</Text>
            <IconChevron />
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
    padding: 18,
    marginBottom: 20,
  },
  heroLab: {
    fontSize: 12,
    fontWeight: '700',
    color: TEXT_TERTIARY,
    marginBottom: 10,
  },
  heroSum: { fontSize: 14, fontWeight: '500', color: TEXT_SEC, lineHeight: 22, marginBottom: 12 },
  heroLink: { alignSelf: 'flex-start' },
  heroLinkTxt: { fontSize: 13, fontWeight: '700', color: ACCENT },
  heroOutline: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: OUTLINE_BORDER,
  },
  heroOutlineTxt: { fontSize: 13, fontWeight: '700', color: ACCENT },
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
    borderRadius: 14,
    borderWidth: 1,
    borderColor: LIST_BORDER,
    padding: 14,
    minHeight: 112,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: ICON_BG,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  gridTitle: { fontSize: 15, fontWeight: '700', color: TEXT_MAIN, marginBottom: 4 },
  gridSub: { fontSize: 11, fontWeight: '500', color: TEXT_TERTIARY, lineHeight: 16 },
  listCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LIST_BORDER,
    overflow: 'hidden',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  listRowBorder: { borderBottomWidth: 1, borderBottomColor: LIST_BORDER },
  listTitle: { fontSize: 15, fontWeight: '700', color: TEXT_MAIN },
});
