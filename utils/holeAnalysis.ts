import {
  calcHandicapIndex,
  loadHandicapRecords,
  type HandicapHoleData,
  type HandicapRecord,
} from '@/lib/handicap';

export type WorstHoleRow = {
  hole: number;
  par: number;
  score: number;
  over: number;
};

/** 失分最多的 n 洞（按相对 Par 的超出杆数） */
export function worstHoles(holeData: HandicapHoleData[], n = 3): WorstHoleRow[] {
  const sorted = [...holeData].sort((a, b) => {
    const da = a.score - a.par;
    const db = b.score - b.par;
    if (db !== da) return db - da;
    return a.hole - b.hole;
  });
  return sorted.slice(0, n).map((h) => ({
    hole: h.hole,
    par: h.par,
    score: h.score,
    over: h.score - h.par,
  }));
}

export type LossBreakdown = {
  putting: number;
  shortGame: number;
  longGame: number;
  penalty: number;
};

/**
 * 各类失分占比（0–100，四项之和为 100）。
 * 以加权计数归一化：罚杆用杆数权重；其余用规则标签权重（可同洞并存）。
 */
export function lossBreakdown(holeData: HandicapHoleData[]): LossBreakdown {
  let wP = 0;
  let wS = 0;
  let wL = 0;
  let wF = 0;
  for (const h of holeData) {
    wF += Math.max(0, h.penalty);
    if (h.putts >= 3) wP += 1 + (h.putts - 3) * 0.5;
    if (h.gir === false && h.score <= h.par + 1) wS += 1;
    if (h.par >= 4 && h.fir === false) wL += 1;
  }
  const sum = wP + wS + wL + wF;
  if (sum <= 0) {
    return { putting: 0, shortGame: 0, longGame: 0, penalty: 0 };
  }
  const raw = [(wP / sum) * 100, (wS / sum) * 100, (wL / sum) * 100, (wF / sum) * 100];
  const floors = raw.map((x) => Math.floor(x));
  let rem = 100 - floors.reduce((a, b) => a + b, 0);
  const frac = raw.map((x, i) => ({ i, f: x - floors[i]! }));
  frac.sort((a, b) => b.f - a.f);
  const out = [...floors];
  for (let k = 0; k < rem; k += 1) {
    out[frac[k % frac.length]!.i] += 1;
  }
  return {
    putting: out[0]!,
    shortGame: out[1]!,
    longGame: out[2]!,
    penalty: out[3]!,
  };
}

/** 标准差映射为 0–100，越高越稳定 */
export function consistencyScore(holeData: HandicapHoleData[]): number {
  if (holeData.length === 0) return 0;
  if (holeData.length === 1) return 100;
  const diffs = holeData.map((h) => h.score - h.par);
  const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  const variance = diffs.reduce((s, x) => s + (x - mean) ** 2, 0) / diffs.length;
  const sigma = Math.sqrt(Math.max(0, variance));
  const CAP = 2.8;
  const raw = 100 * (1 - Math.min(1, sigma / CAP));
  return Math.round(Math.max(0, Math.min(100, raw)));
}

export function consistencyLabel(score: number): string {
  if (score < 40) return '你的成绩波动较大';
  if (score < 70) return '你的成绩波动一般';
  return '你的成绩较为稳定';
}

function countLossHoles(holeData: HandicapHoleData[]) {
  let putting = 0;
  let short = 0;
  let long = 0;
  let penaltyStrokes = 0;
  for (const h of holeData) {
    if (h.putts >= 3) putting += 1;
    if (h.gir === false && h.score <= h.par + 1) short += 1;
    if (h.par >= 4 && h.fir === false) long += 1;
    penaltyStrokes += Math.max(0, h.penalty);
  }
  return { putting, short, long, penaltyStrokes };
}

/** 供 AI 使用的结构化中文 prompt（与 UI 失分分析同源统计口径） */
export function buildAIPrompt(round: HandicapRecord, holeData: HandicapHoleData[]): string {
  const hi = calcHandicapIndex(loadHandicapRecords());
  const hiStr = typeof hi === 'number' ? hi.toFixed(1) : '—';
  const totalStrokes = round.adjustedGrossScore;
  const course = round.courseName.trim() || '—';
  const { putting, short, long, penaltyStrokes } = countLossHoles(holeData);
  const worst = worstHoles(holeData, 3);
  const worstLine = worst.map((w) => `第${w.hole}洞(Par${w.par}) 打了${w.score}杆`).join(' / ');
  const n = holeData.length;
  const sumPutts = holeData.reduce((s, h) => s + h.putts, 0);
  const avgPutts = n > 0 ? Math.round((sumPutts / n) * 10) / 10 : 0;
  const threePlus = holeData.filter((h) => h.putts >= 3).length;
  const girHit = holeData.filter((h) => h.gir === true).length;
  const girPct = n > 0 ? Math.round((girHit / n) * 100) : 0;
  const firRows = holeData.filter((h) => h.par >= 4);
  const firHit = firRows.filter((h) => h.fir === true).length;
  const firPct = firRows.length > 0 ? Math.round((firHit / firRows.length) * 100) : 0;

  return `球员信息：差点 ${hiStr}，本场总杆 ${totalStrokes}，球场 ${course}
失分分布：推杆失分 ${putting} 洞，短杆失分 ${short} 洞，长杆失分 ${long} 洞，罚杆 ${penaltyStrokes} 次
最差 3 洞：${worstLine}
推杆数据：场均 ${avgPutts} 推，3 推以上 ${threePlus} 洞
GIR：${girPct}%，FIR：${firPct}%
请根据以上数据给出：
1. 本场最需改进的 1 个问题（一句话，直接说问题）
2. 针对该问题的具体练习方法（3 条，每条不超过 30 字）
3. 下场策略建议（1 条，针对球场特点）
只输出以上三部分，不要多余的话。`;
}

export type ParsedAiReview = {
  problem: string;
  drills: string[];
  strategy: string;
};

/** 将模型返回的「1. / 2. / 3.」结构解析为三段（失败时返回 null） */
export function parseStructuredAiReview(raw: string): ParsedAiReview | null {
  const t = raw.trim();
  if (!t) return null;
  const norm = t.replace(/\r\n/g, '\n');
  const m1 = norm.match(/(?:^|\n)\s*1[\.、]\s*([\s\S]*?)(?=\n\s*2[\.、]|\s*$)/);
  const m2 = norm.match(/(?:^|\n)\s*2[\.、]\s*([\s\S]*?)(?=\n\s*3[\.、]|\s*$)/);
  const m3 = norm.match(/(?:^|\n)\s*3[\.、]\s*([\s\S]*)$/);
  if (!m1) return null;
  const problem = m1[1]!.replace(/\n+/g, ' ').trim();
  const block2 = m2 ? m2[1]!.trim() : '';
  const strategy = m3 ? m3[1]!.replace(/\n+/g, ' ').trim() : '';
  const drillLines = block2
    .split(/\n+/)
    .map((l) => l.replace(/^\s*[-*•\d.)]+\s*/, '').trim())
    .filter(Boolean);
  const drills = drillLines.slice(0, 3);
  while (drills.length < 3) drills.push('');
  if (!problem || !strategy) return null;
  return { problem, drills, strategy };
}
