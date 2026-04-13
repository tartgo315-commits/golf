import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface HandicapRecord {
  id: string;
  date: string;
  courseName: string;
  adjustedGrossScore: number;
  totalPutts: number;
  greensInRegulation: number;
  fairwaysHit: number;
  fairwaysTotal: number;
  holes: number;
  scoreDifferential: number;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return '早上好';
  if (h < 18) return '下午好';
  return '晚上好';
}

function daysSince(dateStr: string) {
  const d = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  return d === 0 ? '今天' : d === 1 ? '昨天' : `${d}天前`;
}

function calcHandicap(records: HandicapRecord[]) {
  if (records.length < 3) return null;
  const n = records.length <= 6 ? 1 : records.length <= 8 ? 2 :
    records.length <= 11 ? 3 : records.length <= 14 ? 4 :
    records.length <= 16 ? 5 : records.length <= 18 ? 6 : 8;
  const sorted = [...records].sort((a, b) => a.scoreDifferential - b.scoreDifferential).slice(0, n);
  return (sorted.reduce((s, r) => s + r.scoreDifferential, 0) / sorted.length * 0.96).toFixed(1);
}

export default function HomeScreen() {
  const [records, setRecords] = useState<HandicapRecord[]>([]);
  const [clubCount, setClubCount] = useState<number>(0);
  const [savedCount, setSavedCount] = useState<number>(0);

  useFocusEffect(useCallback(() => {
    AsyncStorage.getItem('handicapRecords').then(raw => {
      try { if (raw) setRecords(JSON.parse(raw)); } catch {}
    }).catch(() => {});
    AsyncStorage.getItem('savedClubs').then(raw => {
      try { if (raw) setClubCount(JSON.parse(raw).length); } catch {}
    }).catch(() => {});
    AsyncStorage.getItem('savedRecommendations').then(raw => {
      try { if (raw) setSavedCount(JSON.parse(raw).length); } catch {}
    }).catch(() => {});
  }, []));

  const sorted = [...records].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const recent20 = sorted.slice(0, 20);
  const hcp = calcHandicap(records);

  const avgScore = recent20.length
    ? Math.round(recent20.reduce((s, r) => s + r.adjustedGrossScore, 0) / recent20.length) : null;
  const bestScore = recent20.length
    ? Math.min(...recent20.map(r => r.adjustedGrossScore)) : null;
  const puttsRounds = recent20.filter(r => r.holes === 18);
  const avgPutts = puttsRounds.length
    ? Math.round(puttsRounds.reduce((s, r) => s + r.totalPutts, 0) / puttsRounds.length) : null;
  const girRounds = recent20.filter(r => r.greensInRegulation != null && r.holes);
  const avgGir = girRounds.length
    ? Math.round(girRounds.reduce((s, r) => s + (r.greensInRegulation / r.holes * 100), 0) / girRounds.length) : null;
  const progressRatio = Math.min(records.length / 3, 1);

  return (
    <View style={s.root}>
      <View style={s.header}>
        <View style={s.headerRow}>
          <View>
            <Text style={s.greetText}>{greeting()}</Text>
            <Text style={s.nameText}>Lee</Text>
          </View>
          <TouchableOpacity style={s.profileBtn} onPress={() => router.push('/settings' as any)}>
            <Text style={s.profileBtnText}>我的档案</Text>
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.snapshotRow}>
          <TouchableOpacity style={[s.snapshotCard, s.snapshotCardAccent]} onPress={() => router.push('/(tabs)/handicap' as any)}>
            <Text style={s.snapshotLabel}>WHS 差点</Text>
            <Text style={s.snapshotValue}>{hcp ?? '待生成'}</Text>
            {!hcp ? (
              <Text style={s.snapshotSub}>还需 {Math.max(0, 3 - records.length)} 场</Text>
            ) : (
              <View style={s.progressTrackMini}>
                <View style={[s.progressFillMini, { width: `${progressRatio * 100}%` as any }]} />
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={s.snapshotCard} onPress={() => router.push('/(tabs)/score' as any)}>
            <Text style={s.snapshotLabel}>近期均杆</Text>
            <Text style={s.snapshotValue}>{avgScore ?? '--'}</Text>
            <Text style={s.snapshotSub}>最佳 {bestScore ?? '--'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.snapshotCard} onPress={() => router.push('/(tabs)/score' as any)}>
            <Text style={s.snapshotLabel}>平均推杆</Text>
            <Text style={s.snapshotValue}>{avgPutts ?? '--'}</Text>
            <Text style={s.snapshotSub}>每洞 {avgPutts ? (avgPutts / 18).toFixed(1) : '--'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.snapshotCard} onPress={() => router.push('/(tabs)/score' as any)}>
            <Text style={s.snapshotLabel}>平均 GIR</Text>
            <Text style={s.snapshotValue}>{avgGir != null ? `${avgGir}%` : '--'}</Text>
            <Text style={s.snapshotSub}>{records.length} 场记录</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.snapshotCard} onPress={() => router.push('/(tabs)/fitting' as any)}>
            <Text style={s.snapshotLabel}>球杆库</Text>
            <Text style={s.snapshotValue}>{clubCount || '--'}</Text>
            <Text style={s.snapshotSub}>支球杆</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.snapshotCard, { marginRight: 14 }]} onPress={() => router.push('/(tabs)/fitting' as any)}>
            <Text style={s.snapshotLabel}>配杆收藏</Text>
            <Text style={s.snapshotValue}>{savedCount || '--'}</Text>
            <Text style={s.snapshotSub}>个方案</Text>
          </TouchableOpacity>
        </ScrollView>

        <Text style={s.sectionTitle}>快捷入口</Text>
        <View style={s.gridRow}>
          <TouchableOpacity style={[s.gridCell, { backgroundColor: '#a3e635' }]} onPress={() => router.push('/(tabs)/score' as any)}>
            <Text style={s.gridIcon}>📝</Text>
            <Text style={[s.gridLabel, { color: '#0d1f10' }]}>记成绩</Text>
            <Text style={[s.gridSub, { color: 'rgba(13,31,16,0.55)' }]}>新增一轮</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.gridCell} onPress={() => router.push('/(tabs)/fitting' as any)}>
            <Text style={s.gridIcon}>🤖</Text>
            <Text style={s.gridLabel}>AI 配杆</Text>
            <Text style={s.gridSub}>智能推荐</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.gridCell} onPress={() => router.push('/(tabs)/fitting' as any)}>
            <Text style={s.gridIcon}>🏌️</Text>
            <Text style={s.gridLabel}>球杆库</Text>
            <Text style={s.gridSub}>{clubCount ? `${clubCount} 支` : '管理球杆'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.gridCell} onPress={() => router.push('/(tabs)/bet' as any)}>
            <Text style={s.gridIcon}>⛳</Text>
            <Text style={s.gridLabel}>球场设定</Text>
            <Text style={s.gridSub}>差点配置</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.sectionTitle}>配杆中心</Text>
        <View style={s.fittingList}>
          <TouchableOpacity style={s.fittingCard} onPress={() => router.push('/(tabs)/fitting' as any)}>
            <Text style={s.fittingIcon}>🤖</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.fittingLabel}>AI 配杆顾问</Text>
              <Text style={s.fittingSub}>基于档案的型号搭配建议</Text>
            </View>
            <Text style={s.fittingArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.fittingCard} onPress={() => router.push('/(tabs)/fitting' as any)}>
            <Text style={s.fittingIcon}>📋</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.fittingLabel}>球杆推荐测验</Text>
              <Text style={s.fittingSub}>一号木、铁杆、木杆等问卷入口</Text>
            </View>
            <Text style={s.fittingArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.fittingCard} onPress={() => router.push('/(tabs)/fitting' as any)}>
            <Text style={s.fittingIcon}>🔧</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.fittingLabel}>配杆工具</Text>
              <Text style={s.fittingSub}>挥重、握把、距离间距</Text>
            </View>
            <Text style={s.fittingArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={s.sectionRow}>
          <Text style={s.sectionTitle}>最近成绩</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/score' as any)}>
            <Text style={s.seeAll}>查看全部 ›</Text>
          </TouchableOpacity>
        </View>
        {sorted.length === 0 ? (
          <Text style={s.emptyText}>暂无成绩，去记录第一轮吧</Text>
        ) : (
          sorted.slice(0, 3).map(r => (
            <TouchableOpacity key={r.id} style={s.roundCard} onPress={() => router.push(`/handicap/${r.id}` as any)}>
              <View style={{ flex: 1 }}>
                <Text style={s.courseName}>{r.courseName}</Text>
                <Text style={s.courseMeta}>{r.date} · {r.holes}洞 · {daysSince(r.date)}</Text>
                <View style={s.chipsRow}>
                  <View style={[s.chip, s.chipGreen]}>
                    <Text style={[s.chipText, { color: '#a3e635' }]}>微差 {r.scoreDifferential.toFixed(1)}</Text>
                  </View>
                  <View style={s.chip}>
                    <Text style={s.chipText}>推杆 {r.totalPutts}</Text>
                  </View>
                  {r.greensInRegulation != null && r.holes ? (
                    <View style={[s.chip, s.chipGreen]}>
                      <Text style={[s.chipText, { color: '#a3e635' }]}>GIR {Math.round(r.greensInRegulation / r.holes * 100)}%</Text>
                    </View>
                  ) : null}
                  {r.fairwaysTotal ? (
                    <View style={s.chip}>
                      <Text style={s.chipText}>球道 {Math.round(r.fairwaysHit / r.fairwaysTotal * 100)}%</Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <View style={s.scoreBadge}>
                <Text style={s.scoreBadgeText}>{r.adjustedGrossScore}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d1f10' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  header: { backgroundColor: '#0d1f10', paddingHorizontal: 18, paddingTop: 16, paddingBottom: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  greetText: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 2 },
  nameText: { fontSize: 20, color: '#fff', fontWeight: '700', letterSpacing: -0.5 },
  profileBtn: { backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  profileBtnText: { fontSize: 11, color: 'rgba(255,255,255,0.85)' },
  snapshotRow: { paddingLeft: 14, paddingBottom: 4, gap: 8, paddingTop: 2 },
  snapshotCard: { width: 108, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 18, padding: 14 },
  snapshotCardAccent: { backgroundColor: '#1a3820', borderColor: 'rgba(163,230,53,0.3)' },
  snapshotLabel: { fontSize: 9, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  snapshotValue: { fontSize: 22, color: '#fff', fontWeight: '800', letterSpacing: -0.5, lineHeight: 26 },
  snapshotSub: { fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 4 },
  progressTrackMini: { height: 3, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, marginTop: 8 },
  progressFillMini: { height: 3, backgroundColor: '#a3e635', borderRadius: 2 },
  sectionTitle: { fontSize: 10, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 1.2, paddingHorizontal: 18, marginTop: 18, marginBottom: 10 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, marginTop: 18, marginBottom: 10 },
  seeAll: { fontSize: 12, color: '#a3e635' },
  gridRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 14, gap: 8 },
  gridCell: { width: '47.5%', backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 18, padding: 16 },
  gridIcon: { fontSize: 26, marginBottom: 8 },
  gridLabel: { fontSize: 15, fontWeight: '700', color: '#fff', letterSpacing: -0.2 },
  gridSub: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 3 },
  fittingList: { paddingHorizontal: 14, gap: 6 },
  fittingCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', borderRadius: 14, padding: 13, gap: 12 },
  fittingIcon: { fontSize: 20 },
  fittingLabel: { fontSize: 13, color: '#fff', fontWeight: '600' },
  fittingSub: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  fittingArrow: { fontSize: 20, color: 'rgba(255,255,255,0.2)', fontWeight: '300' },
  roundCard: { marginHorizontal: 14, marginBottom: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', borderRadius: 16, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  courseName: { fontSize: 13, color: '#fff', fontWeight: '600' },
  courseMeta: { fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 1 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 },
  chip: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  chipGreen: { backgroundColor: 'rgba(163,230,53,0.12)' },
  chipText: { fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  scoreBadge: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(163,230,53,0.15)', borderWidth: 1.5, borderColor: 'rgba(163,230,53,0.4)', alignItems: 'center', justifyContent: 'center' },
  scoreBadgeText: { fontSize: 14, color: '#a3e635', fontWeight: '800' },
  emptyText: { textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13, paddingVertical: 28 },
});
