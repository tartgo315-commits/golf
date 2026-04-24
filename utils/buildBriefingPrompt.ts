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
  const rows = slice.filter((r) => r.totalPutts != null && Number.isFinite(r.totalPutts) && r.holes > 0);
  if (rows.length === 0) return NA;
  const v = rows.reduce((a, r) => a + (r.totalPutts as number) / r.holes, 0) / rows.length;
  return `${round1(v)}`;
}

function avgGirPct(slice: HandicapRecord[]): string {
  const rows = slice.filter((r) => r.greensInRegulation != null && Number.isFinite(r.greensInRegulation) && r.holes > 0);
  if (rows.length === 0) return NA;
  const v = rows.reduce((a, r) => a + ((r.greensInRegulation as number) / r.holes) * 100, 0) / rows.length;
  return `${Math.round(v)}`;
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
  const v = rows.reduce((a, r) => a + ((r.fairwaysHit as number) / (r.fairwaysTotal as number)) * 100, 0) / rows.length;
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

function weakLine(fir: string, putts: string, gir: string): string {
  return `FIR ${fir}（推杆 ${putts} / GIR ${gir}）`;
}

export type BuildBriefingPromptResult = {
  prompt: string;
  historyThin: boolean;
};

export function buildBriefingPrompt(records: HandicapRecord[], ctx: BriefingMatchContext): BuildBriefingPromptResult {
  const norm = normalizeHandicapRecords(records);
  const slice = recentSlice(norm, 8);
  const historyThin = norm.length < 3;

  const hi = calcHandicapIndex(norm);
  const hcpStr = typeof hi === 'number' && Number.isFinite(hi) ? hi.toFixed(1) : NA;
  const n = slice.length;
  const avgTotal = n > 0 ? avgScoreStr(slice) : NA;
  const fir = n > 0 ? avgFirPct(slice) : NA;
  const putts = n > 0 ? avgPutts(slice) : NA;
  const gir = n > 0 ? avgGirPct(slice) : NA;
  const weak = historyThin ? NA : weakLine(fir, putts, gir);
  const worst = historyThin ? NA : worstParLine(slice);

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
- 最差洞型：${worst}

今日比赛：
- 球场：${courseLine}
- 玩法：${ctx.gameModeLabel || NA}
${oppBlock}- 洞数：${ctx.holes} 洞

请生成：
1. 今日核心策略（1 句话，针对玩法和对手差点）
2. 需要重点关注的 3 个洞型或场景（每条不超过 25 字）
3. 本场扬长避短建议（1 条，基于球员弱项）
4. 心态建议（1 句话）
只输出以上四部分，格式固定，不要多余内容。`;

  return { prompt, historyThin };
}

export type ParsedBriefing = {
  strategy: string;
  /** 最多 3 条 */
  focus: string[];
  leverage: string;
  mindset: string;
};

/** 解析模型输出的 1–4 段结构 */
export function parseBriefingResponse(text: string): ParsedBriefing | null {
  const t = text.trim();
  const m1 = t.match(/1[\\.、]\s*([\s\S]*?)(?=\n\s*2[\\.、]|$)/);
  const m2 = t.match(/2[\\.、]\s*([\s\S]*?)(?=\n\s*3[\\.、]|$)/);
  const m3 = t.match(/3[\\.、]\s*([\s\S]*?)(?=\n\s*4[\\.、]|$)/);
  const m4 = t.match(/4[\\.、]\s*([\s\S]*)/);
  const strategy = m1?.[1]?.trim() ?? '';
  const block2 = m2?.[1]?.trim() ?? '';
  const leverage = m3?.[1]?.trim() ?? '';
  const mindset = m4?.[1]?.trim() ?? '';
  const focusLines = block2
    .split(/\n+/)
    .map((s) => s.replace(/^\s*[-*•\d]+[.)）]?\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 3);
  while (focusLines.length < 3) focusLines.push('');
  if (!strategy) return null;
  return { strategy, focus: focusLines, leverage, mindset: mindset || '—' };
}
