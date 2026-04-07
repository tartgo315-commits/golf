import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Circle, Ellipse, Line, Path } from 'react-native-svg';
import { useCallback, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { USER_PROFILE_KEY, type StoredUserProfile } from '@/lib/app-storage';
import { readJson } from '@/lib/local-storage';

type GridItem = {
  icon: 'driver' | 'iron' | 'fairway' | 'wedge' | 'putter' | 'compare';
  title: string;
  type?: 'driver' | 'iron' | 'fairway' | 'wedge' | 'putter';
  href?: '/compare';
  tab?: '2';
  highlight?: boolean;
};

type ToolItem = {
  icon: 'scale' | 'compare-bars' | 'grip';
  title: string;
  sub: string;
  href: '/tools/swing-weight' | '/compare' | '/tools/grip';
  tab?: '0';
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
    type: 'iron',
  },
  {
    icon: 'fairway',
    title: '球道木',
    type: 'fairway',
  },
  {
    icon: 'wedge',
    title: '挖起杆',
    type: 'wedge',
  },
  {
    icon: 'putter',
    title: '推杆',
    type: 'putter',
  },
  {
    icon: 'compare',
    title: '套杆推荐',
    href: '/compare',
    tab: '2',
  },
];

const TOOLS: ToolItem[] = [
  { icon: 'scale', title: '挥重计算器', sub: '输入杆身/杆头数据，推算目标挥重', href: '/tools/swing-weight' },
  { icon: 'compare-bars', title: '杆身对比', sub: "Ventus / Kai'li / Tour AD 速查", href: '/compare', tab: '0' },
  { icon: 'grip', title: '握把选择', sub: '尺寸 · 材质 · 对挥重的影响', href: '/tools/grip' },
];

function ClubIcon({ kind, stroke, size = 48 }: { kind: GridItem['icon']; stroke: string; size?: number }) {
  const common = { stroke, strokeWidth: 2, fill: 'none' as const, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

  if (kind === 'driver') {
    return (
      <Svg width={size} height={size} viewBox="0 0 48 48">
        <Circle cx="14" cy="34" r="7" {...common} />
        <Line x1="19" y1="29" x2="37" y2="12" {...common} />
        <Line x1="35" y1="14" x2="41" y2="8" {...common} />
      </Svg>
    );
  }

  if (kind === 'iron') {
    return (
      <Svg width={size} height={size} viewBox="0 0 48 48">
        <Path d="M11 30 H22 V38 H11 Z" {...common} />
        <Line x1="22" y1="30" x2="36" y2="14" {...common} />
        <Line x1="35" y1="15" x2="40" y2="10" {...common} />
      </Svg>
    );
  }

  if (kind === 'fairway') {
    return (
      <Svg width={size} height={size} viewBox="0 0 48 48">
        <Path d="M7 34 C9 27, 21 27, 24 34 C21 39, 9 39, 7 34 Z" {...common} />
        <Line x1="21" y1="30" x2="37" y2="13" {...common} />
        <Line x1="35" y1="15" x2="40" y2="10" {...common} />
      </Svg>
    );
  }

  if (kind === 'wedge') {
    return (
      <Svg width={size} height={size} viewBox="0 0 48 48">
        <Path d="M10 38 L24 38 L20 29 Z" {...common} />
        <Line x1="20" y1="29" x2="35" y2="14" {...common} />
        <Line x1="34" y1="15" x2="39" y2="10" {...common} />
      </Svg>
    );
  }

  if (kind === 'putter') {
    return (
      <Svg width={size} height={size} viewBox="0 0 48 48">
        <Line x1="28" y1="10" x2="28" y2="30" {...common} />
        <Path d="M28 30 H12 V36 H28" {...common} />
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
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
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<StoredUserProfile | null>(null);

  useFocusEffect(
    useCallback(() => {
      const next = readJson<StoredUserProfile | null>(USER_PROFILE_KEY, null);
      setProfile(next);
      return () => {};
    }, []),
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 8) }]}>
        <View style={styles.headerTop}>
          <Text style={styles.menuIcon}>☰</Text>
        </View>
        <View style={styles.profileBar}>
          <Text style={styles.headerTitle}>配杆顾问</Text>
          <Text style={styles.headerMeta}>
            挥速 {profile?.swingSpeedMph || '—'} · 差点 {profile?.handicap || '—'} · 身高 {profile?.heightCm || '—'}
          </Text>
        </View>
      </View>

      <View style={styles.mainArea}>
        <View style={styles.grid}>
          {GRID.map((item) => {
            const isHighlight = item.highlight === true;
            const onPress = () => {
              if (item.href) {
                if (item.tab) {
                  router.push({ pathname: item.href, params: { tab: item.tab } });
                  return;
                }
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
                    <ClubIcon kind={item.icon} stroke={isHighlight ? WHITE : GREEN} size={32} />
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
              onPress={() => {
                if (item.tab) {
                  router.push({ pathname: item.href, params: { tab: item.tab } });
                  return;
                }
                router.push(item.href);
              }}
              accessibilityRole="button"
              accessibilityLabel={item.title}
              activeOpacity={0.85}>
              <View style={styles.toolIconWrap}>
                <ToolIcon kind={item.icon} />
              </View>
              <View style={styles.toolLeft}>
                <View>
                  <Text style={styles.toolTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.toolSub} numberOfLines={1}>{item.sub}</Text>
                </View>
              </View>
              <Text style={styles.arrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const HEADER_BG = '#1a3d2b';
const GREEN = '#166534';
const WHITE = '#ffffff';
const BG = '#f5f5f5';
const GRID_BG = '#f0f4f0';
const TEXT_PRIMARY = '#333333';
const TEXT_DEEP = '#1a3d2b';
const TEXT_MUTED = '#6b7280';
const WHITE_70 = 'rgba(255,255,255,0.7)';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    height: 96,
    backgroundColor: HEADER_BG,
    paddingHorizontal: 14,
    paddingBottom: 8,
    justifyContent: 'space-between',
    flex: 0,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center' },
  menuIcon: { fontSize: 18, color: WHITE },
  profileBar: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: WHITE, marginBottom: 2 },
  headerMeta: { fontSize: 12, color: WHITE_70 },
  mainArea: {
    flex: 1,
    backgroundColor: WHITE,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -6,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
  },
  sectionLabel: { fontSize: 12, color: TEXT_PRIMARY, marginBottom: 6, marginLeft: 2, marginTop: 6, flex: 0 },

  grid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignContent: 'stretch',
    marginBottom: 8,
  },
  gridCardWrap: {
    width: '48%',
    flexGrow: 1,
    minHeight: 0,
  },
  gridCard: {
    flex: 1,
    width: '100%',
    backgroundColor: GRID_BG,
    borderRadius: 20,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridCardHighlight: {
    backgroundColor: GREEN,
  },
  gridIconWrap: {
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridTitle: { fontSize: 12, fontWeight: '600', color: TEXT_PRIMARY, marginTop: 8, textAlign: 'center' },
  gridTitleHighlight: { color: WHITE },

  toolList: {
    flex: 0,
    backgroundColor: WHITE,
    marginBottom: 0,
    gap: 6,
  },
  toolItem: {
    backgroundColor: GRID_BG,
    borderRadius: 16,
    height: 48,
    paddingHorizontal: 12,
    paddingVertical: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 0,
  },
  toolIconWrap: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  toolLeft: { flex: 1 },
  toolTitle: { fontSize: 13, fontWeight: '600', color: TEXT_DEEP, marginBottom: 0 },
  toolSub: { fontSize: 11, color: TEXT_MUTED },
  arrow: { fontSize: 18, color: GREEN },
});
