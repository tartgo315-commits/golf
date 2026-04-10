import '@/lib/i18n';

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { Platform, View } from 'react-native';

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
          <View style={{ flex: 1, paddingTop: Platform.OS === 'web' ? ('env(safe-area-inset-top)' as any) : 0 }}>
            <Stack
              screenOptions={{
                contentStyle: { flex: 1 },
              }}>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="quiz/[type]" options={{ title: 'Quiz' }} />
              <Stack.Screen name="result/[type]" options={{ title: 'Results' }} />
              <Stack.Screen name="swing-weight" options={{ title: '挥重计算器' }} />
              <Stack.Screen name="grip-select" options={{ title: '握把选择' }} />
              <Stack.Screen name="tools/swing-weight" options={{ title: '挥重计算器' }} />
              <Stack.Screen name="tools/grip" options={{ title: '握把选择' }} />
              <Stack.Screen name="my-bag" options={{ headerShown: false }} />
              <Stack.Screen name="my-bag/[id]" options={{ headerShown: false }} />
              <Stack.Screen name="ai-advisor" options={{ headerShown: false }} />
              <Stack.Screen name="product/[id]" options={{ title: '产品详情' }} />
              <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
            </Stack>
          </View>
        </WebPhoneFrame>
      </AuthProvider>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
