import '@/lib/i18n';

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { LocaleSync } from '@/components/locale-sync';
import { AuthProvider } from '@/contexts/auth-context';
import { WebPhoneFrame } from '@/components/web-phone-frame';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <LocaleSync />
        <WebPhoneFrame>
          <Stack
            screenOptions={{
              contentStyle: { flex: 1 },
            }}>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="quiz/[type]" options={{ title: 'Quiz' }} />
            <Stack.Screen name="result/[type]" options={{ title: 'Results' }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          </Stack>
        </WebPhoneFrame>
      </AuthProvider>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
