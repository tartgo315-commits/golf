import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, StatusBar, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Svg, Line, Circle, Path, Rect } from 'react-native-svg';

import { FAVORITES_KEY, USER_PROFILE_KEY, type StoredUserProfile } from '@/lib/app-storage';
import { readJson } from '@/lib/local-storage';

const GREEN = '#166534';
const HEADER_BG = '#1a3d2b';
const WHITE = '#ffffff';
const BORDER = '#e5e7eb';
const LIGHT_GREEN = '#dcfce7';
const TEXT_DARK = '#111827';
const TEXT_MID = '#6b7280';
const TEXT_LIGHT = '#9ca3af';

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
  const [profile, setProfile] = useState<StoredUserProfile | null>(null);
  const [recentFavorites, setRecentFavorites] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      const p = readJson<StoredUserProfile | null>(USER_PROFILE_KEY, null);
      setProfile(p);
      const favorites = readJson<any[]>(FAVORITES_KEY, []);
      setRecentFavorites(Array.isArray(favorites) ? favorites.slice(0, 3) : []);
      return () => {};
    }, []),
  );

  const clubs = [
    { label: '一号木', Icon: DriverIcon, route: '/quiz/driver' },
    { label: '铁杆', Icon: IronIcon, route: '/quiz/iron' },
    { label: '球道木', Icon: FairwayIcon, route: '/quiz/fairway' },
    { label: '挖起杆', Icon: WedgeIcon, route: '/quiz/wedge' },
    { label: '推杆', Icon: PutterIcon, route: '/quiz/putter' },
    { label: '套杆推荐', Icon: SetIcon, route: '/(tabs)/compare' },
  ];

  const tools = [
    { label: '挥重计算器', sub: '杆身/杆头数据', route: '/tools/swing-weight' },
    { label: '杆身对比', sub: "Ventus / Kai'li", route: '/(tabs)/compare' },
    { label: '握把选择', sub: '尺寸·材质影响', route: '/tools/grip' },
    { label: '距离间距检查', sub: '球杆距离分布诊断', route: '/tools/distance-gap' },
  ];

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerRow}>
          <Text style={s.headerTitle}>配杆顾问</Text>
          <TouchableOpacity style={s.editBtn} onPress={() => router.push('/(tabs)/settings')}>
            <Text style={s.editBtnTxt}>编辑</Text>
          </TouchableOpacity>
        </View>
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={s.statLabel}>挥速</Text>
            <Text style={s.statValue}>{profile?.swingSpeedMph || '—'}</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statLabel}>身高</Text>
            <Text style={s.statValue}>{profile?.heightCm || '—'}</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statLabel}>差点</Text>
            <Text style={s.statValue}>{profile?.handicap || '—'}</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={s.aiCtaCard} onPress={() => router.push('/ai-advisor')}>
        <Text style={s.aiCtaHint}>推荐入口</Text>
        <Text style={s.aiCtaTitle}>AI 配杆顾问</Text>
        <Text style={s.aiCtaDesc}>基于你的档案，获取精准型号搭配建议</Text>
        <View style={s.aiCtaBtn}>
          <Text style={s.aiCtaBtnText}>开始咨询 →</Text>
        </View>
      </TouchableOpacity>

      {/* 宫格 */}
      <View style={s.gridWrap}>
        {clubs.map((c) => (
          <View key={c.label} style={s.gridCell}>
            <TouchableOpacity
              style={s.gridCard}
              onPress={() => router.push(c.route as any)}
            >
              <c.Icon color={GREEN} />
              <Text style={s.gridLabel}>{c.label}</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {/* 工具 */}
      <View style={s.toolWrap}>
        <Text style={s.sectionLabel}>配杆细节工具</Text>
        <View style={s.toolGrid}>
          {tools.map((t) => (
            <TouchableOpacity
              key={t.label}
              style={s.toolCard}
              onPress={() => router.push(t.route as any)}
            >
              <View style={s.toolIconBox} />
              <Text style={s.toolCardLabel}>{t.label}</Text>
              <Text style={s.toolCardSub}>{t.sub}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.sectionLabel}>最近收藏</Text>
        {recentFavorites.length ? (
          <View style={s.recentWrap}>
            {recentFavorites.map((item) => (
              <View key={item.id} style={s.recentRow}>
                <Text style={s.recentType}>{item.type || '推荐方案'}</Text>
                <Text style={s.recentModel} numberOfLines={1}>{item.model || '-'}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={s.recentEmpty}>
            <Text style={s.recentEmptyText}>暂无收藏，完成测试后可保存推荐方案。</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },

  header: {
    backgroundColor: HEADER_BG,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'web' ? 50 : (StatusBar.currentHeight || 36),
    paddingBottom: 10,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 4 },
  editBtn: {
    borderWidth: 1,
    borderColor: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 4,
  },
  editBtnTxt: { color: '#ffffff', fontSize: 12, fontWeight: '600' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  statCard: {
    width: '31%',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.6)' },
  statValue: { marginTop: 2, fontSize: 13, color: '#ffffff', fontWeight: '700' },

  aiCtaCard: {
    backgroundColor: '#166534',
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 8,
    marginTop: 8,
  },
  aiCtaHint: { color: 'rgba(255,255,255,0.6)', fontSize: 11 },
  aiCtaTitle: { color: '#ffffff', fontSize: 16, fontWeight: '700', marginTop: 2 },
  aiCtaDesc: { color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 4 },
  aiCtaBtn: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  aiCtaBtnText: { color: '#ffffff', fontSize: 12 },

  gridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 6,
    justifyContent: 'space-between',
    rowGap: 4,
    alignContent: 'flex-start',
    backgroundColor: '#fff',
    marginTop: 8,
  },
  gridCell: {
    width: '31%',
  },
  gridCard: {
    width: '100%',
    aspectRatio: 1.2,
    backgroundColor: '#f0f4f0',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  gridLabel: { fontSize: 13, fontWeight: '600', color: '#1a3d2b' },

  toolWrap: { backgroundColor: WHITE, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 20 },
  sectionLabel: { fontSize: 11, color: TEXT_LIGHT, marginBottom: 6 },
  toolGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingTop: 4,
    paddingBottom: 12,
  },
  toolCard: {
    width: '48%',
    backgroundColor: WHITE,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: BORDER,
    padding: 10,
  },
  toolIconBox: {
    width: 22,
    height: 22,
    backgroundColor: LIGHT_GREEN,
    borderRadius: 6,
    marginBottom: 6,
  },
  toolCardLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_DARK,
    marginBottom: 2,
  },
  toolCardSub: {
    fontSize: 10,
    color: TEXT_LIGHT,
  },
  recentWrap: {
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: BORDER,
    backgroundColor: WHITE,
  },
  recentRow: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f3f4f6',
  },
  recentType: {
    fontSize: 11,
    color: TEXT_MID,
    marginBottom: 2,
  },
  recentModel: {
    fontSize: 12,
    color: TEXT_DARK,
    fontWeight: '600',
  },
  recentEmpty: {
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: BORDER,
    backgroundColor: WHITE,
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  recentEmptyText: {
    fontSize: 11,
    color: TEXT_LIGHT,
  },
});
