import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  equivalent18FromGrossAndHoles,
  formatRoundDurationMinutes,
  type HandicapRecord,
} from '@/lib/handicap';
import { computeRoundDeepStats, fmtVsPar, type RoundDeepStatsModel } from '@/lib/roundDeepStats';

const CARD_BG = '#16261c';
const BORDER = 'rgba(255,255,255,0.08)';
const WHITE = '#ffffff';
const SUB = '#a8b5ac';
const MUTED = '#5a6b5f';
const ACCENT = '#b5ff3a';
export type RoundDeepStatsOmit = 'courseDate' | 'weatherPartners' | 'timing';

export type RoundDeepStatsProps = {
  record: HandicapRecord;
  /** embedded：成绩分析 Tab 内；page：独立页卡片 */
  variant?: 'embedded' | 'page';
  /** null 则不显示大标题 */
  title?: string | null;
  showEquivBanner?: boolean;
  showHoleTable?: boolean;
  omitMetaSections?: RoundDeepStatsOmit[];
  onPressOpenFull?: (id: string) => void;
  showOpenFullCta?: boolean;
};

function omit(sections: RoundDeepStatsOmit[] | undefined, key: RoundDeepStatsOmit) {
  return Boolean(sections?.includes(key));
}

function Row({ lab, val }: { lab: string; val: string }) {
  return (
    <>
      <Text style={styles.rowLab}>{lab}</Text>
      <Text style={styles.rowVal}>{val}</Text>
    </>
  );
}

function DistChip({ label, n, color }: { label: string; n: number; color: string }) {
  if (n <= 0) return null;
  return (
    <View style={styles.distChip}>
      <View style={[styles.distDot, { backgroundColor: color }]} />
      <Text style={styles.distChipTxt}>
        {label} {n}
      </Text>
    </View>
  );
}

function StatGrid({ m }: { m: RoundDeepStatsModel }) {
  if (!m.hasFullHoles) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>逐洞统计</Text>
        <Text style={styles.muted}>无完整逐洞数据，以下为汇总字段（若有）。</Text>
        <Row lab="推杆（汇总）" val={m.puttsTotal != null ? `${m.puttsTotal} 推` : '—'} />
        <Row lab="上球道率 FIR" val={m.firPct != null ? `${m.firPct.toFixed(1)}%` : '—'} />
        <Row lab="上果岭洞数（汇总）" val={m.girCountFromHoles != null ? `${m.girCountFromHoles} 洞` : '—'} />
      </View>
    );
  }

  const d = m.distribution!;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>相对标准杆</Text>
      <Row lab="全场 vs Par" val={fmtVsPar(m.vsParTotal)} />
      <Row lab="前 9 vs Par" val={fmtVsPar(m.vsParFront9)} />
      {m.vsParBack9 != null ? <Row lab="后 9 vs Par" val={fmtVsPar(m.vsParBack9)} /> : null}
      <Row lab="前 9 总杆" val={m.front9Strokes != null ? `${m.front9Strokes}` : '—'} />
      {m.back9Strokes != null ? <Row lab="后 9 总杆" val={`${m.back9Strokes}`} /> : null}

      <Text style={[styles.sectionTitle, styles.sectionSp]}>杆数分布（本场）</Text>
      <View style={styles.distRow}>
        <DistChip label="老鹰+" n={d.eagle} color="#e5c53a" />
        <DistChip label="小鸟" n={d.birdie} color="#3ac5a8" />
        <DistChip label="Par" n={d.par} color="#e8e8e8" />
        <DistChip label="柏忌" n={d.bogey} color="#e89b3a" />
        <DistChip label="双柏忌+" n={d.doublePlus} color="#d94848" />
      </View>

      <Text style={[styles.sectionTitle, styles.sectionSp]}>Par 分段均杆</Text>
      <Row lab="Par3 均杆" val={m.avgPar3 != null ? m.avgPar3.toFixed(1) : '—'} />
      <Row lab="Par4 均杆" val={m.avgPar4 != null ? m.avgPar4.toFixed(1) : '—'} />
      <Row lab="Par5 均杆" val={m.avgPar5 != null ? m.avgPar5.toFixed(1) : '—'} />

      <Text style={[styles.sectionTitle, styles.sectionSp]}>推杆 · 上果岭</Text>
      <Row lab="推杆总数" val={m.puttsTotal != null ? `${m.puttsTotal} 推` : '—'} />
      <Row lab="三推洞数" val={m.threePuttCount != null ? `${m.threePuttCount} 洞` : '—'} />
      <Row lab="三推率" val={m.threePuttPct != null ? `${m.threePuttPct.toFixed(1)}%` : '—'} />
      <Row lab="标 on 率（GIR）" val={m.girPct != null ? `${m.girPct.toFixed(1)}%` : '—'} />
      <Row lab="上果岭洞数" val={m.girCountFromHoles != null ? `${m.girCountFromHoles} / ${m.holeCount}` : '—'} />

      <Text style={[styles.sectionTitle, styles.sectionSp]}>球道 · 其他</Text>
      <Row lab="上球道率 FIR" val={m.firPct != null ? `${m.firPct.toFixed(1)}%` : '—'} />
      <Row lab="罚杆（逐洞复盘）" val={m.penaltyStrokesTotal != null ? `${m.penaltyStrokesTotal}` : '—'} />
      <Row lab="最长连续 Par+" val={m.streakParOrBetter != null ? `${m.streakParOrBetter} 洞` : '—'} />
      <Row lab="最长连续柏忌+" val={m.streakBogeyPlus != null ? `${m.streakBogeyPlus} 洞` : '—'} />
    </View>
  );
}

export function RoundDeepStats({
  record,
  variant = 'page',
  title = '单场深度',
  showEquivBanner = true,
  showHoleTable = true,
  omitMetaSections,
  onPressOpenFull,
  showOpenFullCta,
}: RoundDeepStatsProps) {
  const model = useMemo(() => computeRoundDeepStats(record), [record]);
  const partners = (record.playingPartners ?? []).map((p) => p.name).filter(Boolean);
  const hasHoles = record.holeDetails.length === record.holes && record.holes > 0;
  const pad = variant === 'embedded' ? styles.wrapEmbedded : styles.wrapPage;

  const eq = equivalent18FromGrossAndHoles(record.adjustedGrossScore, record.holes);
  const equivLine =
    Number.isFinite(eq) && showEquivBanner
      ? `${eq % 1 === 0 ? eq : (eq as number).toFixed(1)} 杆（等效 18 洞）`
      : null;

  const oc = omit(omitMetaSections, 'courseDate');
  const ow = omit(omitMetaSections, 'weatherPartners');
  const ot = omit(omitMetaSections, 'timing');

  return (
    <View style={[styles.card, pad]}>
      {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
      {equivLine ? <Text style={styles.equiv}>{equivLine}</Text> : null}

      {!oc ? (
        <>
          <Row lab="球场" val={record.courseName} />
          <Row lab="日期" val={record.date} />
        </>
      ) : null}
      {!ow ? (
        <>
          <Row lab="上场天气（回顾）" val={record.weather?.trim() ? record.weather.trim() : '—'} />
          <Row lab="同组" val={partners.length > 0 ? partners.join('、') : '—'} />
          <Text style={styles.rowFoot}>
            未使用本应用的同组不会自动看到本场；已注册且经应用内同场记分时，同步支持后对方账户也会出现本场。
          </Text>
        </>
      ) : null}
      {!ot ? (
        <>
          <Row lab="开球时间" val={record.teeTime?.trim() ? record.teeTime.trim() : '—'} />
          <Row lab="总时长" val={formatRoundDurationMinutes(record.durationTotalMinutes)} />
          {record.holes === 18 ? (
            <>
              <Row lab="前 9 用时" val={formatRoundDurationMinutes(record.durationFront9Minutes)} />
              <Row lab="后 9 用时" val={formatRoundDurationMinutes(record.durationBack9Minutes)} />
            </>
          ) : null}
        </>
      ) : null}

      <Text style={[styles.sectionTitle, styles.sectionSp]}>成绩概要</Text>
      <Row lab="调整后总杆" val={`${record.adjustedGrossScore} 杆 · ${record.holes} 洞`} />
      <Row lab="微差" val={Number.isFinite(record.scoreDifferential) ? record.scoreDifferential.toFixed(1) : '—'} />

      <StatGrid m={model} />

      {showHoleTable && hasHoles ? (
        <>
          <Text style={[styles.sectionTitle, styles.sectionSp]}>逐洞成绩</Text>
          <View style={styles.tableHead}>
            <Text style={styles.thHole}>洞</Text>
            <Text style={styles.thPar}>Par</Text>
            <Text style={styles.thScore}>杆</Text>
            <Text style={styles.thPutt}>推</Text>
          </View>
          {record.holeDetails
            .slice()
            .sort((a, b) => a.holeNumber - b.holeNumber)
            .map((h) => (
              <View key={h.holeNumber} style={styles.tableRow}>
                <Text style={styles.tdHole}>{h.holeNumber}</Text>
                <Text style={styles.tdPar}>{h.par}</Text>
                <Text style={styles.tdScore}>{h.strokes}</Text>
                <Text style={styles.tdPutt}>{h.putts}</Text>
              </View>
            ))}
        </>
      ) : showHoleTable && !hasHoles ? (
        <Text style={[styles.muted, styles.sectionSp]}>无逐洞表（快速录入等）。</Text>
      ) : null}

      {showOpenFullCta && onPressOpenFull ? (
        <Pressable style={styles.cta} onPress={() => onPressOpenFull(record.id)} accessibilityRole="button">
          <Text style={styles.ctaTxt}>完整成绩与复盘 ›</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: BORDER,
    padding: 14,
  },
  wrapPage: { marginBottom: 14 },
  wrapEmbedded: { marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: SUB, marginBottom: 8 },
  equiv: { fontSize: 20, fontWeight: '800', color: ACCENT, marginBottom: 10 },
  rowLab: { fontSize: 11, fontWeight: '700', color: MUTED, marginTop: 8 },
  rowVal: { fontSize: 15, fontWeight: '600', color: WHITE, marginTop: 2 },
  rowFoot: { fontSize: 11, fontWeight: '500', color: SUB, lineHeight: 16, marginTop: 8 },
  section: { marginTop: 4 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: SUB, marginTop: 12, marginBottom: 4 },
  sectionSp: { marginTop: 14 },
  muted: { fontSize: 13, fontWeight: '500', color: SUB, lineHeight: 19 },
  distRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  distChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  distDot: { width: 7, height: 7, borderRadius: 3.5 },
  distChipTxt: { fontSize: 12, fontWeight: '600', color: SUB },
  tableHead: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
    paddingBottom: 6,
    marginTop: 6,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  thHole: { width: 36, fontSize: 11, fontWeight: '700', color: MUTED },
  thPar: { width: 40, fontSize: 11, fontWeight: '700', color: MUTED },
  thScore: { flex: 1, fontSize: 11, fontWeight: '700', color: MUTED },
  thPutt: { width: 44, fontSize: 11, fontWeight: '700', color: MUTED, textAlign: 'right' },
  tdHole: { width: 36, fontSize: 14, fontWeight: '700', color: WHITE },
  tdPar: { width: 40, fontSize: 14, fontWeight: '600', color: SUB },
  tdScore: { flex: 1, fontSize: 14, fontWeight: '800', color: WHITE },
  tdPutt: { width: 44, fontSize: 14, fontWeight: '600', color: SUB, textAlign: 'right' },
  cta: { marginTop: 14, paddingVertical: 10 },
  ctaTxt: { fontSize: 14, fontWeight: '800', color: ACCENT },
});
