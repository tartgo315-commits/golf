import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { GOLF } from '@/constants/golfTheme';
import { useAuth } from '@/contexts/auth-context';

const WHITE = '#ffffff';
const BG = '#f3f4f6';
const BORDER = '#e5e7eb';
const TEXT_TITLE = '#14261c';
const TEXT_BODY = '#4a5d52';
const TEXT_LABEL = '#6b7a72';
const TEXT_EMAIL = '#1a2e22';
const OVERLAY = 'rgba(0,0,0,0.45)';
const DANGER_BG_SOFT = 'rgba(176, 0, 32, 0.1)';
const DANGER_BG_STRONG = 'rgba(176, 0, 32, 0.12)';
const DANGER_BORDER = 'rgba(176, 0, 32, 0.35)';

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
    padding: 16,
    paddingTop: 24,
    backgroundColor: BG,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 8,
    color: TEXT_TITLE,
  },
  subtitle: {
    fontSize: 15,
    color: TEXT_BODY,
    lineHeight: 22,
    marginBottom: 16,
  },
  card: {
    backgroundColor: WHITE,
    borderRadius: 14,
    padding: 16,
    borderWidth: 0.5,
    borderColor: BORDER,
    marginBottom: 16,
  },
  cardLabel: { fontSize: 13, fontWeight: '600', color: TEXT_LABEL, marginBottom: 6 },
  email: { fontSize: 17, fontWeight: '700', color: TEXT_EMAIL },
  provider: { fontSize: 14, color: TEXT_LABEL, marginTop: 4, textTransform: 'capitalize' },
  danger: {
    alignSelf: 'flex-start',
    backgroundColor: DANGER_BG_SOFT,
    borderWidth: 0.5,
    borderColor: DANGER_BORDER,
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
    backgroundColor: OVERLAY,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: WHITE,
    borderRadius: 14,
    padding: 20,
    borderWidth: 0.5,
    borderColor: BORDER,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: TEXT_TITLE,
    marginBottom: 8,
  },
  modalBody: {
    fontSize: 15,
    color: TEXT_BODY,
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
    color: TEXT_LABEL,
  },
  modalConfirm: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: DANGER_BG_STRONG,
    borderWidth: 0.5,
    borderColor: DANGER_BORDER,
  },
  modalConfirmText: {
    fontSize: 16,
    fontWeight: '700',
    color: GOLF.danger,
  },
});
