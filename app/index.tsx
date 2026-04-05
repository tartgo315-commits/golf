import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuth } from '@/contexts/auth-context';
import { GOLF } from '@/constants/golfTheme';

/**
 * Auth gate: login → profile setup → tabs.
 */
export default function Index() {
  const { hydrated, session, profileComplete } = useAuth();

  if (!hydrated) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color={GOLF.accent} />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/login" />;
  }

  if (!profileComplete) {
    return <Redirect href="/profile-setup" />;
  }

  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: GOLF.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
