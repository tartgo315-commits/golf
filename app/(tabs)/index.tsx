import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { type Href, router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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

/** 设计稿英文副标题 / 卡片用 */
function relativeTimeEn(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (diff === 0) return 'today';
  if (diff === 1) return 'yesterday';
  if (diff < 7) return `${diff} days ago`;
  const w = Math.round(diff / 7);
  if (w <= 1) return '1 week ago';
  return `${w} weeks ago`;
}

function greetingPrefix(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

/** 与稿图「9:41」一致的 12 小时制无 AM/PM */
function formatStatusTime(d: Date): string {
  let h = d.getHours() % 12;
  if (h === 0) h = 12;
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

function holesLabel(holes: number | string | undefined): string {
  const n = typeof holes === 'number' ? holes : Number(holes);
  const v = Number.isFinite(n) && n > 0 ? n : 18;
  return `${v} holes`;
}

export default function HomeScreen() {
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

  const displayName = firstName || 'Golfer';
  const hcpLine =
    hcp === '--'
      ? 'HCP pending · No rounds yet'
      : `HCP ${hcp} · Last round ${latest ? relativeTimeEn(latest.date) : '—'}`;

  const statHcp = hcp === '--' ? '—' : hcp;
  const statRecent = latest ? String(latest.adjustedGrossScore) : '—';
  const statRounds = String(records.length);

  const statusPadTop = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scrollContent}>
      <View style={[styles.statusBar, { paddingTop: 8 + statusPadTop }]}>
        <Text style={styles.statusTime}>{formatStatusTime(clock)}</Text>
        <Text style={styles.statusBrand}>⛳ GolfMate</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/settings' as Href)} hitSlop={12} accessibilityRole="button">
          <Text style={styles.statusDots}>●●●</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.navHeader}>
        <Text style={styles.navTitle}>
          {greetingPrefix()}, {displayName}
        </Text>
        <Text style={styles.navSub}>{hcpLine}</Text>
      </View>

      <View style={styles.screen}>
        <View style={styles.statRow}>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{statHcp}</Text>
            <Text style={styles.statLbl}>Handicap</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{statRecent}</Text>
            <Text style={styles.statLbl}>Last score</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{statRounds}</Text>
            <Text style={styles.statLbl}>Rounds</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Quick actions</Text>
        <TouchableOpacity style={styles.btnPrimary} onPress={() => router.push('/(tabs)/score' as Href)} activeOpacity={0.88}>
          <Text style={styles.btnPrimaryText}>+ Start new round</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnGhost} onPress={() => router.push('/(tabs)/bet' as Href)} activeOpacity={0.88}>
          <Text style={styles.btnGhostText}>Setup betting game</Text>
        </TouchableOpacity>

        <View style={styles.recentWrap}>
          <Text style={styles.sectionLabel}>Recent activity</Text>
          {sorted.length === 0 ? (
            <Text style={styles.empty}>No rounds yet.</Text>
          ) : (
            sorted.slice(0, 3).map((r) => (
              <TouchableOpacity
                key={r.id}
                style={styles.card}
                onPress={() => router.push(`/handicap/${r.id}` as Href)}
                activeOpacity={0.88}>
                <View style={styles.cardRow}>
                  <View style={styles.cardTextCol}>
                    <Text style={styles.cardTitle}>{r.courseName}</Text>
                    <Text style={styles.cardSub}>
                      {relativeTimeEn(r.date)} · {holesLabel(r.holes)}
                    </Text>
                  </View>
                  <View style={styles.badgeAmber}>
                    <Text style={styles.badgeAmberText}>{r.adjustedGrossScore}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const GREEN = '#1a3a1a';
const GREEN_BTN = '#1a6b2e';
const BG_PRIMARY = '#ffffff';
const BG_SECONDARY = '#f5f5f5';
const BORDER = '#e5e5e5';
const TEXT_PRIMARY = '#1a1a1a';
const TEXT_SECONDARY = '#6b7280';
const TEXT_TERTIARY = '#999999';
const AMBER_BG = '#faeeda';
const AMBER_TEXT = '#854f0b';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG_PRIMARY },
  scrollContent: { flexGrow: 1, paddingBottom: 32 },

  statusBar: {
    backgroundColor: GREEN,
    paddingHorizontal: 16,
    paddingBottom: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusTime: { color: '#fff', fontSize: 11, opacity: 0.85 },
  statusBrand: { color: '#fff', fontSize: 13, fontWeight: '500', opacity: 1 },
  statusDots: { color: '#fff', fontSize: 11, opacity: 0.85, letterSpacing: 1 },

  navHeader: {
    backgroundColor: GREEN,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  navTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '500',
    marginBottom: 2,
    letterSpacing: -0.3,
  },
  navSub: { color: 'rgba(255,255,255,0.6)', fontSize: 12, margin: 0 },

  screen: {
    padding: 16,
    backgroundColor: BG_PRIMARY,
    minHeight: 200,
  },

  statRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  statBox: {
    flex: 1,
    backgroundColor: BG_SECONDARY,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: BORDER,
  },
  statVal: { fontSize: 20, fontWeight: '500', color: TEXT_PRIMARY },
  statLbl: { fontSize: 11, color: TEXT_SECONDARY, marginTop: 2 },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: TEXT_TERTIARY,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },

  btnPrimary: {
    width: '100%',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: GREEN_BTN,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  btnPrimaryText: { color: '#fff', fontSize: 13, fontWeight: '500' },

  btnGhost: {
    width: '100%',
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: 'transparent',
    borderWidth: 0.5,
    borderColor: '#cccccc',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  btnGhostText: { color: TEXT_PRIMARY, fontSize: 13, fontWeight: '400' },

  recentWrap: { marginTop: 14 },

  card: {
    backgroundColor: BG_SECONDARY,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: BORDER,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTextCol: { flex: 1, paddingRight: 10 },
  cardTitle: { fontSize: 13, fontWeight: '500', color: TEXT_PRIMARY },
  cardSub: { fontSize: 12, color: TEXT_SECONDARY, marginTop: 2 },

  badgeAmber: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 20,
    backgroundColor: AMBER_BG,
  },
  badgeAmberText: { fontSize: 11, fontWeight: '500', color: AMBER_TEXT },

  empty: {
    textAlign: 'center',
    color: '#bbbbbb',
    fontSize: 14,
    paddingVertical: 20,
  },
});
