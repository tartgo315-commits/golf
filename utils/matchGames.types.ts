/**
 * 中国民间高尔夫多赌局并行架构（逐步接入具体玩法与计算）。
 * 一场 MatchRecord 可有 legacy 单 mode，也可挂 games[] 多赌局叠加。
 */

import type { EventModifierConfig, HoleEventRecord } from '@/utils/matchEventModifiers';

export type SettlementMode = 'per_hole' | 'end_total';

/** 玩法枚举（后续在引擎中逐个实现） */
export type SideGameType =
  | 'match_play'
  | 'stroke_play'
  | 'stableford'
  | 'nassau_pack'
  | 'points_8421'
  | 'fixed_lasi'
  | 'rotating_lasi'
  | 'fixed_lasi_3pt'
  | 'rotating_lasi_3pt'
  | 'landlord'
  | 'trumpet'
  | 'skins';

/** 比洞类单洞平局后的赌注递进（仅 match_play 等；固拉/乱拉 Las Vegas 用 {@link VegasTieRule}） */
export type TieRule = 'void' | 'carry' | 'double';

/** Las Vegas（拉丝）单洞平局后的累积倍数规则 */
export type VegasTieRule = 'void' | 'carry' | 'double';

/** 单个并行赌局（独立单位、结算模式、账单） */
export type MatchSideGame = {
  id: string;
  gameType: SideGameType;
  unitAmount: number;
  settlementMode: SettlementMode;
  /** 比洞/固拉/乱拉：平局时赌注处理；默认 void */
  tieRule?: TieRule;
  /** Las Vegas：一方有鹰、对方无鹰时，分差乘以该倍数（默认 2，可选 1/2/3） */
  eagleMultiplier?: number;
  /** Las Vegas：一方双柏忌、对方无 → 分差翻倍（默认关） */
  doubleBogeyFlip?: boolean;
  /** Las Vegas：两队拼接分平局时的处理（默认 carry） */
  vegasTieRule?: VegasTieRule;
  /** 喇叭花：第二路金额（如「每人」）；其余玩法不传 */
  secondaryUnitAmount?: number;
  /** 每人该赌局累计收支（与 players 顺序对齐，纯数字） */
  ledger: number[];
  /** 逐洞得分（结构依 gameType 扩展） */
  scores: unknown;
  /** 挂花事件记录（每洞触发后写入） */
  events?: HoleEventRecord[];
  /** 挂花配置（开局时设定） */
  eventConfig?: EventModifierConfig;
};
