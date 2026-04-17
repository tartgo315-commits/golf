import { StyleSheet, Text, View } from 'react-native';

const CARD_BG = '#16261c';
const BORDER = 'rgba(255,255,255,0.08)';
const ACCENT = '#b5ff3a';
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
    highlight === 'green' || highlight === 'red' || highlight === 'gold'
      ? HIGHLIGHT_COLOR[highlight]
      : ACCENT;

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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 12,
    minHeight: 88,
    justifyContent: 'center',
  },
  value: { fontSize: 24, fontWeight: '800', letterSpacing: -0.6 },
  label: { fontSize: 13, fontWeight: '600', color: WHITE, marginTop: 6 },
  sublabel: { fontSize: 11, color: MUTED, marginTop: 2 },
});
