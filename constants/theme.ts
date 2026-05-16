/**
 * 浅色 / 深色色板（Expo 模板兼容）。
 * 供 `useThemeColor`、`Collapsible` 等与 `keyof Colors.light` 相关的组件使用。
 */
export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: '#0a7ea4',
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: '#0a7ea4',
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: '#fff',
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: '#fff',
  },
} as const;

/** 全局字号阶梯（手机端可读性基准） */
export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 28,
  xxl: 40,
  hero: 52,
} as const;

/** 数据页 Hero / 统计大数字 */
export const fontSizeData = {
  hero: fontSize.hero,
  heroSecondary: 40,
  number: 30,
  tabLabel: fontSize.md,
  cardTitle: 15,
  caption: fontSize.xs,
} as const;

export const THEME = {
  bg: '#07120b', // 主背景（深绿黑，与首页稿一致）
  card: '#102018', // WHS 英雄卡（深绿灰）
  surface: '#14221a', // 统计 / 列表块（略浅于背景）
  border: 'rgba(225,255,218,0.10)', // 卡片边框
  accent: '#c9ff4a', // 荧光绿（主强调色）
  accentBg: 'rgba(201,255,74,0.13)', // 荧光绿浅背景
  accentBorder: 'rgba(201,255,74,0.28)',
  /** WHS 小标题等（浅荧光字） */
  accentLabel: 'rgba(217,255,126,0.88)',

  text1: '#ffffff', // 主文字
  text2: 'rgba(244,255,238,0.78)', // 次级文字
  text3: 'rgba(244,255,238,0.56)', // 三级文字（标签/说明）
  text4: 'rgba(255,255,255,0.35)', // 最淡（占位符）

  /** 主按钮 / 荧光胶囊上的深色字 */
  textOnAccent: '#07120b',

  /** 进度条轨道（深灰绿） */
  trackMuted: 'rgba(255,255,255,0.10)',

  profileChipBg: 'rgba(255,255,255,0.03)',
  profileChipBorder: 'rgba(255,255,255,0.22)',
  accentRingFill: 'rgba(163,230,53,0.08)',

  tabActive: '#c9ff4a',
  tabInactive: 'rgba(255,255,255,0.4)',
};

/** Extra bottom padding for tab screens when the tab bar is `position: 'absolute'`. */
export const TAB_BAR_SCROLL_EXTRA = 80;

/**
 * 栈页面 / 深层路由与 Tab 主流程统一的深色壳（背景、卡片、输入、强调色与 Tab 页一致）。
 */
export const DARK_PAGE = {
  bg: '#07120b',
  card: 'rgba(255,255,255,0.055)',
  cardBorder: 'rgba(225,255,218,0.10)',
  text: '#ffffff',
  textSecondary: 'rgba(255,255,255,0.55)',
  textMuted: 'rgba(255,255,255,0.35)',
  textSubHeader: 'rgba(255,255,255,0.5)',
  accent: '#c9ff4a',
  onAccent: '#07120b',
  inputBg: 'rgba(255,255,255,0.06)',
  inputBorder: 'rgba(255,255,255,0.12)',
  surface: 'rgba(255,255,255,0.08)',
  divider: 'rgba(255,255,255,0.08)',
  overlay: 'rgba(0,0,0,0.55)',
  chipBg: 'rgba(201,255,74,0.14)',
  bestBg: 'rgba(201,255,74,0.12)',
  worstBg: 'rgba(248,113,113,0.14)',
  worstText: '#fca5a5',
} as const;

/** Tab 页标题距安全区底部的额外间距（与首页 scrollContent.paddingTop 对齐） */
export const TAB_SCREEN_TOP_PADDING = 4;

/** 栈内子页 / 带返回的页面顶距（ScreenSafeArea 已含顶部 inset） */
export const STACK_SCREEN_TOP_PADDING = 8;

/** 与统计 / 配杆等 Tab 顶栏对齐的标题区（顶距由根 ScreenSafeArea 负责，此处仅留呼吸） */
export const SCREEN_HEADER = {
  wrap: {
    backgroundColor: DARK_PAGE.bg,
    paddingHorizontal: 18,
    paddingTop: TAB_SCREEN_TOP_PADDING,
    paddingBottom: 12,
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: '700' as const,
    color: DARK_PAGE.text,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: DARK_PAGE.textSubHeader,
  },
};
