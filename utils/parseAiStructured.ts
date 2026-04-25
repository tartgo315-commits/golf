function extractSequential(text: string, labels: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i]!;
    const start = `【${label}】`;
    const idx = text.indexOf(start);
    if (idx === -1) continue;
    const from = idx + start.length;
    let end = text.length;
    for (let j = i + 1; j < labels.length; j++) {
      const next = `【${labels[j]}】`;
      const ni = text.indexOf(next, from);
      if (ni !== -1) {
        end = ni;
        break;
      }
    }
    out[label] = text.slice(from, end).trim();
  }
  return out;
}

const TRAINING_LABELS = ['主要短板', '重点练习', '每周计划', '重点球杆'] as const;

export type ParsedTraining = {
  weakness: string;
  practice: string;
  weeklyPlan: string;
  keyClub: string;
  ok: boolean;
};

export function parseAITrainingResult(text: string): ParsedTraining {
  const m = extractSequential(text, TRAINING_LABELS);
  const weakness = m['主要短板'] ?? '';
  const practice = m['重点练习'] ?? '';
  const weeklyPlan = m['每周计划'] ?? '';
  const keyClub = m['重点球杆'] ?? '';
  const ok = Boolean(weakness && practice && weeklyPlan && keyClub);
  return { weakness, practice, weeklyPlan, keyClub, ok };
}

const STRATEGY_LABELS = ['本场目标', '短板规避', '优势发挥', '心态节奏', '核心口诀'] as const;

export type ParsedStrategy = {
  goal: string;
  avoid: string;
  strength: string;
  rhythm: string;
  mantra: string;
  ok: boolean;
};

export function parseAIStrategyResult(text: string): ParsedStrategy {
  const m = extractSequential(text, STRATEGY_LABELS);
  const goal = m['本场目标'] ?? '';
  const avoid = m['短板规避'] ?? '';
  const strength = m['优势发挥'] ?? '';
  const rhythm = m['心态节奏'] ?? '';
  const mantra = m['核心口诀'] ?? '';
  const ok = Boolean(goal && avoid && strength && rhythm && mantra);
  return { goal, avoid, strength, rhythm, mantra, ok };
}

/** 取「主要短板」摘要：第一句或首段前 120 字 */
export function trainingWeaknessSummary(weakness: string): string {
  const t = weakness.trim();
  if (!t) return '';
  const parts = t.split(/(?<=[。！？.!?])\s+/);
  const first = parts[0]?.trim() ?? t;
  return first.length > 120 ? `${first.slice(0, 120)}…` : first;
}
