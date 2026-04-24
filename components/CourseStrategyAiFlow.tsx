import { type ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

const WHITE = '#e8f0e5';
const CARD = '#16261c';
const ACCENT = '#b5ff3a';
const ACCENT_TEXT = '#0d1b11';
const HERO_BORDER = 'rgba(181, 255, 58, 0.18)';
const ICON_BG = 'rgba(181, 255, 58, 0.12)';

function TacticalHubIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Circle cx="12" cy="7" r="2.4" stroke={ACCENT} strokeWidth={1.8} fill="none" />
      <Circle cx="6.5" cy="17" r="2.4" stroke={ACCENT} strokeWidth={1.8} fill="none" />
      <Circle cx="17.5" cy="17" r="2.4" stroke={ACCENT} strokeWidth={1.8} fill="none" />
      <Line x1="12" y1="9.4" x2="7.2" y2="15.2" stroke={ACCENT} strokeWidth={1.8} strokeLinecap="round" />
      <Line x1="12" y1="9.4" x2="16.8" y2="15.2" stroke={ACCENT} strokeWidth={1.8} strokeLinecap="round" />
      <Line x1="8.8" y1="17" x2="15.2" y2="17" stroke={ACCENT} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

type Props = {
  children?: ReactNode;
  onPressBriefing: () => void;
};

export function CourseStrategyAiFlow({ children, onPressBriefing }: Props) {
  return (
    <View style={styles.wrap}>
      <TouchableOpacity style={styles.entryCard} activeOpacity={0.9} onPress={onPressBriefing}>
        <View style={styles.entryTop}>
          <View style={styles.entryIconWrap}>
            <TacticalHubIcon />
          </View>
          <View style={styles.entryTextCol}>
            <Text style={styles.entryTitle}>AI 战术分析</Text>
            <Text style={styles.entrySub}>赛前简报：结合差点与同组信息生成今日打法</Text>
          </View>
        </View>
        <View style={styles.entryBtnAccent}>
          <Text style={styles.entryBtnAccentText}>生成今日战术 →</Text>
        </View>
      </TouchableOpacity>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  entryCard: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: HERO_BORDER,
    borderRadius: 16,
    padding: 18,
    marginBottom: 4,
  },
  entryTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  entryIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: ICON_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryTextCol: { flex: 1, minWidth: 0 },
  entryTitle: { fontSize: 16, fontWeight: '800', color: WHITE, marginBottom: 4, letterSpacing: -0.3 },
  entrySub: { fontSize: 11, fontWeight: '600', color: '#8a9a8e', lineHeight: 16 },
  entryBtnAccent: {
    marginTop: 16,
    backgroundColor: ACCENT,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  entryBtnAccentText: { color: ACCENT_TEXT, fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
});
