import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { DARK_PAGE, SCREEN_HEADER, STACK_SCREEN_TOP_PADDING, fontSize } from '@/constants/theme';

export const SCREEN_HEADER_BACK = {
  text: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: DARK_PAGE.accent,
  },
  chevron: {
    fontSize: 22,
    fontWeight: '600' as const,
    color: DARK_PAGE.accent,
    lineHeight: 24,
    paddingRight: 4,
  },
} as const;

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  /** tab：与五个主 Tab 顶距一致；stack：子页面（ScreenSafeArea 已含顶部安全区） */
  variant?: 'tab' | 'stack';
  /** default：左对齐标题；toolbar：居中标题 + 左右操作区 */
  layout?: 'default' | 'toolbar';
  onBack?: () => void;
  /** text = ‹ 返回；chevron = 仅 ‹（球包等紧凑顶栏） */
  backMode?: 'text' | 'chevron';
  trailing?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

function headerWrap(variant: 'tab' | 'stack'): ViewStyle {
  return {
    ...SCREEN_HEADER.wrap,
    paddingTop: variant === 'stack' ? STACK_SCREEN_TOP_PADDING : SCREEN_HEADER.wrap.paddingTop,
  };
}

export function ScreenHeaderBackButton({
  onPress,
  mode = 'text',
  label = '返回',
}: {
  onPress: () => void;
  mode?: 'text' | 'chevron';
  label?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={mode === 'chevron' ? SCREEN_HEADER_BACK.chevron : SCREEN_HEADER_BACK.text}>
        {mode === 'chevron' ? '‹' : `‹ ${label}`}
      </Text>
    </Pressable>
  );
}

/** Tab / 栈子页顶栏：样式以 `SCREEN_HEADER` 为唯一来源 */
export function ScreenHeader({
  title,
  subtitle,
  variant = 'tab',
  layout = 'default',
  onBack,
  backMode = 'text',
  trailing,
  style,
}: ScreenHeaderProps) {
  const wrap = headerWrap(variant);

  if (layout === 'toolbar') {
    return (
      <View style={[wrap, styles.toolbar, style]}>
        <View style={styles.toolbarSide}>
          {onBack ? <ScreenHeaderBackButton onPress={onBack} mode={backMode} /> : null}
        </View>
        <Text style={[SCREEN_HEADER.title, styles.toolbarTitle]} numberOfLines={1}>
          {title}
        </Text>
        <View style={[styles.toolbarSide, styles.toolbarSideRight]}>{trailing}</View>
      </View>
    );
  }

  const titleBlock = (
    <View style={trailing ? SCREEN_HEADER.titleBlock : undefined}>
      <Text style={SCREEN_HEADER.title}>{title}</Text>
      {subtitle ? <Text style={SCREEN_HEADER.subtitle}>{subtitle}</Text> : null}
    </View>
  );

  if (onBack && trailing) {
    return (
      <View style={[wrap, SCREEN_HEADER.wrapRow, styles.inlineBackRow, style]}>
        <ScreenHeaderBackButton onPress={onBack} mode={backMode} />
        {titleBlock}
        {trailing}
      </View>
    );
  }

  if (onBack) {
    return (
      <View style={[wrap, style]}>
        <View style={styles.backAbove}>
          <ScreenHeaderBackButton onPress={onBack} mode={backMode} />
        </View>
        {titleBlock}
      </View>
    );
  }

  if (trailing) {
    return (
      <View style={[wrap, SCREEN_HEADER.wrapRow, style]}>
        {titleBlock}
        {trailing}
      </View>
    );
  }

  return (
    <View style={[wrap, style]}>
      {titleBlock}
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  toolbarSide: { width: 76, justifyContent: 'center', minHeight: 24 },
  toolbarSideRight: { alignItems: 'flex-end' },
  toolbarTitle: {
    flex: 1,
    textAlign: 'center',
    marginBottom: 0,
  },
  backAbove: { marginBottom: 12 },
  inlineBackRow: { alignItems: 'flex-start' },
});

export const screenHeaderStyles = StyleSheet.create({
  wrap: SCREEN_HEADER.wrap,
  wrapRow: SCREEN_HEADER.wrapRow,
  titleBlock: SCREEN_HEADER.titleBlock,
  title: SCREEN_HEADER.title,
  subtitle: SCREEN_HEADER.subtitle,
  backText: SCREEN_HEADER_BACK.text,
});
