import { Link, Redirect, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
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
  const router = useRouter();
  const { hydrated, session, profileComplete } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

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

  async function onLogin() {
    const e = normalizeEmail(email);
    if (!e) {
      Alert.alert('登录失败', '请输入正确的邮箱');
      return;
    }
    if (password.length < 6) {
      Alert.alert('登录失败', '密码至少 6 位');
      return;
    }
    try {
      setBusy(true);
      const { error } = await supabase.auth.signInWithPassword({ email: e, password });
      if (error) throw error;
      /** 真实跳转由 auth gate 接管；这里做兜底，避免 UI 卡在登录页 */
      router.replace('/'); 
    } catch (e2) {
      Alert.alert('登录失败', toZhErrorMessage(e2));
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
        <View style={styles.header}>
          <Text style={styles.logo}>⛳</Text>
          <Text style={styles.title}>GolfClubAdvisor</Text>
          <Text style={styles.subtitle}>使用邮箱账号登录</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>邮箱</Text>
          <TextInput
            style={styles.input}
            placeholder="请输入邮箱"
            placeholderTextColor={GOLF.muted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
          />
          <Text style={styles.label}>密码</Text>
          <TextInput
            style={styles.input}
            placeholder="请输入密码（至少 6 位）"
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
            <Text style={styles.primaryText}>{busy ? '登录中…' : '登录'}</Text>
          </Pressable>
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.footer}>还没有账号？</Text>
          <Link href="/register" asChild>
            <Pressable hitSlop={8}>
              <Text style={styles.link}>去注册</Text>
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
    paddingTop: Platform.OS === 'web' ? 44 : 56,
    paddingBottom: 40,
  },
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

