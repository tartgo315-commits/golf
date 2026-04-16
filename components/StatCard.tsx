import { StyleSheet, Text, View } from 'react-native';

const CARD_BG = 'rgba(255,255,255,0.05)';
/** 与成绩分析页主色条统一（#166534 系） */
const BORDER = 'rgba(22, 101, 52, 0.55)';
const WHITE = '#ffffff';
const MUTED = 'rgba(255,255,255,0.45)';

export type StatCardHighlight = 'green' | 'red' | 'gold' | null;

export type StatCardProps = {
  value: string | null;
  label: string;
  sublabel?: string | null;
  highlight?: StatCardHighlight;
  hidden?: boolean;
};

const HIGHLIGHT_COLOR: Record<Exclude<StatCardHighlight, null>, string> = {
  green: '#4ade80',
  red: '#f87171',
  gold: '#fbbf24',
};

export function StatCard({ value, label, sublabel, highlight, hidden }: StatCardProps) {
  if (hidden || value == null) return null;

  const valueColor =
    highlight != null && highlight in HIGHLIGHT_COLOR ? HIGHLIGHT_COLOR[highlight] : '#a3e635';

  return (
    <View style={styles.card}>
      <Text style={[styles.value, { color: valueColor }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
      {sublabel ? <Text style={styles.sublabel}>{sublabel}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 12,
    minHeight: 88,
    justifyContent: 'center',
  },
  value: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  label: { fontSize: 13, fontWeight: '600', color: WHITE, marginTop: 6 },
  sublabel: { fontSize: 11, color: MUTED, marginTop: 2 },
});
