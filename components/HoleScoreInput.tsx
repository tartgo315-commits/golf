import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { MatchRecord } from '@/utils/matchScoring';
import { holeNetGross } from '@/utils/matchScoring';

const ACCENT = '#b5ff3a';
const ON = '#0d1b11';
const MAIN = '#e8f0e5';
const SUB = '#5a6b5f';

export type HoleScoreInputProps = {
  match: MatchRecord;
  pars: number[];
  hole: number;
  grossDraft: number[];
  onChangeGross: (playerIndex: number, gross: number) => void;
  onNext: () => void;
  isLastHole: boolean;
};

export function HoleScoreInput({
  match,
  pars,
  hole,
  grossDraft,
  onChangeGross,
  onNext,
  isLastHole,
}: HoleScoreInputProps) {
  const par = pars[hole - 1] ?? 4;
  const { players, holes } = match;

  const step = (idx: number, delta: number) => {
    const cur = grossDraft[idx] ?? par;
    const next = Math.min(15, Math.max(1, cur + delta));
    onChangeGross(idx, next);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.holeBig}>
        第 {hole} 洞 · Par {par}
      </Text>
      {players.map((pl, idx) => {
        const g = grossDraft[idx] ?? par;
        const net = holeNetGross(pl, hole, holes, par, g);
        return (
          <View key={`${pl.name}-${idx}`} style={styles.plRow}>
            <Text style={styles.plName} numberOfLines={1}>
              {pl.name || `玩家 ${idx + 1}`}
            </Text>
            <View style={styles.stepRow}>
              <Pressable style={styles.stepBtn} onPress={() => step(idx, -1)} hitSlop={8}>
                <Text style={styles.stepTxt}>−</Text>
              </Pressable>
              <Text style={styles.grossNum}>{g}</Text>
              <Pressable style={styles.stepBtn} onPress={() => step(idx, 1)} hitSlop={8}>
                <Text style={styles.stepTxt}>+</Text>
              </Pressable>
            </View>
            <Text style={styles.netHint}>净杆 {net}</Text>
          </View>
        );
      })}
      <Pressable style={styles.nextBtn} onPress={onNext}>
        <Text style={styles.nextTxt}>{isLastHole ? '完成比赛 →' : '下一洞 →'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#16261c',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  holeBig: { fontSize: 18, fontWeight: '800', color: MAIN, textAlign: 'center', marginBottom: 16 },
  plRow: { marginBottom: 14 },
  plName: { fontSize: 13, fontWeight: '700', color: '#8a9a8e', marginBottom: 8 },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTxt: { fontSize: 22, fontWeight: '800', color: MAIN },
  grossNum: { fontSize: 28, fontWeight: '800', color: ACCENT, minWidth: 48, textAlign: 'center' },
  netHint: { marginTop: 6, fontSize: 11, fontWeight: '600', color: SUB, textAlign: 'center' },
  nextBtn: {
    marginTop: 8,
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  nextTxt: { fontSize: 15, fontWeight: '800', color: ON },
});
