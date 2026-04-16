import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { MiniTrendChart } from '@/components/MiniTrendChart';
import { StatCard, type StatCardHighlight } from '@/components/StatCard';
import type { ComputedAllStats } from '@/src/utils/statsEngine';

export type ScoreAnalyticsTabId = 'overview' | 'tee' | 'approach' | 'short' | 'putting' | 'sg';

type AllStats = ComputedAllStats;

const WHITE = '#ffffff';
const MUTED = 'rgba(255,255,255,0.55)';
const MUTED2 = 'rgba(255,255,255,0.42)';
const BORDER = 'rgba(255,255,255,0.08)';
const PRIMARY_GREEN = '#166534';

function fmtPct(n: number | null, digits = 1): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  return `${n.toFixed(digits)}%`;
}

function fmtNum(n: number | null, digits = 1): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  return n.toFixed(digits);
}

function hasAnyNumericRecord(obj: Record<string, number | null> | null): boolean {
  if (!obj) return false;
  return Object.values(obj).some((v) => v != null && Number.isFinite(v));
}

function approachTabHasAnyCard(a: AllStats['approach']): boolean {
  const anyParGir = [a.girByPar.par3, a.girByPar.par4, a.girByPar.par5].some(
    (v) => v != null && Number.isFinite(v),
  );
  return (
    a.girPct != null ||
    anyParGir ||
    a.avgProximity != null ||
    a.missGreenDirection != null ||
    (a.girByDistance != null && hasAnyNumericRecord(a.girByDistance)) ||
    a.girTrend.some((t) => t.value != null && Number.isFinite(t.value))
  );
}

function puttingTabHasAnyCard(p: AllStats['putting']): boolean {
  return (
    p.avgPuttsPerHole != null ||
    p.avgTotalPutts != null ||
    p.threePuttPct != null ||
    p.onePuttPct != null ||
    p.puttsWhenGIR != null ||
    p.puttsWhenMiss != null ||
    (p.puttsByDistance != null && hasAnyNumericRecord(p.puttsByDistance)) ||
    p.puttsTrend.some((t) => t.value != null && Number.isFinite(t.value))
  );
}

/** 0° = 顶部，顺时针为正（与开球扇区顺序一致） */
function polarPoint(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** 从圆心到弧线的扇形路径；接近整圆时返回 null（改用 Circle） */
function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string | null {
  const sweep = endDeg - startDeg;
  if (sweep <= 0.0001) return null;
  if (sweep >= 359.99) return null;
  const p0 = polarPoint(cx, cy, r, startDeg);
  const p1 = polarPoint(cx, cy, r, endDeg);
  const largeArc = sweep > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${p0.x} ${p0.y} A ${r} ${r} 0 ${largeArc} 1 ${p1.x} ${p1.y} Z`;
}

function DistributionBars({ pct }: { pct: AllStats['scoring']['distributionPct'] }) {
  const items = [
    { key: 'eagle', label: '老鹰', zh: 'Eagle', color: '#FFD700' },
    { key: 'birdie', label: '小鸟', zh: 'Birdie', color: '#4ade80' },
    { key: 'par', label: '标准杆', zh: 'Par', color: '#ffffff' },
    { key: 'bogey', label: '柏忌', zh: 'Bogey', color: '#f97316' },
    { key: 'doublePlus', label: '双柏忌+', zh: 'Dbl+', color: '#ef4444' },
  ] as const;

  const nums = items.map((it) => {
    const v = pct[it.key];
    return v == null || !Number.isFinite(v) ? 0 : Math.max(0, v);
  });
  const maxPct = Math.max(...nums, 0.01);
  const barW = 40;
  const gap = 12;
  const maxH = 120;
  const svgW = items.length * barW + (items.length - 1) * gap + 24;
  const svgH = maxH + 52;

  return (
    <View style={styles.distWrap}>
      <Svg width={svgW} height={svgH}>
        {items.map((it, i) => {
          const p = nums[i]!;
          const h = p <= 0 ? 2 : (p / maxPct) * maxH;
          const x = 12 + i * (barW + gap);
          const y = 8 + maxH - h;
          const labelPct = fmtPct(p, 1) ?? '0%';
          return (
            <G key={it.key}>
              <Rect x={x} y={y} width={barW} height={h} rx={4} fill={it.color} opacity={0.92} />
              <SvgText
                x={x + barW / 2}
                y={maxH + 28}
                fill={MUTED}
                fontSize={10}
                fontWeight="600"
                textAnchor="middle">
                {labelPct}
              </SvgText>
              <SvgText
                x={x + barW / 2}
                y={maxH + 44}
                fill={WHITE}
                fontSize={11}
                fontWeight="700"
                textAnchor="middle">
                {it.label}
              </SvgText>
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

function MissTendencyPie({
  firPct,
  mt,
}: {
  firPct: number | null;
  mt: NonNullable<AllStats['tee']['missTendency']>;
}) {
  /** 饼直径 160（r=80），画布略大以容纳外围百分比文字 */
  const pieR = 80;
  const pad = 20;
  const vb = pieR * 2 + pad * 2;
  const cx = vb / 2;
  const cy = vb / 2;
  const r = pieR;
  const strokePie = '#0d1f10';

  const segs = [
    { pct: mt.left, color: '#ef4444', label: 'Left' },
    { pct: mt.fairway, color: '#4ade80', label: 'Fairway' },
    { pct: mt.right, color: '#60a5fa', label: 'Right' },
  ].filter((s) => s.pct > 0);

  type PieSlice =
    | { kind: 'path'; d: string; color: string; midDeg: number; pct: number; label: string }
    | { kind: 'circle'; color: string; midDeg: number; pct: number; label: string };

  const slices: PieSlice[] = [];
  let angle = 0;
  for (const s of segs) {
    const sweep = (s.pct / 100) * 360;
    const startDeg = angle;
    const endDeg = angle + sweep;
    const midDeg = startDeg + sweep / 2;
    if (sweep >= 359.99) {
      slices.push({ kind: 'circle', color: s.color, midDeg, pct: s.pct, label: s.label });
    } else {
      const d = describeArc(cx, cy, r, startDeg, endDeg);
      if (d) slices.push({ kind: 'path', d, color: s.color, midDeg, pct: s.pct, label: s.label });
    }
    angle = endDeg;
  }

  if (slices.length === 0) return null;

  const labelR = r + 16;
  const firMain = firPct != null && Number.isFinite(firPct) ? firPct.toFixed(0) : '—';

  return (
    <View style={styles.pieWrap}>
      <Svg width={vb} height={vb} viewBox={`0 0 ${vb} ${vb}`}>
        <G>
          {slices.map((p, i) =>
            p.kind === 'circle' ? (
              <Circle key={i} cx={cx} cy={cy} r={r} fill={p.color} stroke={strokePie} strokeWidth={1} />
            ) : (
              <Path key={i} d={p.d} fill={p.color} stroke={strokePie} strokeWidth={1} />
            ),
          )}
        </G>
        <SvgText x={cx} y={cy - 2} fill={WHITE} fontSize={24} fontWeight="900" textAnchor="middle">
          {firMain}
        </SvgText>
        <SvgText x={cx} y={cy + 18} fill={WHITE} fontSize={12} fontWeight="800" textAnchor="middle">
          FIR%
        </SvgText>
        {slices.map((p, i) => {
          const pt = polarPoint(cx, cy, labelR, p.midDeg);
          return (
            <SvgText
              key={`lab-${i}`}
              x={pt.x}
              y={pt.y + 4}
              fill={WHITE}
              fontSize={11}
              fontWeight="700"
              textAnchor="middle">
              {`${p.label} ${p.pct.toFixed(0)}%`}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
}

function MissGreenQuad({ m }: { m: NonNullable<AllStats['approach']['missGreenDirection']> }) {
  const maxV = Math.max(m.short, m.long, m.left, m.right, 1);

  return (
    <View style={styles.quadOuter}>
      <Text style={[styles.quadSide, styles.quadTop, { opacity: 0.4 + (0.6 * m.short) / maxV }]}>
        Short {m.short.toFixed(0)}%
      </Text>
      <View style={styles.quadMidRow}>
        <Text style={[styles.quadSide, { opacity: 0.4 + (0.6 * m.left) / maxV }]}>
          Left{'\n'}
          {m.left.toFixed(0)}%
        </Text>
        <View style={styles.quadCircle}>
          <Svg width={72} height={72}>
            <Circle cx={36} cy={36} r={28} fill="rgba(255,255,255,0.06)" stroke={PRIMARY_GREEN} strokeWidth={2} />
          </Svg>
        </View>
        <Text style={[styles.quadSide, { opacity: 0.4 + (0.6 * m.right) / maxV }]}>
          Right{'\n'}
          {m.right.toFixed(0)}%
        </Text>
      </View>
      <Text style={[styles.quadSide, styles.quadBottom, { opacity: 0.4 + (0.6 * m.long) / maxV }]}>
        Long {m.long.toFixed(0)}%
      </Text>
    </View>
  );
}

function GirDistanceBars({ g }: { g: NonNullable<AllStats['approach']['girByDistance']> }) {
  const rows: { key: keyof typeof g; label: string }[] = [
    { key: 'under100', label: '<100y' },
    { key: 'd100_125', label: '100–125' },
    { key: 'd125_150', label: '125–150' },
    { key: 'd150_175', label: '150–175' },
    { key: 'd175_200', label: '175–200' },
    { key: 'over200', label: '200+' },
  ];

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>GIR 距离分桶</Text>
      {rows.map((row) => {
        const v = g[row.key];
        if (v == null) return null;
        return (
          <View key={row.key} style={styles.hBarRow}>
            <Text style={styles.hBarLab}>{row.label}</Text>
            <View style={styles.hBarTrack}>
              <View style={[styles.hBarFill, { width: `${Math.min(100, v)}%` }]} />
            </View>
            <Text style={styles.hBarPct}>{v.toFixed(0)}%</Text>
          </View>
        );
      })}
    </View>
  );
}

function PuttsDistanceTable({ p }: { p: NonNullable<AllStats['putting']['puttsByDistance']> }) {
  const rows: { key: keyof typeof p; label: string }[] = [
    { key: 'ft0_3', label: '0–3ft' },
    { key: 'ft3_6', label: '3–6ft' },
    { key: 'ft6_10', label: '6–10ft' },
    { key: 'ft10_20', label: '10–20ft' },
    { key: 'ft20plus', label: '20ft+' },
  ];

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>一推进洞率（按首推距离）</Text>
      <View style={styles.tableHead}>
        <Text style={[styles.tableCell, styles.tableCellLab]}>距离范围</Text>
        <Text style={[styles.tableCell, styles.tableCellVal]}>一推进洞率</Text>
      </View>
      {rows.map((row) => {
        const v = p[row.key];
        if (v == null) return null;
        return (
          <View key={row.key} style={styles.tableRow}>
            <Text style={[styles.tableCell, styles.tableCellLab]}>{row.label}</Text>
            <Text style={[styles.tableCell, styles.tableCellVal]}>{v.toFixed(1)}%</Text>
          </View>
        );
      })}
    </View>
  );
}

function SgPlaceholder() {
  const barW = 260;
  const barH = 14;
  const gap = 18;
  const labels = ['OTT', 'APP', 'ARG', 'PUTT'];
  const y0 = 24;

  return (
    <View style={styles.sgWrap}>
      <Text style={styles.sgTitle}>Strokes Gained</Text>
      <Text style={styles.sgSub}>最精准的高尔夫表现分析法</Text>
      <Text style={styles.sgBody}>
        SG 通过和基准水平对比，精确量化你在开球、进攻、短杆、推杆每个环节赢或输了多少杆。{'\n'}
        需要在记成绩时记录每杆的剩余距离才能计算。
      </Text>
      <Svg width={barW + 32} height={y0 + labels.length * (barH + gap) + 8} viewBox={`0 0 ${barW + 32} ${y0 + labels.length * (barH + gap) + 8}`}>
        <Line x1={barW / 2 + 16} y1={12} x2={barW / 2 + 16} y2={y0 + labels.length * (barH + gap)} stroke="rgba(255,255,255,0.35)" strokeWidth={1} />
        {labels.map((lab, i) => {
          const y = y0 + i * (barH + gap);
          return (
            <G key={lab}>
              <SvgText x={4} y={y + barH - 2} fill={MUTED} fontSize={11} fontWeight="700">
                {lab}
              </SvgText>
              <Rect x={44} y={y} width={barW} height={barH} rx={4} fill="rgba(255,255,255,0.08)" />
            </G>
          );
        })}
      </Svg>
      <Pressable onPress={() => {}} accessibilityRole="button">
        <Text style={styles.sgCta}>开启逐杆距离记录 →</Text>
      </Pressable>
    </View>
  );
}

function shortGamePctHighlight(pct: number | null): StatCardHighlight {
  if (pct == null || !Number.isFinite(pct)) return null;
  if (pct >= 50) return 'green';
  if (pct < 20) return 'red';
  return null;
}

function threePuttHighlight(pct: number | null): StatCardHighlight {
  if (pct == null) return null;
  if (pct > 5) return 'red';
  if (pct < 0.05) return 'green';
  return null;
}

function onePuttHighlight(pct: number | null): StatCardHighlight {
  if (pct == null) return null;
  if (pct > 15) return 'green';
  return null;
}

function OverviewTab({ scoring }: { scoring: AllStats['scoring'] }) {
  const pct = scoring.distributionPct;
  const hasDistPct = Object.values(pct).some((v) => v != null && Number.isFinite(v));
  if (!hasDistPct) {
    return (
      <View style={styles.tabPane}>
        <Text style={styles.guideBlock}>暂无成绩分布数据。请确认逐洞杆数与标准杆已正确保存。</Text>
      </View>
    );
  }
  return (
    <View style={styles.tabPane}>
      <DistributionBars pct={pct} />
      <View style={styles.row3}>
        <View style={styles.col31}>
          <StatCard value={fmtNum(scoring.avgByPar.par3)} label="Par3 场均" />
        </View>
        <View style={styles.col31}>
          <StatCard value={fmtNum(scoring.avgByPar.par4)} label="Par4 场均" />
        </View>
        <View style={styles.col31}>
          <StatCard value={fmtNum(scoring.avgByPar.par5)} label="Par5 场均" />
        </View>
      </View>
      <View style={styles.row2}>
        <View style={styles.col48}>
          <StatCard value={fmtNum(scoring.avgFront9)} label="前九均杆" />
        </View>
        <View style={styles.col48}>
          <StatCard value={fmtNum(scoring.avgBack9)} label="后九均杆" />
        </View>
      </View>
      <Text style={styles.chartSectionTitle}>成绩走势</Text>
      <MiniTrendChart
        data={scoring.scoreTrend.map((d) => ({ date: d.date, value: d.score }))}
        height={80}
        color="#a3e635"
      />
    </View>
  );
}

function TeeTab({ tee }: { tee: AllStats['tee'] }) {
  const firStr = fmtPct(tee.firPct);
  return (
    <View style={styles.tabPane}>
      {firStr != null ? (
        <StatCard value={firStr} label="上球道率" sublabel="FIR%" />
      ) : (
        <Text style={styles.guideTxt}>记录开球数据后解锁</Text>
      )}
      <StatCard value={fmtNum(tee.avgPenalties)} label="场均罚杆" />
      <StatCard value={fmtNum(tee.avgDriveDistance)} label="平均开球距离" sublabel="码" />
      {tee.missTendency != null ? <MissTendencyPie firPct={tee.firPct} mt={tee.missTendency} /> : null}
      <Text style={styles.chartSectionTitle}>FIR 走势</Text>
      <MiniTrendChart data={tee.firTrend} height={80} />
    </View>
  );
}

function ApproachTab({ approach }: { approach: AllStats['approach'] }) {
  const gbd = approach.girByDistance;
  if (!approachTabHasAnyCard(approach)) {
    return (
      <View style={styles.tabPane}>
        <Text style={styles.guideBlock}>
          当前窗口下暂无进攻果岭统计数据。请确认已保存逐洞成绩与标准杆；若有进攻距离可继续完善记录。
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.tabPane}>
      <StatCard value={fmtPct(approach.girPct)} label="上果岭率" sublabel="GIR%" />
      <View style={styles.row3}>
        <View style={styles.col31}>
          <StatCard value={fmtPct(approach.girByPar.par3)} label="Par3 GIR" />
        </View>
        <View style={styles.col31}>
          <StatCard value={fmtPct(approach.girByPar.par4)} label="Par4 GIR" />
        </View>
        <View style={styles.col31}>
          <StatCard value={fmtPct(approach.girByPar.par5)} label="Par5 GIR" />
        </View>
      </View>
      <StatCard value={fmtNum(approach.avgProximity)} label="平均 Proximity" sublabel="英尺" />
      {approach.missGreenDirection != null ? <MissGreenQuad m={approach.missGreenDirection} /> : null}
      {gbd != null && hasAnyNumericRecord(gbd) ? <GirDistanceBars g={gbd} /> : null}
      <Text style={styles.chartSectionTitle}>GIR 走势</Text>
      <MiniTrendChart data={approach.girTrend} height={80} />
    </View>
  );
}

function ShortTab({ shortGame }: { shortGame: AllStats['shortGame'] }) {
  const empty =
    shortGame.scramblingPct == null &&
    shortGame.upAndDownPct == null &&
    shortGame.sandSavePct == null;

  if (empty) {
    return (
      <View style={styles.tabPane}>
        <Text style={styles.guideBlock}>
          短杆数据需要记录 up-and-down 和沙坑信息，在记成绩时开启详细记录即可。
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.tabPane}>
      <StatCard
        value={fmtPct(shortGame.scramblingPct)}
        label="救帕率"
        sublabel="Scrambling%"
        highlight={shortGamePctHighlight(shortGame.scramblingPct)}
      />
      <StatCard
        value={fmtPct(shortGame.upAndDownPct)}
        label="一切一推"
        sublabel="Up & Down%"
        highlight={shortGamePctHighlight(shortGame.upAndDownPct)}
      />
      <StatCard value={fmtPct(shortGame.sandSavePct)} label="沙坑救球" sublabel="Sand Save%" />
      <StatCard value={fmtNum(shortGame.avgMissGIRPerRound)} label="场均未上 GIR 洞数" />
      <Text style={styles.chartSectionTitle}>Scrambling 走势</Text>
      <MiniTrendChart data={shortGame.scramblingTrend} height={80} />
    </View>
  );
}

function PuttingTab({ putting }: { putting: AllStats['putting'] }) {
  if (!puttingTabHasAnyCard(putting)) {
    return (
      <View style={styles.tabPane}>
        <Text style={styles.guideBlock}>
          当前窗口下暂无推杆结构数据。保存逐洞推杆数后，将显示场均推杆、三推率与分距离一推率等。
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.tabPane}>
      <StatCard value={fmtNum(putting.avgPuttsPerHole)} label="每洞推杆" sublabel="Avg / hole" />
      <View style={styles.grid22}>
        <View style={styles.col48}>
          <StatCard value={fmtNum(putting.avgTotalPutts)} label="场均推杆" />
        </View>
        <View style={styles.col48}>
          <StatCard
            value={fmtPct(putting.threePuttPct)}
            label="三推率"
            highlight={threePuttHighlight(putting.threePuttPct)}
          />
        </View>
        <View style={styles.col48}>
          <StatCard
            value={fmtPct(putting.onePuttPct)}
            label="一推率"
            highlight={onePuttHighlight(putting.onePuttPct)}
          />
        </View>
        <View style={styles.col48}>
          <StatCard value={fmtNum(putting.puttsWhenGIR)} label="GIR 后均推" />
        </View>
      </View>
      <StatCard value={fmtNum(putting.puttsWhenMiss)} label="未上果岭后均推" />
      {putting.puttsByDistance != null && hasAnyNumericRecord(putting.puttsByDistance) ? (
        <PuttsDistanceTable p={putting.puttsByDistance} />
      ) : null}
      <Text style={styles.chartSectionTitle}>推杆走势</Text>
      <MiniTrendChart data={putting.puttsTrend} height={80} />
    </View>
  );
}

export type ScoreAnalyticsTabContentProps = {
  stats: AllStats;
  activeTab: ScoreAnalyticsTabId;
};

export function ScoreAnalyticsTabContent({ stats, activeTab }: ScoreAnalyticsTabContentProps) {
  switch (activeTab) {
    case 'overview':
      return <OverviewTab scoring={stats.scoring} />;
    case 'tee':
      return <TeeTab tee={stats.tee} />;
    case 'approach':
      return <ApproachTab approach={stats.approach} />;
    case 'short':
      return <ShortTab shortGame={stats.shortGame} />;
    case 'putting':
      return <PuttingTab putting={stats.putting} />;
    case 'sg':
      return (
        <View style={styles.tabPane}>
          <SgPlaceholder />
        </View>
      );
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  tabPane: { gap: 12, paddingTop: 0 },
  distWrap: { alignItems: 'center', marginBottom: 8 },
  row3: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  row2: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  col31: { width: '31%' },
  col48: { width: '48%' },
  grid22: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  chartSectionTitle: { fontSize: 14, fontWeight: '800', color: WHITE, marginTop: 8 },
  section: { marginTop: 8, gap: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: WHITE },
  guideTxt: { fontSize: 15, color: MUTED2, paddingVertical: 8 },
  guideBlock: { fontSize: 15, color: MUTED2, lineHeight: 22, paddingVertical: 8 },
  pieWrap: { alignItems: 'center', marginVertical: 8 },
  quadOuter: { alignItems: 'center', paddingVertical: 12, gap: 8 },
  quadTop: { marginBottom: 4 },
  quadBottom: { marginTop: 4 },
  quadMidRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  quadSide: { fontSize: 11, color: WHITE, textAlign: 'center', maxWidth: 72, fontWeight: '700' },
  quadCircle: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  hBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  hBarLab: { width: 72, fontSize: 12, color: MUTED, fontWeight: '600' },
  hBarTrack: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  hBarFill: { height: '100%', borderRadius: 5, backgroundColor: PRIMARY_GREEN },
  hBarPct: { width: 44, fontSize: 12, fontWeight: '800', color: WHITE, textAlign: 'right' },
  tableHead: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingBottom: 8,
    marginTop: 4,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  tableCell: { fontSize: 13 },
  tableCellLab: { flex: 1, color: MUTED, fontWeight: '600' },
  tableCellVal: { width: 100, textAlign: 'right', color: WHITE, fontWeight: '700' },
  sgWrap: { gap: 12, alignItems: 'flex-start' },
  sgTitle: { fontSize: 20, fontWeight: '900', color: WHITE },
  sgSub: { fontSize: 14, fontWeight: '700', color: MUTED },
  sgBody: { fontSize: 14, color: MUTED2, lineHeight: 22 },
  sgCta: { fontSize: 15, fontWeight: '800', color: '#a3e635', marginTop: 8 },
});
