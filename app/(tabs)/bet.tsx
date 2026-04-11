import { Platform, StatusBar, StyleSheet, Text, View } from 'react-native';

const HEADER_BG = '#1a3a1a';
const WHITE = '#ffffff';
const TEXT_SECONDARY = '#6b7280';

export default function BetPlaceholderScreen() {
  return (
    <View style={s.root}>
      <View style={s.header}>
        <Text style={s.headerTitle}>赌球</Text>
      </View>
      <View style={s.body}>
        <Text style={s.placeholder}>赌球计算功能开发中</Text>
        <Text style={s.hint}>未来将支持常见赌球规则与结算辅助。</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: WHITE },
  header: {
    backgroundColor: HEADER_BG,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'web' ? 50 : (StatusBar.currentHeight || 36) + 8,
    paddingBottom: 16,
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: WHITE },
  body: { flex: 1, padding: 24, justifyContent: 'center' },
  placeholder: { fontSize: 18, fontWeight: '700', color: HEADER_BG, textAlign: 'center' },
  hint: { fontSize: 14, color: TEXT_SECONDARY, textAlign: 'center', marginTop: 12, lineHeight: 22 },
});
