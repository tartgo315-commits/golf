import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { type Href, router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TopTabNav } from '@/components/top-tab-nav';
import { USER_PROFILE_KEY, type StoredUserProfile } from '@/lib/app-storage';
import { readJson } from '@/lib/local-storage';

interface HandicapRecord {
  id: string;
  date: string;
  courseName: string;
  adjustedGrossScore: number;
  scoreDifferential: number;
  holes: number;
}

type ProfileJson = StoredUserProfile & { nickname?: string; name?: string };

function calcHandicap(records: HandicapRecord[]): string {
  if (records.length < 3) return '--';
  const sorted = [...records]
    .sort((a, b) => a.scoreDifferential - b.scoreDifferential)
    .slice(0, Math.min(8, Math.floor(records.length * 0.4) + 1));
  const avg = sorted.reduce((s, r) => s + r.scoreDifferential, 0) / sorted.length;
  return (avg * 0.96).toFixed(1);
}

function daysSince(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (diff === 0) return '今天';
  if (diff === 1) return '昨天';
  return `${diff} 天前`;
}

function thisMonthCount(records: HandicapRecord[]): number {
  const now = new Date();
  return records.filter((r) => {
    const d = new Date(r.date);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;
}

function lastRoundSubphrase(dateStr: string): string {
  return daysSince(dateStr).replace(' 天前', '天前');
}

function greetingPrefixCn(): string {
  const h = new Date().getHours();
  if (h < 12) return '早上好';
  if (h < 18) return '下午好';
  return '晚上好';
}

function formatClock(d: Date): string {
  let h = d.getHours() % 12;
  if (h === 0) h = 12;
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

function holesLabelCn(holes: number | string | undefined): string {
  const n = typeof holes === 'number' ? holes : Number(holes);
  const v = Number.isFinite(n) && n > 0 ? n : 18;
  return `${v} 洞`;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [records, setRecords] = useState<HandicapRecord[]>([]);
  const [firstName, setFirstName] = useState('');
  const [clock, setClock] = useState(() => new Date());

  useFocusEffect(
    useCallback(() => {
      const profile = readJson<ProfileJson | null>(USER_PROFILE_KEY, null);
      const name = profile?.nickname?.trim() || profile?.name?.trim() || '';
      setFirstName(name);

      AsyncStorage.getItem('handicapRecords')
        .then((raw) => {
          if (!raw) {
            setRecords([]);
            return;
          }
          try {
            const parsed: unknown = JSON.parse(raw);
            setRecords(Array.isArray(parsed) ? (parsed as HandicapRecord[]) : []);
          } catch {
            setRecords([]);
          }
        })
        .catch(() => {
          setRecords([]);
        });

      setClock(new Date());
      return () => {};
    }, []),
  );

  const sorted = [...records].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const latest = sorted[0];
  const hcp = calcHandicap(records);
  const monthCount = thisMonthCount(records);

  const displayName = firstName || '球友';
  const hcpSub =
    hcp === '--'
      ? '差点待计算'
      : `差点 ${hcp} · 最近一轮${latest ? lastRoundSubphrase(latest.date) : '—'}`;

  const statHcp = hcp === '--' ? '—' : hcp;
  const statRecent = latest ? String(latest.adjustedGrossScore) : '—';
  const statMonth = records.length === 0 ? '—' : String(monthCount);

  const padTop = Math.max(insets.top, 8);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: padTop }]}>
        <View style={styles.statusRow}>
          <Text style={styles.statusTime}>{formatClock(clock)}</Text>
          <Text style={styles.statusBrand}>⛳ GolfMate</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/settings' as Href)} hitSlop={10} accessibilityRole="button">
            <Text style={styles.statusDots}>设置</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.greeting}>
          {greetingPrefixCn()}，{displayName}
        </Text>
        <Text style={styles.subGreeting}>{hcpSub}</Text>
      </View>

      <TopTabNav />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} bounces={false}>
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{statHcp}</Text>
            <Text style={styles.statLbl}>差点</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{statRecent}</Text>
            <Text style={styles.statLbl}>最近成绩</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{statMonth}</Text>
            <Text style={styles.statLbl}>本月轮数</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>快捷操作</Text>
        <TouchableOpacity style={styles.btnPrimary} onPress={() => router.push('/(tabs)/score' as Href)} activeOpacity={0.88}>
          <Text style={styles.btnPrimaryText}>＋ 开始记成绩</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnGhost} onPress={() => router.push('/(tabs)/bet' as Href)} activeOpacity={0.88}>
          <Text style={styles.btnGhostText}>设置赌球游戏</Text>
        </TouchableOpacity>

        <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>最近成绩</Text>
        {sorted.length === 0 ? (
          <Text style={styles.empty}>暂无成绩，去记录第一轮吧</Text>
        ) : (
          sorted.slice(0, 3).map((r) => (
            <TouchableOpacity
              key={r.id}
              style={styles.scoreCard}
              onPress={() => router.push(`/handicap/${r.id}` as Href)}
              activeOpacity={0.88}>
              <View style={styles.scoreCardLeft}>
                <Text style={styles.courseName}>{r.courseName}</Text>
                <Text style={styles.scoreSub}>
                  {daysSince(r.date)} · {holesLabelCn(r.holes)}
                </Text>
              </View>
              <View style={styles.scoreBadge}>
                <Text style={styles.scoreBadgeText}>{r.adjustedGrossScore}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const GREEN = '#1a3a1a';
const GREEN_ACCENT = '#1a6b2e';
const BG_PAGE = '#f5f5f0';
const WHITE = '#ffffff';
const BORDER_LIGHT = '#e8e8e8';
const TEXT_MAIN = '#1a1a1a';
const TEXT_MUTED = '#888888';
const AMBER_BG = '#faeeda';
const AMBER_TEXT = '#854f0b';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG_PAGE },

  header: {
    backgroundColor: GREEN,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
  },
  statusTime: { color: WHITE, fontSize: 11, opacity: 0.85, minWidth: 40 },
  statusBrand: { color: WHITE, fontSize: 13, fontWeight: '500' },
  statusDots: { color: WHITE, fontSize: 13, opacity: 0.95, minWidth: 40, textAlign: 'right' },

  greeting: {
    color: WHITE,
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  subGreeting: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginTop: 4,
  },

  scrollView: { flex: 1, backgroundColor: BG_PAGE },
  scrollContent: { paddingBottom: 32 },

  statsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
  },
  statBox: {
    flex: 1,
    backgroundColor: WHITE,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER_LIGHT,
  },
  statVal: {
    fontSize: 20,
    fontWeight: '600',
    color: TEXT_MAIN,
  },
  statLbl: {
    fontSize: 11,
    color: TEXT_MUTED,
    marginTop: 2,
  },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#999999',
    letterSpacing: 0.6,
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  sectionLabelSpaced: { marginTop: 20 },

  btnPrimary: {
    backgroundColor: GREEN_ACCENT,
    marginHorizontal: 16,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnPrimaryText: { color: WHITE, fontSize: 13, fontWeight: '500' },

  btnGhost: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#cccccc',
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: WHITE,
  },
  btnGhostText: { color: GREEN, fontSize: 13, fontWeight: '500' },

  scoreCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: WHITE,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER_LIGHT,
  },
  scoreCardLeft: { flex: 1, paddingRight: 12 },
  courseName: { fontSize: 13, fontWeight: '600', color: TEXT_MAIN },
  scoreSub: { fontSize: 12, color: TEXT_MUTED, marginTop: 2 },
  scoreBadge: {
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: 10,
    borderRadius: 22,
    backgroundColor: AMBER_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreBadgeText: { fontSize: 13, fontWeight: '600', color: AMBER_TEXT },

  empty: {
    textAlign: 'center',
    color: '#bbbbbb',
    fontSize: 14,
    paddingVertical: 24,
  },
});
