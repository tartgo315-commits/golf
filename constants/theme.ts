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

export const THEME = {
  bg: '#101512', // 主背景（深绿黑，与首页稿一致）
  card: '#1a2822', // WHS 英雄卡（深绿灰）
  surface: '#1e2520', // 统计 / 列表块（略浅于背景）
  border: 'rgba(255,255,255,0.07)', // 卡片边框
  accent: '#a3e635', // 荧光绿（主强调色）
  accentBg: 'rgba(163,230,53,0.12)', // 荧光绿浅背景
  accentBorder: 'rgba(163,230,53,0.25)',
  /** WHS 小标题等（浅荧光字） */
  accentLabel: 'rgba(163,230,53,0.82)',

  text1: '#ffffff', // 主文字
  text2: 'rgba(255,255,255,0.75)', // 次级文字
  text3: 'rgba(255,255,255,0.55)', // 三级文字（标签/说明）
  text4: 'rgba(255,255,255,0.35)', // 最淡（占位符）

  /** 主按钮 / 荧光胶囊上的深色字 */
  textOnAccent: '#0d0f0d',

  /** 进度条轨道（深灰绿） */
  trackMuted: '#2a302b',

  profileChipBg: 'rgba(255,255,255,0.03)',
  profileChipBorder: 'rgba(255,255,255,0.22)',
  accentRingFill: 'rgba(163,230,53,0.08)',

  tabActive: '#a3e635',
  tabInactive: 'rgba(255,255,255,0.4)',
};

/** Extra bottom padding for tab screens when the tab bar is `position: 'absolute'`. */
export const TAB_BAR_SCROLL_EXTRA = 80;

/**
 * 栈页面 / 深层路由与 Tab 主流程统一的深色壳（背景、卡片、输入、强调色与 Tab 页一致）。
 */
export const DARK_PAGE = {
  bg: '#0d1f10',
  card: 'rgba(255,255,255,0.05)',
  cardBorder: 'rgba(255,255,255,0.08)',
  text: '#ffffff',
  textSecondary: 'rgba(255,255,255,0.55)',
  textMuted: 'rgba(255,255,255,0.35)',
  textSubHeader: 'rgba(255,255,255,0.5)',
  accent: '#a3e635',
  onAccent: '#0d1f10',
  inputBg: 'rgba(255,255,255,0.06)',
  inputBorder: 'rgba(255,255,255,0.12)',
  surface: 'rgba(255,255,255,0.08)',
  divider: 'rgba(255,255,255,0.08)',
  overlay: 'rgba(0,0,0,0.55)',
  chipBg: 'rgba(163,230,53,0.14)',
  bestBg: 'rgba(163,230,53,0.12)',
  worstBg: 'rgba(248,113,113,0.14)',
  worstText: '#fca5a5',
} as const;

/** 与成绩 / 配杆等 Tab 顶栏对齐的标题区 */
export const SCREEN_HEADER = {
  wrap: {
    backgroundColor: DARK_PAGE.bg,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: DARK_PAGE.text,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    color: DARK_PAGE.textSubHeader,
  },
};
