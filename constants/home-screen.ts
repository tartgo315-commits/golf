/**
 * GolfMate 首页 — 与 UI 稿对齐的间距、圆角、字号（色值与 THEME 同步于 theme.ts）。
 */
export const HOME = {
  padX: 18,
  gapSm: 8,
  gapMd: 10,

  radiusHero: 26,
  radiusTile: 20,
  radiusCard: 22,
  radiusBtn: 18,
  radiusChip: 999,
  radiusProfile: 22,

  btnHeight: 56,

  appTitle: 17,
  greet: 11,
  name: 32,
  profilePadH: 14,
  profilePadV: 7,

  heroPad: 22,
  heroLabel: 11,
  heroPending: 30,
  capsulePadH: 14,
  capsulePadV: 8,

  progressH: 6,
  progressLbl: 11,

  sectionLbl: 11,
  statNum: 26,
  statLbl: 11,
  statSub: 11,

  courseTitle: 15,
  courseMeta: 12,

  scoreRing: 48,
  cardInnerPad: 14,
  chipPadH: 10,
  chipPadV: 5,
  chipText: 11,
} as const;

/** 稿图：最近成绩标签 — 深色底 + 浅绿字 */
export const HOME_CHIP = {
  bg: 'rgba(201,255,74,0.10)',
  border: 'rgba(201,255,74,0.24)',
  text: '#dfff7a',
} as const;
