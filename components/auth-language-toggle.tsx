import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { saveStoredAppLanguage, type StoredAppLanguage } from '@/lib/app-language-storage';

/**
 * Compact zh / EN switcher for auth screens (top-right).
 */
export function AuthLanguageToggle() {
  const { i18n } = useTranslation();
  const current: StoredAppLanguage = i18n.language.startsWith('zh') ? 'zh' : 'en';

  async function setLang(lng: StoredAppLanguage) {
    await i18n.changeLanguage(lng);
    await saveStoredAppLanguage(lng);
  }

  return (
    <View style={styles.row} accessibilityRole={Platform.OS === 'web' ? 'toolbar' : undefined}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: current === 'zh' }}
        style={({ pressed }) => [
          styles.chip,
          current === 'zh' && styles.chipActive,
          pressed && styles.chipPressed,
          Platform.OS === 'web' && styles.chipWeb,
        ]}
        onPress={() => void setLang('zh')}>
        <Text style={[styles.text, current === 'zh' && styles.textActive]}>中文</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: current === 'en' }}
        style={({ pressed }) => [
          styles.chip,
          current === 'en' && styles.chipActive,
          pressed && styles.chipPressed,
          Platform.OS === 'web' && styles.chipWeb,
        ]}
        onPress={() => void setLang('en')}>
        <Text style={[styles.text, current === 'en' && styles.textActive]}>EN</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 38, 28, 0.45)',
    borderRadius: 999,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  chipActive: {
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  chipPressed: {
    opacity: 0.88,
  },
  chipWeb: {
    cursor: 'pointer',
  },
  text: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
  },
  textActive: {
    color: '#14261c',
  },
});
