import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const DEFAULT_CLUBS = [
  { id: '1w',  name: '1号木',   type: 'wood',   shaftLength: '', shaftWeight: '', flex: '', swingSpeed: '', distance: '', grip: '', active: true },
  { id: '3w',  name: '3号木',   type: 'wood',   shaftLength: '', shaftWeight: '', flex: '', swingSpeed: '', distance: '', grip: '', active: true },
  { id: '5w',  name: '5号木',   type: 'wood',   shaftLength: '', shaftWeight: '', flex: '', swingSpeed: '', distance: '', grip: '', active: true },
  { id: '4i',  name: '4铁',     type: 'iron',   shaftLength: '', shaftWeight: '', flex: '', swingSpeed: '', distance: '', grip: '', active: true },
  { id: '5i',  name: '5铁',     type: 'iron',   shaftLength: '', shaftWeight: '', flex: '', swingSpeed: '', distance: '', grip: '', active: true },
  { id: '6i',  name: '6铁',     type: 'iron',   shaftLength: '', shaftWeight: '', flex: '', swingSpeed: '', distance: '', grip: '', active: true },
  { id: '7i',  name: '7铁',     type: 'iron',   shaftLength: '', shaftWeight: '', flex: '', swingSpeed: '', distance: '', grip: '', active: true },
  { id: '8i',  name: '8铁',     type: 'iron',   shaftLength: '', shaftWeight: '', flex: '', swingSpeed: '', distance: '', grip: '', active: true },
  { id: '9i',  name: '9铁',     type: 'iron',   shaftLength: '', shaftWeight: '', flex: '', swingSpeed: '', distance: '', grip: '', active: true },
  { id: 'pi',  name: 'P铁',     type: 'iron',   shaftLength: '', shaftWeight: '', flex: '', swingSpeed: '', distance: '', grip: '', active: true },
  { id: 'w52', name: '52度挖起杆', type: 'wedge', shaftLength: '', shaftWeight: '', flex: '', swingSpeed: '', distance: '', grip: '', active: true },
  { id: 'w56', name: '56度挖起杆', type: 'wedge', shaftLength: '', shaftWeight: '', flex: '', swingSpeed: '', distance: '', grip: '', active: true },
  { id: 'w60', name: '60度挖起杆', type: 'wedge', shaftLength: '', shaftWeight: '', flex: '', swingSpeed: '', distance: '', grip: '', active: true },
  { id: 'pt',  name: '推杆',    type: 'putter', shaftLength: '', shaftWeight: '', flex: '', swingSpeed: '', distance: '', grip: '', active: true },
  { id: 'rng', name: '测距仪',  type: 'accessory', shaftLength: '', shaftWeight: '', flex: '', swingSpeed: '', distance: '', grip: '', active: true },
  { id: 'ball',name: '惯用球',  type: 'accessory', shaftLength: '', shaftWeight: '', flex: '', swingSpeed: '', distance: '', grip: '', active: true },
];

const FIELDS = [
  { key: 'flex',       label: '硬度' },
  { key: 'swingSpeed', label: '挥速(mph)' },
  { key: 'distance',   label: '落点距离(m)' },
  { key: 'grip',       label: '握把型号' },
];

const TYPE_LABELS: Record<string, string> = {
  wood: '木杆',
  iron: '铁杆',
  wedge: '挖起杆',
  putter: '推杆',
  accessory: '配件',
};

export default function MyBagScreen() {
  const [clubs, setClubs] = useState(DEFAULT_CLUBS);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('myBagClubs').then(raw => {
      if (raw) {
        try {
          const stored = JSON.parse(raw);
          // 合并：保留默认结构，用存储数据覆盖
          const merged = DEFAULT_CLUBS.map(d => {
            const s = stored.find((x: any) => x.id === d.id) || {};
            const legacyShaft = (s as any).shaft as string | undefined;
            return {
              ...d,
              ...s,
              shaftLength: (s as any).shaftLength ?? legacyShaft ?? d.shaftLength,
              shaftWeight: (s as any).shaftWeight ?? d.shaftWeight,
            };
          });
          setClubs(merged);
        } catch {}
      }
    });
  }, []);

  const activeCount = clubs.filter(c => c.type !== 'accessory' && c.active).length;
  const showActiveToggle = activeCount > 14 || clubs.some(c => !c.active);

  const update = (id: string, key: string, val: string | boolean) => {
    setClubs(prev => prev.map(c => c.id === id ? { ...c, [key]: val } : c));
    setSaved(false);
  };

  const save = async () => {
    await AsyncStorage.setItem('myBagClubs', JSON.stringify(clubs));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // 按类型分组
  const groups = ['wood', 'iron', 'wedge', 'putter', 'accessory'];

  return (
    <View style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>‹ 返回</Text>
        </TouchableOpacity>
        <Text style={s.title}>🏌️ 我的球包</Text>
        <TouchableOpacity onPress={save} style={s.saveBtn}>
          <Text style={s.saveBtnText}>{saved ? '已保存✓' : '保存'}</Text>
        </TouchableOpacity>
      </View>

      {/* 球包状态栏 */}
      <View style={s.statusBar}>
        <Text style={s.statusText}>
          球杆数量：<Text style={[s.statusNum, activeCount > 14 && { color: '#ff8080' }]}>{activeCount}</Text> / 14
        </Text>
        {activeCount > 14 && (
          <Text style={s.statusWarn}>超出限制！请将部分球杆设为备用</Text>
        )}
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        {groups.map(type => {
          const groupClubs = clubs.filter(c => c.type === type);
          return (
            <View key={type} style={s.group}>
              <Text style={s.groupTitle}>{TYPE_LABELS[type]}</Text>
              {groupClubs.map(club => (
                <View key={club.id} style={[
                  s.clubCard,
                  !club.active && s.clubCardInactive
                ]}>
                  {/* 球杆头部行 */}
                  <TouchableOpacity
                    style={s.clubRow}
                    onPress={() => setExpanded(expanded === club.id ? null : club.id)}
                  >
                    <Text style={[s.clubName, !club.active && { color: 'rgba(255,255,255,0.35)' }]}>
                      {club.name}
                    </Text>
                    <View style={s.clubRowRight}>
                      {/* 启用/备用 切换按钮（超过14根或有备用时显示） */}
                      {(showActiveToggle && club.type !== 'accessory') && (
                        <TouchableOpacity
                          style={[s.toggleBtn, club.active ? s.toggleActive : s.toggleInactive]}
                          onPress={() => update(club.id, 'active', !club.active)}
                        >
                          <Text style={[s.toggleText, !club.active && { color: 'rgba(255,255,255,0.4)' }]}>
                            {club.active ? '启用' : '备用'}
                          </Text>
                        </TouchableOpacity>
                      )}
                      <Text style={s.expandIcon}>{expanded === club.id ? '▲' : '▼'}</Text>
                    </View>
                  </TouchableOpacity>

                  {/* 展开后的数据字段 */}
                  {expanded === club.id && (
                    <View style={s.fieldsBox}>
                      {club.type === 'accessory' ? (
                        // 配件只显示型号/品牌字段
                        <View style={s.fieldRow}>
                          <Text style={s.fieldLabel}>型号/品牌</Text>
                          <TextInput
                            style={s.fieldInput}
                            value={club.grip}
                            onChangeText={v => update(club.id, 'grip', v)}
                            placeholder="输入型号或品牌"
                            placeholderTextColor="rgba(255,255,255,0.2)"
                          />
                        </View>
                      ) : (
                        <>
                          <View style={s.shaftPairRow}>
                            <View style={s.shaftHalf}>
                              <Text style={s.fieldLabelSmall}>杆身长度</Text>
                              <TextInput
                                style={s.fieldInputHalf}
                                value={(club as any).shaftLength ?? ''}
                                onChangeText={v => update(club.id, 'shaftLength', v)}
                                placeholder="如 45&quot; / 115cm"
                                placeholderTextColor="rgba(255,255,255,0.2)"
                              />
                            </View>
                            <View style={s.shaftHalf}>
                              <Text style={s.fieldLabelSmall}>杆身重量</Text>
                              <TextInput
                                style={s.fieldInputHalf}
                                value={(club as any).shaftWeight ?? ''}
                                onChangeText={v => update(club.id, 'shaftWeight', v)}
                                placeholder="如 65g"
                                placeholderTextColor="rgba(255,255,255,0.2)"
                              />
                            </View>
                          </View>
                          {FIELDS.map(f => (
                            <View key={f.key} style={s.fieldRow}>
                              <Text style={s.fieldLabel}>{f.label}</Text>
                              <TextInput
                                style={s.fieldInput}
                                value={(club as any)[f.key]}
                                onChangeText={v => update(club.id, f.key, v)}
                                placeholder={`输入${f.label}`}
                                placeholderTextColor="rgba(255,255,255,0.2)"
                                keyboardType={['swingSpeed', 'distance'].includes(f.key) ? 'numeric' : 'default'}
                              />
                            </View>
                          ))}
                        </>
                      )}
                    </View>
                  )}
                </View>
              ))}
            </View>
          );
        })}

        <TouchableOpacity style={s.saveBottomBtn} onPress={save}>
          <Text style={s.saveBottomBtnText}>{saved ? '✓ 已保存' : '保存球包数据'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d1f10' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 16, paddingBottom: 10 },
  backBtn: { width: 60 },
  backText: { fontSize: 16, color: '#a3e635', fontWeight: '600' },
  title: { fontSize: 17, color: '#fff', fontWeight: '700' },
  saveBtn: { backgroundColor: 'rgba(163,230,53,0.15)', borderWidth: 1, borderColor: 'rgba(163,230,53,0.4)', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 5 },
  saveBtnText: { fontSize: 12, color: '#a3e635', fontWeight: '600' },

  statusBar: { marginHorizontal: 14, marginBottom: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
  statusText: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  statusNum: { color: '#a3e635', fontWeight: '700' },
  statusWarn: { fontSize: 11, color: '#ff8080', marginTop: 2 },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 14, paddingBottom: 40 },

  group: { marginBottom: 16 },
  groupTitle: { fontSize: 9, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6, marginLeft: 2 },

  clubCard: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', borderRadius: 14, marginBottom: 6, overflow: 'hidden' },
  clubCardInactive: { backgroundColor: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.05)' },
  clubRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 13 },
  clubName: { fontSize: 14, color: '#fff', fontWeight: '600' },
  clubRowRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  toggleBtn: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1 },
  toggleActive: { backgroundColor: 'rgba(163,230,53,0.15)', borderColor: 'rgba(163,230,53,0.4)' },
  toggleInactive: { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' },
  toggleText: { fontSize: 11, color: '#a3e635', fontWeight: '600' },

  expandIcon: { fontSize: 10, color: 'rgba(255,255,255,0.3)' },

  fieldsBox: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12, gap: 8 },
  shaftPairRow: { flexDirection: 'row', gap: 10, marginBottom: 2 },
  shaftHalf: { flex: 1, minWidth: 0 },
  fieldLabelSmall: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 4 },
  fieldInputHalf: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 13,
    color: '#fff',
  },
  fieldRow: { flexDirection: 'row', alignItems: 'center' },
  fieldLabel: { width: 90, fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  fieldInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 13, color: '#fff' },

  saveBottomBtn: { backgroundColor: '#a3e635', borderRadius: 14, height: 50, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  saveBottomBtnText: { fontSize: 15, fontWeight: '700', color: '#0d1f10' },
});
