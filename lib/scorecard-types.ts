import type { EventModifierConfig, HoleEventRecord } from '@/utils/matchEventModifiers';
import type { PressRecord } from '@/utils/matchScoring';
import type { WolfDecision } from '@/utils/wolfScoring';

export type TeeColor = 'white' | 'yellow' | 'blue' | 'red';
export type RoundStatus = 'in_progress' | 'completed' | 'locked' | 'abandoned';

export type RoundRow = {
  id: string;
  created_by: string;
  course_name: string;
  tee_color: TeeColor;
  played_at: string; // ISO date
  holes: number; // 9 or 18
  starting_hole?: number | null;
  status: RoundStatus;
  created_at?: string;
  weather?: string | null;
  tee_time?: string | null;
  duration_minutes?: number | null;
  front9_minutes?: number | null;
  back9_minutes?: number | null;
  par_setting?: number | null;
  /** 果岭速度 Stimp，约 6–15 */
  green_speed?: number | null;
  /** Nassau Press 记录（与 live match 对齐） */
  presses?: PressRecord[];
  /** 同行访客（无账号），形如 [{ "type": "guest", "id": "guest_…", "name": "…" }] */
  guest_companions?: Array<{ type: 'guest'; id: string; name: string; group_number?: number }> | null;
};

export type ProfileRow = {
  id: string;
  username: string | null;
};

export type RoundPlayerRow = {
  id: string;
  round_id: string;
  user_id: string;
  handicap: number | null;
  group_number?: number | null;
};

export type ScoreRow = {
  id: string;
  round_id: string;
  user_id: string;
  hole_number: number;
  strokes: number;
  par: number;
  putts?: number | null;
  /** 果岭命中（GIR） */
  gir?: boolean | null;
  /** 球道命中，仅 Par4/5 有意义 */
  fir?: 'hit' | 'left' | 'right' | null;
  /** 是否进沙坑 */
  sand?: boolean | null;
  /** 惩罚类型 */
  penalty?: 'none' | 'water' | 'ob' | null;
};

export type BetRow = {
  id: string;
  round_id: string;
  bet_type: string;
  unit_amount: number;
  settlement_timing: 'per_hole' | 'end_total';
  is_public: boolean;
  sort_order: number;
  /** 比洞：void | carry | double */
  tie_rule?: string | null;
  /** 固拉/乱拉 Las Vegas 平局规则 */
  vegas_tie_rule?: string | null;
  eagle_multiplier?: number | null;
  double_bogey_flip?: boolean | null;
  events?: HoleEventRecord[] | null;
  event_config?: EventModifierConfig | null;
  wolf_decisions?: WolfDecision[] | null;
};

export type BetResultRow = {
  id: string;
  bet_id: string;
  user_id: string;
  net_amount: number;
  result_detail: any;
};

