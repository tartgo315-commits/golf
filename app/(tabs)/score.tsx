import { type Href, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ScoreAnalyticsPanel } from '@/components/ScoreAnalyticsPanel';
import { TAB_BAR_SCROLL_EXTRA } from '@/constants/theme';

const BG = '#0d1f10';
const WHITE = '#ffffff';
const LIME = '#a3e635';
const MUTED = 'rgba(255,255,255,0.55)';

/** 底部「成绩」Tab：直接进入成绩分析（无中间页） */
export default function ScoreScreen() {
  const router = useRouter();

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerTitles}>
            <Text style={styles.title}>成绩分析</Text>
            <Text style={styles.sub}>自动汇总 · 含 9 / 18 洞</Text>
          </View>
          <Pressable
            style={styles.recordBtn}
            onPress={() => router.push('/handicap/add' as Href)}
            accessibilityRole="button"
            accessibilityLabel="记录成绩">
            <Text style={styles.recordBtnTxt}>记成绩</Text>
          </Pressable>
        </View>
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
    backgroundColor: BG,
  },
  headerTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  headerTitles: { flex: 1, minWidth: 0 },
  title: { fontSize: 24, fontWeight: '800', color: WHITE, marginBottom: 4 },
  sub: { fontSize: 13, color: MUTED, lineHeight: 18 },
  recordBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(163,230,53,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(163,230,53,0.45)',
  },
  recordBtnTxt: { fontSize: 14, fontWeight: '800', color: LIME },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 28 + TAB_BAR_SCROLL_EXTRA },
});
