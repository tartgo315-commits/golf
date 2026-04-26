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

/** 「主要短板」第一段的首句（按换行分段后再取句末标点切分） */
export function trainingWeaknessFirstParagraphFirstSentence(weakness: string): string {
  const t = weakness.trim();
  if (!t) return '';
  const firstPara =
    t
      .split(/\n+/)
      .map((l) => l.trim())
      .find(Boolean) ?? t;
  return trainingWeaknessSummary(firstPara);
}

function clampGoal(s: string, max: number): string {
  const x = s.trim();
  if (x.length <= max) return x;
  return `${x.slice(0, max - 1)}…`;
}

/** 从练球分析全文推断「下场目标」展示文案 */
function extractTrainingRoundGoalLine(text: string, p: ParsedTraining): string | null {
  const explicit = text.match(/(?:下场目标|本场目标)\s*[：:]\s*([^\n]+)/);
  if (explicit?.[1]) return clampGoal(explicit[1], 72);

  const weeklyLines = (p.weeklyPlan ?? '')
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  for (const line of weeklyLines) {
    if (
      line.length >= 6 &&
      line.length <= 72 &&
      /%|\d/.test(line) &&
      (/目标|争取|力争|次|练|杆|洞/.test(line) || /\d+\s*[-–~～]\s*\d+/.test(line))
    ) {
      return line;
    }
  }

  const prLines = (p.practice ?? '')
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const prFirst = prLines[0];
  if (prFirst && prFirst.length >= 8 && prFirst.length <= 72) return prFirst;

  const w = p.weakness?.trim() ?? '';
  const wm = w.match(/[^。\n]*(?:下场目标|本场目标|杆数目标)[^。\n]*(?:。|$)/);
  if (wm?.[0]) {
    const inner = wm[0].replace(/^[^：:]*[：:]\s*/, '').trim();
    if (inner.length >= 4) return clampGoal(inner, 72);
  }

  const fallback = weeklyLines[0];
  if (fallback && fallback.length <= 72) return fallback;
  return null;
}

/**
 * 首页 AI 卡：缓存为完整练球分析（>100 字）时，取主要短板首句 + 推断的下场目标行
 */
export function trainingHomeFromLongCache(text: string): { summary: string; goal: string | null } | null {
  const raw = typeof text === 'string' ? text.trim() : '';
  if (raw.length <= 100) return null;
  const p = parseAITrainingResult(raw);
  const w = p.weakness?.trim() ?? '';
  if (!w) return null;
  const summary = trainingWeaknessFirstParagraphFirstSentence(w);
  if (!summary) return null;
  const goal = extractTrainingRoundGoalLine(raw, p);
  return { summary, goal };
}
