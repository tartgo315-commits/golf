import { type Href, useRouter } from 'expo-router';
import { Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const HEADER_BG = '#1a3a1a';
const GREEN_BTN = '#1a6b2e';
const WHITE = '#ffffff';
const BG = '#f5f5f0';
const BORDER = '#e5e7eb';
const TEXT_MAIN = '#111827';
const TEXT_SECONDARY = '#6b7280';

export default function BetPlaceholderScreen() {
  const router = useRouter();

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Text style={s.headerTitle}>赌球</Text>
      </View>
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false} bounces={false}>
        <Text style={s.placeholder}>赌球计算功能开发中</Text>
        <Text style={s.hint}>未来将支持常见赌球规则（Nassau、Skins、比洞等）与结算辅助。可先完成下列准备：</Text>

        <TouchableOpacity style={s.btnPrimary} activeOpacity={0.88} onPress={() => router.push('/(tabs)/score' as Href)}>
          <Text style={s.btnPrimaryText}>去记成绩</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.btnSecondary} activeOpacity={0.88} onPress={() => router.push('/(tabs)/handicap' as Href)}>
          <Text style={s.btnSecondaryText}>查看差点与历史</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.btnSecondary} activeOpacity={0.88} onPress={() => router.push('/(tabs)/compare' as Href)}>
          <Text style={s.btnSecondaryText}>装备对比（约球参考）</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: {
    backgroundColor: HEADER_BG,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'web' ? 50 : (StatusBar.currentHeight || 36) + 8,
    paddingBottom: 16,
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: WHITE },
  scroll: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 40 },
  placeholder: { fontSize: 18, fontWeight: '700', color: HEADER_BG, textAlign: 'center' },
  hint: { fontSize: 14, color: TEXT_SECONDARY, textAlign: 'center', marginTop: 12, lineHeight: 22, marginBottom: 20 },
  btnPrimary: {
    backgroundColor: GREEN_BTN,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  btnPrimaryText: { color: WHITE, fontSize: 15, fontWeight: '700' },
  btnSecondary: {
    backgroundColor: WHITE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  btnSecondaryText: { color: TEXT_MAIN, fontSize: 15, fontWeight: '600' },
});
