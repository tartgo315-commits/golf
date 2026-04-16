import { useFocusEffect } from '@react-navigation/native';
import { type Href, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { buildHoleShapeStats, buildNineSplit, buildSliceStats, fmt0, fmt1 } from '@/lib/home-score-analytics';
import { loadHandicapRecords, type HandicapRecord } from '@/lib/handicap';

const TILE_BG = 'rgba(255,255,255,0.07)';
const TILE_BORDER = 'rgba(255,255,255,0.1)';
const WHITE = '#ffffff';
const MUTED = 'rgba(255,255,255,0.45)';
const MUTED2 = 'rgba(255,255,255,0.4)';
const LIME = '#a3e635';
const LABEL_DIM = 'rgba(255,255,255,0.5)';
const SUB_DIM = 'rgba(255,255,255,0.32)';

const COLS = 4;

type TileSpec = { label: string; value: string; sub?: string };

function chunkRows(items: TileSpec[]): (TileSpec | null)[][] {
  const copy: (TileSpec | null)[] = [...items];
  while (copy.length % COLS !== 0) copy.push(null);
  const rows: (TileSpec | null)[][] = [];
  for (let i = 0; i < copy.length; i += COLS) {
    rows.push(copy.slice(i, i + COLS));
  }
  return rows;
}

function StatTile({ label, value, sub }: TileSpec) {
  return (
    <View style={tileStyles.box}>
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
              {t ? <StatTile label={t.label} value={t.value} sub={t.sub} /> : null}
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

  const overallTiles: TileSpec[] = [
    { label: '样本', value: `${overallStats.rounds} 场` },
    { label: '场均总杆', value: fmt0(overallStats.avgGross) },
    {
      label: '最佳/最差',
      value: `${fmt0(overallStats.bestGross)}/${fmt0(overallStats.worstGross)}`,
    },
    {
      label: 'σ 波动',
      value: overallStats.stdGross != null ? fmt1(overallStats.stdGross) : '—',
    },
    { label: '平均微差', value: fmt1(overallStats.avgDiff) },
    { label: '场均推杆', value: fmt1(overallStats.avgPuttsRound) },
    { label: '每洞推杆', value: fmt1(overallStats.avgPuttsPerHole) },
    {
      label: 'GIR',
      value: overallStats.avgGirPct != null ? `${fmt0(overallStats.avgGirPct)}%` : '—',
    },
    {
      label: '球道',
      value: overallStats.avgFwPct != null ? `${fmt0(overallStats.avgFwPct)}%` : '—',
    },
    { label: '逐洞场数', value: `${overallStats.roundsWithHoles} 场` },
  ];

  const recentTiles: TileSpec[] =
    recent5Stats.rounds >= 2
      ? [
          { label: '样本', value: `${recent5Stats.rounds} 场` },
          { label: '场均总杆', value: fmt0(recent5Stats.avgGross) },
          { label: '较整体', value: recentVsOverallText },
          { label: '场均推杆', value: fmt1(recent5Stats.avgPuttsRound) },
          { label: '每洞推杆', value: fmt1(recent5Stats.avgPuttsPerHole) },
          {
            label: 'GIR',
            value: recent5Stats.avgGirPct != null ? `${fmt0(recent5Stats.avgGirPct)}%` : '—',
          },
          { label: '平均微差', value: fmt1(recent5Stats.avgDiff) },
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
      <Text style={styles.intro}>基于已保存轮次自动汇总（含 9 / 18 洞）</Text>

      <Text style={styles.sectionTitle}>整体</Text>
      <StatTileGrid tiles={overallTiles} />

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
});
