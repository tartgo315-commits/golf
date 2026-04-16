export type RoundWindow = 'all' | 'last5' | 'last10' | 'last20';

export type HoleData = {
  holeNumber: number;
  par: number;
  score: number;
  putts: number;
  fairwayHit: boolean | null;
  girHit: boolean;
  upAndDown: boolean | null;
  sandSave: boolean | null;
  penalties: number;
  driveDistance: number | null;
  approachDistance: number | null;
  firstPuttDistance: number | null;
  missDirection?: string | null;
  missGreenDirection?: string | null;
  teeMissDirection?: string | null;
};

export type RoundData = {
  roundId: string;
  date: string;
  courseName: string;
  courseRating: number;
  slopeRating: number;
  totalScore: number;
  totalPutts: number;
  holes: HoleData[];
  holeCount: number;
};

export type FilterRoundsResult = {
  rounds: RoundData[];
  actualCount: number;
  requestedCount: number;
};

export type ValidateRoundResult = { ok: true } | { ok: false; errors: string[] };

export function r1(x: number | null | undefined): number | null;

export function filterRounds(allRounds: unknown[], window: RoundWindow): FilterRoundsResult;

export function computeScoring(rounds: RoundData[]): {
  roundCount: number;
  avgScore: number | null;
  handicapIndex: number | null;
  avgDifferential: number | null;
  bestScore: number | null;
  worstScore: number | null;
  bestRound: { score: number; date: string; course: string } | null;
  worstRound: { score: number; date: string; course: string } | null;
  avgByPar: { par3: number | null; par4: number | null; par5: number | null };
  avgFront9: number | null;
  avgBack9: number | null;
  distribution: { eagle: number; birdie: number; par: number; bogey: number; doublePlus: number };
  distributionPct: {
    eagle: number | null;
    birdie: number | null;
    par: number | null;
    bogey: number | null;
    doublePlus: number | null;
  };
  scoreTrend: { date: string; score: number }[];
};

export function computeTee(rounds: RoundData[]): {
  firPct: number | null;
  avgDriveDistance: number | null;
  avgPenalties: number | null;
  missTendency: { left: number; right: number; fairway: number } | null;
  firTrend: { date: string; value: number | null }[];
};

export function computeApproach(rounds: RoundData[]): {
  girPct: number | null;
  girByPar: { par3: number | null; par4: number | null; par5: number | null };
  girByDistance: {
    under100: number | null;
    d100_125: number | null;
    d125_150: number | null;
    d150_175: number | null;
    d175_200: number | null;
    over200: number | null;
  } | null;
  missGreenDirection: { left: number; right: number; short: number; long: number } | null;
  avgProximity: number | null;
  girTrend: { date: string; value: number | null }[];
};

export function computeShortGame(rounds: RoundData[]): {
  scramblingPct: number | null;
  upAndDownPct: number | null;
  sandSavePct: number | null;
  avgMissGIRPerRound: number | null;
  scramblingTrend: { date: string; value: number | null }[];
};

export function computePutting(rounds: RoundData[]): {
  avgTotalPutts: number | null;
  avgPuttsPerHole: number | null;
  threePuttPct: number | null;
  onePuttPct: number | null;
  puttsWhenGIR: number | null;
  puttsWhenMiss: number | null;
  puttsByDistance: {
    ft0_3: number | null;
    ft3_6: number | null;
    ft6_10: number | null;
    ft10_20: number | null;
    ft20plus: number | null;
  } | null;
  puttsTrend: { date: string; value: number | null }[];
};

export type ComputedAllStats = {
  filter: FilterRoundsResult;
  scoring: ReturnType<typeof computeScoring>;
  tee: ReturnType<typeof computeTee>;
  approach: ReturnType<typeof computeApproach>;
  shortGame: ReturnType<typeof computeShortGame>;
  putting: ReturnType<typeof computePutting>;
};

export function computeAllStats(allRounds: unknown[], window: RoundWindow): ComputedAllStats;

export function migrateOldData(oldRounds: unknown): RoundData[];

export function validateRound(round: unknown): ValidateRoundResult;

export function calcRoundFirPct(round: RoundData): number | null;
export function calcRoundGirPct(round: RoundData): number | null;
export function calcRoundScramblingPct(round: RoundData): number | null;
export function calcRoundThreePuttPct(round: RoundData): number | null;
