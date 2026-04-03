import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
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

export default function LoginScreen() {
  const router = useRouter();
  const { signInWithEmail, signInWithGoogle, signInWithApple } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function onEmailLogin() {
    try {
      setBusy(true);
      const { complete } = await signInWithEmail(email, password);
      router.replace(complete ? '/(tabs)' : '/profile-setup');
    } catch (e) {
      Alert.alert('Sign in', e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    try {
      setBusy(true);
      const { complete } = await signInWithGoogle();
      router.replace(complete ? '/(tabs)' : '/profile-setup');
    } catch (e) {
      Alert.alert('Google', e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  async function onApple() {
    try {
      setBusy(true);
      const { complete } = await signInWithApple();
      router.replace(complete ? '/(tabs)' : '/profile-setup');
    } catch (e) {
      Alert.alert('Apple', e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.logo}>⛳</Text>
          <Text style={styles.title}>Golf Club Advisor</Text>
          <Text style={styles.subtitle}>Sign in to get personalized club guidance</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor={GOLF.muted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
          />
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="At least 4 characters (demo)"
            placeholderTextColor={GOLF.muted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <Pressable
            style={[styles.primary, busy && styles.disabled]}
            onPress={onEmailLogin}
            disabled={busy}>
            <Text style={styles.primaryText}>Sign in with email</Text>
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.divider} />
          </View>

          <Pressable style={[styles.social, styles.google]} onPress={onGoogle} disabled={busy}>
            <Text style={styles.socialText}>Continue with Google</Text>
          </Pressable>
          <Pressable style={[styles.social, styles.apple]} onPress={onApple} disabled={busy}>
            <Text style={[styles.socialText, styles.appleText]}>Continue with Apple</Text>
          </Pressable>
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.footer}>New here? </Text>
          <Link href="/register" asChild>
            <Pressable hitSlop={8}>
              <Text style={styles.link}>Create an account</Text>
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
    paddingTop: 56,
    paddingBottom: 40,
  },
  header: { marginBottom: 28 },
  logo: { fontSize: 48, marginBottom: 8 },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: GOLF.text,
    letterSpacing: -0.5,
  },
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
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 18, gap: 10 },
  divider: { flex: 1, height: 1, backgroundColor: GOLF.border },
  dividerText: { color: GOLF.muted, fontSize: 13 },
  social: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
  },
  google: {
    backgroundColor: '#fff',
    borderColor: '#dadce0',
  },
  socialText: { fontSize: 16, fontWeight: '600', color: '#1a1a1a' },
  apple: {
    backgroundColor: '#000',
    borderColor: '#333',
  },
  appleText: { color: '#fff' },
  footerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: { color: GOLF.muted, fontSize: 15 },
  link: { color: GOLF.accent, fontWeight: '700', fontSize: 15 },
});
