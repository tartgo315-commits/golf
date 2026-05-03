import type { EventModifierConfig, HoleEventRecord } from '@/utils/matchEventModifiers';
import type { PressRecord } from '@/utils/matchScoring';

export type TeeColor = 'white' | 'yellow' | 'blue' | 'red';
export type RoundStatus = 'in_progress' | 'completed';

export type RoundRow = {
  id: string;
  created_by: string;
  course_name: string;
  tee_color: TeeColor;
  played_at: string; // ISO date
  holes: number; // 9 or 18
  status: RoundStatus;
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
};

export type ScoreRow = {
  id: string;
  round_id: string;
  user_id: string;
  hole_number: number;
  strokes: number;
  par: number;
  putts?: number | null;
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
};

export type BetResultRow = {
  id: string;
  bet_id: string;
  user_id: string;
  net_amount: number;
  result_detail: any;
};

