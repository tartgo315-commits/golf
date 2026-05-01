import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { MatchPlayer, MatchRecord } from '@/utils/matchScoring';
import { THEME } from '@/constants/theme';

const CELL_W = 34;
const GAP = 6;
const ACCENT_BG = THEME.accentBg;
const TEXT_MAIN = THEME.text2;
const MUTED = THEME.text3;
const BIRD = 'rgba(163,230,53,0.22)';
const BOGEY = 'rgba(248,113,113,0.14)';
const DBL = 'rgba(220,38,38,0.35)';
const NEUT = 'rgba(255,255,255,0.06)';

function cellStyle(gross: number | null, par: number) {
  if (gross == null) return { bg: 'transparent' as const, color: MUTED };
  const d = gross - par;
  if (d <= -2) return { bg: BIRD, color: THEME.accent };
  if (d === -1) return { bg: BIRD, color: TEXT_MAIN };
  if (d === 0) return { bg: NEUT, color: TEXT_MAIN };
  if (d === 1) return { bg: BOGEY, color: TEXT_MAIN };
  return { bg: DBL, color: '#fecaca' };
}

export type ScoreboardProps = {
  match: MatchRecord;
  pars: number[];
  currentHole: number;
  onPickHole?: (hole: number) => void;
};

function grossFor(p: MatchPlayer, hole: number): number | null {
  const r = p.scores.find((s) => s.hole === hole);
  return r ? r.gross : null;
}

export function Scoreboard({ match, pars, currentHole, onPickHole }: ScoreboardProps) {
  const { players, holes } = match;
  const holeNums = Array.from({ length: holes }, (_, i) => i + 1);
  const firstRow = holeNums.filter((h) => h <= 9);
  const secondRow = holeNums.filter((h) => h > 9);

  const renderHeader = (nums: number[]) => (
    <View style={styles.row}>
      <View style={styles.nameCol} />
      {nums.map((h) => (
        <View key={`h-${h}`} style={styles.cellWrap}>
          <Text style={styles.holeLab}>{h}</Text>
        </View>
      ))}
    </View>
  );

  const renderPlayer = (pl: MatchPlayer, pIdx: number, nums: number[]) => (
    <View key={`p-${pIdx}`} style={styles.row}>
      <View style={styles.nameCol}>
        <Text style={styles.nameTxt} numberOfLines={1}>
          {pl.name || '—'}
        </Text>
      </View>
      {nums.map((h) => {
        const par = pars[h - 1] ?? 4;
        const g = grossFor(pl, h);
        const st = cellStyle(g, par);
        const hi = h === currentHole;
        return (
          <Pressable
            key={`${pl.name}-${h}`}
            onPress={() => onPickHole?.(h)}
            style={[styles.cellWrap, hi && styles.cellHi]}
          >
            <View style={[styles.cell, { backgroundColor: st.bg }]}>
              <Text style={[styles.cellTxt, { color: st.color }]}>
                {g == null ? '-' : String(g)}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <View style={styles.card}>
      <Text style={styles.title}>记分板</Text>
      {renderHeader(firstRow)}
      {players.map((pl, i) => renderPlayer(pl, i, firstRow))}
      {secondRow.length > 0 ? (
        <>
          <View style={styles.spacer} />
          {renderHeader(secondRow)}
          {players.map((pl, i) => renderPlayer(pl, i, secondRow))}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#16261c',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  title: { fontSize: 13, fontWeight: '700', color: '#a8b5ac', marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  nameCol: { width: 72, paddingRight: 6 },
  nameTxt: { fontSize: 11, fontWeight: '700', color: '#8a9a8e' },
  cellWrap: { width: CELL_W, marginHorizontal: GAP / 2 },
  cellHi: {
    borderRadius: 8,
    backgroundColor: ACCENT_BG,
    padding: 2,
  },
  holeLab: { fontSize: 10, fontWeight: '600', color: MUTED, textAlign: 'center', marginBottom: 4 },
  cell: {
    width: CELL_W - 4,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  cellTxt: { fontSize: 13, fontWeight: '800' },
  spacer: { height: 10 },
});
