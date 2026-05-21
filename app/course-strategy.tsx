import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ScreenHeader } from '@/components/ScreenHeader';
import {
  equivalent18FromGrossAndHoles,
  HANDICAP_RECORDS_KEY,
  type HandicapRecord,
} from '@/lib/handicap';
import { parseJsonArray } from '@/lib/local-storage';
import { AI_STRATEGY_CACHE_KEY } from '@/utils/aiCacheKeys';
import { callAI } from '@/utils/callAI';
import { parseAIStrategyResult, type ParsedStrategy } from '@/utils/parseAiStructured';
import { THEME } from '@/constants/theme';

const BG = THEME.bg;
const CARD = THEME.card;
const ACCENT = THEME.accent;
const BACK_TXT = THEME.text3;
const TITLE = THEME.text1;
const SUB = THEME.text3;
const BODY = THEME.text2;
const BORDER_HERO = THEME.accentBorder;
const MANTRA_BG = THEME.accentBg;
const QUOTE = '#2d5436';
const SKELETON = 'rgba(255,255,255,0.06)';
const ERR_BG = 'rgba(255,80,80,0.1)';
const ERR_BORDER = 'rgba(255,80,80,0.3)';
const ERR_TXT = '#ff8080';

const GOAL_BORDER = '#b5ff3a';
const AVOID_BORDER = '#e89b3a';
const STR_BORDER = '#3ac5a8';
const RHYTHM_BORDER = '#8a9a8e';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type StrategyCache = {
  text: string;
  source: string;
  generatedAt: number;
  recordCount: number;
};

function makeEmptyParsed(): ParsedStrategy {
  return { goal: '', avoid: '', strength: '', rhythm: '', mantra: '', ok: false };
}

function cacheValid(c: StrategyCache, recordCount: number): boolean {
  if (!c?.text || typeof c.recordCount !== 'number' || typeof c.generatedAt !== 'number') {
    return false;
  }
  if (c.recordCount !== recordCount) return false;
  if (Date.now() - c.generatedAt > CACHE_TTL_MS) return false;
  return true;
}

export default function CourseStrategyScreen() {
  const [rawText, setRawText] = useState('');
  const [parsed, setParsed] = useState<ParsedStrategy>(makeEmptyParsed);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasData, setHasData] = useState(true);

  const runStrategy = useCallback(async (forceRefresh: boolean) => {
    setError('');
    if (forceRefresh) {
      await AsyncStorage.removeItem(AI_STRATEGY_CACHE_KEY);
    }

    const rawRecords = await AsyncStorage.getItem(HANDICAP_RECORDS_KEY);
    const records = parseJsonArray<HandicapRecord>(rawRecords);
    const recordCount = records.length;

    if (recordCount === 0) {
      await AsyncStorage.removeItem(AI_STRATEGY_CACHE_KEY);
      setHasData(false);
      setRawText('');
      setParsed(makeEmptyParsed());
      setLoading(false);
      return;
    }
    setHasData(true);

    if (!forceRefresh) {
      try {
        const cachedRaw = await AsyncStorage.getItem(AI_STRATEGY_CACHE_KEY);
        if (cachedRaw) {
          const c = JSON.parse(cachedRaw) as StrategyCache;
          if (cacheValid(c, recordCount)) {
            setRawText(c.text);
            setParsed(parseAIStrategyResult(c.text));
            setLoading(false);
            return;
          }
        }
      } catch {
        /* continue */
      }
    }

    setLoading(true);
    setRawText('');
    setParsed(makeEmptyParsed());

    try {
      const recent = records
        .sort((a: HandicapRecord, b: HandicapRecord) => {
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        })
        .slice(0, 20);

      const avgScore = Math.round(
        recent.reduce((s: number, r: HandicapRecord) => {
          const holes = r.holes === 9 ? 9 : 18;
          return s + equivalent18FromGrossAndHoles(Number(r.adjustedGrossScore), holes);
        }, 0) / recent.length,
      );
      const avgPutts = Math.round(
        recent
          .filter((r: HandicapRecord) => r.holes === 18)
          .reduce((s: number, r: HandicapRecord) => s + (r.totalPutts ?? 0), 0) /
          (recent.filter((r: HandicapRecord) => r.holes === 18).length || 1),
      );
      const girRounds = recent.filter(
        (r: HandicapRecord) => r.greensInRegulation != null && r.holes,
      );
      const avgGir = girRounds.length
        ? Math.round(
            girRounds.reduce(
              (s: number, r: HandicapRecord) => s + ((r.greensInRegulation ?? 0) / r.holes) * 100,
              0,
            ) / girRounds.length,
          )
        : 0;
      const fwRounds = recent.filter(
        (r: HandicapRecord) =>
          r.fairwaysTotal != null &&
          r.fairwaysTotal > 0 &&
          r.fairwaysHit != null &&
          Number.isFinite(r.fairwaysHit),
      );
      const avgFw = fwRounds.length
        ? Math.round(
            fwRounds.reduce(
              (s: number, r: HandicapRecord) =>
                s + ((r.fairwaysHit as number) / (r.fairwaysTotal as number)) * 100,
              0,
            ) / fwRounds.length,
          )
        : 0;
      const lastRound = recent[0];

      const prompt = `你是一位专业高尔夫赛前策略教练，请用中文回答，语言简洁实用，像教练赛前面授一样。

以下是我的数据：
- 近${recent.length}场均杆：${avgScore}杆
- 平均推杆：${avgPutts}次（18洞）
- 平均GIR：${avgGir}%
- 平均球道命中率：${avgFw}%
- 最近一场：${lastRound?.courseName || '--'}，${lastRound?.adjustedGrossScore || '--'}杆

请给出我下一场比赛的策略预案：
1. 本场核心目标（结合当前水平，定一个合理目标）
2. 短板规避策略（针对弱项，场上具体怎么打）
3. 优势发挥方案（强项如何最大化利用）
4. 心态与节奏管理（关键时刻怎么处理）
5. 一句话核心口诀（简短有力，下场时随时提醒自己，不超过20字）

请严格按以下格式输出：
【本场目标】
（内容）
【短板规避】
（内容）
【优势发挥】
（内容）
【心态节奏】
（内容）
【核心口诀】
（一句话，不超过20字）`;

      const { text, source } = await callAI(prompt);
      setRawText(text);
      setParsed(parseAIStrategyResult(text));
      const payload: StrategyCache = {
        text,
        source,
        generatedAt: Date.now(),
        recordCount,
      };
      await AsyncStorage.setItem(AI_STRATEGY_CACHE_KEY, JSON.stringify(payload));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '分析失败，请检查网络';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void runStrategy(false);
    }, [runStrategy]),
  );

  const onRegenerate = useCallback(() => {
    void runStrategy(true);
  }, [runStrategy]);

  return (
    <View style={s.root}>
      <ScreenHeader
        variant="stack"
        layout="toolbar"
        title="下场策略"
        onBack={() => router.back()}
        trailing={
          <Pressable onPress={onRegenerate} hitSlop={12} disabled={loading || !hasData}>
            <Text style={[s.reTopTxt, (loading || !hasData) && s.reTopTxtDisabled]}>重新生成</Text>
          </Pressable>
        }
      />

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {loading && (
          <View style={s.skelWrap}>
            <View style={[s.skelBar, { width: '100%' }]} />
            <View style={[s.skelBar, { width: '80%' }]} />
            <View style={[s.skelBar, { width: '60%' }]} />
            <Text style={s.skelHint}>AI 分析中...</Text>
          </View>
        )}

        {!hasData && !loading && (
          <View style={s.emptyBox}>
            <Text style={s.emptyText}>请先记录至少 1 场成绩</Text>
          </View>
        )}

        {error !== '' && !loading && (
          <View style={s.errorBox}>
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        {!loading && hasData && rawText !== '' && parsed.ok && (
          <View style={s.cardsCol}>
            <View style={s.mantraCard}>
              <Text style={s.quoteDeco}>“</Text>
              <Text style={s.mantraText}>{parsed.mantra}</Text>
              <Text style={s.mantraTag}>核心口诀</Text>
            </View>
            <View style={[s.card, { borderLeftColor: GOAL_BORDER }]}>
              <Text style={[s.cardTag, { color: GOAL_BORDER }]}>本场目标</Text>
              <Text style={s.cardBody}>{parsed.goal}</Text>
            </View>
            <View style={[s.card, { borderLeftColor: AVOID_BORDER }]}>
              <Text style={[s.cardTag, { color: AVOID_BORDER }]}>短板规避</Text>
              <Text style={s.cardBody}>{parsed.avoid}</Text>
            </View>
            <View style={[s.card, { borderLeftColor: STR_BORDER }]}>
              <Text style={[s.cardTag, { color: STR_BORDER }]}>优势发挥</Text>
              <Text style={s.cardBody}>{parsed.strength}</Text>
            </View>
            <View style={[s.card, { borderLeftColor: RHYTHM_BORDER }]}>
              <Text style={[s.cardTag, { color: RHYTHM_BORDER }]}>心态节奏</Text>
              <Text style={s.cardBody}>{parsed.rhythm}</Text>
            </View>
          </View>
        )}

        {!loading && hasData && rawText !== '' && !parsed.ok && (
          <View style={s.fallbackBox}>
            <Text style={s.fallbackText}>{rawText}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  reTopTxt: { fontSize: 12, fontWeight: '600', color: ACCENT },
  reTopTxtDisabled: { opacity: 0.35 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  skelWrap: { paddingVertical: 24, gap: 10 },
  skelBar: {
    height: 12,
    borderRadius: 4,
    backgroundColor: SKELETON,
    alignSelf: 'flex-start',
  },
  skelHint: { fontSize: 12, color: SUB, marginTop: 8 },
  emptyBox: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { color: SUB, fontSize: 14 },
  errorBox: {
    backgroundColor: ERR_BG,
    borderWidth: 1,
    borderColor: ERR_BORDER,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  errorText: { color: ERR_TXT, fontSize: 13 },
  cardsCol: { gap: 12 },
  mantraCard: {
    backgroundColor: MANTRA_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER_HERO,
    padding: 18,
    alignItems: 'center',
  },
  quoteDeco: {
    fontSize: 36,
    color: QUOTE,
    lineHeight: 40,
    alignSelf: 'flex-start',
    marginBottom: -8,
  },
  mantraText: {
    fontSize: 16,
    fontWeight: '800',
    color: TITLE,
    textAlign: 'center',
    lineHeight: 24,
    width: '100%',
  },
  mantraTag: {
    fontSize: 10,
    fontWeight: '600',
    color: SUB,
    marginTop: 8,
    textAlign: 'center',
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 12,
    borderLeftWidth: 3,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  cardTag: { fontSize: 11, fontWeight: '700', marginBottom: 8 },
  cardBody: { fontSize: 13, fontWeight: '500', color: BODY, lineHeight: 1.8 * 13 },
  fallbackBox: {
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 16,
  },
  fallbackText: { fontSize: 13, color: BODY, lineHeight: 22 },
});
