import { Platform } from 'react-native';
import { Stack } from 'expo-router';

import { DARK_PAGE } from '@/constants/theme';

const stackOptions = {
  contentStyle: {
    flex: 1,
    backgroundColor: '#07120b',
    ...(Platform.OS === 'web' ? { minHeight: '100%' as const } : {}),
  },
  headerStyle: { backgroundColor: DARK_PAGE.bg },
  headerTintColor: '#ffffff',
  headerTitleStyle: { color: '#ffffff', fontWeight: '600' as const },
};

export default function SettingsLayout() {
  return (
    <Stack screenOptions={stackOptions}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="profile" options={{ title: '个人档案' }} />
    </Stack>
  );
}
