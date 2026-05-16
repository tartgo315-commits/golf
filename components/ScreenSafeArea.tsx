import type { ReactNode } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { THEME } from '@/constants/theme';

/** 根级顶部安全区：避免内容压住系统状态栏；底部由 Tab Bar / 各页自行处理 */
export function ScreenSafeArea({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME.bg }} edges={['top']}>
      {children}
    </SafeAreaView>
  );
}
