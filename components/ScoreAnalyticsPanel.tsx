import { useFocusEffect } from '@react-navigation/native';
import { type Href, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { buildHoleShapeStats, buildNineSplit, buildSliceStats, fmt0, fmt1 } from '@/lib/home-score-analytics';
import { loadHandicapRecords, type HandicapRecord } from '@/lib/handicap';

const CARD = 'rgba(255,255,255,0.05)';
const BORDER = 'rgba(255,255,255,0.09)';
const WHITE = '#ffffff';
const MUTED = 'rgba(255,255,255,0.45)';
const MUTED2 = 'rgba(255,255,255,0.4)';
const LIME = '#a3e635';

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

  return (
    <View style={styles.wrap}>
      <Text style={styles.intro}>基于已保存轮次自动汇总（含 9 / 18 洞）</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>整体</Text>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>样本</Text>
          <Text style={styles.statValue}>{overallStats.rounds} 场</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>场均总杆</Text>
          <Text style={styles.statValue}>{fmt0(overallStats.avgGross)}</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>最佳 / 最差</Text>
          <Text style={styles.statValue}>
            {fmt0(overallStats.bestGross)} / {fmt0(overallStats.worstGross)}
          </Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>总杆波动 σ</Text>
          <Text style={styles.statValue}>{overallStats.stdGross != null ? fmt1(overallStats.stdGross) : '—'}</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>平均微差</Text>
          <Text style={styles.statValue}>{fmt1(overallStats.avgDiff)}</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>场均推杆</Text>
          <Text style={styles.statValue}>{fmt1(overallStats.avgPuttsRound)}</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>每洞推杆</Text>
          <Text style={styles.statValue}>{fmt1(overallStats.avgPuttsPerHole)}</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>平均 GIR</Text>
          <Text style={styles.statValue}>
            {overallStats.avgGirPct != null ? `${fmt0(overallStats.avgGirPct)}%` : '—'}
          </Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>平均球道命中</Text>
          <Text style={styles.statValue}>
            {overallStats.avgFwPct != null ? `${fmt0(overallStats.avgFwPct)}%` : '—'}
          </Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>逐洞数据场数</Text>
          <Text style={styles.statValue}>{overallStats.roundsWithHoles} 场</Text>
        </View>
      </View>

      {sorted.length >= 2 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>近期（最近 5 场）</Text>
          {recent5Stats.rounds < 2 ? (
            <Text style={styles.muted}>场次不足，多记几场后对比更有意义。</Text>
          ) : (
            <>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>样本</Text>
                <Text style={styles.statValue}>{recent5Stats.rounds} 场</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>场均总杆</Text>
                <Text style={styles.statValue}>{fmt0(recent5Stats.avgGross)}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>较整体</Text>
                <Text style={styles.statValue}>
                  {deltaRecentVsOverall == null
                    ? '—'
                    : deltaRecentVsOverall === 0
                      ? '持平'
                      : deltaRecentVsOverall > 0
                        ? `高 ${fmt1(Math.abs(deltaRecentVsOverall))} 杆`
                        : `低 ${fmt1(Math.abs(deltaRecentVsOverall))} 杆`}
                </Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>场均推杆</Text>
                <Text style={styles.statValue}>{fmt1(recent5Stats.avgPuttsRound)}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>每洞推杆</Text>
                <Text style={styles.statValue}>{fmt1(recent5Stats.avgPuttsPerHole)}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>平均 GIR</Text>
                <Text style={styles.statValue}>
                  {recent5Stats.avgGirPct != null ? `${fmt0(recent5Stats.avgGirPct)}%` : '—'}
                </Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>平均微差</Text>
                <Text style={styles.statValue}>{fmt1(recent5Stats.avgDiff)}</Text>
              </View>
            </>
          )}
        </View>
      ) : null}

      {holeShape.holesCounted > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>洞级表现（全部逐洞样本）</Text>
          <Text style={styles.muted}>共 {holeShape.holesCounted} 洞</Text>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>鸟或更好</Text>
            <Text style={styles.statValue}>
              {holeShape.birdieOrBetterPct != null ? `${fmt1(holeShape.birdieOrBetterPct)}%` : '—'}
            </Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>标准杆上</Text>
            <Text style={styles.statValue}>{holeShape.parPct != null ? `${fmt1(holeShape.parPct)}%` : '—'}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>双柏忌及以上</Text>
            <Text style={styles.statValue}>
              {holeShape.doubleOrWorsePct != null ? `${fmt1(holeShape.doubleOrWorsePct)}%` : '—'}
            </Text>
          </View>
        </View>
      ) : null}

      {nineSplit.rounds > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>18 洞半场（有逐洞数据）</Text>
          <Text style={styles.muted}>样本 {nineSplit.rounds} 场</Text>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>场均前 9</Text>
            <Text style={styles.statValue}>{fmt1(nineSplit.avgFront9)} 杆</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>场均后 9</Text>
            <Text style={styles.statValue}>{fmt1(nineSplit.avgBack9)} 杆</Text>
          </View>
        </View>
      ) : null}

      <TouchableOpacity style={styles.link} onPress={() => router.push('/handicap/history' as Href)}>
        <Text style={styles.linkTxt}>打开完整成绩时间线 ›</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  intro: { fontSize: 12, color: MUTED, marginBottom: 4, lineHeight: 18 },
  emptyWrap: { paddingVertical: 24, paddingHorizontal: 8 },
  emptyText: { fontSize: 14, color: MUTED2, textAlign: 'center', lineHeight: 22 },
  card: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    padding: 14,
    gap: 2,
  },
  cardTitle: { fontSize: 15, fontWeight: '800', color: WHITE, marginBottom: 8 },
  muted: { fontSize: 12, color: MUTED2, marginBottom: 8, lineHeight: 18 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  statLabel: { fontSize: 13, color: 'rgba(255,255,255,0.55)', flex: 1, paddingRight: 8 },
  statValue: { fontSize: 13, fontWeight: '700', color: WHITE, textAlign: 'right', maxWidth: '56%' },
  link: { paddingVertical: 12, alignItems: 'center' },
  linkTxt: { fontSize: 13, fontWeight: '700', color: LIME },
});
