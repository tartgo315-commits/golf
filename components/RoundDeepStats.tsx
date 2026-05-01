import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  equivalent18FromGrossAndHoles,
  formatRoundDurationMinutes,
  type HandicapRecord,
} from '@/lib/handicap';
import { computeRoundDeepStats, fmtVsPar, type RoundDeepStatsModel } from '@/lib/roundDeepStats';
import { THEME } from '@/constants/theme';

const CARD_BG = THEME.card;
const BORDER = 'rgba(255,255,255,0.08)';
const WHITE = THEME.text1;
const SUB = THEME.text3;
const MUTED = THEME.text3;
const ACCENT = THEME.accent;

export type RoundDeepStatsOmit = 'courseDate' | 'weatherPartners' | 'timing';

export type RoundDeepStatsProps = {
  record: HandicapRecord;
  variant?: 'embedded' | 'page';
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

/** 双列：左/右各「小标签 + 值」 */
function CellPair({
  leftLab,
  leftVal,
  rightLab,
  rightVal,
}: {
  leftLab: string;
  leftVal: string;
  rightLab: string;
  rightVal: string;
}) {
  return (
    <View style={styles.pairRow}>
      <View style={styles.pairCell}>
        <Text style={styles.cellLab}>{leftLab}</Text>
        <Text style={styles.cellVal} numberOfLines={2}>
          {leftVal}
        </Text>
      </View>
      <View style={styles.pairCell}>
        <Text style={styles.cellLab}>{rightLab}</Text>
        <Text style={styles.cellVal}>{rightVal}</Text>
      </View>
    </View>
  );
}

function MiniTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniTile}>
      <Text style={styles.miniTileLab}>{label}</Text>
      <Text style={styles.miniTileVal}>{value}</Text>
    </View>
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
      <View style={styles.block}>
        <Text style={styles.blockTitle}>逐洞</Text>
        <Text style={styles.compactNote}>无完整逐洞 · 仅汇总</Text>
        <View style={styles.kpiStrip}>
          <MiniTile label="推杆" value={m.puttsTotal != null ? `${m.puttsTotal}` : '—'} />
          <MiniTile label="FIR" value={m.firPct != null ? `${m.firPct.toFixed(0)}%` : '—'} />
          <MiniTile
            label="GIR洞"
            value={m.girCountFromHoles != null ? `${m.girCountFromHoles}` : '—'}
          />
        </View>
      </View>
    );
  }

  const d = m.distribution!;
  const vsBack = m.vsParBack9 != null ? `后9 ${fmtVsPar(m.vsParBack9)}` : '';
  const strokeLine =
    m.back9Strokes != null
      ? `杆数 前${m.front9Strokes ?? '—'}/后${m.back9Strokes}`
      : `前9总杆 ${m.front9Strokes ?? '—'}`;

  return (
    <View style={styles.block}>
      <Text style={styles.blockTitle}>相对 Par · 杆数</Text>
      <Text style={styles.compactLine}>
        全场 {fmtVsPar(m.vsParTotal)} · 前9 {fmtVsPar(m.vsParFront9)}
        {vsBack ? ` · ${vsBack}` : ''}
      </Text>
      <Text style={styles.compactLineMuted}>{strokeLine}</Text>

      <Text style={[styles.blockTitle, styles.blockTitleSp]}>杆数分布</Text>
      <View style={styles.distRow}>
        <DistChip label="鹰+" n={d.eagle} color="#e5c53a" />
        <DistChip label="鸟" n={d.birdie} color="#3ac5a8" />
        <DistChip label="P" n={d.par} color="#e8e8e8" />
        <DistChip label="柏" n={d.bogey} color="#e89b3a" />
        <DistChip label="双+" n={d.doublePlus} color="#d94848" />
      </View>

      <Text style={[styles.blockTitle, styles.blockTitleSp]}>Par 均杆</Text>
      <View style={styles.kpiStrip}>
        <MiniTile label="P3" value={m.avgPar3 != null ? m.avgPar3.toFixed(1) : '—'} />
        <MiniTile label="P4" value={m.avgPar4 != null ? m.avgPar4.toFixed(1) : '—'} />
        <MiniTile label="P5" value={m.avgPar5 != null ? m.avgPar5.toFixed(1) : '—'} />
      </View>

      <Text style={[styles.blockTitle, styles.blockTitleSp]}>推杆 · GIR</Text>
      <Text style={styles.compactLine}>
        {m.puttsTotal != null ? `${m.puttsTotal} 推` : '—'}
        {m.threePuttCount != null && m.threePuttPct != null
          ? ` · 三推 ${m.threePuttCount}（${m.threePuttPct.toFixed(0)}%）`
          : ''}
        {m.girPct != null ? ` · GIR ${m.girPct.toFixed(1)}%` : ''}
        {m.girCountFromHoles != null ? ` · ${m.girCountFromHoles}/${m.holeCount}` : ''}
      </Text>

      <Text style={[styles.blockTitle, styles.blockTitleSp]}>球道 · 节奏</Text>
      <Text style={styles.compactLine}>
        FIR {m.firPct != null ? `${m.firPct.toFixed(1)}%` : '—'}
        {m.penaltyStrokesTotal != null ? ` · 罚杆 ${m.penaltyStrokesTotal}` : ''}
        {m.streakParOrBetter != null ? ` · 连Par+ ${m.streakParOrBetter}` : ''}
        {m.streakBogeyPlus != null ? ` · 连柏忌+ ${m.streakBogeyPlus}` : ''}
      </Text>
    </View>
  );
}

const PARTNER_HINT_SHORT = '手填仅本机；未注册不自动可见。多人记分已注册可同步。';

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
  const compactHint = variant === 'embedded';

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
      <View style={styles.headRow}>
        {title ? <Text style={styles.cardTitle}>{title}</Text> : <View />}
        {equivLine ? <Text style={styles.equivInline}>{equivLine}</Text> : null}
      </View>

      {!oc ? (
        <CellPair
          leftLab="球场"
          leftVal={record.courseName}
          rightLab="日期"
          rightVal={record.date}
        />
      ) : null}

      {!ow ? (
        <>
          <CellPair
            leftLab="天气"
            leftVal={record.weather?.trim() ? record.weather.trim() : '—'}
            rightLab="同组"
            rightVal={partners.length > 0 ? partners.join('、') : '—'}
          />
          {!compactHint ? (
            <Text style={styles.rowFootLong}>
              未使用本应用的同组不会自动看到本场；已注册且经应用内同场记分时，同步支持后对方账户也会出现本场。
            </Text>
          ) : (
            <Text style={styles.rowFootShort}>{PARTNER_HINT_SHORT}</Text>
          )}
        </>
      ) : null}

      {!ot ? (
        <View style={styles.timingGrid}>
          <View style={styles.timingCell}>
            <Text style={styles.cellLab}>开球</Text>
            <Text style={styles.cellValSm}>
              {record.teeTime?.trim() ? record.teeTime.trim() : '—'}
            </Text>
          </View>
          <View style={styles.timingCell}>
            <Text style={styles.cellLab}>总时长</Text>
            <Text style={styles.cellValSm}>
              {formatRoundDurationMinutes(record.durationTotalMinutes)}
            </Text>
          </View>
          {record.holes === 18 ? (
            <>
              <View style={styles.timingCell}>
                <Text style={styles.cellLab}>前9</Text>
                <Text style={styles.cellValSm}>
                  {formatRoundDurationMinutes(record.durationFront9Minutes)}
                </Text>
              </View>
              <View style={styles.timingCell}>
                <Text style={styles.cellLab}>后9</Text>
                <Text style={styles.cellValSm}>
                  {formatRoundDurationMinutes(record.durationBack9Minutes)}
                </Text>
              </View>
            </>
          ) : null}
        </View>
      ) : null}

      <View style={styles.kpiStrip}>
        <MiniTile label="总杆" value={`${record.adjustedGrossScore}·${record.holes}洞`} />
        <MiniTile
          label="微差"
          value={
            Number.isFinite(record.scoreDifferential) ? record.scoreDifferential.toFixed(1) : '—'
          }
        />
      </View>

      <StatGrid m={model} />

      {showHoleTable && hasHoles ? (
        <View style={styles.tableBlock}>
          <Text style={[styles.blockTitle, styles.blockTitleSp]}>逐洞</Text>
          <View style={styles.tableHead}>
            <Text style={styles.thHole}>#</Text>
            <Text style={styles.thPar}>P</Text>
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
        </View>
      ) : showHoleTable && !hasHoles ? (
        <Text style={[styles.compactNote, styles.blockTitleSp]}>无逐洞表</Text>
      ) : null}

      {showOpenFullCta && onPressOpenFull ? (
        <Pressable
          style={styles.cta}
          onPress={() => onPressOpenFull(record.id)}
          accessibilityRole="button"
        >
          <Text style={styles.ctaTxt}>完整场次 ›</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: BORDER,
    padding: 10,
  },
  wrapPage: { marginBottom: 12 },
  wrapEmbedded: { marginBottom: 8 },
  headRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  cardTitle: { fontSize: 14, fontWeight: '800', color: WHITE, flex: 1 },
  equivInline: { fontSize: 13, fontWeight: '800', color: ACCENT, flexShrink: 0 },
  pairRow: { flexDirection: 'row', gap: 10, marginBottom: 6 },
  pairCell: { flex: 1, minWidth: 0 },
  cellLab: { fontSize: 10, fontWeight: '700', color: MUTED, marginBottom: 2 },
  cellVal: { fontSize: 13, fontWeight: '600', color: WHITE, lineHeight: 18 },
  cellValSm: { fontSize: 12, fontWeight: '700', color: WHITE },
  rowFootLong: {
    fontSize: 10,
    fontWeight: '500',
    color: SUB,
    lineHeight: 14,
    marginTop: 4,
    marginBottom: 4,
  },
  rowFootShort: { fontSize: 10, fontWeight: '500', color: SUB, lineHeight: 14, marginBottom: 4 },
  timingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  timingCell: { width: '47%', minWidth: '42%' },
  kpiStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  miniTile: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
  },
  miniTileLab: { fontSize: 10, fontWeight: '700', color: MUTED, marginBottom: 2 },
  miniTileVal: { fontSize: 14, fontWeight: '800', color: ACCENT },
  block: { marginTop: 4 },
  blockTitle: { fontSize: 11, fontWeight: '800', color: SUB, letterSpacing: 0.4, marginBottom: 4 },
  blockTitleSp: { marginTop: 8 },
  compactNote: { fontSize: 11, color: SUB, marginBottom: 4 },
  compactLine: { fontSize: 12, fontWeight: '600', color: WHITE, lineHeight: 17 },
  compactLineMuted: { fontSize: 11, fontWeight: '500', color: SUB, marginTop: 2, marginBottom: 2 },
  distRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  distChip: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  distDot: { width: 6, height: 6, borderRadius: 3 },
  distChipTxt: { fontSize: 11, fontWeight: '600', color: SUB },
  tableBlock: { marginTop: 6 },
  tableHead: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
    paddingBottom: 4,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  thHole: { width: 28, fontSize: 10, fontWeight: '700', color: MUTED },
  thPar: { width: 28, fontSize: 10, fontWeight: '700', color: MUTED },
  thScore: { flex: 1, fontSize: 10, fontWeight: '700', color: MUTED },
  thPutt: { width: 36, fontSize: 10, fontWeight: '700', color: MUTED, textAlign: 'right' },
  tdHole: { width: 28, fontSize: 12, fontWeight: '700', color: WHITE },
  tdPar: { width: 28, fontSize: 12, fontWeight: '600', color: SUB },
  tdScore: { flex: 1, fontSize: 12, fontWeight: '800', color: WHITE },
  tdPutt: { width: 36, fontSize: 12, fontWeight: '600', color: SUB, textAlign: 'right' },
  cta: { marginTop: 8, paddingVertical: 8, alignItems: 'center' },
  ctaTxt: { fontSize: 13, fontWeight: '800', color: ACCENT },
});
