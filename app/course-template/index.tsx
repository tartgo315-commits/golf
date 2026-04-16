import { type Href, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DARK_PAGE, TAB_BAR_SCROLL_EXTRA } from '@/constants/theme';
import { getLibraryCoursesWithScorecard, getLibraryPending } from '@/lib/golf-courses';

const BG = DARK_PAGE.bg;
const TEXT = DARK_PAGE.text;
const TEXT_MUTED = DARK_PAGE.textSecondary;
const CARD = DARK_PAGE.card;
const BORDER = DARK_PAGE.cardBorder;
const ACCENT = DARK_PAGE.accent;

export default function CourseTemplateListScreen() {
  const router = useRouter();
  const courses = getLibraryCoursesWithScorecard();
  const pending = getLibraryPending();

  const onBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/score' as Href);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backBtn} hitSlop={10} accessibilityRole="button" accessibilityLabel="返回">
          <Text style={styles.backTxt}>← 返回</Text>
        </Pressable>
        <Text style={styles.headerTitle}>球场模板</Text>
        <Text style={styles.headerSub}>选择已有记分卡数据的球场，自动载入 Par、码数与 SI</Text>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}>
        <Text style={styles.sectionLabel}>完整数据</Text>
        <View style={styles.grid}>
          {courses.map((c) => (
            <Pressable
              key={c.id}
              style={styles.card}
              onPress={() => router.push(`/course-template/${c.id}` as Href)}>
              <Text style={styles.cardEmoji}>⛳</Text>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {c.nameCn}
              </Text>
              <Text style={styles.cardMeta} numberOfLines={2}>
                Par {c.totalPar} · {c.totalYards} yds{c.province ? ` · ${c.province}` : ''}
              </Text>
            </Pressable>
          ))}
        </View>

        {pending.length > 0 ? (
          <>
            <Text style={[styles.sectionLabel, styles.sectionSpaced]}>数据待补全</Text>
            <View style={styles.pendingBox}>
              {pending.map((p, i) => (
                <Text key={`${p.nameCn}-${i}`} style={styles.pendingLine}>
                  · {p.nameCn}
                </Text>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: {
    backgroundColor: BG,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
  },
  backBtn: { alignSelf: 'flex-start', marginBottom: 8 },
  backTxt: { fontSize: 15, fontWeight: '600', color: TEXT_MUTED },
  headerTitle: { fontSize: 24, fontWeight: '700', color: TEXT, marginBottom: 4 },
  headerSub: { fontSize: 12, color: DARK_PAGE.textSubHeader, lineHeight: 18 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 + TAB_BAR_SCROLL_EXTRA, gap: 8 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: ACCENT, marginBottom: 4 },
  sectionSpaced: { marginTop: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: {
    width: '48%',
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: BORDER,
    padding: 12,
    minHeight: 112,
  },
  cardEmoji: { fontSize: 26, marginBottom: 6 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: TEXT, marginBottom: 6 },
  cardMeta: { fontSize: 11, color: TEXT_MUTED, lineHeight: 16 },
  pendingBox: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: BORDER,
    padding: 14,
    gap: 6,
  },
  pendingLine: { fontSize: 13, color: TEXT_MUTED },
});
