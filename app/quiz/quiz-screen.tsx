import { useNavigation, useRouter } from 'expo-router';
import { useLayoutEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GOLF } from '@/constants/golfTheme';
import { USER_PROFILE_KEY, type StoredUserProfile } from '@/lib/app-storage';
import { readJson, writeJson } from '@/lib/local-storage';

import type { Question, QuizType } from './quiz-data';

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

export function QuizScreen({
  type,
  title,
  questions,
}: {
  type: QuizType;
  title: string;
  questions: Question[];
}) {
  const navigation = useNavigation();
  const router = useRouter();
  const profile = useMemo(() => readJson<StoredUserProfile | null>(USER_PROFILE_KEY, null), []);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title });
  }, [navigation, title]);

  function selectOption(questionId: string, optionId: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  }

  async function onGetRecommendation() {
    if (!questions.every((q) => Boolean(answers[q.id]))) return;
    setBusy(true);
    try {
      writeJson(QUIZ_PAYLOAD_KEY, { category: type, answers });
      router.push({
        pathname: '/result/[type]',
        params: { type, answers: encodeURIComponent(JSON.stringify(answers)) },
      });
    } finally {
      setBusy(false);
    }
  }

  const complete = questions.every((q) => Boolean(answers[q.id]));

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} bounces={false}>
      <Pressable onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backTxt}>← 返回</Text>
      </Pressable>
      <Text style={styles.kicker}>问卷评估</Text>
      <Text style={styles.title}>{title}</Text>
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
                <Text style={[styles.optionText, selected && styles.optionTextOn]}>{opt.label}</Text>
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
  scroll: { padding: 16, paddingTop: Platform.OS === 'web' ? 44 : 16, paddingBottom: 40 },
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
  muted: { color: TEXT_MUTED, textAlign: 'center' },
});
