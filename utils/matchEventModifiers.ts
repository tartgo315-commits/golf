/**
 * 挂花事件账本：小鸟/老鹰等触发后点对点零和金额变动。
 */

export type GolfEventType =
  | 'birdie'
  | 'eagle'
  | 'albatross'
  | 'sand_save'
  | 'par_train'
  | 'water_hazard'
  | 'out_of_bounds';

export interface HoleEventRecord {
  hole: number;
  playerIndex: number;
  event: GolfEventType;
}

export interface EventModifierConfig {
  birdieEnabled: boolean;
  birdieAmount: number;
  eagleEnabled: boolean;
  eagleAmount: number;
  albatrossEnabled: boolean;
  albatrossAmount: number;
  sandSaveEnabled: boolean;
  sandSaveAmount: number;
  parTrainEnabled: boolean;
  parTrainAmount: number;
  parTrainMinStreak: number;
  waterHazardEnabled: boolean;
  waterHazardAmount: number;
  outOfBoundsEnabled: boolean;
  outOfBoundsAmount: number;
}

export function defaultEventConfig(unitAmount: number): EventModifierConfig {
  const u = Math.max(0, Math.round(unitAmount));
  return {
    birdieEnabled: true,
    birdieAmount: u,
    eagleEnabled: true,
    eagleAmount: u * 2,
    albatrossEnabled: true,
    albatrossAmount: u * 3,
    sandSaveEnabled: false,
    sandSaveAmount: u,
    parTrainEnabled: false,
    parTrainAmount: u,
    parTrainMinStreak: 3,
    waterHazardEnabled: true,
    waterHazardAmount: u,
    outOfBoundsEnabled: true,
    outOfBoundsAmount: u,
  };
}

/**
 * 单个挂花事件的金额变动（零和：触发者向每人收/付 amount，其他人各付/收 amount）
 */
export function eventPayouts(
  event: GolfEventType,
  triggerIndex: number,
  playerCount: number,
  config: EventModifierConfig,
): number[] {
  const out = Array.from({ length: playerCount }, () => 0);
  const others = playerCount - 1;
  if (others <= 0) return out;

  let amount = 0;
  let direction = 1;

  switch (event) {
    case 'birdie':
      if (!config.birdieEnabled) return out;
      amount = config.birdieAmount;
      direction = 1;
      break;
    case 'eagle':
      if (!config.eagleEnabled) return out;
      amount = config.eagleAmount;
      direction = 1;
      break;
    case 'albatross':
      if (!config.albatrossEnabled) return out;
      amount = config.albatrossAmount;
      direction = 1;
      break;
    case 'sand_save':
      if (!config.sandSaveEnabled) return out;
      amount = config.sandSaveAmount;
      direction = 1;
      break;
    case 'par_train':
      if (!config.parTrainEnabled) return out;
      amount = config.parTrainAmount;
      direction = 1;
      break;
    case 'water_hazard':
      if (!config.waterHazardEnabled) return out;
      amount = config.waterHazardAmount;
      direction = -1;
      break;
    case 'out_of_bounds':
      if (!config.outOfBoundsEnabled) return out;
      amount = config.outOfBoundsAmount;
      direction = -1;
      break;
    default:
      return out;
  }

  if (!Number.isFinite(amount) || amount <= 0) return out;

  const per = Math.round(amount * direction);
  if (per === 0) return out;

  out[triggerIndex] = per * others;
  for (let i = 0; i < playerCount; i += 1) {
    if (i !== triggerIndex) out[i] = -per;
  }
  return out;
}

/**
 * 当前洞及之前连续若干洞均为帕（净杆 = Par）
 */
export function detectParTrain(
  scores: ReadonlyArray<{ hole: number; net: number; par: number }>,
  currentHole: number,
  minStreak = 3,
): boolean {
  if (currentHole < minStreak) return false;
  for (let h = currentHole - minStreak + 1; h <= currentHole; h += 1) {
    const s = scores.find((r) => r.hole === h);
    if (!s) return false;
    if (s.net !== s.par) return false;
  }
  return true;
}

export function cumulativeEventPayouts(
  events: HoleEventRecord[],
  throughHole: number,
  playerCount: number,
  config: EventModifierConfig,
): number[] {
  const totals = Array.from({ length: playerCount }, () => 0);
  for (const ev of events) {
    if (ev.hole > throughHole) continue;
    const pay = eventPayouts(ev.event, ev.playerIndex, playerCount, config);
    pay.forEach((v, i) => {
      totals[i] += v;
    });
  }
  return totals.map((x) => Math.round(x));
}

/** 将挂花累计叠加到玩法基底累计（元） */
export function mergeEventPayoutsIntoBase(
  base: number[],
  events: HoleEventRecord[] | undefined,
  throughHole: number,
  n: number,
  config: EventModifierConfig | undefined,
): number[] {
  if (!events?.length || !config) return base.map((x) => Math.round(x));
  const ev = cumulativeEventPayouts(events, throughHole, n, config);
  return base.map((x, i) => Math.round(x + (ev[i] ?? 0)));
}
