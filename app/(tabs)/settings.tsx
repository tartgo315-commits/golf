import { useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { GOLF } from '@/constants/golfTheme';
import { useAuth } from '@/contexts/auth-context';

/**
 * Settings — English UI; sign out returns to login flow.
 */
export default function SettingsScreen() {
  const router = useRouter();
  const { session, signOut } = useAuth();

  async function onSignOut() {
    Alert.alert('Sign out', 'Clear this device session?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/login');
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.subtitle}>
        Language switching can plug into i18n here. The app home quiz flow is in English.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Signed in as</Text>
        <Text style={styles.email}>{session?.email ?? '—'}</Text>
        <Text style={styles.provider}>via {session?.provider ?? '—'}</Text>
      </View>

      <Pressable style={styles.danger} onPress={onSignOut}>
        <Text style={styles.dangerText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    paddingTop: 40,
    backgroundColor: '#f0f2f1',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 8,
    color: '#14261c',
  },
  subtitle: {
    fontSize: 15,
    color: '#4a5d52',
    lineHeight: 22,
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e0e6e2',
    marginBottom: 20,
  },
  cardLabel: { fontSize: 13, fontWeight: '600', color: '#6b7a72', marginBottom: 6 },
  email: { fontSize: 17, fontWeight: '700', color: '#1a2e22' },
  provider: { fontSize: 14, color: '#6b7a72', marginTop: 4, textTransform: 'capitalize' },
  danger: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(176, 0, 32, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(176, 0, 32, 0.35)',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  dangerText: { color: GOLF.danger, fontWeight: '700', fontSize: 16 },
});
