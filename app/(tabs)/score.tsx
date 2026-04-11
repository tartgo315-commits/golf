import { type Href, useRouter } from 'expo-router';
import { Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { TopTabNav } from '@/components/top-tab-nav';
import { TAB_BAR_SCROLL_EXTRA } from '@/constants/theme';

const HEADER_BG = '#121212';
const GREEN_BTN = '#1a6b2e';
const WHITE = '#ffffff';
const BG = '#f5f5f0';
const BORDER = '#e5e7eb';
const TEXT_MAIN = '#111827';
const TEXT_SECONDARY = '#6b7280';

export default function ScoreScreen() {
  const router = useRouter();

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Text style={s.headerTitle}>成绩</Text>
        <Text style={s.headerSub}>录入与查看球场成绩（与差点共用数据）</Text>
      </View>

      <TopTabNav />

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false} bounces={false}>
        <TouchableOpacity style={s.btnPrimary} activeOpacity={0.88} onPress={() => router.push('/handicap/add' as Href)}>
          <Text style={s.btnPrimaryText}>＋ 新增一轮成绩</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.btnSecondary} activeOpacity={0.88} onPress={() => router.push('/(tabs)/handicap' as Href)}>
          <Text style={s.btnSecondaryText}>查看差点与历史成绩</Text>
        </TouchableOpacity>

        <View style={s.card}>
          <Text style={s.cardTitle}>说明</Text>
          <Text style={s.cardBody}>
            记分卡、逐洞杆数与总杆会保存到本地，并参与 WHS 差点计算。此前在「差点」里使用的录入流程即为本页入口。
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: {
    backgroundColor: HEADER_BG,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'web' ? 50 : (StatusBar.currentHeight || 36) + 12,
    paddingBottom: 18,
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: WHITE },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 8, lineHeight: 20 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 + TAB_BAR_SCROLL_EXTRA },
  btnPrimary: {
    backgroundColor: GREEN_BTN,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  btnPrimaryText: { color: WHITE, fontSize: 16, fontWeight: '700' },
  btnSecondary: {
    backgroundColor: WHITE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  btnSecondaryText: { color: HEADER_BG, fontSize: 15, fontWeight: '600' },
  card: {
    backgroundColor: WHITE,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: BORDER,
    padding: 16,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: TEXT_MAIN, marginBottom: 8 },
  cardBody: { fontSize: 14, color: TEXT_SECONDARY, lineHeight: 22 },
});
