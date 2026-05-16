import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { GOLF } from '@/constants/golfTheme';
import { STACK_SCREEN_TOP_PADDING } from '@/constants/theme';
import { getRoundBundle } from '@/lib/scorecardApi';
import { callAI } from '@/utils/callAI';

// 缓存 key 格式：round_review:{roundId}
function cacheKey(roundId: string) {
  return `round_review:${roundId}`;
}

function buildReviewPrompt(bundle: any): string {
  const round = bundle.round;
  const scores = bundle.scores ?? [];
  const players = bundle.players ?? [];
  const holes = round.holes === 9 ? 9 : 18;

  // 为每位球员汇总数据
  const playerSummaries = players.map((p: any) => {
    const myScores = scores.filter((s: any) => s.user_id === p.userId);
    const total = myScores.reduce((a: number, s: any) => a + (s.strokes || 0), 0);
    const totalPar = myScores.reduce((a: number, s: any) => a + (s.par || 4), 0);
    const totalPutts = myScores.reduce((a: number, s: any) => a + (s.putts || 0), 0);
    const girCount = myScores.filter((s: any) => s.gir === true).length;
    const firCount = myScores.filter((s: any) => s.fir === 'hit').length;
    const par45 = myScores.filter((s: any) => (s.par || 4) >= 4).length;
    const penalties = myScores.filter((s: any) => s.penalty === 'water' || s.penalty === 'ob').length;

    // 最差洞（超标准杆最多）
    const worst = myScores
      .map((s: any) => ({ hole: s.hole_number, diff: (s.strokes || 0) - (s.par || 4) }))
      .sort((a: any, b: any) => b.diff - a.diff)
      .slice(0, 3);

    return `${p.username}：总杆 ${total}（${total - totalPar >= 0 ? '+' : ''}${total - totalPar}）
  推杆 ${totalPutts}，GIR ${girCount}/${holes}（${Math.round((girCount / holes) * 100)}%）
  FIR ${firCount}/${par45}（${par45 > 0 ? Math.round((firCount / par45) * 100) : 0}%）
  罚杆 ${penalties} 次
  失分洞：${worst.map((w: any) => `第${w.hole}洞(+${w.diff})`).join('、') || '无'}`;
  });

  return `你是一位专业高尔夫教练，请根据以下单场成绩数据进行复盘分析，用中文回答，语气直接专业。

【本场信息】
球场：${round.course_name || '未知球场'}
日期：${round.played_at}
洞数：${holes}洞  发球台：${round.tee_color || '蓝'}

【成绩数据】
${playerSummaries.join('\n\n')}

请给出（针对以上数据）：
1. 本场整体表现评价（结合数据说明优劣）
2. 主要失分原因分析（推杆/果岭/开球/罚杆，说明数据依据）
3. 最值得关注的3个改进点
4. 下次下场的1个核心执行建议

请严格按以下格式输出：
【整体评价】
（内容）
【失分分析】
（内容）
【改进重点】
（内容）
【下场建议】
（内容）`;
}

type ParsedReview = {
  overall: string;
  weakness: string;
  improvements: string;
  nextRound: string;
  ok: boolean;
};

function parseReview(text: string): ParsedReview {
  const get = (tag: string) => {
    const re = new RegExp(`【${tag}】\\s*([\\s\\S]*?)(?=【|$)`);
    return text.match(re)?.[1]?.trim() ?? '';
  };
  const overall = get('整体评价');
  const weakness = get('失分分析');
  const improvements = get('改进重点');
  const nextRound = get('下场建议');
  return {
    overall,
    weakness,
    improvements,
    nextRound,
    ok: !!(overall && weakness && improvements && nextRound),
  };
}

export default function RoundReviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const roundId = String(params.id ?? '');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [parsed, setParsed] = useState<ParsedReview | null>(null);
  const [rawText, setRawText] = useState('');

  async function run(forceRefresh = false) {
    setError('');
    setLoading(true);
    try {
      if (!forceRefresh) {
        const cached = await AsyncStorage.getItem(cacheKey(roundId));
        if (cached) {
          const c = JSON.parse(cached);
          if (c?.text) {
            setRawText(c.text);
            setParsed(parseReview(c.text));
            setLoading(false);
            return;
          }
        }
      }
      const bundle = await getRoundBundle(roundId);
      const prompt = buildReviewPrompt(bundle);
      const { text } = await callAI(prompt);
      setRawText(text);
      setParsed(parseReview(text));
      await AsyncStorage.setItem(cacheKey(roundId), JSON.stringify({ text, generatedAt: Date.now() }));
    } catch (e: any) {
      setError(e?.message || '分析失败，请检查网络');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void run();
  }, [roundId]);

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={s.back}>‹ 返回</Text>
        </Pressable>
        <Text style={s.title}>AI 单场复盘</Text>
        <Pressable onPress={() => void run(true)} hitSlop={12} disabled={loading}>
          <Text style={[s.refresh, loading && { opacity: 0.35 }]}>重新分析</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        {loading ? (
          <View style={s.center}>
            <ActivityIndicator color={GOLF.accent} />
            <Text style={s.hint}>AI 复盘分析中…</Text>
          </View>
        ) : null}

        {!loading && error !== '' ? (
          <View style={s.errorBox}>
            <Text style={s.errorTxt}>⚠️ {error}</Text>
            <Pressable style={s.retryBtn} onPress={() => void run(true)}>
              <Text style={s.retryTxt}>重试</Text>
            </Pressable>
          </View>
        ) : null}

        {!loading && parsed?.ok ? (
          <View style={s.cards}>
            {(
              [
                { tag: '整体评价', text: parsed.overall, color: GOLF.accent },
                { tag: '失分分析', text: parsed.weakness, color: '#f87171' },
                { tag: '改进重点', text: parsed.improvements, color: '#f59e0b' },
                { tag: '下场建议', text: parsed.nextRound, color: '#60a5fa' },
              ] as const
            ).map(({ tag, text, color }) => (
              <View key={tag} style={[s.card, { borderLeftColor: color }]}>
                <Text style={[s.cardTag, { color }]}>{tag}</Text>
                <Text style={s.cardBody}>{text}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {!loading && !parsed?.ok && rawText !== '' ? (
          <View style={s.fallback}>
            <Text style={s.fallbackTxt}>{rawText}</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: GOLF.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: STACK_SCREEN_TOP_PADDING,
    paddingBottom: 12,
  },
  back: { color: GOLF.accent, fontSize: 16, fontWeight: '800' },
  title: { color: GOLF.text, fontSize: 18, fontWeight: '900' },
  refresh: { color: GOLF.accent, fontSize: 12, fontWeight: '600' },
  scroll: { padding: 16, paddingBottom: 40 },
  center: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  hint: { color: GOLF.muted, fontSize: 13 },
  errorBox: {
    backgroundColor: 'rgba(248,113,113,0.1)',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.3)',
    alignItems: 'center',
    gap: 12,
  },
  errorTxt: { color: '#f87171', fontSize: 13, textAlign: 'center' },
  retryBtn: {
    borderWidth: 1,
    borderColor: GOLF.accent,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  retryTxt: { color: GOLF.accent, fontWeight: '800' },
  cards: { gap: 12 },
  card: {
    backgroundColor: GOLF.bgCard,
    borderRadius: 12,
    borderLeftWidth: 3,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  cardTag: { fontSize: 11, fontWeight: '700', marginBottom: 8 },
  cardBody: { fontSize: 13, fontWeight: '500', color: GOLF.text, lineHeight: 22 },
  fallback: { backgroundColor: GOLF.bgCard, borderRadius: 12, padding: 16 },
  fallbackTxt: { fontSize: 13, color: GOLF.text, lineHeight: 22 },
});
