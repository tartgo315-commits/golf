import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { Svg, Line, Circle, Path, Rect } from 'react-native-svg';
import { useRouter } from 'expo-router';

const GREEN = '#166534';
const GREEN_LIGHT = '#dcfce7';
const HEADER_BG = '#1a3d2b';

function DriverIcon({ color = GREEN }) {
  return <Svg width={36} height={36} viewBox="0 0 36 36"><Circle cx="10" cy="26" r="7" stroke={color} strokeWidth="1.5" fill="none"/><Line x1="15" y1="21" x2="30" y2="6" stroke={color} strokeWidth="1.5" strokeLinecap="round"/></Svg>;
}
function IronIcon({ color = GREEN }) {
  return <Svg width={36} height={36} viewBox="0 0 36 36"><Rect x="6" y="20" width="12" height="8" rx="2" stroke={color} strokeWidth="1.5" fill="none"/><Line x1="18" y1="24" x2="30" y2="6" stroke={color} strokeWidth="1.5" strokeLinecap="round"/></Svg>;
}
function FairwayIcon({ color = GREEN }) {
  return <Svg width={36} height={36} viewBox="0 0 36 36"><Circle cx="11" cy="25" r="5" stroke={color} strokeWidth="1.5" fill="none"/><Line x1="15" y1="21" x2="30" y2="6" stroke={color} strokeWidth="1.5" strokeLinecap="round"/></Svg>;
}
function WedgeIcon({ color = GREEN }) {
  return <Svg width={36} height={36} viewBox="0 0 36 36"><Path d="M6 28 L16 20 L20 28 Z" stroke={color} strokeWidth="1.5" fill="none" strokeLinejoin="round"/><Line x1="18" y1="22" x2="30" y2="6" stroke={color} strokeWidth="1.5" strokeLinecap="round"/></Svg>;
}
function PutterIcon({ color = GREEN }) {
  return <Svg width={36} height={36} viewBox="0 0 36 36"><Line x1="18" y1="6" x2="18" y2="26" stroke={color} strokeWidth="1.5" strokeLinecap="round"/><Line x1="10" y1="26" x2="26" y2="26" stroke={color} strokeWidth="1.5" strokeLinecap="round"/></Svg>;
}
function SetIcon({ color = GREEN }) {
  return <Svg width={36} height={36} viewBox="0 0 36 36"><Line x1="8" y1="28" x2="28" y2="8" stroke={color} strokeWidth="1.5" strokeLinecap="round"/><Line x1="28" y1="28" x2="8" y2="8" stroke={color} strokeWidth="1.5" strokeLinecap="round"/></Svg>;
}

export default function HomeScreen() {
  const router = useRouter();

  const clubs = [
    { label: '一号木', Icon: DriverIcon, route: '/quiz/driver', highlight: true },
    { label: '铁杆', Icon: IronIcon, route: '/quiz/iron', highlight: false },
    { label: '球道木', Icon: FairwayIcon, route: '/quiz/fairway', highlight: false },
    { label: '挖起杆', Icon: WedgeIcon, route: '/quiz/wedge', highlight: false },
    { label: '推杆', Icon: PutterIcon, route: '/quiz/putter', highlight: false },
    { label: '套杆推荐', Icon: SetIcon, route: '/(tabs)/compare', highlight: false },
  ];

  const tools = [
    { label: '挥重计算器', sub: '输入杆身/杆头数据，推算目标挥重', route: '/tools/swing-weight' },
    { label: '杆身对比', sub: "Ventus / Kai'li / Tour AD 速查", route: '/(tabs)/compare' },
    { label: '握把选择', sub: '尺寸 · 材质 · 对挥重的影响', route: '/tools/grip' },
  ];

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>配杆顾问</Text>
        <Text style={s.headerSub}>挥速 — · 差点 — · 身高 —</Text>
      </View>

      {/* 宫格 */}
      <View style={s.gridWrap}>
        {clubs.map((c) => (
          <View key={c.label} style={s.gridCell}>
            <TouchableOpacity
              style={[s.gridCard, c.highlight && s.gridCardHL]}
              onPress={() => router.push(c.route as any)}
            >
              <c.Icon color={c.highlight ? '#fff' : GREEN} />
              <Text style={[s.gridLabel, c.highlight && s.gridLabelHL]}>{c.label}</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {/* 工具 */}
      <View style={s.toolWrap}>
        <Text style={s.sectionLabel}>配杆细节工具</Text>
        {tools.map((t, i) => (
          <TouchableOpacity
            key={t.label}
            style={[s.toolRow, i < tools.length - 1 && s.toolBorder]}
            onPress={() => router.push(t.route as any)}
          >
            <View style={s.toolLeft}>
              <Text style={s.toolLabel}>{t.label}</Text>
              <Text style={s.toolSub}>{t.sub}</Text>
            </View>
            <Text style={s.arrow}>›</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },

  header: {
    backgroundColor: HEADER_BG,
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 16,
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 4 },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.65)' },

  gridWrap: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 10,
    justifyContent: 'space-between',
    rowGap: 8,
    alignContent: 'flex-start',
    backgroundColor: '#fff',
  },
  gridCell: {
    width: '48%',
  },
  gridCard: {
    width: '100%',
    aspectRatio: 1.4,
    backgroundColor: '#f0f4f0',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  gridCardHL: { backgroundColor: GREEN },
  gridLabel: { fontSize: 13, fontWeight: '600', color: '#1a3d2b' },
  gridLabelHL: { color: '#fff' },

  toolWrap: { backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  sectionLabel: { fontSize: 11, color: '#9ca3af', marginBottom: 6 },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  toolBorder: { borderBottomWidth: 0.5, borderBottomColor: '#f3f4f6' },
  toolLeft: { flex: 1 },
  toolLabel: { fontSize: 14, fontWeight: '500', color: '#111827', marginBottom: 2 },
  toolSub: { fontSize: 11, color: '#9ca3af' },
  arrow: { fontSize: 18, color: '#d1d5db' },
});
