import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { HandicapHoleData } from '@/lib/handicap';

const HOLE_NUM = '#5a6b5f';
const PAR_LAB = '#5a6b5f';
const DOT = '#5a6b5f';
const CARD_BG = '#16261c';
const BORDER = 'rgba(255,255,255,0.08)';
const ACCENT = '#b5ff3a';
const TEXT_MAIN = '#e8f0e5';
const TEXT_SEC = '#a8b5ac';

function scoreRelColor(score: number, par: number): string {
  const d = score - par;
  if (d <= -2) return '#e5c53a';
  if (d === -1) return '#3ac5a8';
  if (d === 0) return '#e8f0e5';
  if (d === 1) return '#e89b3a';
  return '#d94848';
}

function PuttDots({ count }: { count: number }) {
  const n = Math.min(Math.max(0, count), 12);
  return (
    <View style={styles.dotsWrap}>
      {Array.from({ length: n }, (_, i) => (
        <View key={i} style={styles.puttDot} />
      ))}
    </View>
  );
}

function ReadonlyHoleCell({ h }: { h: HandicapHoleData }) {
  return (
    <View style={styles.roCell}>
      <Text style={styles.roHole}>{h.hole}</Text>
      <Text style={styles.roPar}>{h.par}</Text>
      <Text style={[styles.roScore, { color: scoreRelColor(h.score, h.par) }]}>{h.score}</Text>
      <PuttDots count={h.putts} />
    </View>
  );
}

function ReadonlyGrid({ data }: { data: HandicapHoleData[] }) {
  const n = data.length;
  const row1 = data.filter((h) => h.hole <= 9);
  const row2 = n === 18 ? data.filter((h) => h.hole > 9) : [];
  return (
    <View style={styles.roGrid}>
      <View style={styles.roRow}>
        {row1.map((h) => (
          <ReadonlyHoleCell key={h.hole} h={h} />
        ))}
      </View>
      {row2.length ? (
        <View style={[styles.roRow, styles.roRowSecond]}>
          {row2.map((h) => (
            <ReadonlyHoleCell key={h.hole} h={h} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Stepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={styles.stepRow}>
      <Pressable
        style={[styles.stepBtn, value <= min && styles.stepBtnOff]}
        onPress={() => value > min && onChange(value - 1)}
        hitSlop={6}
      >
        <Text style={styles.stepBtnTxt}>−</Text>
      </Pressable>
      <Text style={styles.stepVal}>{value}</Text>
      <Pressable
        style={[styles.stepBtn, value >= max && styles.stepBtnOff]}
        onPress={() => value < max && onChange(value + 1)}
        hitSlop={6}
      >
        <Text style={styles.stepBtnTxt}>+</Text>
      </Pressable>
    </View>
  );
}

function Toggle({
  value,
  onChange,
  label,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <Pressable
      style={styles.toggleRow}
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
    >
      <Text style={styles.toggleLab}>{label}</Text>
      <View style={[styles.toggleTrack, value && styles.toggleTrackOn]}>
        <View style={[styles.toggleKnob, value ? styles.toggleKnobOn : undefined]} />
      </View>
    </Pressable>
  );
}

function HoleEditCard({
  h,
  onPatch,
  penaltyOpen,
  onPenaltyOpen,
}: {
  h: HandicapHoleData;
  onPatch: (patch: Partial<HandicapHoleData>) => void;
  penaltyOpen: boolean;
  onPenaltyOpen: (open: boolean) => void;
}) {
  const maxScore = 15;
  const maxPutts = Math.min(12, h.score);
  const showPenalty = penaltyOpen || h.penalty > 0;

  const setPar = (par: 3 | 4 | 5) => {
    const nextFir: boolean | null = par === 3 ? null : h.fir === null ? false : h.fir;
    onPatch({ par, fir: nextFir });
  };

  return (
    <View style={styles.editCard}>
      <Text style={styles.editCardTitle}>第 {h.hole} 洞 · Par</Text>
      <View style={styles.parPick}>
        {([3, 4, 5] as const).map((p) => (
          <Pressable
            key={p}
            style={[styles.parChip, h.par === p && styles.parChipOn]}
            onPress={() => setPar(p)}
          >
            <Text style={[styles.parChipTxt, h.par === p && styles.parChipTxtOn]}>{p}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.editLab}>杆数</Text>
      <Stepper
        value={h.score}
        min={1}
        max={maxScore}
        onChange={(score) => onPatch({ score: Math.max(1, Math.min(maxScore, score)) })}
      />
      <Text style={styles.editLab}>推杆</Text>
      <Stepper
        value={h.putts}
        min={0}
        max={maxPutts}
        onChange={(putts) => onPatch({ putts: Math.max(0, Math.min(maxPutts, putts)) })}
      />
      {h.par >= 4 ? (
        <>
          <Text style={styles.editLab}>球道（FIR）</Text>
          <Toggle
            label={h.fir === true ? '上球道' : '未上球道'}
            value={h.fir === true}
            onChange={(fir) => onPatch({ fir })}
          />
        </>
      ) : null}
      <Text style={styles.editLab}>上果岭（GIR）</Text>
      <Toggle
        label={h.gir === true ? '已上果岭' : '未上果岭'}
        value={h.gir === true}
        onChange={(gir) => onPatch({ gir })}
      />
      {!showPenalty ? (
        <Pressable style={styles.penLink} onPress={() => onPenaltyOpen(true)}>
          <Text style={styles.penLinkTxt}>+ 罚杆</Text>
        </Pressable>
      ) : (
        <>
          <Text style={styles.editLab}>罚杆</Text>
          <Stepper value={h.penalty} min={0} max={8} onChange={(penalty) => onPatch({ penalty })} />
        </>
      )}
    </View>
  );
}

export type HoleReviewGridProps = {
  holeCount: 9 | 18;
  data: HandicapHoleData[];
  mode: 'view' | 'edit';
  onChange?: (next: HandicapHoleData[]) => void;
};

export function HoleReviewGrid({ holeCount, data, mode, onChange }: HoleReviewGridProps) {
  const sorted = useMemo(() => [...data].sort((a, b) => a.hole - b.hole), [data]);
  const [penOpenByHole, setPenOpenByHole] = useState<Record<number, boolean>>({});

  const patchHole = useCallback(
    (holeNum: number, patch: Partial<HandicapHoleData>) => {
      if (!onChange) return;
      const next = sorted.map((row) => {
        if (row.hole !== holeNum) return row;
        const merged = { ...row, ...patch };
        if (merged.par === 3) merged.fir = null;
        if (merged.putts > merged.score) merged.putts = merged.score;
        return merged;
      });
      onChange(next);
    },
    [onChange, sorted],
  );

  if (sorted.length !== holeCount) {
    return (
      <Text style={{ fontSize: 12, color: TEXT_SEC, textAlign: 'center', paddingVertical: 12 }}>
        逐洞数据洞数与本场洞数不一致
      </Text>
    );
  }

  if (mode === 'view') {
    return <ReadonlyGrid data={sorted} />;
  }

  return (
    <View style={styles.editList}>
      {sorted.map((h) => (
        <HoleEditCard
          key={h.hole}
          h={h}
          penaltyOpen={Boolean(penOpenByHole[h.hole] || h.penalty > 0)}
          onPenaltyOpen={(open) => setPenOpenByHole((prev) => ({ ...prev, [h.hole]: open }))}
          onPatch={(patch) => patchHole(h.hole, patch)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  roGrid: { gap: 10 },
  roRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 2 },
  roRowSecond: { marginTop: 4 },
  roCell: { flex: 1, minWidth: 0, alignItems: 'center' },
  roHole: { fontSize: 10, fontWeight: '600', color: HOLE_NUM },
  roPar: { fontSize: 10, fontWeight: '600', color: PAR_LAB, marginTop: 2 },
  roScore: { fontSize: 16, fontWeight: '800', marginTop: 4 },
  dotsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 3,
    marginTop: 6,
    maxWidth: 36,
  },
  puttDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: DOT },

  editList: { gap: 12 },
  editCard: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 12,
  },
  editCardTitle: { fontSize: 13, fontWeight: '700', color: TEXT_SEC, marginBottom: 10 },
  parPick: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  parChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER,
  },
  parChipOn: { borderColor: ACCENT, backgroundColor: 'rgba(181,255,58,0.12)' },
  parChipTxt: { fontSize: 14, fontWeight: '700', color: TEXT_SEC },
  parChipTxtOn: { color: ACCENT },
  editLab: { fontSize: 11, fontWeight: '600', color: HOLE_NUM, marginBottom: 6, marginTop: 4 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 4 },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnOff: { opacity: 0.35 },
  stepBtnTxt: { fontSize: 20, fontWeight: '700', color: TEXT_MAIN },
  stepVal: { fontSize: 18, fontWeight: '800', color: ACCENT, minWidth: 36, textAlign: 'center' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  toggleLab: { fontSize: 13, fontWeight: '600', color: TEXT_MAIN },
  toggleTrack: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 3,
    justifyContent: 'center',
  },
  toggleTrackOn: { backgroundColor: 'rgba(181,255,58,0.35)' },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#5a6b5f',
    alignSelf: 'flex-start',
  },
  toggleKnobOn: { alignSelf: 'flex-end', backgroundColor: ACCENT },
  penLink: { marginTop: 8, alignSelf: 'flex-start' },
  penLinkTxt: { fontSize: 12, fontWeight: '700', color: ACCENT },
});
