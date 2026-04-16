import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ScoreAnalyticsPanel } from '@/components/ScoreAnalyticsPanel';
import { TAB_BAR_SCROLL_EXTRA } from '@/constants/theme';

const BG = '#0d1f10';
const WHITE = '#ffffff';
const MUTED = 'rgba(255,255,255,0.55)';

export default function ScoreAnalyticsScreen() {
  const router = useRouter();

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10} accessibilityRole="button">
          <Text style={styles.backTxt}>← 返回</Text>
        </Pressable>
        <Text style={styles.title}>成绩分析</Text>
        <Text style={styles.sub}>二级页面 · 自动汇总</Text>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}>
        <ScoreAnalyticsPanel />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backBtn: { alignSelf: 'flex-start', marginBottom: 8 },
  backTxt: { fontSize: 15, fontWeight: '600', color: MUTED },
  title: { fontSize: 22, fontWeight: '800', color: WHITE, marginBottom: 4 },
  sub: { fontSize: 12, color: 'rgba(255,255,255,0.45)' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 28 + TAB_BAR_SCROLL_EXTRA },
});
