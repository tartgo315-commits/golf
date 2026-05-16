import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { type Href, router } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { loadUserProfile } from '@/lib/app-storage';
import {
  equivalent18FromGrossAndHoles,
  HANDICAP_RECORDS_KEY,
  type HandicapRecord,
} from '@/lib/handicap';
import { parseJsonArray } from '@/lib/local-storage';
import { AI_TRAINING_CACHE_KEY } from '@/utils/aiCacheKeys';
import { callAI } from '@/utils/callAI';
import { parseAITrainingResult, type ParsedTraining } from '@/utils/parseAiStructured';

import { STACK_SCREEN_TOP_PADDING, THEME } from '@/constants/theme';

const BG = THEME.bg;
const CARD = THEME.card;
const ACCENT = THEME.accent;
const BACK_TXT = THEME.text3;
const TITLE = THEME.text1;
const SUB = THEME.text3;
const BODY = THEME.text2;
const KEY_CLUB_TXT = THEME.text1;
const SKELETON = THEME.trackMuted;
const ERR_BG = 'rgba(255,255,255,0.05)';
const ERR_BORDER = 'rgba(255,100,100,0.3)';
const ERR_TXT = '#ff8080';
const WEAK_BORDER = '#d94848';
const PRAC_BORDER = '#e89b3a';
const PLAN_BORDER = '#3ac5a8';
const CLUB_BG = THEME.accentBg;
const CLUB_BORDER = THEME.accent;

type TrainingCache = {
  text: string;
  source: string;
  generatedAt: number;
  recordCount: number;
};

function makeEmptyParsed(): ParsedTraining {
  return { weakness: '', practice: '', weeklyPlan: '', keyClub: '', ok: false };
}

export default function AITrainingScreen() {
  const [rawText, setRawText] = useState('');
  const [parsed, setParsed] = useState<ParsedTraining>(makeEmptyParsed);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasData, setHasData] = useState(true);

  const runAnalysis = useCallback(async (forceRefresh: boolean) => {
    setError('');
    if (forceRefresh) {
      await AsyncStorage.removeItem(AI_TRAINING_CACHE_KEY);
    }

    const rawRecords = await AsyncStorage.getItem(HANDICAP_RECORDS_KEY);
    const records = parseJsonArray<HandicapRecord>(rawRecords);
    const recordCount = records.length;

    if (recordCount === 0) {
      await AsyncStorage.removeItem(AI_TRAINING_CACHE_KEY);
      setHasData(false);
      setRawText('');
      setParsed(makeEmptyParsed());
      setLoading(false);
      return;
    }
    setHasData(true);

    if (!forceRefresh) {
      try {
        const cachedRaw = await AsyncStorage.getItem(AI_TRAINING_CACHE_KEY);
        if (cachedRaw) {
          const c = JSON.parse(cachedRaw) as TrainingCache;
          if (
            c &&
            typeof c.text === 'string' &&
            typeof c.recordCount === 'number' &&
            c.recordCount === recordCount &&
            c.text.length > 0
          ) {
            setRawText(c.text);
            setParsed(parseAITrainingResult(c.text));
            setLoading(false);
            return;
          }
        }
      } catch {
        /* continue to API */
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
      const bestScore = Math.min(
        ...recent.map((r: HandicapRecord) => {
          const holes = r.holes === 9 ? 9 : 18;
          return equivalent18FromGrossAndHoles(Number(r.adjustedGrossScore), holes);
        }),
      );

      const clubRaw = await AsyncStorage.getItem('savedClubs');
      const clubs = clubRaw ? (JSON.parse(clubRaw) as unknown[]) : [];
      const clubList =
        clubs.map((c: unknown) => (typeof c === 'object' && c && 'name' in c ? (c as { name?: string }).name : String(c))).join('、') ||
        '暂无球杆库数据';

      const profile = await loadUserProfile();
      const profileText = `身高${profile.height ?? '--'}cm，体重${profile.weight ?? '--'}kg，挥速${profile.driverSpeed ?? '--'}mph`;

      const prompt = `你是一位专业高尔夫教练，请用中文回答，语言简洁实用。

以下是我的数据：
- 近${recent.length}场均杆：${avgScore}杆，最佳${bestScore}杆
- 平均推杆：${avgPutts}次（18洞）
- 平均GIR（果岭命中率）：${avgGir}%
- 平均球道命中率：${avgFw}%
- 球杆库：${clubList}
- 个人档案：${profileText}

请给出（结合以上数据）：
1. 主要短板分析（最多3项，说明数据依据）
2. 重点练习方向（每项配具体动作要点）
3. 每周练球计划（频率、时间、各项分配）
4. 最需要重点练习的一支球杆及理由

请严格按以下格式输出，每个标题单独一行，内容跟在后面：
【主要短板】
（内容）
【重点练习】
（内容）
【每周计划】
（内容）
【重点球杆】
（内容）`;

      const { text, source } = await callAI(prompt);
      setRawText(text);
      setParsed(parseAITrainingResult(text));
      const payload: TrainingCache = {
        text,
        source,
        generatedAt: Date.now(),
        recordCount,
      };
      await AsyncStorage.setItem(AI_TRAINING_CACHE_KEY, JSON.stringify(payload));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '分析失败，请检查网络';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void runAnalysis(false);
    }, [runAnalysis]),
  );

  const onReanalyze = useCallback(() => {
    void runAnalysis(true);
  }, [runAnalysis]);

  return (
    <View style={s.root}>
      <View style={s.header}>
        <View style={s.headerSide}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Text style={s.backTxt}>‹ 返回</Text>
          </Pressable>
        </View>
        <Text style={s.headerTitle}>练球分析</Text>
        <View style={[s.headerSide, s.headerSideRight]}>
          <Pressable onPress={onReanalyze} hitSlop={12} disabled={loading || !hasData}>
            <Text style={[s.reTopTxt, (loading || !hasData) && s.reTopTxtDisabled]}>重新分析</Text>
          </Pressable>
        </View>
      </View>

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
            <Text style={s.errorIcon}>⚠️</Text>
            <Text style={s.errorTitle}>
              {error.includes('Key') || error.includes('配置') || error.includes('403')
                ? '未配置 AI Key'
                : '分析失败'}
            </Text>
            <Text style={s.errorText}>{error}</Text>
            {(error.includes('Key') || error.includes('配置') || error.includes('403')) && (
              <Pressable
                style={s.errorBtn}
                onPress={() => router.push('/settings' as Href)}
                hitSlop={8}
              >
                <Text style={s.errorBtnTxt}>前往设置 → 配置 API Key</Text>
              </Pressable>
            )}
          </View>
        )}

        {!loading && hasData && rawText !== '' && parsed.ok && (
          <View style={s.cardsCol}>
            <View style={[s.card, { borderLeftColor: WEAK_BORDER }]}>
              <Text style={[s.cardTag, { color: WEAK_BORDER }]}>主要短板</Text>
              <Text style={s.cardBody}>{parsed.weakness}</Text>
            </View>
            <View style={[s.card, { borderLeftColor: PRAC_BORDER }]}>
              <Text style={[s.cardTag, { color: PRAC_BORDER }]}>重点练习</Text>
              <Text style={s.cardBody}>{parsed.practice}</Text>
            </View>
            <View style={[s.card, { borderLeftColor: PLAN_BORDER }]}>
              <Text style={[s.cardTag, { color: PLAN_BORDER }]}>每周计划</Text>
              <Text style={s.cardBody}>{parsed.weeklyPlan}</Text>
            </View>
            <View style={[s.card, s.cardClub]}>
              <Text style={[s.cardTag, { color: ACCENT }]}>重点球杆</Text>
              <Text style={s.cardClubBody}>{parsed.keyClub}</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: STACK_SCREEN_TOP_PADDING,
    paddingBottom: 12,
  },
  headerSide: { width: 76, justifyContent: 'center' },
  headerSideRight: { alignItems: 'flex-end' },
  backTxt: { fontSize: 16, color: BACK_TXT, fontWeight: '600' },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    color: TITLE,
    textAlign: 'center',
  },
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
    padding: 24,
    marginBottom: 16,
    alignItems: 'center',
  },
  errorIcon: { fontSize: 36, marginBottom: 12 },
  errorTitle: { color: ERR_TXT, fontSize: 16, fontWeight: '700', marginBottom: 6 },
  errorText: { color: ERR_TXT, fontSize: 12, textAlign: 'center', lineHeight: 18, marginBottom: 16 },
  errorBtn: { backgroundColor: ACCENT, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 20 },
  errorBtnTxt: { color: '#07120b', fontSize: 13, fontWeight: '700' },
  cardsCol: { gap: 12 },
  card: {
    backgroundColor: CARD,
    borderRadius: 12,
    borderLeftWidth: 3,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  cardClub: {
    backgroundColor: CLUB_BG,
    borderLeftColor: CLUB_BORDER,
  },
  cardTag: { fontSize: 11, fontWeight: '700', marginBottom: 8 },
  cardBody: { fontSize: 13, fontWeight: '500', color: BODY, lineHeight: 1.8 * 13 },
  cardClubBody: { fontSize: 14, fontWeight: '800', color: KEY_CLUB_TXT, lineHeight: 22 },
  fallbackBox: {
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 16,
  },
  fallbackText: { fontSize: 13, color: BODY, lineHeight: 22 },
});
