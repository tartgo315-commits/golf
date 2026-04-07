import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { ClubCategory } from '@/data/golfKnowledge';

type GridItem = {
  icon: string;
  title: string;
  sub: string;
  type: ClubCategory;
};

type ToolItem = {
  icon: string;
  title: string;
  sub: string;
  href: '/swing-weight' | '/compare' | '/grip-select';
};

const GRID: GridItem[] = [
  { icon: '🏌️', title: '一号木', sub: '杆身 · 杆长 · 挥重', type: 'driver' },
  { icon: '🔧', title: '铁杆', sub: '钢/碳杆身 · 硬度', type: 'irons' },
  { icon: '🌿', title: '球道木 / 铁木', sub: '弹道 · 接口规格', type: 'fairway' },
  { icon: '🚩', title: '挖起杆 / 推杆', sub: '杆面角 · 配重', type: 'wedges' },
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
      <View style={styles.headerCard}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>你好，Golfer 👋</Text>
            <Text style={styles.title}>配杆顾问</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarIcon}>⛳</Text>
          </View>
        </View>
        <View style={styles.profileBar}>
          <Text style={styles.profileText}>挥速 — · 差点 — · 身高 —</Text>
          <TouchableOpacity
            onPress={() => router.push('/profile-setup')}
            accessibilityRole="button"
            accessibilityLabel="编辑档案"
            activeOpacity={0.85}>
            <Text style={styles.editBtn}>编辑</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.sectionLabel}>选择球杆类型开始配杆</Text>
      <View style={styles.grid}>
        {GRID.map((item) => (
          <TouchableOpacity
            key={item.title}
            style={styles.gridCard}
            onPress={() => router.push({ pathname: '/quiz/[type]', params: { type: item.type } })}
            accessibilityRole="button"
            accessibilityLabel={`${item.title} 问卷`}
            activeOpacity={0.85}>
            <Text style={styles.gridIcon}>{item.icon}</Text>
            <Text style={styles.gridTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.gridSub} numberOfLines={2}>
              {item.sub}
            </Text>
          </TouchableOpacity>
        ))}
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
    </ScrollView>
  );
}

const GREEN = '#166534';
const GREEN_LIGHT = '#dcfce7';
const WHITE = '#ffffff';
const BG = '#f3f4f6';
const BORDER = '#e5e7eb';
const TEXT_PRIMARY = '#111827';
const TEXT_SECONDARY = '#6b7280';
const TEXT_TERTIARY = '#9ca3af';
const TEXT_DISABLED = '#d1d5db';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  content: { padding: 16, paddingBottom: 32 },

  headerCard: {
    backgroundColor: WHITE,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: BORDER,
    padding: 16,
    marginBottom: 16,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  greeting: { fontSize: 13, color: TEXT_SECONDARY, marginBottom: 2 },
  title: { fontSize: 22, fontWeight: '600', color: TEXT_PRIMARY },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: GREEN_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarIcon: { fontSize: 26 },
  profileBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: GREEN_LIGHT,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  profileText: { fontSize: 13, color: GREEN, fontWeight: '500', flex: 1, paddingRight: 8 },
  editBtn: {
    fontSize: 12,
    color: GREEN,
    borderWidth: 1,
    borderColor: GREEN,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },

  sectionLabel: { fontSize: 12, color: TEXT_SECONDARY, marginBottom: 8, marginLeft: 2 },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  gridCard: {
    width: '48%',
    backgroundColor: WHITE,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: BORDER,
    padding: 14,
  },
  gridIcon: { fontSize: 26, marginBottom: 8 },
  gridTitle: { fontSize: 14, fontWeight: '600', color: TEXT_PRIMARY, marginBottom: 2 },
  gridSub: { fontSize: 11, color: TEXT_TERTIARY },

  toolList: {
    backgroundColor: WHITE,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: BORDER,
    overflow: 'hidden',
    marginBottom: 16,
  },
  toolItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 14 },
  toolBorder: { borderBottomWidth: 0.5, borderBottomColor: BG },
  toolLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  toolIcon: { fontSize: 20, width: 28 },
  toolTitle: { fontSize: 14, fontWeight: '500', color: TEXT_PRIMARY, marginBottom: 2 },
  toolSub: { fontSize: 11, color: TEXT_TERTIARY },
  arrow: { fontSize: 18, color: TEXT_DISABLED },
});
