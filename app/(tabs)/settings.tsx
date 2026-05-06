import { type Href, useRouter } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DARK_PAGE, TAB_BAR_SCROLL_EXTRA } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';

const CARD_FILL = DARK_PAGE.card;
const BG = DARK_PAGE.bg;
const BORDER = DARK_PAGE.cardBorder;
const GREEN = DARK_PAGE.accent;
const TEXT_PRIMARY = DARK_PAGE.text;
const TEXT_SECONDARY = DARK_PAGE.textSecondary;

export default function TabSettingsHubScreen() {
  const router = useRouter();
  const { signOut } = useAuth();

  async function onSignOut() {
    await signOut();
    router.replace('/login' as unknown as Href);
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      <Text style={styles.title}>设置</Text>

      <View style={styles.card}>
        <Pressable
          style={styles.rowPress}
          onPress={() => router.push('/settings/profile' as Href)}
          android_ripple={{ color: 'rgba(255,255,255,0.06)' }}
        >
          <View style={styles.rowTextCol}>
            <Text style={styles.rowTitle}>我的档案</Text>
            <Text style={styles.rowHint}>差点、身高、挥速等配杆信息</Text>
          </View>
          <Text style={styles.chev}>›</Text>
        </Pressable>
      </View>

      <Pressable style={styles.logoutBtn} onPress={onSignOut}>
        <Text style={styles.logoutBtnTxt}>退出登录</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  content: {
    padding: 16,
    paddingTop: Platform.OS === 'web' ? 44 : 24,
    paddingBottom: 32 + TAB_BAR_SCROLL_EXTRA,
  },
  title: { fontSize: 24, fontWeight: '700', color: TEXT_PRIMARY, marginBottom: 14 },
  card: {
    backgroundColor: CARD_FILL,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
  },
  rowPress: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  rowTextCol: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 16, fontWeight: '700', color: TEXT_PRIMARY },
  rowHint: { fontSize: 12, color: TEXT_SECONDARY, marginTop: 4 },
  chev: { fontSize: 22, color: GREEN, fontWeight: '300' },
  logoutBtn: {
    marginTop: 14,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(248,113,113,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.45)',
  },
  logoutBtnTxt: { color: '#fca5a5', fontWeight: '700', fontSize: 15 },
});
