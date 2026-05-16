import { Redirect, Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { AuthLanguageToggle } from '@/components/auth-language-toggle';
import { AUTH_GATE_BYPASSED } from '@/constants/auth-bypass';
import { TAB_SCREEN_TOP_PADDING } from '@/constants/theme';

export default function AuthLayout() {

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
        style={styles.langBar}
        pointerEvents="box-none"
      >
        <AuthLanguageToggle />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  langBar: {
    position: 'absolute',
    top: TAB_SCREEN_TOP_PADDING,
    right: 0,
    left: 0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 0,
    paddingRight: 16,
    zIndex: 50,
    pointerEvents: 'box-none',
  },
});
