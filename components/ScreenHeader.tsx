import { type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { SCREEN_HEADER } from '@/constants/theme';

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

/** 页面顶栏：不叠加安全区，仅保留与首页一致的顶距（见 SCREEN_HEADER.wrap） */
export function ScreenHeader({ title, subtitle, style, children }: ScreenHeaderProps) {
  return (
    <View style={[SCREEN_HEADER.wrap, style]}>
      {children}
      <Text style={SCREEN_HEADER.title}>{title}</Text>
      {subtitle ? <Text style={SCREEN_HEADER.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export const screenHeaderStyles = StyleSheet.create({
  wrap: SCREEN_HEADER.wrap,
  title: SCREEN_HEADER.title,
  subtitle: SCREEN_HEADER.subtitle,
});
