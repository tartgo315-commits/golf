import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { useLayoutEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { GOLF } from '@/constants/golfTheme';
import { USER_PROFILE_KEY, type StoredUserProfile } from '@/lib/app-storage';
import { writeJson } from '@/lib/local-storage';
import { readJson } from '@/lib/local-storage';
import { normalizeClubTypeParam } from '@/lib/quiz-routing';

const QUIZ_PAYLOAD_KEY = 'last_quiz';
const WHITE = '#ffffff';
const BG = '#f3f4f6';
const BORDER = '#e5e7eb';
const OPTION_BORDER = '#d5ddd7';
const OPTION_BG = '#fafcfb';
const TEXT_TITLE = '#14261c';
const TEXT_SUBTITLE = '#4a5d52';
const TEXT_BODY = '#333333';
const TEXT_MUTED = '#666666';
const TEXT_SELECTED = '#1b5e20';
const SELECTED_BG = 'rgba(46, 125, 50, 0.12)';
const CTA_TEXT = '#ffffff';

type QuizType = 'driver' | 'iron' | 'fairway' | 'wedge' | 'putter';
type Question = { id: string; title: string; options: { id: string; label: string }[] };

const QUIZ_BANK: Record<QuizType, Question[]> = {
  driver: [
    { id: 'd1', title: '你的一号木最常见失误？', options: [{ id: 'right', label: '右曲' }, { id: 'left', label: '左曲' }, { id: 'thin', label: '打薄' }, { id: 'top', label: '打厚' }] },
    { id: 'd2', title: '你目前弹道高度？', options: [{ id: 'high', label: '偏高' }, { id: 'mid', label: '中等' }, { id: 'low', label: '偏低' }, { id: 'unstable', label: '不稳定' }] },
    { id: 'd3', title: '你更看重什么？', options: [{ id: 'forgiving', label: '容错' }, { id: 'distance', label: '距离' }, { id: 'control', label: '操控' }, { id: 'feel', label: '手感' }] },
    { id: 'd4', title: '你对杆身手感偏好？', options: [{ id: 'soft', label: '更顺滑' }, { id: 'neutral', label: '中性' }, { id: 'firm', label: '更扎实' }, { id: 'none', label: '无所谓' }] },
  ],
  iron: [
    { id: 'i1', title: '你铁杆纯击球（打甜）的频率？', options: [{ id: 'rare', label: '很少' }, { id: 'sometimes', label: '偶尔' }, { id: 'often', label: '经常' }, { id: 'stable', label: '非常稳定' }] },
    { id: 'i2', title: '站位时你更喜欢的杆头顶线？', options: [{ id: 'thick', label: '较厚偏易打' }, { id: 'mid', label: '中等' }, { id: 'thin', label: '薄接近刀背' }, { id: 'any', label: '无所谓' }] },
    { id: 'i3', title: '铁杆最常见的失误？', options: [{ id: 'right', label: '右曲' }, { id: 'left', label: '左曲' }, { id: 'thin', label: '打薄' }, { id: 'fat', label: '打厚' }] },
    { id: 'i4', title: '你最希望新铁杆带来什么？', options: [{ id: 'forgiving', label: '更宽容' }, { id: 'farther', label: '更远' }, { id: 'accurate', label: '更准' }, { id: 'feel', label: '更好手感' }] },
  ],
  fairway: [
    { id: 'f1', title: '你球道木主要从哪里打？', options: [{ id: 'fairway', label: '球道草地' }, { id: 'rough', label: '粗草区' }, { id: 'tee', label: '发球台' }, { id: 'all', label: '都有' }] },
    { id: 'f2', title: '典型弹道？', options: [{ id: 'high', label: '偏高' }, { id: 'low', label: '偏低' }, { id: 'mid', label: '中等' }, { id: 'unstable', label: '不稳定' }] },
    { id: 'f3', title: '最常见失误？', options: [{ id: 'right', label: '右曲' }, { id: 'left', label: '左曲' }, { id: 'thin', label: '打薄' }, { id: 'short', label: '距离不足' }] },
    { id: 'f4', title: '最希望改善？', options: [{ id: 'launch', label: '起飞容易' }, { id: 'distance', label: '距离更远' }, { id: 'stable', label: '弹道更稳' }, { id: 'spin', label: '侧旋更少' }] },
  ],
  wedge: [
    { id: 'w1', title: '主要用在什么距离？', options: [{ id: '100', label: '100码内' }, { id: '80', label: '80码内' }, { id: '60', label: '60码内' }, { id: 'sand', label: '沙坑专用' }] },
    { id: 'w2', title: '你的果岭周围短打？', options: [{ id: 'confident', label: '很自信' }, { id: 'normal', label: '一般' }, { id: 'unstable', label: '不稳定' }, { id: 'need', label: '需要改善' }] },
    { id: 'w3', title: '最常用杆面角？', options: [{ id: '52', label: '52°' }, { id: '56', label: '56°' }, { id: '60', label: '60°' }, { id: 'unknown', label: '不确定' }] },
    { id: 'w4', title: '最希望改善？', options: [{ id: 'distance', label: '距离控制' }, { id: 'spin', label: '旋转量' }, { id: 'sand', label: '沙坑表现' }, { id: 'consistency', label: '整体一致性' }] },
  ],
  putter: [
    { id: 'p1', title: '你的推击弧线？', options: [{ id: 'straight', label: '直线型' }, { id: 'arc-light', label: '轻微弧线' }, { id: 'arc-big', label: '明显弧线' }, { id: 'unknown', label: '不确定' }] },
    { id: 'p2', title: '常见失误？', options: [{ id: 'short', label: '推短' }, { id: 'long', label: '推长' }, { id: 'left', label: '偏左' }, { id: 'right', label: '偏右' }] },
    { id: 'p3', title: '偏好杆头形状？', options: [{ id: 'blade', label: '刀背型' }, { id: 'mallet', label: '大型槌头' }, { id: 'mid-mallet', label: '小型槌头' }, { id: 'any', label: '无所谓' }] },
    { id: 'p4', title: '最希望改善？', options: [{ id: 'distance', label: '距离感' }, { id: 'line', label: '方向感' }, { id: 'long', label: '长推' }, { id: 'short', label: '短推' }] },
  ],
};

const TITLE_BY_TYPE: Record<QuizType, string> = {
  driver: '一号木问卷',
  iron: '铁杆问卷',
  fairway: '球道木问卷',
  wedge: '挖起杆问卷',
  putter: '推杆问卷',
};

export default function QuizByTypeScreen() {
  const navigation = useNavigation();
  const { type: rawType } = useLocalSearchParams<{ type: string }>();
  const router = useRouter();
  const category = normalizeClubTypeParam(rawType) as QuizType | null;
  const questions = category ? QUIZ_BANK[category] : [];
  const profile = useMemo(
    () => readJson<StoredUserProfile | null>(USER_PROFILE_KEY, null),
    [],
  );
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: category ? TITLE_BY_TYPE[category] : '问卷' });
  }, [category, navigation]);

  function selectOption(questionId: string, optionId: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  }

  async function onGetRecommendation() {
    if (!category || !questions.every((q) => Boolean(answers[q.id]))) return;
    setBusy(true);
    try {
      writeJson(QUIZ_PAYLOAD_KEY, { category, answers });
      router.push({
        pathname: '/result/[type]',
        params: { type: rawType ?? category, answers: encodeURIComponent(JSON.stringify(answers)) },
      });
    } finally {
      setBusy(false);
    }
  }

  if (!category) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>未知球杆类型</Text>
        <Text style={styles.muted}>请从首页重新进入问卷。</Text>
      </View>
    );
  }

  const complete = questions.every((q) => Boolean(answers[q.id]));

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
      <Pressable onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backTxt}>← 返回</Text>
      </Pressable>
      <Text style={styles.kicker}>问卷评估</Text>
      <Text style={styles.title}>{TITLE_BY_TYPE[category]}</Text>
      <Text style={styles.subtitle}>共 {questions.length} 题，完成后获取推荐结果</Text>
      {profile ? (
        <View style={styles.profileHint}>
          <Text style={styles.profileHintText}>
            基于你的档案：挥速 {profile.swingSpeedMph || '—'}mph · 差点 {profile.handicap || '—'} · 身高 {profile.heightCm || '—'}cm
          </Text>
        </View>
      ) : null}

      {questions.map((q) => (
        <View key={q.id} style={styles.card}>
          <Text style={styles.question}>{q.title}</Text>
          {q.options.map((opt) => {
            const selected = answers[q.id] === opt.id;
            return (
              <Pressable
                key={opt.id}
                onPress={() => selectOption(q.id, opt.id)}
                style={[styles.option, selected && styles.optionOn]}>
                <Text style={[styles.optionText, selected && styles.optionTextOn]}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}

      <Pressable
        style={[styles.cta, (!complete || busy) && styles.ctaDisabled]}
        onPress={onGetRecommendation}
        disabled={!complete || busy}>
        <Text style={styles.ctaText}>获取推荐</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: BG },
  scroll: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  muted: { color: TEXT_MUTED, textAlign: 'center' },
  backBtn: { marginBottom: 8, alignSelf: 'flex-start' },
  backTxt: { color: GOLF.accentDark, fontWeight: '600' },
  kicker: {
    fontSize: 13,
    fontWeight: '700',
    color: GOLF.accentDark,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  title: { fontSize: 24, fontWeight: '800', color: TEXT_TITLE, marginBottom: 6 },
  subtitle: { fontSize: 15, color: TEXT_SUBTITLE, marginBottom: 20, lineHeight: 22 },
  profileHint: {
    backgroundColor: '#dcfce7',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  profileHintText: { fontSize: 12, color: '#166534' },
  card: {
    backgroundColor: WHITE,
    borderRadius: 14,
    padding: 16,
    marginBottom: 8,
    borderWidth: 0.5,
    borderColor: BORDER,
  },
  question: { fontSize: 17, fontWeight: '700', color: TEXT_TITLE, marginBottom: 12 },
  option: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: OPTION_BORDER,
    marginBottom: 8,
    backgroundColor: OPTION_BG,
  },
  optionOn: {
    borderColor: GOLF.accentDark,
    backgroundColor: SELECTED_BG,
  },
  optionText: { fontSize: 15, color: TEXT_BODY },
  optionTextOn: { fontWeight: '700', color: TEXT_SELECTED },
  cta: {
    marginTop: 8,
    backgroundColor: GOLF.accentDark,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  ctaDisabled: { opacity: 0.45 },
  ctaText: { color: CTA_TEXT, fontSize: 17, fontWeight: '700' },
});
