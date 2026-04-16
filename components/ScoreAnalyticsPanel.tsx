import { useFocusEffect } from '@react-navigation/native';
import { type Href, useRouter } from 'expo-router';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { G, Path, Polygon, Text as SvgText } from 'react-native-svg';

import { loadHandicapRecords } from '@/lib/handicap';
import {
  calcFourDimensionStatsFromRounds,
  calcHandicapIndexFromRounds,
  calcRoundFirPct,
  calcRoundGirPct,
  calcRoundScramblingPct,
  calcRoundThreePuttPct,
  migrateOldData,
  validateRound,
  type RoundData,
} from '@/src/utils/statsEngine';

const CARD_BG = 'rgba(255,255,255,0.06)';
const CARD_BORDER = 'rgba(255,255,255,0.1)';
const WHITE = '#ffffff';
const MUTED = 'rgba(255,255,255,0.55)';
const MUTED2 = 'rgba(255,255,255,0.42)';
const LIME = '#a3e635';
const LIME_DIM = 'rgba(163,230,53,0.28)';
const RED = '#f87171';
const GRAY_ARROW = 'rgba(255,255,255,0.35)';

const RADAR_SIZE = 220;
const RADAR_CX = RADAR_SIZE / 2;
const RADAR_CY = RADAR_SIZE / 2;
const RADAR_R = 78;

function toDateMs(date: string): number {
  return Number.isFinite(Date.parse(date)) ? Date.parse(date) : 0;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function fmtPct(n: number | null, digits = 0): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  return `${n.toFixed(digits)}%`;
}

function fmt1(n: number | null): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  return (Math.round(n * 10) / 10).toFixed(1);
}

function puttingRadarScore(avgPuttsPerHole: number | null): number | null {
  if (avgPuttsPerHole == null || !Number.isFinite(avgPuttsPerHole)) return null;
  return clamp(100 - (avgPuttsPerHole - 1.5) * 50, 0, 100);
}

function lastNChronological(roundsNewestFirst: RoundData[], n: number): RoundData[] {
  return [...roundsNewestFirst].slice(0, n).reverse();
}

function seriesForMetric(roundsNewestFirst: RoundData[], n: number, pick: (r: RoundData) => number | null): number[] {
  const out: number[] = [];
  for (const r of lastNChronological(roundsNewestFirst, n)) {
    const v = pick(r);
    if (v != null && Number.isFinite(v)) out.push(v);
  }
  return out;
}

/** SVG 迷你折线图；点数 < 3 返回 null（由父级不渲染） */
function MiniSparkline({
  values,
  width,
  height,
  stroke,
}: {
  values: number[];
  width: number;
  height: number;
  stroke: string;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = 4;
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (v - min) / span) * (height - pad * 2);
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  });
  return (
    <Svg width={width} height={height}>
      <Path d={pts.join(' ')} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

type RadarDim = { key: string; label: string; valuePct: number; labelShort: string };

function ScoreRadar({ dims }: { dims: RadarDim[] }) {
  const n = dims.length;
  if (n < 2) return null;

  const angles = dims.map((_, i) => -Math.PI / 2 + (i * 2 * Math.PI) / n);
  const pts = dims.map((d, i) => {
    const rr = (clamp(d.valuePct, 0, 100) / 100) * RADAR_R;
    const x = RADAR_CX + rr * Math.cos(angles[i]!);
    const y = RADAR_CY + rr * Math.sin(angles[i]!);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const gridRings = [0.35, 0.65, 1].map((t) => (
    <Polygon
      key={String(t)}
      points={angles
        .map((ang) => {
          const rr = RADAR_R * t;
          const x = RADAR_CX + rr * Math.cos(ang);
          const y = RADAR_CY + rr * Math.sin(ang);
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' ')}
      fill="none"
      stroke="rgba(255,255,255,0.08)"
      strokeWidth={1}
    />
  ));

  const spokes = angles.map((ang, i) => {
    const x2 = RADAR_CX + RADAR_R * Math.cos(ang);
    const y2 = RADAR_CY + RADAR_R * Math.sin(ang);
    return (
      <Path
        key={i}
        d={`M ${RADAR_CX} ${RADAR_CY} L ${x2.toFixed(1)} ${y2.toFixed(1)}`}
        stroke="rgba(255,255,255,0.1)"
        strokeWidth={1}
      />
    );
  });

  const labels = dims.map((d, i) => {
    const lr = RADAR_R + 22;
    const x = RADAR_CX + lr * Math.cos(angles[i]!);
    const y = RADAR_CY + lr * Math.sin(angles[i]!);
    const sub = d.key === 'putting' ? `${Math.round(d.valuePct)} 分` : `${Math.round(d.valuePct)}%`;
    return (
      <G key={d.key}>
        <SvgText x={x} y={y - 6} fill={MUTED} fontSize={9} fontWeight="600" textAnchor="middle">
          {d.labelShort}
        </SvgText>
        <SvgText x={x} y={y + 6} fill={WHITE} fontSize={10} fontWeight="800" textAnchor="middle">
          {sub}
        </SvgText>
      </G>
    );
  });

  return (
    <Svg width={RADAR_SIZE} height={RADAR_SIZE}>
      {gridRings}
      {spokes}
      <Polygon points={pts.join(' ')} fill={LIME_DIM} stroke={LIME} strokeWidth={2} />
      {labels}
    </Svg>
  );
}

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function buildTips(
  radarDims: RadarDim[],
  threePutt: number | null,
  enoughRounds: boolean,
): string[] {
  if (!enoughRounds) {
    return ['继续记录更多场次，AI将为你生成个性化建议'];
  }
  const tips: string[] = [];
  if (radarDims.length) {
    const weakest = [...radarDims].sort((a, b) => a.valuePct - b.valuePct)[0];
    if (weakest) {
      if (weakest.key === 'tee') tips.push('开球（FIR）相对偏弱，建议在练习场重点练一号木方向与节奏。');
      else if (weakest.key === 'approach') tips.push('进攻果岭（GIR）有提升空间，可加强铁杆距离与落点控制。');
      else if (weakest.key === 'short') tips.push('短杆救帕（Scrambling）偏薄弱，建议增加切杆与果岭边救球练习。');
      else tips.push('推杆效率可继续打磨，注意节奏与果岭阅读。');
    }
  }
  if (threePutt != null && threePutt > 5) {
    tips.push('三推占比较高，可关注6–10英尺推杆练习。');
  }
  return tips.slice(0, 2);
}

export function ScoreAnalyticsPanel() {
  const router = useRouter();
  const [rounds, setRounds] = useState<RoundData[]>([]);

  useFocusEffect(
    useCallback(() => {
      const raw = loadHandicapRecords();
      const migrated = migrateOldData(raw);
      const valid = migrated
        .filter((r) => validateRound(r).ok)
        .sort((a, b) => toDateMs(b.date) - toDateMs(a.date));
      setRounds(valid);
      return () => {};
    }, []),
  );

  const hi = useMemo(() => calcHandicapIndexFromRounds(rounds), [rounds]);
  const four = useMemo(() => (rounds.length ? calcFourDimensionStatsFromRounds(rounds) : null), [rounds]);

  const radarDims = useMemo((): RadarDim[] => {
    if (!four) return [];
    const list: RadarDim[] = [];
    if (four.driving.firPct != null) {
      list.push({ key: 'tee', label: '开球 Tee', labelShort: '开球', valuePct: four.driving.firPct });
    }
    if (four.approach.girPct != null) {
      list.push({ key: 'approach', label: '进攻 Approach', labelShort: '进攻', valuePct: four.approach.girPct });
    }
    if (four.shortGame.scramblingPct != null) {
      list.push({
        key: 'short',
        label: '短杆 Short',
        labelShort: '短杆',
        valuePct: four.shortGame.scramblingPct,
      });
    }
    const p = puttingRadarScore(four.putting.avgPuttsPerHole);
    if (p != null) {
      list.push({ key: 'putting', label: '推杆 Putting', labelShort: '推杆', valuePct: p });
    }
    return list;
  }, [four]);

  const lastRound = rounds[0];
  const prevRound = rounds[1];
  const scoreTrend = useMemo(() => {
    if (!lastRound || !prevRound) return null;
    if (lastRound.totalScore < prevRound.totalScore) return 'up' as const;
    if (lastRound.totalScore > prevRound.totalScore) return 'down' as const;
    return 'flat' as const;
  }, [lastRound, prevRound]);

  const bestWorst = useMemo(() => {
    if (!rounds.length) return null;
    const scores = rounds.map((r) => r.totalScore);
    return { best: Math.min(...scores), worst: Math.max(...scores) };
  }, [rounds]);

  const avgPenalties = useMemo(() => {
    if (!rounds.length) return null;
    const sums = rounds.map((r) => r.holes.reduce((s, h) => s + (h.penalties || 0), 0));
    if (!sums.some((s) => s > 0)) return null;
    const m = sums.reduce((a, b) => a + b, 0) / rounds.length;
    return Number.isFinite(m) ? m : null;
  }, [rounds]);

  const tips = useMemo(
    () => buildTips(radarDims, four?.putting.threePuttHolePct ?? null, rounds.length >= 3),
    [radarDims, four, rounds.length],
  );

  const firSeries = seriesForMetric(rounds, 10, (r) => calcRoundFirPct(r));
  const girSeries = seriesForMetric(rounds, 10, (r) => calcRoundGirPct(r));
  const scrSeries = seriesForMetric(rounds, 10, (r) => calcRoundScramblingPct(r));
  const pphSeries = seriesForMetric(
    rounds,
    10,
    (r) => (r.holeCount > 0 ? r.totalPutts / r.holeCount : null),
  );
  const threeSeries = seriesForMetric(rounds, 10, (r) => calcRoundThreePuttPct(r));

  const hasHoles = rounds.some((r) => r.holes.length > 0);

  if (!rounds.length) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyTitle}>暂无成绩</Text>
        <Text style={styles.emptySub}>记录逐洞成绩后，将在此展示差点、雷达与分项趋势。</Text>
        <Pressable style={styles.emptyBtn} onPress={() => router.push('/handicap/add' as Href)}>
          <Text style={styles.emptyBtnTxt}>去记成绩</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {/* 区块1 总览 */}
      <View style={styles.overviewCard}>
        <View style={styles.overviewCol}>
          {hi.ok ? (
            <>
              <Text style={styles.hiBig}>{hi.index.toFixed(1)}</Text>
              <Text style={styles.hiSub}>
                Handicap Index · {hi.scoresUsed} 场样本
              </Text>
            </>
          ) : rounds.length < 3 ? (
            <>
              <Text style={styles.hiBigMuted}>—</Text>
              <Text style={styles.hiSub}>需要至少3场数据</Text>
            </>
          ) : (
            <>
              <Text style={styles.hiBigMuted}>暂无法计算</Text>
              <Text style={styles.hiSub}>请确认每场 9/18 洞逐洞记录完整，以便生成微差</Text>
            </>
          )}
        </View>
        <View style={styles.overviewColCenter}>
          {lastRound ? (
            <>
              <Text style={styles.lastScore}>{lastRound.totalScore}</Text>
              <Text style={styles.lastMeta} numberOfLines={1}>
                最近一场 · {lastRound.date}
              </Text>
              {scoreTrend ? (
                <Text
                  style={[
                    styles.trendArrow,
                    scoreTrend === 'up' && { color: LIME },
                    scoreTrend === 'down' && { color: RED },
                    scoreTrend === 'flat' && { color: GRAY_ARROW },
                  ]}>
                  {scoreTrend === 'up' ? '↑ 进步' : scoreTrend === 'down' ? '↓ 退步' : '→ 稳定'}
                </Text>
              ) : null}
            </>
          ) : null}
        </View>
        <View style={styles.overviewColRight}>
          {bestWorst ? (
            <>
              <Text style={styles.bwLabel}>最佳 / 最差</Text>
              <Text style={styles.bwVal}>
                {bestWorst.best} / {bestWorst.worst}
              </Text>
            </>
          ) : null}
        </View>
      </View>

      <Text style={styles.blockLabel}>分项数据</Text>

      <SectionCard title="开球">
        {four?.driving.firPct != null ? (
          <View style={styles.detailBlock}>
            <Text style={styles.bigMetric}>{fmtPct(four.driving.firPct)}</Text>
            <Text style={styles.metricCaption}>FIR%</Text>
            {firSeries.length >= 3 ? (
              <View style={styles.sparkWrap}>
                <MiniSparkline values={firSeries} width={200} height={50} stroke={LIME} />
              </View>
            ) : null}
            {avgPenalties != null && avgPenalties > 0 ? (
              <Text style={styles.penLine}>场均罚杆相关：约 {fmt1(avgPenalties)} 杆/场（逐洞 penalties 合计）</Text>
            ) : null}
          </View>
        ) : (
          <Text style={styles.mutedBody}>暂无开球球道数据</Text>
        )}
      </SectionCard>

      <SectionCard title="进攻果岭">
        {four?.approach.girPct != null ? (
          <View style={styles.detailBlock}>
            <Text style={styles.bigMetric}>{fmtPct(four.approach.girPct)}</Text>
            <Text style={styles.metricCaption}>GIR%</Text>
            {girSeries.length >= 3 ? (
              <View style={styles.sparkWrap}>
                <MiniSparkline values={girSeries} width={200} height={50} stroke={LIME} />
              </View>
            ) : null}
            <View style={styles.triRow}>
              {four.approach.girPar3Pct != null && four.approach.holesPar3 > 0 ? (
                <View style={styles.triCell}>
                  <Text style={styles.triVal}>{fmtPct(four.approach.girPar3Pct)}</Text>
                  <Text style={styles.triLab}>Par3 GIR</Text>
                </View>
              ) : null}
              {four.approach.girPar4Pct != null && four.approach.holesPar4 > 0 ? (
                <View style={styles.triCell}>
                  <Text style={styles.triVal}>{fmtPct(four.approach.girPar4Pct)}</Text>
                  <Text style={styles.triLab}>Par4 GIR</Text>
                </View>
              ) : null}
              {four.approach.girPar5Pct != null && four.approach.holesPar5 > 0 ? (
                <View style={styles.triCell}>
                  <Text style={styles.triVal}>{fmtPct(four.approach.girPar5Pct)}</Text>
                  <Text style={styles.triLab}>Par5 GIR</Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : (
          <Text style={styles.mutedBody}>暂无 GIR 数据</Text>
        )}
      </SectionCard>

      <SectionCard title="短杆">
        {four?.shortGame.scramblingPct != null ? (
          <View style={styles.detailBlock}>
            <Text style={styles.bigMetric}>{fmtPct(four.shortGame.scramblingPct)}</Text>
            <Text style={styles.metricCaption}>Scrambling%</Text>
            {scrSeries.length >= 3 ? (
              <View style={styles.sparkWrap}>
                <MiniSparkline values={scrSeries} width={200} height={50} stroke={LIME} />
              </View>
            ) : null}
          </View>
        ) : (
          <Text style={styles.mutedBody}>{hasHoles ? '当前样本下无法计算救帕率' : '记录逐洞数据后解锁'}</Text>
        )}
      </SectionCard>

      <SectionCard title="推杆">
        {four?.putting.avgPuttsPerHole != null ? (
          <View style={styles.detailBlock}>
            <Text style={styles.bigMetric}>{fmt1(four.putting.avgPuttsPerHole)}</Text>
            <Text style={styles.metricCaption}>每洞推杆</Text>
            {pphSeries.length >= 3 ? (
              <View style={styles.sparkWrap}>
                <MiniSparkline values={pphSeries} width={200} height={50} stroke={LIME} />
              </View>
            ) : null}
            <View style={styles.quadRow}>
              {four.putting.avgPuttsRound != null ? (
                <View style={styles.quadCell}>
                  <Text style={styles.quadVal}>{fmt1(four.putting.avgPuttsRound)}</Text>
                  <Text style={styles.quadLab}>场均推杆</Text>
                </View>
              ) : null}
              {four.putting.threePuttHolePct != null ? (
                <View
                  style={[
                    styles.quadCell,
                    four.putting.threePuttHolePct === 0 && styles.quadCellGood,
                    four.putting.threePuttHolePct > 5 && styles.quadCellWarn,
                  ]}>
                  <Text style={styles.quadVal}>{fmtPct(four.putting.threePuttHolePct, 1)}</Text>
                  <Text style={styles.quadLab}>三推率</Text>
                </View>
              ) : null}
              {four.putting.onePuttHolePct != null ? (
                <View style={styles.quadCell}>
                  <Text style={styles.quadVal}>{fmtPct(four.putting.onePuttHolePct)}</Text>
                  <Text style={styles.quadLab}>一推率</Text>
                </View>
              ) : null}
              {four.putting.avgPuttsWhenGir != null ? (
                <View style={styles.quadCell}>
                  <Text style={styles.quadVal}>{fmt1(four.putting.avgPuttsWhenGir)}</Text>
                  <Text style={styles.quadLab}>GIR 后均推</Text>
                </View>
              ) : null}
            </View>
            {threeSeries.length >= 3 ? (
              <View style={styles.sparkWrap}>
                <MiniSparkline values={threeSeries} width={200} height={40} stroke={MUTED} />
                <Text style={styles.sparkCap}>三推率走势（近10场）</Text>
              </View>
            ) : null}
          </View>
        ) : (
          <Text style={styles.mutedBody}>暂无推杆结构数据</Text>
        )}
      </SectionCard>

      <View style={styles.aiCard}>
        <Text style={styles.aiTitle}>练习建议</Text>
        {tips.map((t, i) => (
          <Text key={i} style={styles.aiLine}>
            · {t}
          </Text>
        ))}
      </View>

      <Text style={styles.blockLabel}>能力雷达</Text>
      <View style={styles.radarCard}>
        {radarDims.length >= 2 ? (
          <View style={styles.radarWrap}>
            <ScoreRadar dims={radarDims} />
          </View>
        ) : (
          <Text style={styles.radarHint}>有效维度不少于两项时显示雷达图。</Text>
        )}
      </View>

      <Pressable style={styles.timelineLink} onPress={() => router.push('/handicap/history' as Href)}>
        <Text style={styles.timelineLinkTxt}>完整成绩时间线 ›</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14, paddingBottom: 8 },
  emptyWrap: { paddingVertical: 32, paddingHorizontal: 12, alignItems: 'center', gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: WHITE },
  emptySub: { fontSize: 14, color: MUTED2, textAlign: 'center', lineHeight: 21 },
  emptyBtn: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: LIME_DIM,
    borderWidth: 1,
    borderColor: 'rgba(163,230,53,0.45)',
  },
  emptyBtnTxt: { fontSize: 15, fontWeight: '800', color: LIME },
  overviewCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    paddingVertical: 16,
    paddingHorizontal: 12,
    gap: 8,
  },
  overviewCol: { flex: 1.1, justifyContent: 'center' },
  overviewColCenter: { flex: 1.2, alignItems: 'center', justifyContent: 'center', borderLeftWidth: 1, borderRightWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  overviewColRight: { flex: 0.9, justifyContent: 'center', alignItems: 'flex-end' },
  hiBig: { fontSize: 34, fontWeight: '900', color: LIME, letterSpacing: -1 },
  hiBigMuted: { fontSize: 34, fontWeight: '900', color: MUTED, letterSpacing: -1 },
  hiSub: { fontSize: 10, color: MUTED2, marginTop: 4, lineHeight: 14 },
  lastScore: { fontSize: 26, fontWeight: '800', color: WHITE },
  lastMeta: { fontSize: 11, color: MUTED, marginTop: 2, maxWidth: 120, textAlign: 'center' },
  trendArrow: { fontSize: 12, fontWeight: '700', marginTop: 6 },
  bwLabel: { fontSize: 10, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.8 },
  bwVal: { fontSize: 14, fontWeight: '700', color: WHITE, marginTop: 4 },
  blockLabel: {
    fontSize: 10,
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginTop: 4,
  },
  radarCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    paddingVertical: 20,
    alignItems: 'center',
  },
  radarWrap: { alignItems: 'center', justifyContent: 'center' },
  radarHint: { fontSize: 13, color: MUTED2, textAlign: 'center', paddingHorizontal: 20, lineHeight: 20 },
  sectionCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: CARD_BG,
    overflow: 'hidden',
  },
  sectionHeader: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: WHITE },
  sectionBody: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 16 },
  detailBlock: { gap: 10 },
  bigMetric: { fontSize: 32, fontWeight: '900', color: LIME },
  metricCaption: { fontSize: 12, color: MUTED, marginTop: -4 },
  sparkWrap: { marginTop: 4 },
  sparkCap: { fontSize: 10, color: MUTED2, marginTop: 4 },
  penLine: { fontSize: 12, color: MUTED2, lineHeight: 18 },
  mutedBody: { fontSize: 13, color: MUTED2, lineHeight: 20 },
  triRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  triCell: {
    width: '48%',
    minWidth: 100,
    flexGrow: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 12,
    alignItems: 'center',
  },
  triVal: { fontSize: 18, fontWeight: '800', color: WHITE },
  triLab: { fontSize: 10, color: MUTED, marginTop: 4, textAlign: 'center' },
  quadRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  quadCell: {
    width: '48%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 12,
    alignItems: 'center',
  },
  quadCellGood: { borderColor: 'rgba(163,230,53,0.45)', backgroundColor: 'rgba(163,230,53,0.1)' },
  quadCellWarn: { borderColor: 'rgba(248,113,113,0.5)', backgroundColor: 'rgba(248,113,113,0.08)' },
  quadVal: { fontSize: 17, fontWeight: '800', color: WHITE },
  quadLab: { fontSize: 10, color: MUTED, marginTop: 4 },
  aiCard: {
    minHeight: 120,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: 16,
    gap: 10,
  },
  aiTitle: { fontSize: 15, fontWeight: '800', color: WHITE },
  aiLine: { fontSize: 13, color: MUTED2, lineHeight: 21 },
  timelineLink: { alignItems: 'center', paddingVertical: 8 },
  timelineLinkTxt: { fontSize: 14, fontWeight: '700', color: LIME },
});
