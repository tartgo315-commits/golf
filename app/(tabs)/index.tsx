import { Link } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { ClubCategory } from '@/data/golfKnowledge';
import { useAuth } from '@/contexts/auth-context';

const CLUB_ROWS: { type: ClubCategory; emoji: string }[] = [
  { type: 'driver', emoji: '🏌️' },
  { type: 'fairway', emoji: '🌳' },
  { type: 'hybrid', emoji: '🔧' },
  { type: 'irons', emoji: '⛳' },
  { type: 'wedges', emoji: '🔺' },
  { type: 'putter', emoji: '🏴' },
];

function greetingName(email?: string) {
  if (!email) return 'Golfer';
  const local = email.split('@')[0] ?? 'Golfer';
  if (!local) return 'Golfer';
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const { session } = useAuth();
  const name = greetingName(session?.email);

  const toggleLanguage = useCallback(() => {
    const next = i18n.language.startsWith('zh') ? 'en' : 'zh';
    void i18n.changeLanguage(next);
  }, [i18n]);

  const langLabel = i18n.language.startsWith('zh')
    ? t('language.switchToEn')
    : t('language.switchToZh');

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.topSpacer} />
        <Pressable
          onPress={toggleLanguage}
          style={({ pressed }) => [styles.langButton, pressed && styles.langButtonPressed]}
          accessibilityRole="button"
          accessibilityLabel={langLabel}>
          <Text style={styles.langButtonText}>{langLabel}</Text>
        </Pressable>
      </View>

      <Text style={styles.greeting}>{t('home.greeting', { name })}</Text>
      <Text style={styles.title}>{t('home.title')}</Text>
      <Text style={styles.subtitle}>{t('home.subtitle')}</Text>
      <View style={styles.buttonList}>
        {CLUB_ROWS.map(({ type, emoji }) => {
          const label = t(`home.types.${type}`);
          return (
          <Link key={type} href={{ pathname: '/quiz/[type]', params: { type } }} asChild>
            <Pressable
              style={({ pressed }) => [styles.pressableWrap, pressed && styles.pressablePressed]}
              accessibilityRole="button"
              accessibilityLabel={`${label} quiz`}>
              <View style={styles.button}>
                <Text style={styles.emoji}>{emoji}</Text>
                <Text style={styles.buttonText}>{label}</Text>
              </View>
            </Pressable>
          </Link>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    paddingTop: 16,
    backgroundColor: '#f0f2f1',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  topSpacer: {
    flex: 1,
  },
  langButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(27, 94, 32, 0.12)',
    borderWidth: 1,
    borderColor: '#1b5e20',
  },
  langButtonPressed: {
    opacity: 0.85,
    backgroundColor: 'rgba(27, 94, 32, 0.2)',
  },
  langButtonText: {
    color: '#1b5e20',
    fontSize: 14,
    fontWeight: '700',
  },
  greeting: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1b5e20',
    marginBottom: 6,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 8,
    color: '#14261c',
  },
  subtitle: {
    fontSize: 15,
    color: '#3d5247',
    marginBottom: 24,
    lineHeight: 22,
  },
  buttonList: {
    gap: 12,
  },
  pressableWrap: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  pressablePressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1b5e20',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#0d3d12',
  },
  emoji: {
    fontSize: 22,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
});
