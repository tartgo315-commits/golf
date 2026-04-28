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
};

