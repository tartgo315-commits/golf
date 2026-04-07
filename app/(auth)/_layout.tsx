import { Redirect, Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthLanguageToggle } from '@/components/auth-language-toggle';
import { AUTH_GATE_BYPASSED } from '@/constants/auth-bypass';

export default function AuthLayout() {
  const insets = useSafeAreaInsets();

  if (AUTH_GATE_BYPASSED) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <View style={styles.root}>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
      <View
        style={[styles.langBar, { paddingTop: Math.max(insets.top, 10) }]}
        pointerEvents="box-none">
        <AuthLanguageToggle />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  langBar: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingRight: 16,
    zIndex: 50,
    pointerEvents: 'box-none',
  },
});
