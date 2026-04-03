import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { useLayoutEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { GOLF } from '@/constants/golfTheme';
import { isClubCategory, isQuizComplete, quizByCategory } from '@/data/golfKnowledge';

const QUIZ_PAYLOAD_KEY = '@gca_quiz_last_v1';

export default function QuizByTypeScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation();
  const { type: rawType } = useLocalSearchParams<{ type: string }>();
  const router = useRouter();
  const category = rawType && isClubCategory(rawType) ? rawType : null;
  const questions = useMemo(
    () => (category ? quizByCategory[category] : []),
    [category],
  );
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: t('fit.screens.quiz') });
  }, [navigation, t, i18n.language]);

  function selectOption(questionId: string, optionId: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  }

  async function onGetRecommendation() {
    if (!category || !isQuizComplete(category, answers)) return;
    setBusy(true);
    try {
      await AsyncStorage.setItem(
        QUIZ_PAYLOAD_KEY,
        JSON.stringify({
          category,
          answers,
        }),
      );
      router.push({ pathname: '/result/[type]', params: { type: category } });
    } finally {
      setBusy(false);
    }
  }

  if (!category) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>{t('fit.quiz.unknownTitle')}</Text>
        <Text style={styles.muted}>{t('fit.quiz.unknownBody')}</Text>
      </View>
    );
  }

  const complete = isQuizComplete(category, answers);

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
      <Text style={styles.kicker}>{t('fit.quiz.kicker')}</Text>
      <Text style={styles.title}>
        {t('fit.quiz.fittingLine', { type: t(`home.types.${category}`) })}
      </Text>
      <Text style={styles.subtitle}>
        {t('fit.quiz.subtitle', { count: questions.length })}
      </Text>

      {questions.map((q) => (
        <View key={q.id} style={styles.card}>
          <Text style={styles.question}>{t(q.promptKey)}</Text>
          {q.options.map((opt) => {
            const selected = answers[q.id] === opt.id;
            return (
              <Pressable
                key={opt.id}
                onPress={() => selectOption(q.id, opt.id)}
                style={[styles.option, selected && styles.optionOn]}>
                <Text style={[styles.optionText, selected && styles.optionTextOn]}>
                  {t(opt.labelKey)}
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
        <Text style={styles.ctaText}>{t('fit.quiz.cta')}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f5f7f5' },
  scroll: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  muted: { color: '#666', textAlign: 'center' },
  kicker: {
    fontSize: 13,
    fontWeight: '700',
    color: GOLF.accentDark,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  title: { fontSize: 24, fontWeight: '800', color: '#14261c', marginBottom: 6 },
  subtitle: { fontSize: 15, color: '#4a5d52', marginBottom: 20, lineHeight: 22 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e0e6e2',
  },
  question: { fontSize: 17, fontWeight: '700', color: '#1a2e22', marginBottom: 12 },
  option: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d5ddd7',
    marginBottom: 8,
    backgroundColor: '#fafcfb',
  },
  optionOn: {
    borderColor: GOLF.accentDark,
    backgroundColor: 'rgba(46, 125, 50, 0.12)',
  },
  optionText: { fontSize: 15, color: '#333' },
  optionTextOn: { fontWeight: '700', color: '#1b5e20' },
  cta: {
    marginTop: 8,
    backgroundColor: GOLF.accentDark,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  ctaDisabled: { opacity: 0.45 },
  ctaText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
