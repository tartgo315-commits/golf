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
