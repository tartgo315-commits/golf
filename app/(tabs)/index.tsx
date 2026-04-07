import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { ClubCategory } from '@/data/golfKnowledge';

type GridItem = {
  icon: string;
  title: string;
  type?: ClubCategory;
  href?: '/compare';
  highlight?: boolean;
};

type ToolItem = {
  icon: string;
  title: string;
  sub: string;
  href: '/swing-weight' | '/compare' | '/grip-select';
};

const GRID: GridItem[] = [
  { icon: '🏌', title: '一号木', type: 'driver', highlight: true },
  { icon: '⛳', title: '铁杆', type: 'irons' },
  { icon: '🌿', title: '球道木', type: 'fairway' },
  { icon: '△', title: '挖起杆', type: 'wedges' },
  { icon: '⌇', title: '推杆', type: 'wedges' },
  { icon: '◈', title: '套杆对比', href: '/compare' },
];

const TOOLS: ToolItem[] = [
  { icon: '⚖️', title: '挥重计算器', sub: '输入杆身/杆头数据，推算目标挥重', href: '/swing-weight' },
  { icon: '📊', title: '杆身对比', sub: "Ventus / Kai'li / Tour AD 速查", href: '/compare' },
  { icon: '🤝', title: '握把选择', sub: '尺寸 · 材质 · 对挥重的影响', href: '/grip-select' },
];

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
                style={[styles.gridCard, isHighlight && styles.gridCardHighlight]}
                onPress={onPress}
                accessibilityRole="button"
                accessibilityLabel={item.title}
                activeOpacity={0.85}>
                <View style={styles.gridIconWrap}>
                  <Text style={[styles.gridIcon, isHighlight && styles.gridIconHighlight]}>{item.icon}</Text>
                </View>
                <Text style={[styles.gridTitle, isHighlight && styles.gridTitleHighlight]}>{item.title}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>配杆细节工具</Text>
        <View style={styles.toolList}>
          {TOOLS.map((item, i, arr) => (
            <TouchableOpacity
              key={item.title}
              style={[styles.toolItem, i < arr.length - 1 && styles.toolBorder]}
              onPress={() => router.push(item.href)}
              accessibilityRole="button"
              accessibilityLabel={item.title}
              activeOpacity={0.85}>
              <View style={styles.toolLeft}>
                <Text style={styles.toolIcon}>{item.icon}</Text>
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
const TEXT_TERTIARY = '#9ca3af';
const TEXT_DISABLED = '#d1d5db';
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
  gridCard: {
    width: '48%',
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
  gridIcon: { fontSize: 28, color: GREEN },
  gridIconHighlight: { color: WHITE },
  gridTitle: { fontSize: 14, fontWeight: '600', color: TEXT_PRIMARY, marginTop: 12, textAlign: 'center' },
  gridTitleHighlight: { color: WHITE },

  toolList: {
    backgroundColor: WHITE,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 10,
  },
  toolItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 14 },
  toolBorder: { borderBottomWidth: 0.5, borderBottomColor: LINE },
  toolLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  toolIcon: { fontSize: 20, width: 28 },
  toolTitle: { fontSize: 14, fontWeight: '500', color: TEXT_PRIMARY, marginBottom: 2 },
  toolSub: { fontSize: 11, color: TEXT_TERTIARY },
  arrow: { fontSize: 18, color: TEXT_DISABLED },
});
