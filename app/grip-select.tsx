import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const GREEN = '#166534';
const GREEN_LIGHT = '#dcfce7';

const GRIPS = [
  {
    id: 'std',
    name: '标准口径',
    size: '外径约 0.580"–0.600"',
    material: '橡胶 / 棉线 / 混合',
    sw: '相对基准约 0',
    feel: '多数球友默认选择，操控反馈直接。',
  },
  {
    id: 'mid',
    name: '中号 (Midsize)',
    size: '外径 +1/16" 左右',
    material: '橡胶为主',
    sw: '约 +0.5～1 挥重点',
    feel: '减手腕动作，适合易紧张型握杆。',
  },
  {
    id: 'jumbo',
    name: '加粗 (Jumbo / Oversize)',
    size: '外径明显加粗',
    material: '橡胶 / 轻量化发泡',
    sw: '约 +1～2 挥重点',
    feel: '更减握压；需配合总重与杆长再调挥重。',
  },
  {
    id: 'cord',
    name: '棉线握把',
    size: '同口径下略厚于光面',
    material: '橡胶 + 棉线',
    sw: '略增或接近标准（依品牌）',
    feel: '雨天防滑好，手感偏「糙」、反馈清晰。',
  },
  {
    id: 'light',
    name: '轻量握把',
    size: '同尺寸下重量更轻',
    material: '发泡 / 超轻橡胶',
    sw: '约 −1～2 挥重点',
    feel: '减轻握把端重量，杆头感变「重」；常配合杆头配重微调。',
  },
] as const;

export default function GripSelectScreen() {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(GRIPS[0].id);

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: '握把选择', headerBackTitle: '返回' }} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.lead}>按尺寸、材质与重量，快速对照对挥重与手感的影响（示意说明，选配以试打为准）。</Text>

      {GRIPS.map((g) => {
        const expanded = open === g.id;
        return (
          <View key={g.id} style={styles.card}>
            <Pressable
              onPress={() => setOpen(expanded ? null : g.id)}
              style={({ pressed }) => [styles.cardHead, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityState={{ expanded }}>
              <View style={styles.cardHeadText}>
                <Text style={styles.cardTitle}>{g.name}</Text>
                <Text style={styles.cardSub}>{g.size}</Text>
              </View>
              <Text style={styles.chev}>{expanded ? '▲' : '▼'}</Text>
            </Pressable>
            {expanded && (
              <View style={styles.cardBody}>
                <Row k="材质" v={g.material} />
                <Row k="挥重影响" v={g.sw} />
                <Row k="手感" v={g.feel} />
              </View>
            )}
          </View>
        );
      })}

      <View style={styles.tipBox}>
        <Text style={styles.tipTitle}>配杆提示</Text>
        <Text style={styles.tipBody}>
          换粗握把或加重握把会改变平衡点与总重；若要保持相近挥重，可配合杆头配重、杆长或杆身重量微调。建议与「挥重计算器」对照使用。
        </Text>
      </View>

      <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
        <Text style={styles.backTxt}>返回</Text>
      </Pressable>
      </ScrollView>
    </View>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowK}>{k}</Text>
      <Text style={styles.rowV}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f3f4f6' },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40, flexGrow: 1 },
  lead: { fontSize: 14, color: '#4b5563', lineHeight: 22, marginBottom: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: '#e5e7eb',
    marginBottom: 10,
    overflow: 'hidden',
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  cardHeadText: { flex: 1, paddingRight: 8 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 4 },
  cardSub: { fontSize: 12, color: '#9ca3af' },
  chev: { fontSize: 12, color: '#9ca3af' },
  cardBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#f3f4f6',
  },
  row: { marginTop: 10 },
  rowK: { fontSize: 11, color: '#9ca3af', marginBottom: 2 },
  rowV: { fontSize: 13, color: '#374151', lineHeight: 20 },
  tipBox: {
    marginTop: 8,
    backgroundColor: GREEN_LIGHT,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(22,101,52,0.15)',
  },
  tipTitle: { fontSize: 13, fontWeight: '700', color: GREEN, marginBottom: 6 },
  tipBody: { fontSize: 12, color: '#365314', lineHeight: 18 },
  back: {
    marginTop: 20,
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: GREEN,
  },
  backTxt: { color: GREEN, fontWeight: '700', fontSize: 15 },
  pressed: { opacity: 0.9 },
});
