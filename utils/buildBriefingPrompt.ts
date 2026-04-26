import {
  calcHandicapIndex,
  compareHandicapRecordsChronologicalAsc,
  equivalent18AdjustedGross,
  normalizeHandicapRecords,
  type HandicapRecord,
} from '@/lib/handicap';

const NA = '数据不足';

export type BriefingMatchContext = {
  courseName: string;
  gameModeLabel: string;
  holes: 9 | 18;
  players: { name: string; hcp: string }[];
};

function recentSlice(records: HandicapRecord[], max: number): HandicapRecord[] {
  const norm = normalizeHandicapRecords(records);
  const asc = [...norm].sort(compareHandicapRecordsChronologicalAsc);
  const tail = asc.slice(-max);
  return tail.reverse();
}

function avgScoreStr(slice: HandicapRecord[]): string {
  if (slice.length === 0) return NA;
  const s = slice.reduce((a, r) => a + equivalent18AdjustedGross(r), 0) / slice.length;
  return `${Math.round(s * 10) / 10}`;
}

function avgPutts(slice: HandicapRecord[]): string {
  const rows = slice.filter(
    (r) => r.totalPutts != null && Number.isFinite(r.totalPutts) && r.holes > 0,
  );
  if (rows.length === 0) return NA;
  const v = rows.reduce((a, r) => a + (r.totalPutts as number) / r.holes, 0) / rows.length;
  return `${round1(v)}`;
}

function avgGirPct(slice: HandicapRecord[]): string {
  const n = avgGirPctNum(slice);
  return n == null ? NA : `${Math.round(n)}`;
}

function avgGirPctNum(slice: HandicapRecord[]): number | null {
  const rows = slice.filter(
    (r) => r.greensInRegulation != null && Number.isFinite(r.greensInRegulation) && r.holes > 0,
  );
  if (rows.length === 0) return null;
  return (
    rows.reduce((a, r) => a + ((r.greensInRegulation as number) / r.holes) * 100, 0) / rows.length
  );
}

/** 每场总推杆数（仅统计有 totalPutts 的场次） */
function avgTotalPuttsPerRound(slice: HandicapRecord[]): number | null {
  const rows = slice.filter(
    (r) => r.totalPutts != null && Number.isFinite(r.totalPutts) && r.holes > 0,
  );
  if (rows.length === 0) return null;
  return rows.reduce((a, r) => a + (r.totalPutts as number), 0) / rows.length;
}

function ascChronoRecords(records: HandicapRecord[]): HandicapRecord[] {
  const norm = normalizeHandicapRecords(records);
  return [...norm].sort(compareHandicapRecordsChronologicalAsc);
}

function tailSlice(asc: HandicapRecord[], n: number): HandicapRecord[] {
  if (asc.length === 0 || n <= 0) return [];
  return asc.slice(-Math.min(n, asc.length));
}

/** 近5场 vs 近20场 GIR：样本不足时返回说明文案 */
function girFiveVsTwentyLine(asc: HandicapRecord[]): string {
  if (asc.length < 2) return NA;
  const last20 = tailSlice(asc, 20);
  const last5 = tailSlice(asc, 5);
  const g20 = avgGirPctNum(last20);
  const g5 = avgGirPctNum(last5);
  if (g20 == null || g5 == null) return NA;
  const d = g5 - g20;
  let trend = '基本持平';
  if (d > 2) trend = '近5场高于近20场均值，呈上升趋势（进步）';
  else if (d < -2) trend = '近5场低于近20场均值，呈下降趋势（退步）';
  return `近5场平均 GIR ${Math.round(g5)}%，近20场（实际 ${last20.length} 场）平均 ${Math.round(g20)}%，${trend}`;
}

function puttsFiveVsTwentyLine(asc: HandicapRecord[]): string {
  if (asc.length < 2) return NA;
  const last20 = tailSlice(asc, 20);
  const last5 = tailSlice(asc, 5);
  const p20 = avgTotalPuttsPerRound(last20);
  const p5 = avgTotalPuttsPerRound(last5);
  if (p20 == null || p5 == null) return NA;
  const d = p5 - p20;
  let trend = '基本持平';
  if (d < -0.4) trend = '近5场低于近20场均值，推杆呈好转';
  else if (d > 0.4) trend = '近5场高于近20场均值，推杆需关注';
  return `近5场场均推杆 ${round1(p5)}，近20场（实际 ${last20.length} 场）场均 ${round1(p20)}，${trend}`;
}

/** 最近若干场每场球道命中率，新→旧，如 76%、50%、— */
function recentRoundsFirPercents(asc: HandicapRecord[], count: number): string {
  const tail = tailSlice(asc, count).reverse();
  if (tail.length === 0) return NA;
  return tail.map((r) => firPctRound(r)).join('、');
}

function firPctRound(r: HandicapRecord): string {
  if ((r.fairwaysTotal ?? 0) <= 0) return '—';
  if (
    r.fairwaysHit == null ||
    r.fairwaysTotal == null ||
    !Number.isFinite(r.fairwaysHit) ||
    !Number.isFinite(r.fairwaysTotal)
  ) {
    return '—';
  }
  const pct = Math.round(((r.fairwaysHit as number) / (r.fairwaysTotal as number)) * 100);
  return `${pct}%`;
}

function avgFirPct(slice: HandicapRecord[]): string {
  const rows = slice.filter(
    (r) =>
      (r.fairwaysTotal ?? 0) > 0 &&
      r.fairwaysHit != null &&
      r.fairwaysTotal != null &&
      Number.isFinite(r.fairwaysHit) &&
      Number.isFinite(r.fairwaysTotal),
  );
  if (rows.length === 0) return NA;
  const v =
    rows.reduce((a, r) => a + ((r.fairwaysHit as number) / (r.fairwaysTotal as number)) * 100, 0) /
    rows.length;
  return `${Math.round(v)}`;
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

/** Par3/4/5 上场均相对标准杆；样本不足时返回 NA */
function worstParLine(slice: HandicapRecord[]): string {
  const usable = slice.filter((r) => r.holeDetails && r.holeDetails.length >= 9);
  if (usable.length === 0) return NA;
  const agg: Record<3 | 4 | 5, { sum: number; n: number }> = {
    3: { sum: 0, n: 0 },
    4: { sum: 0, n: 0 },
    5: { sum: 0, n: 0 },
  };
  for (const r of usable) {
    for (const h of r.holeDetails) {
      const p = h.par;
      if (p !== 3 && p !== 4 && p !== 5) continue;
      agg[p].sum += h.strokes - h.par;
      agg[p].n += 1;
    }
  }
  let bestPar: 3 | 4 | 5 = 4;
  let bestAvg = -Infinity;
  for (const p of [3, 4, 5] as const) {
    if (agg[p].n === 0) continue;
    const avg = agg[p].sum / agg[p].n;
    if (avg > bestAvg) {
      bestAvg = avg;
      bestPar = p;
    }
  }
  if (!Number.isFinite(bestAvg) || bestAvg === -Infinity) return NA;
  const sign = bestAvg >= 0 ? '+' : '';
  return `Par ${bestPar} 场均 ${sign}${bestAvg.toFixed(1)}`;
}

/** 三个 Par 分段的超出均值，样本不足时返回 NA */
function allParAvgLines(slice: HandicapRecord[]): string {
  const usable = slice.filter((r) => r.holeDetails && r.holeDetails.length >= 9);
  if (usable.length === 0) return NA;
  const agg: Record<3 | 4 | 5, { sum: number; n: number }> = {
    3: { sum: 0, n: 0 },
    4: { sum: 0, n: 0 },
    5: { sum: 0, n: 0 },
  };
  for (const r of usable) {
    for (const h of r.holeDetails) {
      const p = h.par;
      if (p !== 3 && p !== 4 && p !== 5) continue;
      agg[p].sum += h.strokes - h.par;
      agg[p].n += 1;
    }
  }
  const lines = ([3, 4, 5] as const).map((p) => {
    if (agg[p].n === 0) return `Par${p}: 数据不足`;
    const avg = agg[p].sum / agg[p].n;
    const sign = avg >= 0 ? '+' : '';
    return `Par${p} 场均 ${sign}${avg.toFixed(1)}`;
  });
  return lines.join(' / ');
}

function weakLine(fir: string, putts: string, gir: string): string {
  return `FIR ${fir}（推杆 ${putts} / GIR ${gir}）`;
}

export type BuildBriefingPromptResult = {
  prompt: string;
  historyThin: boolean;
};

export function buildBriefingPrompt(
  records: HandicapRecord[],
  ctx: BriefingMatchContext,
): BuildBriefingPromptResult {
  const norm = normalizeHandicapRecords(records);
  const slice = recentSlice(norm, 8);
  const historyThin = norm.length < 3;
  const asc = ascChronoRecords(records);
  const girTrend = girFiveVsTwentyLine(asc);
  const puttsTrend = puttsFiveVsTwentyLine(asc);
  const firLast3 = recentRoundsFirPercents(asc, 3);

  const hi = calcHandicapIndex(norm);
  const hcpStr = typeof hi === 'number' && Number.isFinite(hi) ? hi.toFixed(1) : NA;
  const n = slice.length;
  const avgTotal = n > 0 ? avgScoreStr(slice) : NA;
  const fir = n > 0 ? avgFirPct(slice) : NA;
  const putts = n > 0 ? avgPutts(slice) : NA;
  const gir = n > 0 ? avgGirPct(slice) : NA;
  const weak = historyThin ? NA : weakLine(fir, putts, gir);
  const worst = historyThin ? NA : worstParLine(slice);
  const allParAvg = historyThin ? NA : allParAvgLines(slice);

  const opponents = ctx.players
    .slice(1)
    .map((p) => {
      const nm = p.name.trim();
      if (!nm) return null;
      const h = p.hcp.trim() || '—';
      return `${nm}（差点 ${h}）`;
    })
    .filter((x): x is string => Boolean(x));
  const oppBlock =
    opponents.length > 0
      ? `- 同组玩家：${opponents.join(' / ')}\n`
      : `- 同组玩家：无（可跳过针对对手的战术分析）\n`;

  const courseLine = ctx.courseName.trim() ? ctx.courseName.trim() : NA;

  const prompt = `球员档案：
- 差点 ${hcpStr}，近 ${n > 0 ? String(n) : NA} 场均杆 ${avgTotal}
- 弱项：${weak}
- Par 分段均杆：${allParAvg}
- 最差洞型：${worst}
- 最近5场 vs 最近20场 GIR 对比：${girTrend}
- 推杆数趋势（近5场场均推杆 vs 近20场）：${puttsTrend}
- 最近3场每场球道命中率（新→旧）：${firLast3}

今日比赛：
- 球场：${courseLine}
- 玩法：${ctx.gameModeLabel || NA}
${oppBlock}- 洞数：${ctx.holes} 洞

请生成：
1. 今日核心策略（1 句话，针对玩法和对手差点）
2. 需要重点关注的 3 个洞型或场景（每条不超过 25 字）
3. 本场扬长避短建议（1 条，基于球员弱项）
4. 心态建议（1 句话）
5. 浓缩建议（单独一行，总长度不超过 60 字）：直接给结论，不要客套话、不要小标题。必须包含：①最需要改进的一项具体指标（带数字）②对应的具体练习动作（不超过 20 字，像教练在球场边说的短口令）③下场目标（一句话，带具体数字）。示例：GIR仅23%，重点练80-100码半挥杆，目标下场GIR达30%以上

请给出（三项合成一句写入第 5 点，不要分列输出）：
1. 最需要改进的一项具体指标（给出数字）
2. 对应的具体练习动作（不超过20字，像教练在球场边说的）
3. 下场目标（一句话，带具体数字）

例如："GIR仅23%，重点练80-100码半挥杆，目标下场GIR达30%以上"
格式：直接给结论，不要客套话，不要标题，总长度不超过60字

只输出以上五部分，1–4 格式与原先相同；第 5 点必须写成：5. （单行内容）`;

  return { prompt, historyThin };
}

export type ParsedBriefing = {
  strategy: string;
  /** 最多 3 条 */
  focus: string[];
  leverage: string;
  mindset: string;
  /** 第 5 点：≤60 字浓缩建议（模型可能省略） */
  condensed?: string;
};

/** 解析模型输出的 1–5 段结构（第 5 点浓缩句可选） */
export function parseBriefingResponse(text: string): ParsedBriefing | null {
  const t = text.trim();
  const m1 = t.match(/1[\\.、]\s*([\s\S]*?)(?=\n\s*2[\\.、]|$)/);
  const m2 = t.match(/2[\\.、]\s*([\s\S]*?)(?=\n\s*3[\\.、]|$)/);
  const m3 = t.match(/3[\\.、]\s*([\s\S]*?)(?=\n\s*4[\\.、]|$)/);
  const m4 = t.match(/4[\\.、]\s*([\s\S]*?)(?=\n\s*5[\\.、]|$)/);
  const m5 = t.match(/(?:^|\n)\s*5[\\.、]\s*([^\n]+)/m);
  const strategy = m1?.[1]?.trim() ?? '';
  const block2 = m2?.[1]?.trim() ?? '';
  const leverage = m3?.[1]?.trim() ?? '';
  const mindset = m4?.[1]?.trim() ?? '';
  const condensed = m5?.[1]?.trim() || undefined;
  const focusLines = block2
    .split(/\n+/)
    .map((s) => s.replace(/^\s*[-*•\d]+[.)）]?\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 3);
  while (focusLines.length < 3) focusLines.push('');
  if (!strategy) return null;
  return { strategy, focus: focusLines, leverage, mindset: mindset || '—', condensed };
}
