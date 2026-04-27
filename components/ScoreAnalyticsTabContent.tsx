import React from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, G, Path, Text as SvgText } from 'react-native-svg';

import { MiniTrendChart } from '@/components/MiniTrendChart';
import { StatCard, type StatCardHighlight } from '@/components/StatCard';
import type { ComputedAllStats } from '@/src/utils/statsEngine';

const showTermInfo = (title: string, message: string) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

export type ScoreAnalyticsTabId = 'overview' | 'tee' | 'approach' | 'short' | 'putting' | 'sg';

type AllStats = ComputedAllStats;

const PAGE_BG = '#0d1b11';
const CARD_BG = '#16261c';
const ACCENT = '#b5ff3a';
const WHITE = '#ffffff';
const BLOCK_TITLE = '#a8b5ac';
const MUTED = 'rgba(255,255,255,0.55)';
const MUTED2 = 'rgba(255,255,255,0.42)';
const LABEL_MUTED = '#5a6b5f';
const BORDER = 'rgba(255,255,255,0.08)';
const PRIMARY_GREEN = '#166534';
const ADVANTAGE = '#e8f0e5';
const PAR_DIFF_POS = '#e89b3a';
const LEGEND_ZERO = '#9ba8a0';
const DIVIDER = 'rgba(255,255,255,0.08)';
const WORST_RED = '#d94848';

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
function describeArc(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
): string | null {
  const sweep = endDeg - startDeg;
  if (sweep <= 0.0001) return null;
  if (sweep >= 359.99) return null;
  const p0 = polarPoint(cx, cy, r, startDeg);
  const p1 = polarPoint(cx, cy, r, endDeg);
  const largeArc = sweep > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${p0.x} ${p0.y} A ${r} ${r} 0 ${largeArc} 1 ${p1.x} ${p1.y} Z`;
}

function StatTermHint({ title, body }: { title: string; body: string }) {
  return (
    <TouchableOpacity
      onPress={() => showTermInfo(title, body)}
      hitSlop={{ top: 6, bottom: 6, left: 4, right: 6 }}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <Text style={statHintStyles.icon}>ⓘ</Text>
    </TouchableOpacity>
  );
}

const statHintStyles = StyleSheet.create({
  icon: { fontSize: 11, color: LABEL_MUTED, marginLeft: 4 },
});

function fmtParDiff(avg: number | null, par: number): { text: string; color: string } | null {
  if (avg == null || !Number.isFinite(avg)) return null;
  const d = avg - par;
  const text = d >= 0 ? `+${d.toFixed(1)}` : d.toFixed(1);
  const color = d > 0 ? PAR_DIFF_POS : d < 0 ? ACCENT : LEGEND_ZERO;
  return { text, color };
}

function DistributionSection({ scoring }: { scoring: AllStats['scoring'] }) {
  const pct = scoring.distributionPct;
  const d = scoring.distribution;
  const totalHoles = d.eagle + d.birdie + d.par + d.bogey + d.doublePlus;

  const items = [
    { key: 'eagle' as const, label: '老鹰', color: '#e5c53a' },
    { key: 'birdie' as const, label: '小鸟', color: '#3ac5a8' },
    { key: 'par' as const, label: '标准杆', color: '#e8e8e8' },
    { key: 'bogey' as const, label: '柏忌', color: '#e89b3a' },
    { key: 'doublePlus' as const, label: '双柏忌+', color: '#d94848' },
  ];

  const flexVals = items.map((it) => {
    const v = pct[it.key];
    return v != null && Number.isFinite(v) && v > 0 ? v : 0;
  });

  return (
    <View style={styles.distSection}>
      <View style={styles.blockHeadRow}>
        <Text style={styles.blockTitle}>成绩分布</Text>
        <Text style={styles.blockHeadRight}>{totalHoles} 洞</Text>
      </View>
      <View style={styles.distStrip}>
        {items.map((it, i) => {
          const f = flexVals[i]!;
          if (f <= 0) return null;
          return (
            <View key={it.key} style={[styles.distSeg, { flex: f, backgroundColor: it.color }]} />
          );
        })}
      </View>
      <View style={styles.distLegendRow}>
        {items.map((it) => {
          const raw = pct[it.key];
          const p = raw != null && Number.isFinite(raw) ? raw : 0;
          const showPct = p > 0;
          return (
            <View key={it.key} style={styles.distLegendCell}>
              <View style={[styles.distDot, { backgroundColor: it.color }]} />
              <Text style={styles.distLegendLab}>{it.label}</Text>
              <Text
                style={[
                  styles.distLegendVal,
                  showPct ? styles.distLegendValOn : styles.distLegendValZero,
                ]}
              >
                {showPct ? `${p.toFixed(1)}%` : '0'}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function SegmentParSection({ scoring }: { scoring: AllStats['scoring'] }) {
  const f = scoring.avgFront9;
  const b = scoring.avgBack9;
  let advStr = '—';
  if (f != null && b != null && Number.isFinite(f) && Number.isFinite(b)) {
    const adv = f - b;
    advStr = adv >= 0 ? `+${adv.toFixed(1)}` : `${adv.toFixed(1)}`;
  }

  const parRows: { par: 3 | 4 | 5; label: string; avg: number | null }[] = [
    { par: 3, label: 'Par 3', avg: scoring.avgByPar.par3 },
    { par: 4, label: 'Par 4', avg: scoring.avgByPar.par4 },
    { par: 5, label: 'Par 5', avg: scoring.avgByPar.par5 },
  ];

  return (
    <View style={styles.segParWrap}>
      <Text style={styles.blockTitleOnly}>分段均杆</Text>
      <View style={styles.segmentHeroCard}>
        <View style={styles.segmentHeroCol}>
          <Text style={styles.segmentHeroLab}>先记 9 洞</Text>
          <Text style={styles.segmentHeroNum}>{fmtNum(f) ?? '—'}</Text>
        </View>
        <View style={styles.segmentVLine} />
        <View style={styles.segmentHeroCol}>
          <Text style={styles.segmentHeroLab}>后记 9 洞</Text>
          <Text style={styles.segmentHeroNum}>{fmtNum(b) ?? '—'}</Text>
        </View>
        <View style={styles.segmentVLine} />
        <View style={styles.segmentHeroCol}>
          <Text style={styles.segmentHeroLab}>先−后</Text>
          <Text style={[styles.segmentHeroNum, styles.segmentAdvNum]}>{advStr}</Text>
        </View>
      </View>
      <View style={styles.parMiniGrid}>
        {parRows.map((row) => {
          const diff = fmtParDiff(row.avg, row.par);
          return (
            <View key={row.par} style={styles.parMiniCard}>
              <Text style={styles.parMiniLab}>{row.label}</Text>
              <Text style={styles.parMiniVal}>{fmtNum(row.avg) ?? '—'}</Text>
              {diff ? (
                <Text style={[styles.parMiniDiff, { color: diff.color }]}>{diff.text}</Text>
              ) : (
                <Text style={styles.parMiniDiff}>—</Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

function KeyMetricsSection({
  tee,
  approach,
  putting,
}: {
  tee: AllStats['tee'];
  approach: AllStats['approach'];
  putting: AllStats['putting'];
}) {
  const fir = tee.firPct;
  const gir = approach.girPct;
  const putts = putting.avgTotalPutts;
  const firStr = fmtPct(fir) ?? '—';
  const girStr = fmtPct(gir) ?? '—';
  const puttsStr = fmtNum(putts) ?? '—';

  return (
    <View style={styles.keyMetricsWrap}>
      <Text style={styles.blockTitleOnly}>关键指标</Text>
      <View style={styles.keyGrid}>
        <View style={styles.keyCard}>
          <View style={styles.keyLabelRow}>
            <View style={styles.keyLabelTexts}>
              <Text style={styles.keyLab}>球道率</Text>
              <Text style={styles.keySub}>FIR · Par4/5</Text>
            </View>
            <StatTermHint
              title="球道命中率（FIR）"
              body="开球后球停在球道内的比例，仅统计 Par4 和 Par5 洞。\n平均水平：业余球手约 40-60%"
            />
          </View>
          <Text style={styles.keyVal} numberOfLines={1}>
            {firStr}
          </Text>
          <View style={styles.keyMiniBarTrack}>
            <View
              style={[styles.keyMiniBarFill, { width: `${fir != null ? Math.min(100, fir) : 0}%` }]}
            />
          </View>
        </View>
        <View style={styles.keyCard}>
          <View style={styles.keyLabelRow}>
            <View style={styles.keyLabelTexts}>
              <Text style={styles.keyLab}>标 on</Text>
              <Text style={styles.keySub}>GIR</Text>
            </View>
            <StatTermHint
              title="果岭命中率（GIR）"
              body="用标准杆减去推杆数以内的杆数上果岭。\n例如 Par4 洞用 2 杆以内上果岭即算 GIR。\n平均水平：差点10约50%，差点20约30%"
            />
          </View>
          <Text style={styles.keyVal} numberOfLines={1}>
            {girStr}
          </Text>
          <View style={styles.keyMiniBarTrack}>
            <View
              style={[styles.keyMiniBarFill, { width: `${gir != null ? Math.min(100, gir) : 0}%` }]}
            />
          </View>
        </View>
        <View style={styles.keyCard}>
          <View style={styles.keyLabelRow}>
            <View style={styles.keyLabelTexts}>
              <Text style={styles.keyLab}>平均推杆</Text>
            </View>
            <StatTermHint
              title="推杆数"
              body="每场18洞的总推杆次数。\n平均水平：差点10约32杆，差点20约36杆"
            />
          </View>
          <Text style={styles.keyVal} numberOfLines={1}>
            {puttsStr}
          </Text>
          <Text style={styles.keyPuttsFoot}>每场</Text>
        </View>
      </View>
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
  const strokePie = PAGE_BG;

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
              <Circle
                key={i}
                cx={cx}
                cy={cy}
                r={r}
                fill={p.color}
                stroke={strokePie}
                strokeWidth={1}
              />
            ) : (
              <Path key={i} d={p.d} fill={p.color} stroke={strokePie} strokeWidth={1} />
            ),
          )}
        </G>
        <SvgText x={cx} y={cy - 2} fill={WHITE} fontSize={24} fontWeight="800" textAnchor="middle">
          {firMain}
        </SvgText>
        <SvgText x={cx} y={cy + 18} fill={WHITE} fontSize={12} fontWeight="800" textAnchor="middle">
          FIR · Par4/5
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
              textAnchor="middle"
            >
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
            <Circle
              cx={36}
              cy={36}
              r={28}
              fill="rgba(255,255,255,0.06)"
              stroke={PRIMARY_GREEN}
              strokeWidth={2}
            />
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

function LossAnalysisTab({ stats }: { stats: AllStats }) {
  const { scoring, tee, approach } = stats;
  const par3 = scoring.avgByPar.par3;
  const par4 = scoring.avgByPar.par4;
  const par5 = scoring.avgByPar.par5;
  const par3Diff = par3 != null ? par3 - 3 : null;
  const par4Diff = par4 != null ? par4 - 4 : null;
  const par5Diff = par5 != null ? par5 - 5 : null;

  const diffs = (
    [
      { par: 3 as const, diff: par3Diff, avg: par3 },
      { par: 4 as const, diff: par4Diff, avg: par4 },
      { par: 5 as const, diff: par5Diff, avg: par5 },
    ] as const
  ).filter(
    (d): d is { par: 3 | 4 | 5; diff: number; avg: number | null } =>
      d.diff != null && Number.isFinite(d.diff),
  );
  const worstPar = diffs.length > 0 ? diffs.reduce((a, b) => (b.diff > a.diff ? b : a)) : null;

  const hasData = par3 != null || par4 != null || par5 != null;
  const fir = tee.firPct;
  const gir = approach.girPct;
  const hi = scoring.handicapIndex;
  const expectedGir =
    hi != null && Number.isFinite(hi) ? Math.max(5, Math.min(60, Math.round(60 - hi * 1.1))) : null;
  const firExpectPct =
    hi != null && Number.isFinite(hi) ? Math.round(Math.max(20, 60 - hi * 1.2)) : null;

  return (
    <View style={[styles.tabPane, { paddingBottom: 24 }]}>
      <Text style={styles.blockTitleOnly}>失分最多的洞型</Text>
      {hasData ? (
        <View style={{ backgroundColor: CARD_BG, borderRadius: 12, overflow: 'hidden' }}>
          {[
            { label: 'Par 3', avg: par3, diff: par3Diff },
            { label: 'Par 4', avg: par4, diff: par4Diff },
            { label: 'Par 5', avg: par5, diff: par5Diff },
          ].map((row, i) => {
            const isWorst = worstPar != null && worstPar.par === i + 3;
            const barWidth =
              row.diff != null && row.diff > 0 ? Math.min(100, (row.diff / 3) * 100) : 0;
            return (
              <View
                key={row.label}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 14,
                  borderLeftWidth: isWorst ? 3 : 0,
                  borderLeftColor: WORST_RED,
                  borderBottomWidth: i < 2 ? 1 : 0,
                  borderBottomColor: 'rgba(255,255,255,0.04)',
                }}
              >
                <Text style={{ color: BLOCK_TITLE, fontSize: 13, fontWeight: '700', width: 48 }}>
                  {row.label}
                </Text>
                <Text
                  style={{
                    color: ACCENT,
                    fontSize: 20,
                    fontWeight: '800',
                    width: 44,
                    letterSpacing: -0.5,
                  }}
                >
                  {row.avg != null ? row.avg.toFixed(1) : '—'}
                </Text>
                <Text
                  style={{
                    color: row.diff != null && row.diff > 0 ? PAR_DIFF_POS : ACCENT,
                    fontSize: 12,
                    fontWeight: '700',
                    width: 40,
                  }}
                >
                  {row.diff != null
                    ? row.diff > 0
                      ? `+${row.diff.toFixed(1)}`
                      : row.diff.toFixed(1)
                    : '—'}
                </Text>
                <View
                  style={{
                    flex: 1,
                    height: 4,
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}
                >
                  {barWidth > 0 ? (
                    <View
                      style={{
                        width: `${barWidth}%`,
                        height: '100%',
                        backgroundColor: WORST_RED,
                        opacity: 0.7,
                      }}
                    />
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <Text style={{ color: LABEL_MUTED, fontSize: 12, textAlign: 'center', padding: 20 }}>
          录入逐洞数据后显示失分分析
        </Text>
      )}

      <Text style={styles.blockTitleOnly}>实际 vs 预期</Text>
      <View style={{ backgroundColor: CARD_BG, borderRadius: 12, overflow: 'hidden' }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            padding: 14,
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(255,255,255,0.04)',
          }}
        >
          <Text style={{ color: LABEL_MUTED, fontSize: 11, fontWeight: '700', flex: 1 }}>
            GIR 上果岭率
          </Text>
          <Text style={{ color: ACCENT, fontSize: 16, fontWeight: '800', marginRight: 8 }}>
            {gir != null ? `${gir.toFixed(1)}%` : '—'}
          </Text>
          <Text style={{ color: LABEL_MUTED, fontSize: 11 }}>vs</Text>
          <Text
            style={{
              color: ADVANTAGE,
              fontSize: 16,
              fontWeight: '800',
              marginLeft: 8,
              textAlign: 'right',
              minWidth: 48,
            }}
          >
            {expectedGir != null ? `~${expectedGir}%` : '—'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14 }}>
          <Text style={{ color: LABEL_MUTED, fontSize: 11, fontWeight: '700', flex: 1 }}>
            球道率（Par4/5）
          </Text>
          <Text style={{ color: ACCENT, fontSize: 16, fontWeight: '800', marginRight: 8 }}>
            {fir != null ? `${fir.toFixed(1)}%` : '—'}
          </Text>
          <Text style={{ color: LABEL_MUTED, fontSize: 11 }}>vs</Text>
          <Text
            style={{
              color: ADVANTAGE,
              fontSize: 16,
              fontWeight: '800',
              marginLeft: 8,
              textAlign: 'right',
              minWidth: 48,
            }}
          >
            {firExpectPct != null ? `~${firExpectPct}%` : '—'}
          </Text>
        </View>
      </View>
      <Text style={{ color: LABEL_MUTED, fontSize: 10, textAlign: 'center', marginTop: -4 }}>
        预期值基于业余球手统计，仅供参考
      </Text>

      {worstPar != null ? (
        <View
          style={{
            backgroundColor: 'rgba(217,72,72,0.08)',
            borderRadius: 12,
            padding: 14,
            borderLeftWidth: 3,
            borderLeftColor: WORST_RED,
          }}
        >
          <Text style={{ color: WORST_RED, fontSize: 11, fontWeight: '700', marginBottom: 6 }}>
            当前最大弱点
          </Text>
          <Text style={{ color: ADVANTAGE, fontSize: 14, fontWeight: '700' }}>
            Par {worstPar.par} 洞超出最多（场均 +{worstPar.diff.toFixed(1)} 杆）
          </Text>
          <Text style={{ color: BLOCK_TITLE, fontSize: 12, marginTop: 6, lineHeight: 18 }}>
            {worstPar.par === 3
              ? '建议重点练习中短铁距离控制与上果岭准确性'
              : worstPar.par === 4
                ? '建议关注开球方向和第二杆进攻果岭效率'
                : '建议提升长距离第三杆落点控制，减少三推风险'}
          </Text>
        </View>
      ) : null}
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

const HCP_OVERVIEW_CARD_BG = '#16261c';
const HCP_OVERVIEW_TITLE = '#e8f0e5';
const HCP_OVERVIEW_SUB = '#8a9a8e';
const HCP_OVERVIEW_CHEV = '#5a6b5f';

function HandicapOverviewEntryCard({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      style={styles.hcpOverCard}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="差点详细分析"
    >
      <View style={styles.hcpOverRow}>
        <View style={styles.hcpOverLeft}>
          <Text style={styles.hcpOverTitle}>差点详细分析</Text>
          <Text style={styles.hcpOverSub}>趋势 · 目标 · 好友对比</Text>
        </View>
        <Text style={styles.hcpOverChev}>›</Text>
      </View>
    </Pressable>
  );
}

function OverviewTab({
  scoring,
  tee,
  approach,
  putting,
  onOpenHandicapTab,
  showHandicapOverviewCta,
}: {
  scoring: AllStats['scoring'];
  tee: AllStats['tee'];
  approach: AllStats['approach'];
  putting: AllStats['putting'];
  onOpenHandicapTab?: () => void;
  showHandicapOverviewCta?: boolean;
}) {
  return (
    <View style={styles.tabPane}>
      <DistributionSection scoring={scoring} />
      <SegmentParSection scoring={scoring} />
      <KeyMetricsSection tee={tee} approach={approach} putting={putting} />
      {showHandicapOverviewCta && onOpenHandicapTab ? (
        <HandicapOverviewEntryCard onPress={onOpenHandicapTab} />
      ) : null}
      <Text style={styles.chartSectionTitle}>成绩走势</Text>
      <MiniTrendChart
        data={scoring.scoreTrend.map((d) => ({ date: d.date, value: d.score }))}
        height={80}
        color={ACCENT}
      />
    </View>
  );
}

function TeeTab({ tee }: { tee: AllStats['tee'] }) {
  const firStr = fmtPct(tee.firPct);
  return (
    <View style={styles.tabPane}>
      {firStr != null ? (
        <StatCard value={firStr} label="上球道率" sublabel="FIR · Par4/5" />
      ) : (
        <Text style={styles.guideTxt}>记录开球数据后解锁</Text>
      )}
      <StatCard value={fmtNum(tee.avgPenalties)} label="场均罚杆" />
      <StatCard value={fmtNum(tee.avgDriveDistance)} label="平均开球距离" sublabel="码" />
      {tee.missTendency != null ? (
        <MissTendencyPie firPct={tee.firPct} mt={tee.missTendency} />
      ) : null}
      <Text style={styles.chartSectionTitle}>FIR · Par4/5 走势</Text>
      <MiniTrendChart data={tee.firTrend} height={80} color={ACCENT} />
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
      {approach.missGreenDirection != null ? (
        <MissGreenQuad m={approach.missGreenDirection} />
      ) : null}
      {gbd != null && hasAnyNumericRecord(gbd) ? <GirDistanceBars g={gbd} /> : null}
      <Text style={styles.chartSectionTitle}>GIR 走势</Text>
      <MiniTrendChart data={approach.girTrend} height={80} color={ACCENT} />
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
      <MiniTrendChart data={shortGame.scramblingTrend} height={80} color={ACCENT} />
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
      <MiniTrendChart data={putting.puttsTrend} height={80} color={ACCENT} />
    </View>
  );
}

export type ScoreAnalyticsTabContentProps = {
  stats: AllStats;
  activeTab: ScoreAnalyticsTabId;
  /** 总览底部「差点详细分析」入口；与 showHandicapOverviewCta 同时传入时展示 */
  onOpenHandicapTab?: () => void;
  showHandicapOverviewCta?: boolean;
};

export function ScoreAnalyticsTabContent({
  stats,
  activeTab,
  onOpenHandicapTab,
  showHandicapOverviewCta,
}: ScoreAnalyticsTabContentProps) {
  switch (activeTab) {
    case 'overview':
      return (
        <View style={styles.tabStack}>
          <OverviewTab
            scoring={stats.scoring}
            tee={stats.tee}
            approach={stats.approach}
            putting={stats.putting}
            onOpenHandicapTab={onOpenHandicapTab}
            showHandicapOverviewCta={showHandicapOverviewCta}
          />
        </View>
      );
    case 'tee':
      return (
        <View style={styles.tabStack}>
          <TeeTab tee={stats.tee} />
        </View>
      );
    case 'approach':
      return (
        <View style={styles.tabStack}>
          <ApproachTab approach={stats.approach} />
        </View>
      );
    case 'short':
      return (
        <View style={styles.tabStack}>
          <ShortTab shortGame={stats.shortGame} />
        </View>
      );
    case 'putting':
      return (
        <View style={styles.tabStack}>
          <PuttingTab putting={stats.putting} />
        </View>
      );
    case 'sg':
      return (
        <View style={styles.tabStack}>
          <LossAnalysisTab stats={stats} />
        </View>
      );
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  /** 各 Tab 主内容纵向间距 */
  tabStack: { gap: 12, paddingTop: 0 },
  tabPane: { gap: 12, paddingTop: 0 },
  hcpOverCard: {
    backgroundColor: HCP_OVERVIEW_CARD_BG,
    borderRadius: 12,
    padding: 14,
  },
  hcpOverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  hcpOverLeft: { flex: 1, minWidth: 0 },
  hcpOverTitle: { fontSize: 14, fontWeight: '700', color: HCP_OVERVIEW_TITLE, letterSpacing: -0.2 },
  hcpOverSub: {
    fontSize: 11,
    fontWeight: '500',
    color: HCP_OVERVIEW_SUB,
    marginTop: 4,
    lineHeight: 15,
  },
  hcpOverChev: { fontSize: 22, fontWeight: '600', color: HCP_OVERVIEW_CHEV, lineHeight: 24 },
  row3: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  row2: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  col31: { width: '31%' },
  col48: { width: '48%' },
  grid22: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  chartSectionTitle: { fontSize: 13, fontWeight: '700', color: BLOCK_TITLE, marginTop: 8 },
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
  hBarFill: { height: '100%', borderRadius: 5, backgroundColor: ACCENT },
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
  distSection: { gap: 10 },
  blockHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  blockTitle: { fontSize: 13, fontWeight: '700', color: BLOCK_TITLE },
  blockHeadRight: { fontSize: 13, fontWeight: '700', color: BLOCK_TITLE },
  blockTitleOnly: { fontSize: 13, fontWeight: '700', color: BLOCK_TITLE, marginBottom: 4 },
  distStrip: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  distSeg: { height: '100%' },
  distLegendRow: { flexDirection: 'row', marginTop: 10 },
  distLegendCell: { flex: 1, alignItems: 'center', gap: 4 },
  distDot: { width: 7, height: 7, borderRadius: 3.5 },
  distLegendLab: { fontSize: 11, fontWeight: '600', color: LABEL_MUTED, textAlign: 'center' },
  distLegendVal: { fontSize: 12, fontWeight: '800', letterSpacing: -0.3 },
  distLegendValOn: { color: ACCENT },
  distLegendValZero: { color: LEGEND_ZERO, fontWeight: '700' },

  segParWrap: { gap: 10 },
  segmentHeroCard: {
    flexDirection: 'row',
    backgroundColor: CARD_BG,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'stretch',
  },
  segmentHeroCol: { flex: 1, alignItems: 'center', justifyContent: 'center', minWidth: 0 },
  segmentVLine: { width: 1, backgroundColor: DIVIDER, alignSelf: 'stretch' },
  segmentHeroLab: { fontSize: 11, fontWeight: '700', color: LABEL_MUTED, marginBottom: 6 },
  segmentHeroNum: {
    fontSize: 24,
    fontWeight: '800',
    color: ACCENT,
    letterSpacing: -0.5,
  },
  segmentAdvNum: { color: ADVANTAGE },
  parMiniGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  parMiniCard: {
    width: '31%',
    flexGrow: 1,
    minWidth: '28%',
    backgroundColor: CARD_BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 12,
    alignItems: 'center',
  },
  parMiniLab: { fontSize: 11, fontWeight: '700', color: LABEL_MUTED, marginBottom: 4 },
  parMiniVal: {
    fontSize: 22,
    fontWeight: '800',
    color: ACCENT,
    letterSpacing: -0.6,
    marginBottom: 4,
  },
  parMiniDiff: { fontSize: 12, fontWeight: '700' },

  keyMetricsWrap: { gap: 10 },
  keyGrid: { flexDirection: 'row', flexWrap: 'nowrap', gap: 8, alignItems: 'stretch' },
  keyCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: CARD_BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 12,
  },
  keyLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'nowrap',
    marginBottom: 4,
    width: '100%',
    gap: 4,
  },
  keyLabelTexts: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  keyLab: { fontSize: 11, fontWeight: '700', color: LABEL_MUTED, flexShrink: 0 },
  keySub: { fontSize: 11, fontWeight: '600', color: LABEL_MUTED, flexShrink: 0 },
  keyVal: {
    fontSize: 22,
    fontWeight: '800',
    color: ACCENT,
    letterSpacing: -0.6,
    marginTop: 2,
    width: '100%',
  },
  keyMiniBarTrack: {
    width: '100%',
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    marginTop: 8,
    alignSelf: 'stretch',
  },
  keyMiniBarFill: {
    height: 3,
    backgroundColor: '#b5ff3a',
    borderRadius: 2,
  },
  keyPuttsFoot: { fontSize: 11, fontWeight: '600', color: LABEL_MUTED, marginTop: 8 },
});
