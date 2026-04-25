import { useFocusEffect } from '@react-navigation/native';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DARK_PAGE, TAB_BAR_SCROLL_EXTRA } from '@/constants/theme';
import {
  equivalent18FromGrossAndHoles,
  loadHandicapRecords,
  type HandicapRecord,
} from '@/lib/handicap';
import {
  computeRoundDeepStats,
  fmtVsPar,
  type RoundDeepStatsModel,
  type RoundScoreDistribution,
} from '@/lib/roundDeepStats';

const BG = DARK_PAGE.bg;
const PAGE_TITLE = '#ffffff';
const PAGE_SUB = '#8a9a8e';
const CARD_MAIN = '#16261c';
const CELL_COURSE = '#0d1b11';
const BEST_NUM = '#b5ff3a';
const WORST_NUM = '#d94848';
const GAP_ORANGE = '#e89b3a';
const LABEL_MUTED = '#8a9a8e';
const ROW_MID = '#5a6b5f';
const SUB_VS_PAR = '#5a6b5f';
const DIVIDER = 'rgba(255,255,255,0.04)';
/** 杆数分布条：标准杆白（含鹰鸟） / 柏忌橙 / 双柏+红 */
const DIST_PAR_OR_BETTER = '#e8e8e8';
const DIST_BOGEY = '#e89b3a';
const DIST_DBL = '#d94848';

function paramOne(v: string | string[] | undefined): string | undefined {
  if (v == null) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

function fmtEquiv18(n: number): string {
  return n % 1 === 0 ? String(Math.round(n)) : n.toFixed(1);
}

function fmtDiff(n: number): string {
  return n.toFixed(1);
}

function gapText(worstEq: number, bestEq: number): string {
  const d = worstEq - bestEq;
  if (!Number.isFinite(d)) return '—';
  if (d === 0) return '0';
  return d > 0 ? `+${fmtEquiv18(d)}` : fmtEquiv18(d);
}

function parAvgLine(m: RoundDeepStatsModel): string {
  if (!m.hasFullHoles) return '—';
  const parts: string[] = [];
  if (m.avgPar3 != null) parts.push(`P3 ${m.avgPar3.toFixed(1)}`);
  if (m.avgPar4 != null) parts.push(`P4 ${m.avgPar4.toFixed(1)}`);
  if (m.avgPar5 != null) parts.push(`P5 ${m.avgPar5.toFixed(1)}`);
  return parts.length ? parts.join(' · ') : '—';
}

function vsParSubline(m: RoundDeepStatsModel): string {
  if (!m.hasFullHoles) return '无完整逐洞';
  const f = fmtVsPar(m.vsParFront9);
  if (m.vsParBack9 != null) return `前9 ${f} · 后9 ${fmtVsPar(m.vsParBack9)}`;
  return `前9 ${f}`;
}

function metricPutts(m: RoundDeepStatsModel): string {
  return m.puttsTotal != null ? String(m.puttsTotal) : '—';
}

function metricGir(m: RoundDeepStatsModel): string {
  if (m.girPct != null) return `${m.girPct.toFixed(0)}%`;
  if (m.girCountFromHoles != null) return `${m.girCountFromHoles}洞`;
  return '—';
}

function metricFir(m: RoundDeepStatsModel): string {
  return m.firPct != null ? `${m.firPct.toFixed(0)}%` : '—';
}

function DistColumn({ label, dist }: { label: string; dist: RoundScoreDistribution | null }) {
  if (!dist) {
    return (
      <View style={styles.distCol}>
        <Text style={styles.distSideLab}>{label}</Text>
        <Text style={styles.distEmpty}>无分布</Text>
      </View>
    );
  }
  const good = dist.eagle + dist.birdie;
  const whiteSeg = good + dist.par;
  const total = whiteSeg + dist.bogey + dist.doublePlus;
  if (total <= 0) {
    return (
      <View style={styles.distCol}>
        <Text style={styles.distSideLab}>{label}</Text>
        <Text style={styles.distEmpty}>—</Text>
      </View>
    );
  }
  return (
    <View style={styles.distCol}>
      <Text style={styles.distSideLab}>{label}</Text>
      <View style={styles.distBarTrack}>
        {whiteSeg > 0 ? (
          <View style={[styles.distSeg, { flex: whiteSeg, backgroundColor: DIST_PAR_OR_BETTER }]} />
        ) : null}
        {dist.bogey > 0 ? (
          <View style={[styles.distSeg, { flex: dist.bogey, backgroundColor: DIST_BOGEY }]} />
        ) : null}
        {dist.doublePlus > 0 ? (
          <View style={[styles.distSeg, { flex: dist.doublePlus, backgroundColor: DIST_DBL }]} />
        ) : null}
      </View>
      <Text style={styles.distNums} numberOfLines={2}>
        鹰鸟 {good} · P {dist.par} · 柏 {dist.bogey} · 双+ {dist.doublePlus}
      </Text>
    </View>
  );
}

function CompareRow({ left, label, right }: { left: string; label: string; right: string }) {
  return (
    <View style={styles.compareRow}>
      <Text style={styles.compareLeft}>{left}</Text>
      <Text style={styles.compareMid}>{label}</Text>
      <Text style={styles.compareRight}>{right}</Text>
    </View>
  );
}

export default function HandicapExtremesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ bestId?: string; worstId?: string }>();
  const bestId = paramOne(params.bestId);
  const worstId = paramOne(params.worstId);

  const [records, setRecords] = useState<HandicapRecord[]>([]);

  useFocusEffect(
    useCallback(() => {
      setRecords(loadHandicapRecords());
    }, []),
  );

  const best = useMemo(
    () => (bestId ? (records.find((r) => r.id === bestId) ?? null) : null),
    [records, bestId],
  );
  const worst = useMemo(
    () => (worstId ? (records.find((r) => r.id === worstId) ?? null) : null),
    [records, worstId],
  );
  const sameRound = Boolean(bestId && worstId && bestId === worstId);

  const bestM = useMemo(() => (best ? computeRoundDeepStats(best) : null), [best]);
  const worstM = useMemo(() => (worst ? computeRoundDeepStats(worst) : null), [worst]);

  const bestEq = best ? equivalent18FromGrossAndHoles(best.adjustedGrossScore, best.holes) : null;
  const worstEq = worst
    ? equivalent18FromGrossAndHoles(worst.adjustedGrossScore, worst.holes)
    : null;

  const openBest = useCallback(() => {
    if (!bestId || !worstId) return;
    const q = `cmpB=${encodeURIComponent(bestId)}&cmpW=${encodeURIComponent(worstId)}`;
    router.push(`/handicap/${bestId}?${q}` as Href);
  }, [router, bestId, worstId]);

  const openWorst = useCallback(() => {
    if (!bestId || !worstId) return;
    const q = `cmpB=${encodeURIComponent(bestId)}&cmpW=${encodeURIComponent(worstId)}`;
    router.push(`/handicap/${worstId}?${q}` as Href);
  }, [router, bestId, worstId]);

  const canOpenBest = Boolean(bestId && best);
  const canOpenWorst = Boolean(worstId && worst);

  return (
    <View style={styles.root}>
      {/* 顶栏移出 ScrollView，避免 Web 上滚动层叠在返回键之上导致无法点击 */}
      <View style={styles.headerBar}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.replace('/score' as Href)}
            style={styles.backBtn}
            accessibilityRole="button"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="返回成绩分析"
          >
            <Text style={styles.backTxt}>‹ 返回</Text>
          </Pressable>
          <Text style={styles.pageTitle} numberOfLines={1}>
            最好 vs 最差
          </Text>
        </View>
        <Text style={styles.pageSub}>2 场成绩对比</Text>
      </View>

      <ScrollView
        style={styles.scrollBody}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces
      >
        <View style={styles.scrollInner}>
        {sameRound && best ? (
          <Text style={styles.sameHint}>当前窗口内仅此一场有效数据，最好与最差为同一场。</Text>
        ) : null}

        {/* 1. 总分对比 */}
        <View style={styles.cardMain}>
          <View style={styles.scoreTri}>
            <View style={styles.scoreTriCol}>
              <Text style={styles.triLab}>最好一场</Text>
              <Text style={styles.triNumBest}>{bestEq != null ? fmtEquiv18(bestEq) : '—'}</Text>
            </View>
            <View style={styles.scoreTriMid}>
              <Text style={styles.gapNum}>
                {bestEq != null && worstEq != null ? gapText(worstEq, bestEq) : '—'}
              </Text>
              <Text style={styles.gapLab}>差距</Text>
            </View>
            <View style={[styles.scoreTriCol, styles.scoreTriColRight]}>
              <Text style={styles.triLab}>最差一场</Text>
              <Text style={styles.triNumWorst}>{worstEq != null ? fmtEquiv18(worstEq) : '—'}</Text>
            </View>
          </View>
          <View style={styles.coursePairRow}>
            <View style={styles.courseCell}>
              <Text style={styles.courseName} numberOfLines={2}>
                {best?.courseName ?? '—'}
              </Text>
              <Text style={styles.courseDate}>{best?.date ?? ''}</Text>
            </View>
            <View style={styles.courseCell}>
              <Text style={[styles.courseName, styles.courseNameRight]} numberOfLines={2}>
                {worst?.courseName ?? '—'}
              </Text>
              <Text style={[styles.courseDate, styles.courseDateRight]}>{worst?.date ?? ''}</Text>
            </View>
          </View>
        </View>

        {/* 2. 微差 */}
        <Text style={styles.sectionTitle}>微差对比</Text>
        <View style={styles.cardMain}>
          <View style={styles.diffVsRow}>
            <Text style={styles.diffNumBest}>
              {best && Number.isFinite(best.scoreDifferential)
                ? fmtDiff(best.scoreDifferential)
                : '—'}
            </Text>
            <Text style={styles.vsTag}>vs</Text>
            <Text style={styles.diffNumWorst}>
              {worst && Number.isFinite(worst.scoreDifferential)
                ? fmtDiff(worst.scoreDifferential)
                : '—'}
            </Text>
          </View>
        </View>

        {/* 3. 相对 Par */}
        <Text style={styles.sectionTitle}>相对 Par 对比</Text>
        <View style={styles.cardMain}>
          <View style={styles.vsParRow}>
            <View style={styles.vsParCol}>
              <Text style={styles.vsParMain}>
                {bestM?.hasFullHoles ? `全场 ${fmtVsPar(bestM.vsParTotal)}` : '—'}
              </Text>
              <Text style={styles.vsParSub}>{bestM ? vsParSubline(bestM) : ''}</Text>
            </View>
            <View style={[styles.vsParCol, styles.vsParColRight]}>
              <Text style={[styles.vsParMain, styles.vsParMainRight]}>
                {worstM?.hasFullHoles ? `全场 ${fmtVsPar(worstM.vsParTotal)}` : '—'}
              </Text>
              <Text style={[styles.vsParSub, styles.vsParSubRight]}>
                {worstM ? vsParSubline(worstM) : ''}
              </Text>
            </View>
          </View>
        </View>

        {/* 4. 关键指标 */}
        <Text style={styles.sectionTitle}>关键指标对比</Text>
        <View style={styles.cardMainPad0}>
          <CompareRow
            left={bestM ? metricPutts(bestM) : '—'}
            label="推杆"
            right={worstM ? metricPutts(worstM) : '—'}
          />
          <View style={styles.hRule} />
          <CompareRow
            left={bestM ? metricGir(bestM) : '—'}
            label="GIR"
            right={worstM ? metricGir(worstM) : '—'}
          />
          <View style={styles.hRule} />
          <CompareRow
            left={bestM ? metricFir(bestM) : '—'}
            label="FIR"
            right={worstM ? metricFir(worstM) : '—'}
          />
          <View style={styles.hRule} />
          <CompareRow
            left={bestM ? parAvgLine(bestM) : '—'}
            label="Par均（P3/P4/P5）"
            right={worstM ? parAvgLine(worstM) : '—'}
          />
        </View>

        {/* 5. 杆数分布 */}
        <Text style={styles.sectionTitle}>杆数分布对比</Text>
        <View style={styles.cardMain}>
          <View style={styles.distRow}>
            <DistColumn label="最好" dist={bestM?.distribution ?? null} />
            <View style={styles.distGap} />
            <DistColumn label="最差" dist={worstM?.distribution ?? null} />
          </View>
        </View>

        {/* 6. 底部按钮 */}
        <View style={styles.btnRow}>
          <Pressable
            style={[styles.footerBtn, !canOpenBest && styles.footerBtnDisabled]}
            onPress={openBest}
            disabled={!canOpenBest}
          >
            <Text style={styles.footerBtnTxt}>最好 完整成绩 ›</Text>
          </Pressable>
          <Pressable
            style={[styles.footerBtn, !canOpenWorst && styles.footerBtnDisabled]}
            onPress={openWorst}
            disabled={!canOpenWorst}
          >
            <Text style={styles.footerBtnTxt}>最差 完整成绩 ›</Text>
          </Pressable>
        </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  headerBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: BG,
    zIndex: 4,
    elevation: 6,
  },
  scrollBody: { flex: 1, minHeight: 0, zIndex: 0 },
  /**
   * 与 (tabs)/score 一致：Tab 为 absolute 贴底，需额外 padding；Web 上 flexGrow 约束避免整页滚不动。
   */
  content: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 28 + TAB_BAR_SCROLL_EXTRA,
    ...Platform.select({
      web: {
        flexGrow: 1,
        justifyContent: 'flex-start',
        alignItems: 'stretch',
      },
      default: { flexGrow: 0 },
    }),
  },
  scrollInner: {
    width: '100%',
    maxWidth: '100%',
    ...Platform.select({
      web: { flex: 1, minHeight: 0 },
      default: {},
    }),
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  backBtn: { flexShrink: 0, paddingVertical: 4, paddingRight: 4 },
  backTxt: { fontSize: 15, fontWeight: '600', color: PAGE_SUB },
  pageTitle: { flex: 1, fontSize: 20, fontWeight: '800', color: PAGE_TITLE, letterSpacing: -0.3 },
  pageSub: { fontSize: 11, fontWeight: '500', color: PAGE_SUB, marginLeft: 2 },
  sameHint: {
    fontSize: 12,
    fontWeight: '600',
    color: DARK_PAGE.accent,
    marginBottom: 12,
    lineHeight: 17,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: LABEL_MUTED,
    marginBottom: 8,
    marginTop: 14,
  },
  cardMain: {
    backgroundColor: CARD_MAIN,
    borderRadius: 16,
    padding: 16,
    marginBottom: 4,
  },
  cardMainPad0: {
    backgroundColor: CARD_MAIN,
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  scoreTri: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  scoreTriCol: { flex: 1, minWidth: 0 },
  scoreTriColRight: { alignItems: 'flex-end' },
  scoreTriMid: { width: 72, alignItems: 'center', paddingTop: 12 },
  triLab: { fontSize: 10, fontWeight: '700', color: LABEL_MUTED, marginBottom: 4 },
  triNumBest: { fontSize: 36, fontWeight: '800', color: BEST_NUM, letterSpacing: -1 },
  triNumWorst: { fontSize: 36, fontWeight: '800', color: WORST_NUM, letterSpacing: -1 },
  gapNum: { fontSize: 22, fontWeight: '800', color: GAP_ORANGE, marginBottom: 2 },
  gapLab: { fontSize: 10, fontWeight: '600', color: ROW_MID },
  coursePairRow: { flexDirection: 'row', gap: 8 },
  courseCell: {
    flex: 1,
    backgroundColor: CELL_COURSE,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    minWidth: 0,
  },
  courseName: { fontSize: 12, fontWeight: '600', color: PAGE_TITLE, marginBottom: 4 },
  courseNameRight: { textAlign: 'right' },
  courseDate: { fontSize: 11, fontWeight: '500', color: PAGE_SUB },
  courseDateRight: { textAlign: 'right' },
  diffVsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  diffNumBest: { fontSize: 22, fontWeight: '800', color: BEST_NUM, flex: 1 },
  diffNumWorst: { fontSize: 22, fontWeight: '800', color: WORST_NUM, flex: 1, textAlign: 'right' },
  vsTag: {
    fontSize: 11,
    fontWeight: '700',
    color: ROW_MID,
    paddingHorizontal: 12,
  },
  vsParRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  vsParCol: { flex: 1, minWidth: 0 },
  vsParColRight: { alignItems: 'flex-end' },
  vsParMain: { fontSize: 15, fontWeight: '800', color: PAGE_TITLE, marginBottom: 6 },
  vsParMainRight: { textAlign: 'right' },
  vsParSub: { fontSize: 10, fontWeight: '600', color: SUB_VS_PAR, lineHeight: 14 },
  vsParSubRight: { textAlign: 'right' },
  compareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  compareLeft: { width: '28%', fontSize: 14, fontWeight: '800', color: BEST_NUM },
  compareMid: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '700',
    color: ROW_MID,
    paddingHorizontal: 4,
  },
  compareRight: {
    width: '28%',
    fontSize: 14,
    fontWeight: '800',
    color: WORST_NUM,
    textAlign: 'right',
  },
  hRule: { height: 1, backgroundColor: DIVIDER, marginHorizontal: 0 },
  distRow: { flexDirection: 'row', alignItems: 'stretch' },
  distCol: { flex: 1, minWidth: 0 },
  distGap: { width: 12 },
  distSideLab: { fontSize: 10, fontWeight: '700', color: LABEL_MUTED, marginBottom: 8 },
  distBarTrack: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  distSeg: { minWidth: 2 },
  distNums: { fontSize: 10, fontWeight: '600', color: ROW_MID, marginTop: 8, lineHeight: 14 },
  distEmpty: { fontSize: 11, fontWeight: '500', color: ROW_MID, marginTop: 4 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  footerBtn: {
    flex: 1,
    backgroundColor: CARD_MAIN,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerBtnDisabled: { opacity: 0.45 },
  footerBtnTxt: { fontSize: 13, fontWeight: '700', color: BEST_NUM },
});
