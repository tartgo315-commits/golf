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

  useFocusEffect(useCallback(() => {
    AsyncStorage.getItem('handicapRecords').then(raw => {
      try { if (raw) setRecords(JSON.parse(raw)); } catch {}
    }).catch(() => {});
  }, []));

  const sorted = [...records].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const recent20 = sorted.slice(0, 20);
  const hcp = calcHandicap(records);

  // 近20场平均
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
      {/* ── Header ── */}
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

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        {/* ── 英雄卡：差点 ── */}
        <View style={s.heroCard}>
          <Text style={s.hcpLabel}>WHS 差点指数</Text>
          {hcp ? (
            <Text style={s.hcpNumber}>{hcp}</Text>
          ) : (
            <Text style={s.hcpPending}>待生成</Text>
          )}
          {!hcp && (
            <View style={s.needMorePill}>
              <Text style={s.needMoreText}>还需 {Math.max(0, 3 - records.length)} 场</Text>
            </View>
          )}
          <View style={s.progressLabelRow}>
            <Text style={s.progressLabel}>进度</Text>
            <Text style={s.progressLabel}>{records.length} / 3 场</Text>
          </View>
          <View style={s.progressTrack}>
            <View style={[s.progressFill, { width: `${progressRatio * 100}%` as any }]} />
          </View>
        </View>

        {/* ── 近20场平均 ── */}
        <View style={s.sectionRow}>
          <Text style={s.sectionLabel}>近20场平均</Text>
          <Text style={s.sectionRight}>共 {records.length} 场记录</Text>
        </View>
        <View style={s.statsRow}>
          <View style={s.statBox}>
            <Text style={s.statNum}>{avgScore ?? '--'}</Text>
            <Text style={s.statLbl}>平均总杆</Text>
            <Text style={s.statSub}>最佳 {bestScore ?? '--'}</Text>
          </View>
          <View style={s.statBox}>
            <Text style={s.statNum}>{avgPutts ?? '--'}</Text>
            <Text style={s.statLbl}>平均推杆</Text>
            <Text style={s.statSub}>
              {avgPutts ? `每洞 ${(avgPutts / 18).toFixed(1)}` : '暂无数据'}
            </Text>
          </View>
          <View style={s.statBox}>
            <Text style={[s.statNum, avgGir != null && { fontSize: 15 }]}>
              {avgGir != null ? `${avgGir}%` : '--'}
            </Text>
            <Text style={s.statLbl}>平均GIR</Text>
            {avgGir != null ? (
              <Text style={[s.statSub, { color: '#a3e635' }]}>↑ 果岭命中</Text>
            ) : (
              <Text style={s.statSub}>暂无数据</Text>
            )}
          </View>
        </View>

        {/* ── 快捷操作 ── */}
        <Text style={[s.sectionLabel, { paddingHorizontal: 18, marginBottom: 6 }]}>快捷操作</Text>
        <View style={s.actionRow}>
          <TouchableOpacity style={s.btnMain} onPress={() => router.push('/(tabs)/score' as any)}>
            <Text style={{ fontSize: 20, fontWeight: '900', color: '#0d1f10', lineHeight: 22 }}>+</Text>
            <Text style={{ fontSize: 15, fontWeight: '800', color: '#0d1f10', letterSpacing: -0.2 }}>记成绩</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.btnSec} onPress={() => router.push('/(tabs)/bet' as any)}>
            <Text style={{ fontSize: 16, color: 'rgba(255,255,255,0.8)' }}>¥</Text>
            <Text style={{ fontSize: 15, fontWeight: '700', color: 'rgba(255,255,255,0.9)' }}>赌球</Text>
          </TouchableOpacity>
        </View>

        {/* ── 最近成绩 ── */}
        <Text style={[s.sectionLabel, { paddingHorizontal: 18, marginTop: 4, marginBottom: 6 }]}>最近成绩</Text>
        {sorted.length === 0 ? (
          <Text style={s.emptyText}>暂无成绩，去记录第一轮吧</Text>
        ) : (
          sorted.slice(0, 3).map(r => (
            <TouchableOpacity key={r.id} style={s.roundCard}
              onPress={() => router.push(`/handicap/${r.id}` as any)}>
              <View style={{ flex: 1 }}>
                <Text style={s.courseName}>{r.courseName}</Text>
                <Text style={s.courseMeta}>{r.date} · {r.holes}洞</Text>
                <View style={s.chipsRow}>
                  <View style={[s.chip, s.chipGreen]}>
                    <Text style={[s.chipText, { color: '#a3e635' }]}>微差 {r.scoreDifferential.toFixed(1)}</Text>
                  </View>
                  <View style={s.chip}>
                    <Text style={s.chipText}>推杆 {r.totalPutts}</Text>
                  </View>
                  {r.greensInRegulation != null && r.holes ? (
                    <View style={[s.chip, s.chipGreen]}>
                      <Text style={[s.chipText, { color: '#a3e635' }]}>
                        GIR {Math.round(r.greensInRegulation / r.holes * 100)}%
                      </Text>
                    </View>
                  ) : null}
                  {r.fairwaysTotal ? (
                    <View style={s.chip}>
                      <Text style={s.chipText}>
                        球道 {Math.round(r.fairwaysHit / r.fairwaysTotal * 100)}%
                      </Text>
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
  scroll: { flex: 1, backgroundColor: '#0d1f10' },
  scrollContent: { paddingBottom: 32 },

  // Header
  header: { backgroundColor: '#0d1f10', paddingHorizontal: 18, paddingTop: 16, paddingBottom: 10 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  greetText: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 2 },
  nameText: { fontSize: 20, color: '#fff', fontWeight: '700', letterSpacing: -0.5 },
  profileBtn: { backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  profileBtnText: { fontSize: 11, color: 'rgba(255,255,255,0.85)' },

  // Hero card
  heroCard: { marginHorizontal: 14, marginBottom: 10, borderRadius: 20, padding: 18, backgroundColor: '#1a3820', borderWidth: 1, borderColor: 'rgba(163,230,53,0.15)' },
  hcpLabel: { fontSize: 10, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6 },
  hcpNumber: { fontSize: 52, color: '#fff', fontWeight: '800', letterSpacing: -3, lineHeight: 56, marginBottom: 4 },
  hcpPending: { fontSize: 24, color: 'rgba(255,255,255,0.6)', fontWeight: '700', marginBottom: 8 },
  needMorePill: { alignSelf: 'flex-start', backgroundColor: 'rgba(163,230,53,0.2)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3, marginBottom: 10 },
  needMoreText: { fontSize: 11, color: '#a3e635', fontWeight: '700' },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  progressLabel: { fontSize: 11, color: 'rgba(255,255,255,0.6)' },
  progressTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2 },
  progressFill: { height: 4, backgroundColor: '#a3e635', borderRadius: 2 },

  // Section labels
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, marginBottom: 6 },
  sectionLabel: { fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1 },
  sectionRight: { fontSize: 10, color: 'rgba(255,255,255,0.35)' },

  // Stats
  statsRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 14, marginBottom: 10 },
  statBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 10, alignItems: 'center' },
  statNum: { fontSize: 18, color: '#fff', fontWeight: '700', lineHeight: 22 },
  statLbl: { fontSize: 10, color: 'rgba(255,255,255,0.55)', marginTop: 3 },
  statSub: { fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 1 },

  // Action buttons
  actionRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, marginBottom: 10 },
  btnMain: { flex: 1, backgroundColor: '#a3e635', borderRadius: 14, height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  btnSec: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 14, height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },

  // Round cards
  roundCard: { marginHorizontal: 14, marginBottom: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', borderRadius: 16, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  courseName: { fontSize: 13, color: '#fff', fontWeight: '600' },
  courseMeta: { fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 1 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 },
  chip: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  chipGreen: { backgroundColor: 'rgba(163,230,53,0.12)' },
  chipText: { fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  scoreBadge: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(163,230,53,0.15)', borderWidth: 1.5, borderColor: 'rgba(163,230,53,0.4)', alignItems: 'center', justifyContent: 'center' },
  scoreBadgeText: { fontSize: 14, color: '#a3e635', fontWeight: '800' },

  emptyText: { textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13, paddingVertical: 24 },
});