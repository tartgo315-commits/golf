import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { parseJsonArray } from '@/lib/local-storage';

const HCP_CARD_BG = '#1a3820';
const HCP_CARD_BORDER = 'rgba(163,230,53,0.25)';
const HCP_VALUE_GREEN = '#a3e635';
const HCP_WARN_DIFF_TEXT = '#ff9800';
const HCP_BADGE_BG = '#7a3a00';
const HCP_BADGE_TEXT = '#ffb74d';

type HomeHoleDetail = { par?: number; strokes?: number };

interface HandicapRecord {
  id: string;
  date: string;
  courseName: string;
  adjustedGrossScore: number;
  totalPutts: number;
  greensInRegulation: number;
  fairwaysHit: number;
  fairwaysTotal: number;
  holes: number;
  scoreDifferential: number;
  holeDetails?: HomeHoleDetail[];
}

/** 该场总标准杆：有逐洞数据则求和 par，否则按 9/18 洞默认 36/72 */
function courseParTotal(r: HandicapRecord): number {
  const hd = r.holeDetails;
  if (Array.isArray(hd) && hd.length > 0) {
    return hd.reduce((s, h) => s + (typeof h.par === 'number' && Number.isFinite(h.par) ? h.par : 4), 0);
  }
  return r.holes === 9 ? 36 : 72;
}

/** 该场总杆数：优先逐洞 strokes 之和，否则用 adjustedGrossScore */
function roundGrossStrokes(r: HandicapRecord): number {
  const hd = r.holeDetails;
  if (Array.isArray(hd) && hd.length > 0) {
    const sum = hd.reduce((s, h) => s + (typeof h.strokes === 'number' && Number.isFinite(h.strokes) ? h.strokes : 0), 0);
    if (sum > 0) return sum;
  }
  return r.adjustedGrossScore;
}

/** (各场杆数−各场标准杆) 之和 ÷ 场数，与「总杆−总标准杆再÷场数」等价 */
function avgStrokesMinusParPerRound(records: HandicapRecord[]): number | null {
  if (records.length === 0) return null;
  const sumDiff = records.reduce((s, r) => s + (roundGrossStrokes(r) - courseParTotal(r)), 0);
  return sumDiff / records.length;
}

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

function calcHandicap(records: HandicapRecord[]) {
  if (records.length < 3) return null;
  const n = records.length <= 6 ? 1 : records.length <= 8 ? 2 :
    records.length <= 11 ? 3 : records.length <= 14 ? 4 :
    records.length <= 16 ? 5 : records.length <= 18 ? 6 : 8;
  const sorted = [...records].sort((a, b) => a.scoreDifferential - b.scoreDifferential).slice(0, n);
  return (sorted.reduce((s, r) => s + r.scoreDifferential, 0) / sorted.length * 0.96).toFixed(1);
}

export default function HomeScreen() {
  const [records, setRecords] = useState<HandicapRecord[]>([]);
  const [clubCount, setClubCount] = useState<number>(0);

  useFocusEffect(useCallback(() => {
    AsyncStorage.getItem('handicapRecords').then(raw => {
      setRecords(parseJsonArray<HandicapRecord>(raw));
    }).catch(() => {});
    AsyncStorage.getItem('savedClubs').then(raw => {
      try { if (raw) setClubCount(JSON.parse(raw).length); } catch {}
    }).catch(() => {});
  }, []));

  const sorted = [...records].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const recent20 = sorted.slice(0, 20);
  const hcp = calcHandicap(records);

  const avgScore = recent20.length
    ? Math.round(recent20.reduce((s, r) => s + r.adjustedGrossScore, 0) / recent20.length) : null;
  const bestScore = recent20.length
    ? Math.min(...recent20.map(r => r.adjustedGrossScore)) : null;
  const puttsRounds = recent20.filter(r => r.holes === 18);
  const avgPutts = puttsRounds.length
    ? Math.round(puttsRounds.reduce((s, r) => s + r.totalPutts, 0) / puttsRounds.length) : null;
  const girRounds = recent20.filter(r => r.greensInRegulation != null && r.holes);
  const avgGir = girRounds.length
    ? Math.round(girRounds.reduce((s, r) => s + (r.greensInRegulation / r.holes * 100), 0) / girRounds.length) : null;
  const progressRatio = Math.min(records.length / 3, 1);

  const avgRelativeToPar = avgStrokesMinusParPerRound(records);
  const hcpNum = hcp != null ? Number.parseFloat(hcp) : NaN;
  /** 与差点指数同一尺度：场均相对标准杆 − 指数（参考 par72 下约等于「相对预期的场均杆差」） */
  const stabilityDiff =
    avgRelativeToPar != null && Number.isFinite(hcpNum) ? avgRelativeToPar - hcpNum : null;
  const showStabilityWarn = stabilityDiff != null && stabilityDiff > 5;
  const stabilityDiffOneDecimal =
    stabilityDiff != null ? (Math.round(stabilityDiff * 10) / 10).toFixed(1) : '';

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
          <TouchableOpacity
            style={[s.hcpCard, { backgroundColor: HCP_CARD_BG, borderColor: HCP_CARD_BORDER }]}
            onPress={() => router.push('/(tabs)/handicap' as any)}>
            <View style={s.hcpTopRow}>
              <View style={s.hcpColLeft}>
                <Text style={s.hcpLabel}>WHS 差点</Text>
                <Text style={[s.hcpValueLarge, hcp ? { color: HCP_VALUE_GREEN } : { color: '#fff' }]}>
                  {hcp ?? '待生成'}
                </Text>
                <Text style={s.hcpSub}>
                  {hcp ? `进度 ${records.length} 场` : `还需 ${Math.max(0, 3 - records.length)} 场`}
                </Text>
              </View>
              <View style={s.hcpColRight}>
                <Text style={s.hcpAvgLabel}>均杆</Text>
                <View style={s.hcpAvgRow}>
                  <Text style={s.hcpAvgNum}>
                    {avgRelativeToPar != null ? avgRelativeToPar.toFixed(1) : '--'}
                  </Text>
                  {showStabilityWarn ? (
                    <View style={[s.hcpWarnBadge, { backgroundColor: HCP_BADGE_BG }]}>
                      <Text style={[s.hcpWarnBadgeText, { color: HCP_BADGE_TEXT }]}>!</Text>
                    </View>
                  ) : null}
                </View>
                {showStabilityWarn ? (
                  <Text style={[s.hcpDiffWarn, { color: HCP_WARN_DIFF_TEXT }]}>
                    差 {stabilityDiffOneDecimal} 杆
                  </Text>
                ) : null}
              </View>
            </View>
            <View style={s.hcpProgressSection}>
              <View style={s.progressTrackFull}>
                <View style={[s.progressFill, { width: `${progressRatio * 100}%` as const }]} />
              </View>
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
              <Text style={s.miniStatNum}>{avgPutts ?? '--'}</Text>
              <Text style={s.miniStatLabel}>平均推杆</Text>
              <Text style={s.miniStatSub}>每洞 {avgPutts ? (avgPutts / 18).toFixed(1) : '--'}</Text>
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
          <TouchableOpacity onPress={() => router.push('/(tabs)/score' as any)}>
            <Text style={s.seeAll}>查看全部 ›</Text>
          </TouchableOpacity>
        </View>

        {sorted.length === 0 ? (
          <Text style={s.emptyText}>暂无成绩，去记录第一轮吧</Text>
        ) : (
          sorted.slice(0, 3).map(r => (
            <TouchableOpacity
              key={r.id}
              style={s.roundCard}
              onPress={() => router.push(`/handicap/${r.id}` as any)}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.courseName}>{r.courseName}</Text>
                <Text style={s.courseMeta}>{r.date} · {r.holes}洞 · {daysSince(r.date)}</Text>
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
                        GIR {Math.round(r.greensInRegulation / r.holes * 100)}%
                      </Text>
                    </View>
                  ) : null}
                  {r.fairwaysTotal ? (
                    <View style={s.chip}>
                      <Text style={s.chipText}>
                        球道 {Math.round(r.fairwaysHit / r.fairwaysTotal * 100)}%
                      </Text>
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
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d1f10' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },

  // Header
  header: { backgroundColor: '#0d1f10', paddingHorizontal: 18, paddingTop: 16, paddingBottom: 10 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  greetText: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 2 },
  nameText: { fontSize: 20, color: '#fff', fontWeight: '700', letterSpacing: -0.5 },
  profileBtn: { backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  profileBtnText: { fontSize: 11, color: 'rgba(255,255,255,0.85)' },

  // Stats grid (差点 + 3项统计)
  statsGrid: { marginHorizontal: 14, marginBottom: 6, gap: 8 },

  // 差点卡片（方案 B：上双栏 + 底进度条）
  hcpCard: { borderWidth: 1, borderRadius: 18, padding: 16 },
  hcpTopRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  hcpColLeft: { flex: 1, alignItems: 'flex-start' },
  hcpColRight: { alignItems: 'flex-end', paddingTop: 2 },
  hcpLabel: { fontSize: 9, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  hcpValueLarge: { fontSize: 52, fontWeight: '800', letterSpacing: -1.5, lineHeight: 54 },
  hcpSub: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 },
  hcpAvgLabel: { fontSize: 10, color: 'rgba(255,255,255,0.45)', marginBottom: 4 },
  hcpAvgRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  hcpAvgNum: { fontSize: 24, color: '#fff', fontWeight: '800', letterSpacing: -0.5 },
  hcpWarnBadge: { borderRadius: 4, paddingVertical: 2, paddingHorizontal: 5 },
  hcpWarnBadgeText: { fontSize: 10, fontWeight: '800' },
  hcpDiffWarn: { fontSize: 11, fontWeight: '600', marginTop: 4 },
  hcpProgressSection: { width: '100%', marginTop: 14 },
  progressTrackFull: { width: '100%', height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' },
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
});
