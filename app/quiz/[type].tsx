import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { DARK_PAGE } from '@/constants/theme';
import { normalizeClubTypeParam } from '@/lib/quiz-routing';

import { QUIZ_BANK, TITLE_BY_TYPE, type QuizType } from './quiz-data';
import { QuizScreen } from './quiz-screen';

const BG = DARK_PAGE.bg;
const TEXT_MUTED = DARK_PAGE.textMuted;
const TEXT_PRIMARY = DARK_PAGE.text;

export default function QuizByTypeScreen() {
  const { type: rawType } = useLocalSearchParams<{ type: string }>();
  const category = normalizeClubTypeParam(rawType) as QuizType | null;

  if (!category) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>未知球杆类型</Text>
        <Text style={styles.muted}>请从首页重新进入问卷。</Text>
      </View>
    );
  }

  return <QuizScreen type={category} title={TITLE_BY_TYPE[category]} questions={QUIZ_BANK[category]} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: BG },
  errorTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8, color: TEXT_PRIMARY },
  muted: { color: TEXT_MUTED, textAlign: 'center' },
});
