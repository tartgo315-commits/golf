import { Link, useRouter } from 'expo-router';
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

import { GOLF } from '@/constants/golfTheme';
import { supabase } from '@/lib/supabase';

function toZhErrorMessage(err) {
  const raw = err && typeof err.message === 'string' ? err.message : '';
  const msg = raw.toLowerCase();
  if (!msg) return '注册失败，请稍后重试';
  if (msg.includes('user already registered')) return '该邮箱已注册，请直接登录';
  if (msg.includes('already registered')) return '该邮箱已注册，请直接登录';
  if (msg.includes('password should be at least')) return '密码至少 6 位';
  if (msg.includes('invalid email')) return '邮箱格式不正确';
  if (msg.includes('too many requests')) return '操作太频繁，请稍后再试';
  return '注册失败：' + raw;
}

function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

export default function RegisterScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [busy, setBusy] = useState(false);

  const canSubmit = useMemo(() => {
    const e = normalizeEmail(email);
    return (
      e.length > 3 &&
      nickname.trim().length > 0 &&
      password.length >= 6 &&
      password2.length >= 6 &&
      password === password2 &&
      !busy
    );
  }, [email, nickname, password, password2, busy]);

  async function onRegister() {
    const e = normalizeEmail(email);
    const nick = nickname.trim();
    if (!e) {
      Alert.alert('注册失败', '请输入正确的邮箱');
      return;
    }
    if (nick.length === 0) {
      Alert.alert('注册失败', '请输入昵称');
      return;
    }
    if (password.length < 6) {
      Alert.alert('注册失败', '密码至少 6 位');
      return;
    }
    if (password !== password2) {
      Alert.alert('注册失败', '两次密码不一致');
      return;
    }

    try {
      setBusy(true);
      const { error } = await supabase.auth.signUp({
        email: e,
        password,
        options: { data: { nickname: nick } },
      });
      if (error) throw error;
      Alert.alert('注册成功', '注册成功，请查收验证邮件');
      router.replace('/login');
    } catch (e2) {
      Alert.alert('注册失败', toZhErrorMessage(e2));
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
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <Text style={styles.backText}>‹ 返回</Text>
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.title}>注册账号</Text>
          <Text style={styles.subtitle}>使用邮箱 + 密码创建账号</Text>
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

          <Text style={styles.label}>昵称</Text>
          <TextInput
            style={styles.input}
            placeholder="请输入昵称"
            placeholderTextColor={GOLF.muted}
            value={nickname}
            onChangeText={setNickname}
          />

          <Text style={styles.label}>密码</Text>
          <TextInput
            style={styles.input}
            placeholder="至少 6 位"
            placeholderTextColor={GOLF.muted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <Text style={styles.label}>确认密码</Text>
          <TextInput
            style={styles.input}
            placeholder="再次输入密码"
            placeholderTextColor={GOLF.muted}
            secureTextEntry
            value={password2}
            onChangeText={setPassword2}
          />

          <Pressable
            style={[styles.primary, (!canSubmit || busy) && styles.disabled]}
            onPress={onRegister}
            disabled={!canSubmit || busy}
          >
            <Text style={styles.primaryText}>{busy ? '注册中…' : '注册'}</Text>
          </Pressable>
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.footer}>已有账号？</Text>
          <Link href="/login" asChild>
            <Pressable hitSlop={8}>
              <Text style={styles.link}>去登录</Text>
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
    paddingTop: Platform.OS === 'web' ? 44 : 48,
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
  footerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  footer: { color: GOLF.muted, fontSize: 15 },
  link: { color: GOLF.accent, fontWeight: '700', fontSize: 15 },
});

