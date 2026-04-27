/**
 * 开局页玩法展示：文案、人数区间、金额说明与 legacy MatchMode 映射。
 */

import type { MatchMode } from '@/utils/matchScoring';
import type { SideGameType } from '@/utils/matchGames.types';

export type SideGameCatalogEntry = {
  type: SideGameType;
  title: string;
  /** 一句话说明 */
  blurb: string;
  /** 适合人数标签，如「2–4 人」「4 人」「3 人」 */
  playersLabel: string;
  minPlayers: number;
  maxPlayers: number;
};

export const SIDE_GAME_CATALOG: SideGameCatalogEntry[] = [
  {
    type: 'match_play',
    title: '比洞',
    blurb: '每人对抗，洞洞见输赢',
    playersLabel: '2–4 人',
    minPlayers: 2,
    maxPlayers: 4,
  },
  {
    type: 'stroke_play',
    title: '比杆',
    blurb: '按总杆或净杆差结算',
    playersLabel: '2–4 人',
    minPlayers: 2,
    maxPlayers: 4,
  },
  {
    type: 'stableford',
    title: '三分赛',
    blurb: 'Stableford 积分差，常见每洞最多 3 分',
    playersLabel: '2–4 人',
    minPlayers: 2,
    maxPlayers: 4,
  },
  {
    type: 'nassau_pack',
    title: 'Nassau',
    blurb: '前九、后九、全场三场独立结算',
    playersLabel: '2–4 人',
    minPlayers: 2,
    maxPlayers: 4,
  },
  {
    type: 'points_8421',
    title: '8421',
    blurb: '按 relative par 计分汇总结算',
    playersLabel: '4 人',
    minPlayers: 4,
    maxPlayers: 4,
  },
  {
    type: 'fixed_lasi',
    title: '固拉',
    blurb: '固定搭档，搭档比洞',
    playersLabel: '4 人',
    minPlayers: 4,
    maxPlayers: 4,
  },
  {
    type: 'rotating_lasi',
    title: '乱拉',
    blurb: '每洞重新配对，小数拼大数',
    playersLabel: '4 人',
    minPlayers: 4,
    maxPlayers: 4,
  },
  {
    type: 'landlord',
    title: '斗地主',
    blurb: '三人地主 vs 农民（玩法接入中）',
    playersLabel: '3 人',
    minPlayers: 3,
    maxPlayers: 3,
  },
  {
    type: 'trumpet',
    title: '喇叭花',
    blurb: '乱拉计分 + 喇叭花奖惩',
    playersLabel: '4 人',
    minPlayers: 4,
    maxPlayers: 4,
  },
];

export function catalogEntry(type: SideGameType): SideGameCatalogEntry | undefined {
  return SIDE_GAME_CATALOG.find((e) => e.type === type);
}

/** 当前人数是否符合该玩法（已按场上有效人数计算） */
export function isPlayerCountOkForGame(type: SideGameType, playerCount: number): boolean {
  const e = catalogEntry(type);
  if (!e) return false;
  return playerCount >= e.minPlayers && playerCount <= e.maxPlayers;
}

/** legacy 记分模式：首场赌局驱动实时页结算引擎，直至各玩法专用引擎接通 */
export function sideGameTypeToMatchMode(gameType: SideGameType): MatchMode {
  switch (gameType) {
    case 'stroke_play':
      return 'stroke';
    case 'stableford':
      return 'stableford';
    case 'nassau_pack':
      return 'nassau';
    case 'match_play':
    case 'fixed_lasi':
    case 'rotating_lasi':
    case 'landlord':
    case 'trumpet':
    case 'points_8421':
    default:
      return 'matchplay';
  }
}

export function sideGameTypeShortLabel(gameType: SideGameType): string {
  return catalogEntry(gameType)?.title ?? gameType;
}

/**
 * 单位金额旁说明（纯文案，不含货币符号）。
 * @param unitLabel 已格式化的数字串，如 "1000"
 */
export function unitHintLines(
  gameType: SideGameType,
  unitLabel: string,
  trumpetPerPersonLabel?: string,
): string[] {
  const u = unitLabel.trim() || '0';
  switch (gameType) {
    case 'match_play':
    case 'fixed_lasi':
    case 'rotating_lasi':
      return [`每洞 ${u}`];
    case 'stroke_play':
      return [`每场 ${u}（按净杆差）`];
    case 'stableford':
      return [`每分 ${u}（每洞最多 3 分）`];
    case 'nassau_pack':
      return [`每洞 ${u}（前九 / 后九 / 全场）`];
    case 'points_8421':
      return [`每分 ${u}（老鹰 8 / 小鸟 4 / 帕 2 / 柏忌 1）`];
    case 'landlord':
      return [`每分 ${u}（地主一洞赢/输 2 分）`];
    case 'trumpet': {
      const tp = trumpetPerPersonLabel?.trim() || '0';
      return [`乱拉每分 ${u}`, `喇叭花每人 ${tp}`];
    }
    default:
      return [`每洞 ${u}`];
  }
}
