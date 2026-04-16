import { type Href, useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { TAB_BAR_SCROLL_EXTRA } from '@/constants/theme';

const BG = '#0d1f10';
const WHITE = '#ffffff';
const CARD = 'rgba(255,255,255,0.05)';
const CARD_BORDER = 'rgba(255,255,255,0.08)';
const TEXT_MUTED = 'rgba(255,255,255,0.65)';
const HEADER_SUB = 'rgba(255,255,255,0.5)';
const LIME = '#a3e635';

export default function ScoreIndexScreen() {
  const router = useRouter();

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>成绩</Text>
        <Text style={[styles.headerSub, { color: HEADER_SUB }]}>记成绩与统计分析</Text>
      </View>

      <View style={styles.body}>
        <TouchableOpacity
          style={styles.entryCard}
          activeOpacity={0.9}
          onPress={() => router.push('/handicap/add' as Href)}>
          <Text style={styles.entryEmoji}>📝</Text>
          <Text style={styles.entryTitle}>记录成绩</Text>
          <Text style={styles.entrySub}>逐洞记录、自动计算差点微差；记分时可选球场库自动填 Par 与难度</Text>
          <View style={styles.entryBtnOutline}>
            <Text style={styles.entryBtnOutlineText}>开始记录</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.analyticsCard}
          activeOpacity={0.88}
          onPress={() => router.push('/(tabs)/score/analytics' as Href)}>
          <Text style={styles.analyticsEmoji}>📊</Text>
          <Text style={styles.analyticsTitle}>成绩分析</Text>
          <Text style={styles.analyticsSub}>整体与近期均杆、推杆、GIR、洞级与半场统计</Text>
          <View style={styles.analyticsRow}>
            <Text style={styles.analyticsCta}>进入二级页面</Text>
            <Text style={styles.analyticsChev}>›</Text>
          </View>
        </TouchableOpacity>
      </View>
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
  headerTitle: { fontSize: 24, fontWeight: '700', color: WHITE, marginBottom: 2 },
  headerSub: { fontSize: 12 },
  body: { flex: 1, padding: 16, paddingBottom: 16 + TAB_BAR_SCROLL_EXTRA, gap: 12 },

  entryCard: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 16,
    padding: 18,
  },
  entryEmoji: { fontSize: 28, marginBottom: 8 },
  entryTitle: { fontSize: 17, fontWeight: '700', color: WHITE, marginBottom: 6 },
  entrySub: { fontSize: 13, color: TEXT_MUTED, marginBottom: 14, lineHeight: 20 },
  entryBtnOutline: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  entryBtnOutlineText: { color: WHITE, fontSize: 15, fontWeight: '700' },

  analyticsCard: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: 'rgba(163,230,53,0.28)',
    borderRadius: 16,
    padding: 18,
  },
  analyticsEmoji: { fontSize: 26, marginBottom: 8 },
  analyticsTitle: { fontSize: 17, fontWeight: '700', color: WHITE, marginBottom: 6 },
  analyticsSub: { fontSize: 13, color: TEXT_MUTED, marginBottom: 12, lineHeight: 20 },
  analyticsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  analyticsCta: { fontSize: 15, fontWeight: '700', color: LIME },
  analyticsChev: { fontSize: 20, fontWeight: '700', color: LIME },
});
