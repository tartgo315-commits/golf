import { Link, Redirect, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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

import { AUTH_GATE_BYPASSED } from '@/constants/auth-bypass';
import { GOLF } from '@/constants/golfTheme';
import { STACK_SCREEN_TOP_PADDING } from '@/constants/theme';
import { saveStoredAppLanguage } from '@/lib/app-language-storage';
import i18n from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';

function toZhErrorMessage(err) {
  const msg = (err && typeof err.message === 'string' ? err.message : '').toLowerCase();
  if (!msg) return '登录失败，请稍后重试';
  if (msg.includes('invalid login credentials')) return '邮箱或密码错误';
  if (msg.includes('email not confirmed')) return '邮箱未验证，请先到邮箱完成验证';
  if (msg.includes('too many requests')) return '操作太频繁，请稍后再试';
  return '登录失败：' + (err?.message ?? '未知错误');
}

function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

export default function LoginScreen() {
  const { t, i18n: i18nInstance } = useTranslation();
  const router = useRouter();
  const { hydrated, session, profileComplete } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [lang, setLang] = useState(() => {
    const raw = i18n.language ?? 'zh';
    if (raw === 'zh' || raw.startsWith('zh')) return 'zh';
    if (raw === 'ja' || raw.startsWith('ja')) return 'ja';
    return 'en';
  });

  useEffect(() => {
    const raw = i18nInstance.language ?? 'zh';
    if (raw === 'zh' || raw.startsWith('zh')) setLang('zh');
    else if (raw === 'ja' || raw.startsWith('ja')) setLang('ja');
    else setLang('en');
  }, [i18nInstance.language]);

  const canSubmit = useMemo(() => {
    return normalizeEmail(email).length > 3 && password.length >= 6 && !busy;
  }, [email, password, busy]);

  if (AUTH_GATE_BYPASSED) {
    return <Redirect href="/(tabs)" />;
  }

  /** 已登录时避免再停留在登录页 */
  if (hydrated && session) {
    return <Redirect href={profileComplete ? '/(tabs)' : '/profile-setup'} />;
  }

  async function switchLang(l) {
    setLang(l);
    await i18n.changeLanguage(l);
    await saveStoredAppLanguage(l);
  }

  async function onLogin() {
    const e = normalizeEmail(email);
    if (!e) {
      Alert.alert(t('login.errTitle'), t('login.errEmail'));
      return;
    }
    if (password.length < 6) {
      Alert.alert(t('login.errTitle'), t('login.errPassword'));
      return;
    }
    try {
      setBusy(true);
      const { error } = await supabase.auth.signInWithPassword({ email: e, password });
      if (error) throw error;
      /** 真实跳转由 auth gate 接管；这里做兜底，避免 UI 卡在登录页 */
      router.replace('/'); 
    } catch (e2) {
      Alert.alert(t('login.errTitle'), toZhErrorMessage(e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.langRow}>
          {['zh', 'en', 'ja'].map((l) => (
            <Pressable
              key={l}
              onPress={() => switchLang(l)}
              style={[styles.langBtn, lang === l && styles.langBtnOn]}
            >
              <Text style={[styles.langTxt, lang === l && styles.langTxtOn]}>
                {l === 'zh' ? '中文' : l === 'en' ? 'English' : '日本語'}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.header}>
          <Text style={styles.logo}>⛳</Text>
          <Text style={styles.title}>GolfClubAdvisor</Text>
          <Text style={styles.subtitle}>{t('login.subtitle')}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>{t('login.email')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('login.emailPlaceholder')}
            placeholderTextColor={GOLF.muted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
          />
          <Text style={styles.label}>{t('login.password')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('login.passwordPlaceholder')}
            placeholderTextColor={GOLF.muted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <Pressable
            style={[styles.primary, (!canSubmit || busy) && styles.disabled]}
            onPress={onLogin}
            disabled={!canSubmit || busy}
          >
            <Text style={styles.primaryText}>{busy ? t('login.submitting') : t('login.submit')}</Text>
          </Pressable>
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.footer}>{t('login.noAccount')}</Text>
          <Link href="/register" asChild>
            <Pressable hitSlop={8}>
              <Text style={styles.link}>{t('login.register')}</Text>
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
    paddingTop: STACK_SCREEN_TOP_PADDING,
    paddingBottom: 40,
  },
  langRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginBottom: 20,
  },
  langBtn: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3a4a40',
  },
  langBtnOn: {
    borderColor: '#c9ff4a',
    backgroundColor: '#1e3a26',
  },
  langTxt: { color: '#6a7a70', fontSize: 13, fontWeight: '700' },
  langTxtOn: { color: '#c9ff4a', fontSize: 13, fontWeight: '700' },
  header: { marginBottom: 28 },
  logo: { fontSize: 48, marginBottom: 8 },
  title: { fontSize: 30, fontWeight: '800', color: GOLF.text, letterSpacing: -0.5 },
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
    backgroundColor: GOLF.gold,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryText: { color: '#1a2e22', fontSize: 17, fontWeight: '700' },
  disabled: { opacity: 0.6 },
  footerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  footer: { color: GOLF.muted, fontSize: 15 },
  link: { color: GOLF.accent, fontWeight: '700', fontSize: 15 },
});

