import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { GOLF } from '@/constants/golfTheme';
import { useAuth } from '@/contexts/auth-context';

/**
 * Settings — English UI; sign out returns to login flow.
 */
export default function SettingsScreen() {
  const router = useRouter();
  const { session, signOut } = useAuth();
  const [webSignOutOpen, setWebSignOutOpen] = useState(false);

  async function performSignOut() {
    await signOut();
    router.replace('/login');
  }

  function onSignOut() {
    // Alert.alert is unreliable on RN Web; use an in-app Modal instead.
    if (Platform.OS === 'web') {
      setWebSignOutOpen(true);
      return;
    }
    Alert.alert('Sign out', 'Clear this device session?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          void performSignOut();
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

      <Pressable
        style={({ pressed }) => [styles.danger, Platform.OS === 'web' && styles.dangerWeb, pressed && styles.dangerPressed]}
        onPress={onSignOut}>
        <Text style={styles.dangerText}>Sign out</Text>
      </Pressable>

      {Platform.OS === 'web' ? (
        <Modal
          visible={webSignOutOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setWebSignOutOpen(false)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setWebSignOutOpen(false)}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Sign out</Text>
              <Text style={styles.modalBody}>Clear this device session?</Text>
              <View style={styles.modalActions}>
                <Pressable style={styles.modalCancel} onPress={() => setWebSignOutOpen(false)}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={styles.modalConfirm}
                  onPress={() => {
                    setWebSignOutOpen(false);
                    void performSignOut();
                  }}>
                  <Text style={styles.modalConfirmText}>Sign out</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Modal>
      ) : null}
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
  dangerWeb: {
    cursor: 'pointer',
  },
  dangerPressed: {
    opacity: 0.85,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e0e6e2',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#14261c',
    marginBottom: 8,
  },
  modalBody: {
    fontSize: 15,
    color: '#4a5d52',
    marginBottom: 20,
    lineHeight: 22,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalCancel: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7a72',
  },
  modalConfirm: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: 'rgba(176, 0, 32, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(176, 0, 32, 0.35)',
  },
  modalConfirmText: {
    fontSize: 16,
    fontWeight: '700',
    color: GOLF.danger,
  },
});
