import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { type Href, router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { TAB_BAR_SCROLL_EXTRA } from '@/constants/theme';
import { buildHoleShapeStats, buildNineSplit, buildSliceStats, fmt0, fmt1 } from '@/lib/home-score-analytics';
import { calcHandicapIndex, loadHandicapRecords, normalizeHandicapRecords, type HandicapRecord } from '@/lib/handicap';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return '早上好';
  if (h < 18) return '下午好';
  return '晚上好';
}

function daysSince(dateStr: string) {
  const d = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  return d === 0 ? '今天' : d === 1 ? '昨天' : `${d}天前`;
}

export default function HomeScreen() {
  const [records, setRecords] = useState<HandicapRecord[]>([]);
  const [clubCount, setClubCount] = useState<number>(0);

  useFocusEffect(
    useCallback(() => {
      setRecords(loadHandicapRecords());
      AsyncStorage.getItem('savedClubs')
        .then((raw) => {
          try {
            if (raw) setClubCount(JSON.parse(raw).length);
          } catch {
            /* ignore */
          }
        })
        .catch(() => {});
    }, []),
  );

  const sorted = useMemo(
    () => [...records].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [records],
  );
  const recent20 = sorted.slice(0, 20);
  const hcpIndex = calcHandicapIndex(normalizeHandicapRecords(records));
  const hcp = typeof hcpIndex === 'number' ? hcpIndex.toFixed(1) : null;

  const avgScore = recent20.length
    ? Math.round(recent20.reduce((s, r) => s + r.adjustedGrossScore, 0) / recent20.length)
    : null;
  const bestScore = recent20.length ? Math.min(...recent20.map((r) => r.adjustedGrossScore)) : null;
  const puttEligible = recent20.filter((r) => r.holes > 0 && Number.isFinite(r.totalPutts));
  const avgPutts = puttEligible.length
    ? Math.round(puttEligible.reduce((s, r) => s + r.totalPutts, 0) / puttEligible.length)
    : null;
  const avgPuttsPerHoleMini = puttEligible.length
    ? puttEligible.reduce((s, r) => s + r.totalPutts / r.holes, 0) / puttEligible.length
    : null;
  const girRounds = recent20.filter((r) => r.holes > 0 && Number.isFinite(r.greensInRegulation));
  const avgGir = girRounds.length
    ? Math.round(girRounds.reduce((s, r) => s + (r.greensInRegulation / r.holes) * 100, 0) / girRounds.length)
    : null;
  const progressRatio = Math.min(records.length / 3, 1);

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

  return (
    <View style={s.root}>
      {/* ── Header ── */}
      <View style={s.header}>
        <View style={s.headerRow}>
          <View>
            <Text style={s.greetText}>{greeting()}</Text>
            <Text style={s.nameText}>Lee</Text>
          </View>
          <TouchableOpacity style={s.profileBtn} onPress={() => router.push('/settings' as any)}>
            <Text style={s.profileBtnText}>我的档案</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── 数据快照：差点 + 3项统计，全部可见 ── */}
        <View style={s.statsGrid}>
          {/* 差点卡，占满第一行 */}
          <TouchableOpacity style={s.hcpCard} onPress={() => router.push('/(tabs)/handicap' as any)}>
            <View style={s.hcpLeft}>
              <Text style={s.hcpLabel}>WHS 差点</Text>
              <Text style={s.hcpValue}>{hcp ?? '待生成'}</Text>
              <Text style={s.hcpSub}>
                {hcp ? `进度 ${records.length} 场` : `还需 ${Math.max(0, 3 - records.length)} 场`}
              </Text>
            </View>
            <View style={s.hcpRight}>
              <View style={s.progressTrack}>
                <View style={[s.progressFill, { width: `${progressRatio * 100}%` as any }]} />
              </View>
              <Text style={s.hcpRecords}>{records.length} 场记录</Text>
            </View>
          </TouchableOpacity>

          {/* 3项统计横排 */}
          <View style={s.miniStatsRow}>
            <TouchableOpacity style={s.miniStat} onPress={() => router.push('/(tabs)/score' as any)}>
              <Text style={s.miniStatNum}>{avgScore ?? '--'}</Text>
              <Text style={s.miniStatLabel}>近期均杆</Text>
              <Text style={s.miniStatSub}>最佳 {bestScore ?? '--'}</Text>
            </TouchableOpacity>
            <View style={s.miniDivider} />
            <TouchableOpacity style={s.miniStat} onPress={() => router.push('/(tabs)/score' as any)}>
              <Text style={s.miniStatNum}>
                {avgPutts != null && Number.isFinite(avgPutts) ? String(avgPutts) : '--'}
              </Text>
              <Text style={s.miniStatLabel}>平均推杆</Text>
              <Text style={s.miniStatSub}>
                每洞{' '}
                {avgPuttsPerHoleMini != null && Number.isFinite(avgPuttsPerHoleMini)
                  ? avgPuttsPerHoleMini.toFixed(2)
                  : '--'}
              </Text>
            </TouchableOpacity>
            <View style={s.miniDivider} />
            <TouchableOpacity style={s.miniStat} onPress={() => router.push('/(tabs)/score' as any)}>
              <Text style={s.miniStatNum}>{avgGir != null ? `${avgGir}%` : '--'}</Text>
              <Text style={s.miniStatLabel}>平均 GIR</Text>
              <Text style={s.miniStatSub}>{records.length} 场</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── 快捷入口 4宫格 ── */}
        <Text style={s.sectionTitle}>快捷入口</Text>
        <View style={s.gridRow}>
          <TouchableOpacity
            style={[s.gridCell, { backgroundColor: '#a3e635' }]}
            onPress={() => router.push('/(tabs)/score' as any)}
          >
            <Text style={[s.gridLabel, { color: '#0d1f10' }]}>记成绩</Text>
            <Text style={[s.gridSub, { color: 'rgba(13,31,16,0.55)' }]}>新增一轮</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.gridCell}
            onPress={() => router.push('/(tabs)/fitting' as any)}
          >
            <Text style={s.gridLabel}>AI 配杆</Text>
            <Text style={s.gridSub}>智能推荐</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.gridCell}
            onPress={() => router.push('/my-bag' as any)}
          >
            <Text style={s.gridLabel}>我的球包</Text>
            <Text style={s.gridSub}>{clubCount ? `${clubCount} 支` : '管理球杆'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.gridCell}
            onPress={() => router.push('/(tabs)/bet' as any)}
          >
            <Text style={s.gridLabel}>比赛设置</Text>
            <Text style={s.gridSub}>差点配置</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.sectionTitle}>AI 分析</Text>
        <View style={s.aiCardRow}>
          <TouchableOpacity
            style={[s.aiCard, { borderColor: 'rgba(163,230,53,0.3)' }]}
            onPress={() => router.push('/ai-training' as any)}
          >
            <Text style={s.aiCardTitle}>练球分析</Text>
            <Text style={s.aiCardSub}>根据成绩数据{'\n'}制定训练计划</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.aiCard, { borderColor: 'rgba(99,179,237,0.3)' }]}
            onPress={() => router.push('/course-strategy' as any)}
          >
            <Text style={s.aiCardTitle}>下场策略</Text>
            <Text style={s.aiCardSub}>针对短板制定{'\n'}本场比赛预案</Text>
          </TouchableOpacity>
        </View>

        {/* ── 最近成绩 ── */}
        <View style={s.sectionRow}>
          <Text style={s.sectionTitle}>最近成绩</Text>
          <TouchableOpacity onPress={() => router.push('/handicap/history' as Href)}>
            <Text style={s.seeAll}>查看全部 ›</Text>
          </TouchableOpacity>
        </View>

        {sorted.length === 0 ? (
          <Text style={s.emptyText}>暂无成绩，去记录第一轮吧</Text>
        ) : (
          sorted.slice(0, 3).map((r) => (
            <TouchableOpacity
              key={r.id}
              style={s.roundCard}
              onPress={() => router.push(`/handicap/${r.id}` as any)}>
              <View style={{ flex: 1 }}>
                <Text style={s.courseName}>{r.courseName}</Text>
                <Text style={s.courseMeta}>
                  {r.date} · {r.holes}洞 · {daysSince(r.date)}
                </Text>
                <View style={s.chipsRow}>
                  <View style={[s.chip, s.chipGreen]}>
                    <Text style={[s.chipText, { color: '#a3e635' }]}>微差 {r.scoreDifferential.toFixed(1)}</Text>
                  </View>
                  <View style={s.chip}>
                    <Text style={s.chipText}>推杆 {r.totalPutts}</Text>
                  </View>
                  {r.greensInRegulation != null && r.holes ? (
                    <View style={[s.chip, s.chipGreen]}>
                      <Text style={[s.chipText, { color: '#a3e635' }]}>
                        GIR {Math.round((r.greensInRegulation / r.holes) * 100)}%
                      </Text>
                    </View>
                  ) : null}
                  {r.fairwaysTotal ? (
                    <View style={s.chip}>
                      <Text style={s.chipText}>球道 {Math.round((r.fairwaysHit / r.fairwaysTotal) * 100)}%</Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <View style={s.scoreBadge}>
                <Text style={s.scoreBadgeText}>{r.adjustedGrossScore}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}

        {sorted.length > 0 ? (
          <View style={s.analysisWrap}>
            <Text style={s.analysisSectionTitle}>成绩分析</Text>
            <Text style={s.analysisIntro}>基于已保存轮次自动汇总（含 9 / 18 洞）</Text>

            <View style={s.analysisCard}>
              <Text style={s.analysisCardTitle}>整体</Text>
              <View style={s.statRow}>
                <Text style={s.statLabel}>样本</Text>
                <Text style={s.statValue}>{overallStats.rounds} 场</Text>
              </View>
              <View style={s.statRow}>
                <Text style={s.statLabel}>场均总杆</Text>
                <Text style={s.statValue}>{fmt0(overallStats.avgGross)}</Text>
              </View>
              <View style={s.statRow}>
                <Text style={s.statLabel}>最佳 / 最差</Text>
                <Text style={s.statValue}>
                  {fmt0(overallStats.bestGross)} / {fmt0(overallStats.worstGross)}
                </Text>
              </View>
              <View style={s.statRow}>
                <Text style={s.statLabel}>总杆波动 σ</Text>
                <Text style={s.statValue}>{overallStats.stdGross != null ? fmt1(overallStats.stdGross) : '—'}</Text>
              </View>
              <View style={s.statRow}>
                <Text style={s.statLabel}>平均微差</Text>
                <Text style={s.statValue}>{fmt1(overallStats.avgDiff)}</Text>
              </View>
              <View style={s.statRow}>
                <Text style={s.statLabel}>场均推杆</Text>
                <Text style={s.statValue}>{fmt1(overallStats.avgPuttsRound)}</Text>
              </View>
              <View style={s.statRow}>
                <Text style={s.statLabel}>每洞推杆</Text>
                <Text style={s.statValue}>{fmt1(overallStats.avgPuttsPerHole)}</Text>
              </View>
              <View style={s.statRow}>
                <Text style={s.statLabel}>平均 GIR</Text>
                <Text style={s.statValue}>{overallStats.avgGirPct != null ? `${fmt0(overallStats.avgGirPct)}%` : '—'}</Text>
              </View>
              <View style={s.statRow}>
                <Text style={s.statLabel}>平均球道命中</Text>
                <Text style={s.statValue}>{overallStats.avgFwPct != null ? `${fmt0(overallStats.avgFwPct)}%` : '—'}</Text>
              </View>
              <View style={s.statRow}>
                <Text style={s.statLabel}>逐洞数据场数</Text>
                <Text style={s.statValue}>{overallStats.roundsWithHoles} 场</Text>
              </View>
            </View>

            {sorted.length >= 2 ? (
              <View style={s.analysisCard}>
                <Text style={s.analysisCardTitle}>近期（最近 5 场）</Text>
                {recent5Stats.rounds < 2 ? (
                  <Text style={s.analysisMuted}>场次不足，多记几场后对比更有意义。</Text>
                ) : (
                  <>
                    <View style={s.statRow}>
                      <Text style={s.statLabel}>样本</Text>
                      <Text style={s.statValue}>{recent5Stats.rounds} 场</Text>
                    </View>
                    <View style={s.statRow}>
                      <Text style={s.statLabel}>场均总杆</Text>
                      <Text style={s.statValue}>{fmt0(recent5Stats.avgGross)}</Text>
                    </View>
                    <View style={s.statRow}>
                      <Text style={s.statLabel}>较整体</Text>
                      <Text style={s.statValue}>
                        {deltaRecentVsOverall == null
                          ? '—'
                          : deltaRecentVsOverall === 0
                            ? '持平'
                            : deltaRecentVsOverall > 0
                              ? `高 ${fmt1(Math.abs(deltaRecentVsOverall))} 杆`
                              : `低 ${fmt1(Math.abs(deltaRecentVsOverall))} 杆`}
                      </Text>
                    </View>
                    <View style={s.statRow}>
                      <Text style={s.statLabel}>场均推杆</Text>
                      <Text style={s.statValue}>{fmt1(recent5Stats.avgPuttsRound)}</Text>
                    </View>
                    <View style={s.statRow}>
                      <Text style={s.statLabel}>每洞推杆</Text>
                      <Text style={s.statValue}>{fmt1(recent5Stats.avgPuttsPerHole)}</Text>
                    </View>
                    <View style={s.statRow}>
                      <Text style={s.statLabel}>平均 GIR</Text>
                      <Text style={s.statValue}>
                        {recent5Stats.avgGirPct != null ? `${fmt0(recent5Stats.avgGirPct)}%` : '—'}
                      </Text>
                    </View>
                    <View style={s.statRow}>
                      <Text style={s.statLabel}>平均微差</Text>
                      <Text style={s.statValue}>{fmt1(recent5Stats.avgDiff)}</Text>
                    </View>
                  </>
                )}
              </View>
            ) : null}

            {holeShape.holesCounted > 0 ? (
              <View style={s.analysisCard}>
                <Text style={s.analysisCardTitle}>洞级表现（全部逐洞样本）</Text>
                <Text style={s.analysisMuted}>共 {holeShape.holesCounted} 洞</Text>
                <View style={s.statRow}>
                  <Text style={s.statLabel}>鸟或更好</Text>
                  <Text style={s.statValue}>
                    {holeShape.birdieOrBetterPct != null ? `${fmt1(holeShape.birdieOrBetterPct)}%` : '—'}
                  </Text>
                </View>
                <View style={s.statRow}>
                  <Text style={s.statLabel}>标准杆上</Text>
                  <Text style={s.statValue}>{holeShape.parPct != null ? `${fmt1(holeShape.parPct)}%` : '—'}</Text>
                </View>
                <View style={s.statRow}>
                  <Text style={s.statLabel}>双柏忌及以上</Text>
                  <Text style={s.statValue}>
                    {holeShape.doubleOrWorsePct != null ? `${fmt1(holeShape.doubleOrWorsePct)}%` : '—'}
                  </Text>
                </View>
              </View>
            ) : null}

            {nineSplit.rounds > 0 ? (
              <View style={s.analysisCard}>
                <Text style={s.analysisCardTitle}>18 洞半场（有逐洞数据）</Text>
                <Text style={s.analysisMuted}>样本 {nineSplit.rounds} 场</Text>
                <View style={s.statRow}>
                  <Text style={s.statLabel}>场均前 9</Text>
                  <Text style={s.statValue}>{fmt1(nineSplit.avgFront9)} 杆</Text>
                </View>
                <View style={s.statRow}>
                  <Text style={s.statLabel}>场均后 9</Text>
                  <Text style={s.statValue}>{fmt1(nineSplit.avgBack9)} 杆</Text>
                </View>
              </View>
            ) : null}

            <TouchableOpacity style={s.analysisLink} onPress={() => router.push('/handicap/history' as Href)}>
              <Text style={s.analysisLinkTxt}>打开完整成绩时间线 ›</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d1f10' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 36 + TAB_BAR_SCROLL_EXTRA },

  // Header
  header: { backgroundColor: '#0d1f10', paddingHorizontal: 18, paddingTop: 16, paddingBottom: 10 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  greetText: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 2 },
  nameText: { fontSize: 20, color: '#fff', fontWeight: '700', letterSpacing: -0.5 },
  profileBtn: { backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  profileBtnText: { fontSize: 11, color: 'rgba(255,255,255,0.85)' },

  // Stats grid (差点 + 3项统计)
  statsGrid: { marginHorizontal: 14, marginBottom: 6, gap: 8 },

  // 差点横向卡片（首版布局）
  hcpCard: {
    backgroundColor: '#1a3820',
    borderWidth: 1,
    borderColor: 'rgba(163,230,53,0.25)',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  hcpLeft: { flex: 1 },
  hcpLabel: { fontSize: 9, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  hcpValue: { fontSize: 28, color: '#fff', fontWeight: '800', letterSpacing: -1, lineHeight: 32 },
  hcpSub: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  hcpRight: { alignItems: 'flex-end', gap: 6 },
  hcpRecords: { fontSize: 10, color: 'rgba(255,255,255,0.35)' },
  progressTrack: { width: 80, height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, backgroundColor: '#a3e635', borderRadius: 2 },

  // 3项小统计横排
  miniStatsRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 18, overflow: 'hidden' },
  miniStat: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  miniStatNum: { fontSize: 20, color: '#fff', fontWeight: '800', letterSpacing: -0.5 },
  miniStatLabel: { fontSize: 9, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 3 },
  miniStatSub: { fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 1 },
  miniDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 12 },

  // Section titles
  sectionTitle: { fontSize: 10, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 1.2, paddingHorizontal: 18, marginTop: 16, marginBottom: 10 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, marginTop: 16, marginBottom: 10 },
  seeAll: { fontSize: 12, color: '#a3e635' },

  // 4-grid
  gridRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 14, gap: 8 },
  gridCell: { width: '47.5%', backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 18, padding: 16 },
  gridLabel: { fontSize: 15, fontWeight: '700', color: '#fff', letterSpacing: -0.2 },
  gridSub: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 3 },

  aiCardRow: { flexDirection: 'row', paddingHorizontal: 14, gap: 8, marginBottom: 4 },
  aiCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderRadius: 18, padding: 16 },
  aiCardTitle: { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 4 },
  aiCardSub: { fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 16 },

  // Round cards
  roundCard: { marginHorizontal: 14, marginBottom: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', borderRadius: 16, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  courseName: { fontSize: 13, color: '#fff', fontWeight: '600' },
  courseMeta: { fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 1 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 },
  chip: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  chipGreen: { backgroundColor: 'rgba(163,230,53,0.12)' },
  chipText: { fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  scoreBadge: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(163,230,53,0.15)', borderWidth: 1.5, borderColor: 'rgba(163,230,53,0.4)', alignItems: 'center', justifyContent: 'center' },
  scoreBadgeText: { fontSize: 14, color: '#a3e635', fontWeight: '800' },
  emptyText: { textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13, paddingVertical: 28 },

  analysisWrap: { marginHorizontal: 14, marginTop: 8, marginBottom: 12, gap: 10 },
  analysisSectionTitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  analysisIntro: { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 6, lineHeight: 18 },
  analysisCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    borderRadius: 16,
    padding: 14,
    gap: 2,
  },
  analysisCardTitle: { fontSize: 15, fontWeight: '800', color: '#fff', marginBottom: 8 },
  analysisMuted: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 8, lineHeight: 18 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  statLabel: { fontSize: 13, color: 'rgba(255,255,255,0.55)', flex: 1, paddingRight: 8 },
  statValue: { fontSize: 13, fontWeight: '700', color: '#fff', textAlign: 'right', maxWidth: '56%' },
  analysisLink: { paddingVertical: 12, alignItems: 'center' },
  analysisLinkTxt: { fontSize: 13, fontWeight: '700', color: '#a3e635' },
});
