import { Stack } from 'expo-router';

import { DARK_PAGE } from '@/constants/theme';

/**
 * 嵌在 (tabs) 内：与首页/统计共用同一 focused 子树，Web 上 history 用 pushState
 * 而非从 (tabs) 跳到根 Stack 兄弟时的 replaceState，浏览器后退可与「← 返回」一致。
 */
export default function HandicapStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { flex: 1, backgroundColor: DARK_PAGE.bg },
      }}
    />
  );
}
