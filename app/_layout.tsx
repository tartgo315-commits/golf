import '@/lib/i18n';

import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as Font from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { ActivityIndicator, AppState, type AppStateStatus, Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { InAppNotificationRoot } from '@/components/InAppNotificationBar';
import { ScreenSafeArea } from '@/components/ScreenSafeArea';
import { LocaleSync } from '@/components/locale-sync';
import { AuthProvider } from '@/contexts/auth-context';
import { WebPhoneFrame } from '@/components/web-phone-frame';
import { DARK_PAGE, THEME, fontSize } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { enableScreens } from 'react-native-screens';

import { hydrateAmendmentUnlocks } from '@/utils/amendmentUnlockStorage';
import {
  applyTrainingReminderFromStorage,
  registerForPushNotifications,
  setupPushNotificationListeners,
} from '@/utils/pushNotification';
import { getOrCreateDeviceUserId } from '@/utils/userIdentity';
import { requestNotificationFlush } from '@/utils/notificationQueue';
import { refreshServerTime, warmServerTime } from '@/utils/serverTime';

/** Web：默认不启用 screens 时 Tab 场景退化为叠放的绝对定位 View，易拦截触摸；启用后用 display:none 隐藏非活动页。 */
enableScreens(true);

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

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(THEME.bg);
  }, []);

  useEffect(() => {
    /** 不在启动时灌模拟成绩，避免覆盖用户真实记录；模拟数据仅保留设置/开发中的手动入口。 */
    warmServerTime();
    void hydrateAmendmentUnlocks();
    const pushSubs = Platform.OS === 'web' ? [] : setupPushNotificationListeners();
    void registerForPushNotifications();
    void applyTrainingReminderFromStorage();
    const onAppState = (s: AppStateStatus) => {
      if (s === 'active') {
        void refreshServerTime();
        void hydrateAmendmentUnlocks();
        void registerForPushNotifications();
        void getOrCreateDeviceUserId().then((id) => requestNotificationFlush(id));
      }
    };
    const sub = AppState.addEventListener('change', onAppState);
    return () => {
      sub.remove();
      pushSubs.forEach((x) => x.remove());
    };
  }, []);

  const blockOnFonts = Platform.OS !== 'web' && !iconFontsLoaded && iconFontError == null;

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
        }}
      >
        <ActivityIndicator size="large" color={THEME.accent} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <AuthProvider>
            <LocaleSync />
            <WebPhoneFrame>
              <ScreenSafeArea>
                <InAppNotificationRoot>
                  <Stack
                    screenOptions={{
                      contentStyle: { flex: 1, backgroundColor: DARK_PAGE.bg },
                                  headerStyle: { backgroundColor: DARK_PAGE.bg },
                                  headerTintColor: '#ffffff',
                                  headerTitleStyle: {
                                    color: DARK_PAGE.text,
                                    fontSize: fontSize.lg,
                                    fontWeight: '800',
                                  },
                    }}
                  >
                    <Stack.Screen name="index" options={{ headerShown: false }} />
                    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                    <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                    <Stack.Screen name="quiz/[type]" options={{ title: '问卷评估' }} />
                    <Stack.Screen name="result/[type]" options={{ title: '推荐结果' }} />
                    <Stack.Screen name="course-strategy" options={{ headerShown: false }} />
                    <Stack.Screen name="swing-weight" options={{ title: '挥重计算器' }} />
                    <Stack.Screen name="grip-select" options={{ title: '握把选择' }} />
                    <Stack.Screen name="tools/swing-weight" options={{ title: '挥重计算器' }} />
                    <Stack.Screen name="tools/grip" options={{ title: '握把选择' }} />
                    <Stack.Screen name="tools/distance-gap" options={{ headerShown: false }} />
                    <Stack.Screen name="tools/spacing" options={{ headerShown: false }} />
                    <Stack.Screen name="settings" options={{ headerShown: false }} />
                    <Stack.Screen name="legal/privacy" options={{ headerShown: false }} />
                    <Stack.Screen name="legal/terms" options={{ headerShown: false }} />
                    <Stack.Screen name="amendment/[id]" options={{ headerShown: false }} />
                    <Stack.Screen name="friends/index" options={{ headerShown: false }} />
                    <Stack.Screen name="friends/[id]" options={{ headerShown: false }} />
                    <Stack.Screen name="match/[id]" options={{ headerShown: false }} />
                    <Stack.Screen name="match/history" options={{ headerShown: false }} />
                    <Stack.Screen name="lottery/[matchId]" options={{ headerShown: false }} />
                    <Stack.Screen name="training/index" options={{ headerShown: false }} />
                    <Stack.Screen name="my-bag" options={{ headerShown: false }} />
                    <Stack.Screen name="my-bag/[id]" options={{ headerShown: false }} />
                    <Stack.Screen name="ai-advisor" options={{ headerShown: false }} />
                    <Stack.Screen name="ai-training" options={{ headerShown: false }} />
                    <Stack.Screen name="rounds" options={{ headerShown: false }} />
                    <Stack.Screen name="product/[id]" options={{ headerShown: false }} />
                    <Stack.Screen
                      name="modal"
                      options={{ presentation: 'modal', title: 'Modal' }}
                    />
                  </Stack>
                </InAppNotificationRoot>
              </ScreenSafeArea>
            </WebPhoneFrame>
          </AuthProvider>
          <StatusBar style="light" />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
