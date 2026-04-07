import { useRouter } from 'expo-router';
import Svg, { Circle, Ellipse, Line, Path } from 'react-native-svg';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { ClubCategory } from '@/data/golfKnowledge';

type GridItem = {
  icon: 'driver' | 'iron' | 'fairway' | 'wedge' | 'putter' | 'compare';
  title: string;
  type?: ClubCategory;
  href?: '/compare' | '/(tabs)/compare?tab=2';
  highlight?: boolean;
};

type ToolItem = {
  icon: 'scale' | 'compare-bars' | 'grip';
  title: string;
  sub: string;
  href: '/swing-weight' | '/compare' | '/grip-select';
};

const GRID: GridItem[] = [
  {
    icon: 'driver',
    title: '一号木',
    type: 'driver',
    highlight: true,
  },
  {
    icon: 'iron',
    title: '铁杆',
    type: 'irons',
  },
  {
    icon: 'fairway',
    title: '球道木',
    type: 'fairway',
  },
  {
    icon: 'wedge',
    title: '挖起杆',
    type: 'wedges',
  },
  {
    icon: 'putter',
    title: '推杆',
    type: 'wedges',
  },
  {
    icon: 'compare',
    title: '套杆推荐',
    href: '/(tabs)/compare?tab=2',
  },
];

const TOOLS: ToolItem[] = [
  { icon: 'scale', title: '挥重计算器', sub: '输入杆身/杆头数据，推算目标挥重', href: '/swing-weight' },
  { icon: 'compare-bars', title: '杆身对比', sub: "Ventus / Kai'li / Tour AD 速查", href: '/compare' },
  { icon: 'grip', title: '握把选择', sub: '尺寸 · 材质 · 对挥重的影响', href: '/grip-select' },
];

function ClubIcon({ kind, stroke }: { kind: GridItem['icon']; stroke: string }) {
  const common = { stroke, strokeWidth: 2, fill: 'none' as const, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

  if (kind === 'driver') {
    return (
      <Svg width={48} height={48} viewBox="0 0 48 48">
        <Circle cx="14" cy="34" r="7" {...common} />
        <Line x1="19" y1="29" x2="37" y2="12" {...common} />
        <Line x1="35" y1="14" x2="41" y2="8" {...common} />
      </Svg>
    );
  }

  if (kind === 'iron') {
    return (
      <Svg width={48} height={48} viewBox="0 0 48 48">
        <Path d="M11 30 H22 V38 H11 Z" {...common} />
        <Line x1="22" y1="30" x2="36" y2="14" {...common} />
        <Line x1="35" y1="15" x2="40" y2="10" {...common} />
      </Svg>
    );
  }

  if (kind === 'fairway') {
    return (
      <Svg width={48} height={48} viewBox="0 0 48 48">
        <Path d="M7 34 C9 27, 21 27, 24 34 C21 39, 9 39, 7 34 Z" {...common} />
        <Line x1="21" y1="30" x2="37" y2="13" {...common} />
        <Line x1="35" y1="15" x2="40" y2="10" {...common} />
      </Svg>
    );
  }

  if (kind === 'wedge') {
    return (
      <Svg width={48} height={48} viewBox="0 0 48 48">
        <Path d="M10 38 L24 38 L20 29 Z" {...common} />
        <Line x1="20" y1="29" x2="35" y2="14" {...common} />
        <Line x1="34" y1="15" x2="39" y2="10" {...common} />
      </Svg>
    );
  }

  if (kind === 'putter') {
    return (
      <Svg width={48} height={48} viewBox="0 0 48 48">
        <Line x1="28" y1="10" x2="28" y2="30" {...common} />
        <Path d="M28 30 H12 V36 H28" {...common} />
      </Svg>
    );
  }

  return (
    <Svg width={48} height={48} viewBox="0 0 48 48">
      <Line x1="10" y1="36" x2="36" y2="12" {...common} />
      <Line x1="12" y1="12" x2="38" y2="36" {...common} />
      <Circle cx="8" cy="38" r="2.5" {...common} />
      <Circle cx="40" cy="10" r="2.5" {...common} />
    </Svg>
  );
}

function ToolIcon({ kind }: { kind: ToolItem['icon'] }) {
  const stroke = GREEN;
  const common = {
    stroke,
    strokeWidth: 1.5,
    fill: 'none' as const,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  if (kind === 'scale') {
    return (
      <Svg width={36} height={36} viewBox="0 0 36 36">
        <Line x1="6" y1="10" x2="30" y2="10" {...common} />
        <Path d="M18 10 L22 18 H14 Z" {...common} />
        <Circle cx="9" cy="21" r="4" {...common} />
        <Circle cx="27" cy="21" r="4" {...common} />
        <Line x1="18" y1="10" x2="18" y2="6" {...common} />
      </Svg>
    );
  }

  if (kind === 'compare-bars') {
    return (
      <Svg width={36} height={36} viewBox="0 0 36 36">
        <Line x1="10" y1="28" x2="10" y2="12" {...common} />
        <Line x1="18" y1="28" x2="18" y2="8" {...common} />
        <Line x1="26" y1="28" x2="26" y2="16" {...common} />
        <Line x1="6" y1="28" x2="30" y2="28" {...common} />
      </Svg>
    );
  }

  return (
    <Svg width={36} height={36} viewBox="0 0 36 36">
      <Ellipse cx="18" cy="11" rx="8" ry="4.5" {...common} />
      <Path d="M10 11 C10 14, 26 14, 26 11" {...common} />
      <Line x1="18" y1="16" x2="18" y2="30" {...common} />
    </Svg>
  );
}

export default function HomeScreen() {
  const router = useRouter();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.menuIcon}>☰</Text>
        </View>
        <View>
          <Text style={styles.headerTitle}>配杆顾问</Text>
          <Text style={styles.headerMeta}>挥速 — · 差点 — · 身高 —</Text>
        </View>
      </View>

      <View style={styles.mainArea}>
        <View style={styles.grid}>
          {GRID.map((item) => {
            const isHighlight = item.highlight === true;
            const onPress = () => {
              if (item.href) {
                router.push(item.href);
                return;
              }
              if (item.type) {
                router.push({ pathname: '/quiz/[type]', params: { type: item.type } });
              }
            };
            return (
              <TouchableOpacity
                key={item.title}
                style={styles.gridCardWrap}
                onPress={onPress}
                accessibilityRole="button"
                accessibilityLabel={item.title}
                activeOpacity={0.85}>
                <View style={[styles.gridCard, isHighlight && styles.gridCardHighlight]}>
                  <View style={styles.gridIconWrap}>
                    <ClubIcon kind={item.icon} stroke={isHighlight ? WHITE : GREEN} />
                  </View>
                  <Text style={[styles.gridTitle, isHighlight && styles.gridTitleHighlight]}>{item.title}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>配杆细节工具</Text>
        <View style={styles.toolList}>
          {TOOLS.map((item) => (
            <TouchableOpacity
              key={item.title}
              style={styles.toolItem}
              onPress={() => router.push(item.href)}
              accessibilityRole="button"
              accessibilityLabel={item.title}
              activeOpacity={0.85}>
              <View style={styles.toolIconWrap}>
                <ToolIcon kind={item.icon} />
              </View>
              <View style={styles.toolLeft}>
                <View>
                  <Text style={styles.toolTitle}>{item.title}</Text>
                  <Text style={styles.toolSub}>{item.sub}</Text>
                </View>
              </View>
              <Text style={styles.arrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const HEADER_BG = '#1a3d2b';
const GREEN = '#166534';
const WHITE = '#ffffff';
const BG = '#f5f5f5';
const GRID_BG = '#f0f4f0';
const LINE = '#f0f0f0';
const TEXT_PRIMARY = '#333333';
const TEXT_DEEP = '#1a3d2b';
const TEXT_TERTIARY = '#9ca3af';
const TEXT_DISABLED = '#d1d5db';
const TEXT_MUTED = '#6b7280';
const WHITE_70 = 'rgba(255,255,255,0.7)';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  content: { paddingBottom: 32 },
  header: {
    minHeight: 180,
    backgroundColor: HEADER_BG,
    padding: 24,
    paddingTop: 60,
    justifyContent: 'space-between',
  },
  headerTop: { flexDirection: 'row', alignItems: 'center' },
  menuIcon: { fontSize: 22, color: WHITE },
  headerTitle: { fontSize: 22, fontWeight: '600', color: WHITE, marginBottom: 8 },
  headerMeta: { fontSize: 13, color: WHITE_70 },
  mainArea: {
    backgroundColor: WHITE,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -14,
    padding: 16,
    paddingTop: 20,
  },
  sectionLabel: { fontSize: 13, color: TEXT_PRIMARY, marginBottom: 10, marginLeft: 2, marginTop: 10 },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  gridCardWrap: {
    width: '48%',
  },
  gridCard: {
    width: '100%',
    backgroundColor: GRID_BG,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  gridCardHighlight: {
    backgroundColor: GREEN,
  },
  gridIconWrap: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridTitle: { fontSize: 13, fontWeight: '600', color: TEXT_PRIMARY, marginTop: 12, textAlign: 'center' },
  gridTitleHighlight: { color: WHITE },

  toolList: {
    backgroundColor: WHITE,
    marginBottom: 10,
  },
  toolItem: {
    backgroundColor: GRID_BG,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 10,
  },
  toolIconWrap: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  toolLeft: { flex: 1 },
  toolTitle: { fontSize: 14, fontWeight: '600', color: TEXT_DEEP, marginBottom: 2 },
  toolSub: { fontSize: 12, color: TEXT_MUTED },
  arrow: { fontSize: 18, color: GREEN },
});
