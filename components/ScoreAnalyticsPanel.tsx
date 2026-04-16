import { useFocusEffect } from '@react-navigation/native';
import { type Href, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import {
  buildHoleDerivedStats,
  buildHoleShapeStats,
  buildNineSplit,
  buildPracticeInsightLines,
  buildSliceStats,
  buildTrendVsEarlier,
  fmt0,
  fmt1,
} from '@/lib/home-score-analytics';
import { calcHandicapIndex, loadHandicapRecords, normalizeHandicapRecords, type HandicapRecord } from '@/lib/handicap';

const TILE_BG = 'rgba(255,255,255,0.07)';
const TILE_BORDER = 'rgba(255,255,255,0.1)';
const WHITE = '#ffffff';
const MUTED = 'rgba(255,255,255,0.45)';
const MUTED2 = 'rgba(255,255,255,0.4)';
const LIME = '#a3e635';
const LABEL_DIM = 'rgba(255,255,255,0.5)';
const SUB_DIM = 'rgba(255,255,255,0.32)';
const ACCENT_BORDER = 'rgba(163,230,53,0.55)';

const COLS = 4;

function fmtDeltaPpt(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${n > 0 ? '+' : ''}${n.toFixed(1)}pt`;
}

function fmtDeltaStrokes(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${n > 0 ? '+' : ''}${n.toFixed(1)}杆`;
}

type TileSpec = { label: string; value: string; sub?: string; accent?: boolean };

function chunkRows(items: TileSpec[]): (TileSpec | null)[][] {
  const copy: (TileSpec | null)[] = [...items];
  while (copy.length % COLS !== 0) copy.push(null);
  const rows: (TileSpec | null)[][] = [];
  for (let i = 0; i < copy.length; i += COLS) {
    rows.push(copy.slice(i, i + COLS));
  }
  return rows;
}

function StatTile({ label, value, sub, accent }: TileSpec) {
  return (
    <View style={[tileStyles.box, accent ? tileStyles.boxAccent : null]}>
      <Text style={tileStyles.value} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75}>
        {value}
      </Text>
      <Text style={tileStyles.label} numberOfLines={2}>
        {label}
      </Text>
      {sub ? (
        <Text style={tileStyles.sub} numberOfLines={2}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

function StatTileGrid({ tiles }: { tiles: TileSpec[] }) {
  const rows = chunkRows(tiles);
  return (
    <View style={styles.tileGridCol}>
      {rows.map((row, ri) => (
        <View key={ri} style={styles.rowGrid}>
          {row.map((t, ci) => (
            <View key={ci} style={styles.cellGrid}>
              {t ? <StatTile label={t.label} value={t.value} sub={t.sub} accent={t.accent} /> : null}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const tileStyles = StyleSheet.create({
  box: {
    flex: 1,
    width: '100%',
    backgroundColor: TILE_BG,
    borderWidth: 1,
    borderColor: TILE_BORDER,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 88,
  },
  value: {
    fontSize: 20,
    fontWeight: '800',
    color: WHITE,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  label: { fontSize: 10, color: LABEL_DIM, marginTop: 6, textAlign: 'center', lineHeight: 14 },
  sub: { fontSize: 10, color: SUB_DIM, marginTop: 2, textAlign: 'center', lineHeight: 14 },
  boxAccent: { borderColor: ACCENT_BORDER, borderWidth: 1.5 },
});

/**
 * 成绩页「成绩分析」：整体 / 近期 / 洞级 / 半场等统计（数据来自 loadHandicapRecords）
 */
export function ScoreAnalyticsPanel() {
  const router = useRouter();
  const [records, setRecords] = useState<HandicapRecord[]>([]);

  useFocusEffect(
    useCallback(() => {
      setRecords(loadHandicapRecords());
      return () => {};
    }, []),
  );

  const sorted = useMemo(
    () => [...records].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [records],
  );

  const overallStats = useMemo(() => buildSliceStats(sorted), [sorted]);
  const recent5Stats = useMemo(() => buildSliceStats(sorted.slice(0, 5)), [sorted]);
  const holeShape = useMemo(() => buildHoleShapeStats(sorted), [sorted]);
  const nineSplit = useMemo(() => buildNineSplit(sorted), [sorted]);
  const overallDerived = useMemo(() => buildHoleDerivedStats(sorted), [sorted]);
  const recent5Derived = useMemo(() => buildHoleDerivedStats(sorted.slice(0, 5)), [sorted]);
  const trend = useMemo(() => buildTrendVsEarlier(sorted, 10), [sorted]);
  const hiVal = useMemo(() => calcHandicapIndex(normalizeHandicapRecords(records)), [records]);
  const insights = useMemo(
    () => buildPracticeInsightLines({ trend, derived: overallDerived, slice: overallStats }),
    [trend, overallDerived, overallStats],
  );

  const deltaRecentVsOverall =
    overallStats.avgGross != null &&
    recent5Stats.avgGross != null &&
    Number.isFinite(overallStats.avgGross) &&
    Number.isFinite(recent5Stats.avgGross)
      ? Math.round((recent5Stats.avgGross - overallStats.avgGross) * 10) / 10
      : null;

  if (!sorted.length) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyText}>暂无已保存轮次，请先记录成绩。</Text>
      </View>
    );
  }

  const recentVsOverallText =
    deltaRecentVsOverall == null
      ? '—'
      : deltaRecentVsOverall === 0
        ? '持平'
        : deltaRecentVsOverall > 0
          ? `高 ${fmt1(Math.abs(deltaRecentVsOverall))} 杆`
          : `低 ${fmt1(Math.abs(deltaRecentVsOverall))} 杆`;

  const hiStr = hiVal != null && Number.isFinite(hiVal) ? hiVal.toFixed(1) : '—';
  const hasHoleSample = overallDerived.holesCounted > 0;

  const baseTiles: TileSpec[] = [
    { label: '样本', value: `${overallStats.rounds} 场`, sub: 'Sample' },
    { label: 'WHS 差点', value: hiStr, sub: 'Handicap Index' },
    { label: '场均总杆', value: fmt0(overallStats.avgGross), sub: 'Score' },
    { label: '平均微差', value: fmt1(overallStats.avgDiff), sub: 'Differential' },
    {
      label: 'σ 波动',
      value: overallStats.stdGross != null ? fmt1(overallStats.stdGross) : '—',
      sub: '稳定性',
    },
    {
      label: '最佳/最差',
      value: `${fmt0(overallStats.bestGross)}/${fmt0(overallStats.worstGross)}`,
      sub: 'Best / Worst',
    },
    { label: '逐洞场数', value: `${overallStats.roundsWithHoles} 场`, sub: 'Hole-by-hole' },
  ];

  const teeTiles: TileSpec[] = [
    {
      label: 'FIR',
      value: overallStats.avgFwPct != null ? `${fmt0(overallStats.avgFwPct)}%` : '—',
      sub: 'Fairways in Reg',
    },
    { label: '开球偏离', value: '—', sub: 'Miss Dir · 待记录' },
    { label: '木杆均距', value: '—', sub: 'Avg Drive · 待记录' },
    { label: '罚杆', value: '—', sub: 'Penalties · 待记录' },
  ];

  const approachTiles: TileSpec[] = [
    {
      label: 'GIR',
      value: overallStats.avgGirPct != null ? `${fmt0(overallStats.avgGirPct)}%` : '—',
      sub: 'Greens in Reg',
      accent: true,
    },
    {
      label: 'Par3 GIR',
      value: overallDerived.par3GirPct != null ? `${fmt0(overallDerived.par3GirPct)}%` : '—',
      sub: '三杆洞',
    },
    {
      label: 'Par4 GIR',
      value: overallDerived.par4GirPct != null ? `${fmt0(overallDerived.par4GirPct)}%` : '—',
      sub: '四杆洞',
    },
    {
      label: 'Par5 GIR',
      value: overallDerived.par5GirPct != null ? `${fmt0(overallDerived.par5GirPct)}%` : '—',
      sub: '五杆洞',
    },
    { label: '失误位置', value: '—', sub: 'Miss Green · 待记录' },
    { label: '铁杆标签', value: '—', sub: 'Club GIR · 待记录' },
  ];

  const wedgeTiles: TileSpec[] = [
    {
      label: '救帕率',
      value: overallDerived.scramblingPct != null ? `${fmt0(overallDerived.scramblingPct)}%` : '—',
      sub: 'Scrambling',
    },
    { label: '沙坑救球', value: '—', sub: 'Sand Saves · 待记录' },
    { label: '切杆留距', value: '—', sub: 'Proximity · 待记录' },
    { label: '短推一推', value: '—', sub: '1-Putt 3–6ft · 待记录' },
  ];

  const greenTiles: TileSpec[] = [
    { label: '场均推杆', value: fmt1(overallStats.avgPuttsRound), sub: 'Total Putts' },
    { label: '每洞推杆', value: fmt1(overallStats.avgPuttsPerHole), sub: 'Putts / Hole' },
    {
      label: '三推洞%',
      value: overallDerived.threePuttHolePct != null ? `${fmt1(overallDerived.threePuttHolePct)}%` : '—',
      sub: '3-Putt holes',
      accent: true,
    },
    {
      label: '一推洞%',
      value: overallDerived.onePuttHolePct != null ? `${fmt0(overallDerived.onePuttHolePct)}%` : '—',
      sub: '1-Putt holes',
    },
    {
      label: '上果岭均推',
      value: overallDerived.avgPuttsWhenGir != null ? fmt1(overallDerived.avgPuttsWhenGir) : '—',
      sub: 'Putts when GIR',
    },
    {
      label: '未上均推',
      value: overallDerived.avgPuttsWhenNotGir != null ? fmt1(overallDerived.avgPuttsWhenNotGir) : '—',
      sub: 'Putts when miss',
    },
  ];

  const trendTiles: TileSpec[] = trend
    ? [
        { label: 'Δ GIR', value: fmtDeltaPpt(trend.deltaGirPctPts), sub: '近10 vs 更早' },
        { label: 'Δ三推洞%', value: fmtDeltaPpt(trend.deltaThreePuttHolePctPts), sub: '百分点' },
        { label: 'Δ场均杆', value: fmtDeltaStrokes(trend.deltaAvgGross), sub: '总杆' },
        { label: 'Δ救帕', value: fmtDeltaPpt(trend.deltaScramblingPctPts), sub: 'Scrambling' },
        { label: 'Δ场均推杆', value: fmtDeltaStrokes(trend.deltaAvgPuttsRound), sub: '推杆/场' },
      ]
    : [];

  const recentTiles: TileSpec[] =
    recent5Stats.rounds >= 2
      ? [
          { label: '样本', value: `${recent5Stats.rounds} 场` },
          { label: '场均总杆', value: fmt0(recent5Stats.avgGross), sub: 'Score' },
          { label: '较整体', value: recentVsOverallText },
          { label: '平均微差', value: fmt1(recent5Stats.avgDiff), sub: 'Diff' },
          { label: '场均推杆', value: fmt1(recent5Stats.avgPuttsRound) },
          { label: '每洞推杆', value: fmt1(recent5Stats.avgPuttsPerHole) },
          {
            label: 'GIR',
            value: recent5Stats.avgGirPct != null ? `${fmt0(recent5Stats.avgGirPct)}%` : '—',
            accent: true,
          },
          ...(recent5Derived.holesCounted > 0
            ? ([
                {
                  label: '救帕率',
                  value:
                    recent5Derived.scramblingPct != null ? `${fmt0(recent5Derived.scramblingPct)}%` : '—',
                  sub: 'Scrambling',
                },
                {
                  label: '三推洞%',
                  value:
                    recent5Derived.threePuttHolePct != null
                      ? `${fmt1(recent5Derived.threePuttHolePct)}%`
                      : '—',
                  accent: true,
                },
                {
                  label: '一推洞%',
                  value:
                    recent5Derived.onePuttHolePct != null ? `${fmt0(recent5Derived.onePuttHolePct)}%` : '—',
                },
              ] as TileSpec[])
            : []),
        ]
      : [];

  const holeTiles: TileSpec[] =
    holeShape.holesCounted > 0
      ? [
          {
            label: '鸟+',
            value: holeShape.birdieOrBetterPct != null ? `${fmt1(holeShape.birdieOrBetterPct)}%` : '—',
          },
          { label: '帕上', value: holeShape.parPct != null ? `${fmt1(holeShape.parPct)}%` : '—' },
          {
            label: '双柏+',
            value: holeShape.doubleOrWorsePct != null ? `${fmt1(holeShape.doubleOrWorsePct)}%` : '—',
          },
        ]
      : [];

  const nineTiles: TileSpec[] =
    nineSplit.rounds > 0
      ? [
          { label: '前 9', value: fmt1(nineSplit.avgFront9), sub: '杆/场' },
          { label: '后 9', value: fmt1(nineSplit.avgBack9), sub: '杆/场' },
        ]
      : [];

  return (
    <View style={styles.wrap}>
      <Text style={styles.intro}>
        高尔夫实战数据分析模型：基于已保存轮次自动汇总（9 / 18 洞）。优先关注「平均 GIR」与「三推洞占比」两项对成绩走向最敏感。
      </Text>

      {!hasHoleSample ? (
        <View style={styles.hintBanner}>
          <Text style={styles.hintText}>
            暂无逐洞样本时，救帕率、分 Par GIR、三推/一推洞占比等显示为 —；建议整场逐洞记分以解锁完整模型。
          </Text>
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>基础信息</Text>
      <StatTileGrid tiles={baseTiles} />

      <Text style={styles.sectionTitle}>开球</Text>
      <StatTileGrid tiles={teeTiles} />

      <Text style={styles.sectionTitle}>攻果岭</Text>
      <StatTileGrid tiles={approachTiles} />

      <Text style={styles.sectionTitle}>短杆</Text>
      <StatTileGrid tiles={wedgeTiles} />

      <Text style={styles.sectionTitle}>果岭与推杆</Text>
      <StatTileGrid tiles={greenTiles} />

      {trend ? (
        <>
          <Text style={styles.sectionTitle}>趋势（近10 vs 更早）</Text>
          <Text style={styles.sectionSub}>
            最近 {trend.recentRounds} 场对比更早 {trend.priorRounds} 场；Δ 为三推/GIR/救帕的百分点差，场均杆与推杆为杆数差。
          </Text>
          <StatTileGrid tiles={trendTiles} />
        </>
      ) : (
        <Text style={styles.sectionSub}>满 11 场后，在此对比「最近 10 场」与「更早全部场次」。</Text>
      )}

      <Text style={styles.sectionTitle}>实操建议</Text>
      <View style={styles.insightBox}>
        {insights.map((line, i) => (
          <Text key={i} style={styles.insightLine}>
            · {line}
          </Text>
        ))}
      </View>

      {sorted.length >= 2 ? (
        <>
          <Text style={styles.sectionTitle}>近期（最近 5 场）</Text>
          {recent5Stats.rounds < 2 ? (
            <View style={styles.hintBanner}>
              <Text style={styles.hintText}>场次不足，多记几场后对比更有意义。</Text>
            </View>
          ) : (
            <StatTileGrid tiles={recentTiles} />
          )}
        </>
      ) : null}

      {holeShape.holesCounted > 0 ? (
        <>
          <Text style={styles.sectionTitle}>洞级表现</Text>
          <Text style={styles.sectionSub}>全部逐洞样本 · 共 {holeShape.holesCounted} 洞</Text>
          <StatTileGrid tiles={holeTiles} />
        </>
      ) : null}

      {nineSplit.rounds > 0 ? (
        <>
          <Text style={styles.sectionTitle}>18 洞半场</Text>
          <Text style={styles.sectionSub}>有逐洞数据 · 样本 {nineSplit.rounds} 场</Text>
          <StatTileGrid tiles={nineTiles} />
        </>
      ) : null}

      <TouchableOpacity style={styles.link} onPress={() => router.push('/handicap/history' as Href)}>
        <Text style={styles.linkTxt}>打开完整成绩时间线 ›</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  intro: { fontSize: 14, color: MUTED, marginBottom: 8, lineHeight: 21 },
  emptyWrap: { paddingVertical: 24, paddingHorizontal: 8 },
  emptyText: { fontSize: 15, color: MUTED2, textAlign: 'center', lineHeight: 23 },
  sectionTitle: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    marginTop: 14,
    marginBottom: 8,
  },
  sectionSub: { fontSize: 12, color: MUTED2, marginTop: -4, marginBottom: 8, lineHeight: 17 },
  tileGridCol: { gap: 6 },
  rowGrid: { flexDirection: 'row', gap: 4, alignItems: 'stretch' },
  cellGrid: { flex: 1, minWidth: 0 },
  hintBanner: {
    backgroundColor: TILE_BG,
    borderWidth: 1,
    borderColor: TILE_BORDER,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 14,
  },
  hintText: { fontSize: 13, color: MUTED2, textAlign: 'center', lineHeight: 20 },
  link: { paddingVertical: 14, alignItems: 'center' },
  linkTxt: { fontSize: 15, fontWeight: '700', color: LIME },
  insightBox: {
    backgroundColor: TILE_BG,
    borderWidth: 1,
    borderColor: TILE_BORDER,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 10,
  },
  insightLine: { fontSize: 13, color: MUTED2, lineHeight: 20 },
});
