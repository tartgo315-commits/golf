/**
 * 中国民间高尔夫多赌局并行架构（逐步接入具体玩法与计算）。
 * 一场 MatchRecord 可有 legacy 单 mode，也可挂 games[] 多赌局叠加。
 */

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
  | 'trumpet';

/** 比洞类单洞平局后的赌注递进（仅 match_play / 固拉 / 乱拉 逐洞累计生效） */
export type TieRule = 'void' | 'carry' | 'double';

/** 单个并行赌局（独立单位、结算模式、账单） */
export type MatchSideGame = {
  id: string;
  gameType: SideGameType;
  unitAmount: number;
  settlementMode: SettlementMode;
  /** 比洞/固拉/乱拉：平局时赌注处理；默认 void */
  tieRule?: TieRule;
  /** 喇叭花：第二路金额（如「每人」）；其余玩法不传 */
  secondaryUnitAmount?: number;
  /** 每人该赌局累计收支（与 players 顺序对齐，纯数字） */
  ledger: number[];
  /** 逐洞得分（结构依 gameType 扩展） */
  scores: unknown;
};
