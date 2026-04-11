import '@/lib/i18n';

import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as Font from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { ActivityIndicator, Platform, View } from 'react-native';

import { LocaleSync } from '@/components/locale-sync';
import { AuthProvider } from '@/contexts/auth-context';
import { WebPhoneFrame } from '@/components/web-phone-frame';
import { THEME } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

/** Preload vector icon fonts (native blocks until ready; web must not block — useFonts never flips true if loadAsync rejects). */
const ICON_VECTOR_FONTS = {
  ...Ionicons.font,
  ...MaterialIcons.font,
  ...MaterialCommunityIcons.font,
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  /** Web: empty map → useFonts reports loaded immediately; we preload in useEffect. Native: wait for fonts or surface error. */
  const [iconFontsLoaded, iconFontError] = Font.useFonts(
    Platform.OS === 'web' ? {} : ICON_VECTOR_FONTS,
  );

  useEffect(() => {
    if (Platform.OS === 'web') {
      void Font.loadAsync(ICON_VECTOR_FONTS).catch(() => {});
    }
  }, []);

  const blockOnFonts =
    Platform.OS !== 'web' && !iconFontsLoaded && iconFontError == null;

  if (blockOnFonts) {
    return (
      <View
        style={{
          flex: 1,
          minHeight: Platform.OS === 'web' ? ('100vh' as unknown as number) : undefined,
          width: '100%',
          backgroundColor: THEME.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <ActivityIndicator size="large" color={THEME.accent} />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <LocaleSync />
        <WebPhoneFrame>
          <View style={{ flex: 1, paddingTop: Platform.OS === 'web' ? ('env(safe-area-inset-top)' as any) : 0 }}>
            <Stack
              screenOptions={{
                contentStyle: { flex: 1, backgroundColor: THEME.bg },
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
              <Stack.Screen name="tools/distance-gap" options={{ title: '距离间距检查' }} />
              <Stack.Screen name="handicap/index" options={{ headerShown: false }} />
              <Stack.Screen name="handicap/add" options={{ headerShown: false }} />
              <Stack.Screen name="handicap/[id]" options={{ headerShown: false }} />
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
