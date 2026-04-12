import { useNavigation, useRouter } from 'expo-router';
import { useLayoutEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DARK_PAGE } from '@/constants/theme';
import { USER_PROFILE_KEY, type StoredUserProfile } from '@/lib/app-storage';
import { readJson, writeJson } from '@/lib/local-storage';

import type { Question, QuizType } from './quiz-data';

const QUIZ_PAYLOAD_KEY = 'last_quiz';
const BG = DARK_PAGE.bg;
const BORDER = DARK_PAGE.cardBorder;
const OPTION_BORDER = DARK_PAGE.inputBorder;
const OPTION_BG = DARK_PAGE.inputBg;
const TEXT_TITLE = DARK_PAGE.text;
const TEXT_SUBTITLE = DARK_PAGE.textSecondary;
const TEXT_BODY = DARK_PAGE.text;
const TEXT_MUTED = DARK_PAGE.textMuted;
const TEXT_SELECTED = DARK_PAGE.accent;
const SELECTED_BG = DARK_PAGE.chipBg;
const CTA_TEXT = DARK_PAGE.onAccent;

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
  backTxt: { color: DARK_PAGE.textSecondary, fontWeight: '600' },
  kicker: {
    fontSize: 13,
    fontWeight: '700',
    color: DARK_PAGE.accent,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  title: { fontSize: 24, fontWeight: '800', color: TEXT_TITLE, marginBottom: 6 },
  subtitle: { fontSize: 15, color: TEXT_SUBTITLE, marginBottom: 20, lineHeight: 22 },
  profileHint: {
    backgroundColor: DARK_PAGE.chipBg,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: DARK_PAGE.cardBorder,
  },
  profileHintText: { fontSize: 12, color: DARK_PAGE.accent },
  card: {
    backgroundColor: DARK_PAGE.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
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
    borderColor: DARK_PAGE.accent,
    backgroundColor: SELECTED_BG,
  },
  optionText: { fontSize: 15, color: TEXT_BODY },
  optionTextOn: { fontWeight: '700', color: TEXT_SELECTED },
  cta: {
    marginTop: 8,
    backgroundColor: DARK_PAGE.accent,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  ctaDisabled: { opacity: 0.45 },
  ctaText: { color: CTA_TEXT, fontSize: 17, fontWeight: '700' },
  muted: { color: TEXT_MUTED, textAlign: 'center' },
});
