import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ScorecardEntry } from '@/components/ScorecardEntry';
import { DARK_PAGE } from '@/constants/theme';
import { getLibraryCourseById } from '@/lib/golf-courses';

const BG = DARK_PAGE.bg;

export default function CourseTemplateDetailScreen() {
  const router = useRouter();
  const { id: idParam } = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  const course = id ? getLibraryCourseById(id) : undefined;

  useEffect(() => {
    if (id && !course) {
      router.replace('/course-template' as Href);
    }
  }, [id, course, router]);

  if (!course) {
    return (
      <View style={styles.container}>
        <Text style={styles.muted}>加载中…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScorecardEntry libraryCourseId={course.id} onBack={() => router.back()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  muted: { color: DARK_PAGE.textSecondary, padding: 16 },
});
