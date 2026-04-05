import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { GOLF } from '@/constants/golfTheme';
import { useAuth } from '@/contexts/auth-context';

export default function RegisterScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { registerWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function onRegister() {
    try {
      setBusy(true);
      await registerWithEmail(email, password);
      router.replace('/profile-setup');
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('auth.genericError');
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(`${t('auth.registerErrorTitle')}\n\n${msg}`);
      } else {
        Alert.alert(t('auth.registerErrorTitle'), msg);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>‹ {t('auth.back')}</Text>
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.title}>{t('auth.registerTitle')}</Text>
          <Text style={styles.subtitle}>{t('auth.registerSubtitle')}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>{t('auth.email')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('auth.emailPlaceholder')}
            placeholderTextColor={GOLF.muted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
          />
          <Text style={styles.label}>{t('auth.password')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('auth.passwordPlaceholder')}
            placeholderTextColor={GOLF.muted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <Pressable
            style={[styles.primary, busy && styles.disabled]}
            onPress={onRegister}
            disabled={busy}>
            <Text style={styles.primaryText}>{t('auth.registerCta')}</Text>
          </Pressable>
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.footer}>{t('auth.footerHasAccount')} </Text>
          <Link href="/login" asChild>
            <Pressable hitSlop={8}>
              <Text style={styles.link}>{t('auth.signInLink')}</Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: GOLF.bg },
  scroll: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 48,
    paddingBottom: 40,
  },
  back: { marginBottom: 16, alignSelf: 'flex-start' },
  backText: { color: GOLF.accent, fontSize: 16, fontWeight: '600' },
  header: { marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '800', color: GOLF.text },
  subtitle: { marginTop: 8, fontSize: 16, color: GOLF.muted, lineHeight: 22 },
  card: {
    backgroundColor: GOLF.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GOLF.border,
    padding: 20,
    marginBottom: 24,
  },
  label: { color: GOLF.muted, fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: {
    backgroundColor: GOLF.inputBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: GOLF.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: GOLF.text,
    fontSize: 16,
    marginBottom: 14,
  },
  primary: {
    backgroundColor: GOLF.accentDark,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  disabled: { opacity: 0.6 },
  footerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: { color: GOLF.muted, fontSize: 15 },
  link: { color: GOLF.accent, fontWeight: '700', fontSize: 15 },
});
