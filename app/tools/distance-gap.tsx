import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ScreenHeader } from '@/components/ScreenHeader';
import { DARK_PAGE } from '@/constants/theme';

const STORAGE_CLUBS = 'myBagClubs';

const GREEN = DARK_PAGE.accent;
const BG = DARK_PAGE.bg;
const CARD_FILL = DARK_PAGE.card;
const BORDER = DARK_PAGE.cardBorder;
const TEXT_PRIMARY = DARK_PAGE.text;
const TEXT_SECONDARY = DARK_PAGE.textSecondary;
const ORANGE = '#d97706';
const RED = '#dc2626';

type ClubType = 'wood' | 'iron' | 'wedge' | 'putter' | 'accessory';

type BagClub = {
  id: string;
  name: string;
  type: ClubType;
  active?: boolean;
  carryDistanceM: string;
  targetDistanceM?: string;
};

type FilledClub = {
  id: string;
  name: string;
  type: ClubType;
  carryM: number;
  targetM: number | null;
};

type GapStatus = 'small' | 'normal' | 'large';

async function loadAllClubs(): Promise<BagClub[]> {
  const raw = await AsyncStorage.getItem(STORAGE_CLUBS);
  if (!raw) return [];
  try {
    const stored = JSON.parse(raw);
    if (stored && typeof stored === 'object' && !Array.isArray(stored) && stored.v === 2) {
      return Array.isArray(stored.main) ? (stored.main as BagClub[]) : [];
    }
    if (Array.isArray(stored)) return stored as BagClub[];
    return [];
  } catch {
    return [];
  }
}

function toFilled(clubs: BagClub[]): FilledClub[] {
  return clubs
    .filter(
      (c) =>
        c.active !== false &&
        c.type !== 'putter' &&
        c.carryDistanceM &&
        String(c.carryDistanceM).trim() !== '',
    )
    .map((c) => {
      const carryM = parseFloat(String(c.carryDistanceM));
      const targetRaw = c.targetDistanceM != null ? String(c.targetDistanceM).trim() : '';
      const targetM = targetRaw !== '' ? parseFloat(targetRaw) : null;
      return {
        id: c.id,
        name: c.name,
        type: c.type,
        carryM,
        targetM: targetM != null && Number.isFinite(targetM) ? targetM : null,
      };
    })
    .filter((c) => Number.isFinite(c.carryM))
    .sort((a, b) => b.carryM - a.carryM);
}

function toPutters(clubs: BagClub[]): BagClub[] {
  return clubs.filter((c) => c.active !== false && c.type === 'putter');
}

export default function DistanceGapScreen() {
  const router = useRouter();
  const [spacingClubs, setSpacingClubs] = useState<FilledClub[]>([]);
  const [putters, setPutters] = useState<BagClub[]>([]);
  const [unit, setUnit] = useState<'m' | 'y'>('m');

  const display = useCallback(
    (m: number) => (unit === 'm' ? `${Math.round(m)}m` : `${Math.round(m * 1.094)}码`),
    [unit],
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const allClubs = await loadAllClubs();
        if (cancelled) return;
        setSpacingClubs(toFilled(allClubs));
        setPutters(toPutters(allClubs));
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const summary = useMemo(() => {
    if (!spacingClubs.length) return null;
    const dists = spacingClubs.map((c) => c.carryM);
    const gaps: number[] = [];
    for (let i = 0; i < spacingClubs.length - 1; i += 1) {
      gaps.push(spacingClubs[i].carryM - spacingClubs[i + 1].carryM);
    }
    const avgGap = gaps.length ? gaps.reduce((s, g) => s + g, 0) / gaps.length : 0;
    return {
      count: spacingClubs.length,
      max: Math.max(...dists),
      min: Math.min(...dists),
      avgGap,
    };
  }, [spacingClubs]);

  function gapStatus(gapM: number): GapStatus {
    if (gapM < 10) return 'small';
    if (gapM <= 20) return 'normal';
    return 'large';
  }

  function gapText(gapM: number, status: GapStatus) {
    const n = unit === 'm' ? Math.round(gapM) : Math.round(gapM * 1.094);
    const suffix = unit === 'm' ? 'm' : '码';
    if (status === 'small') return `↓${n}${suffix} ⚠ 太近`;
    if (status === 'normal') return `↓${n}${suffix} ✓`;
    return `↓${n}${suffix} △ 偏大`;
  }

  function gapColor(status: GapStatus) {
    if (status === 'normal') return GREEN;
    if (status === 'small') return RED;
    return ORANGE;
  }

  const notEnough = spacingClubs.length < 1;

  return (
    <View style={styles.container}>
      <ScreenHeader
        variant="stack"
        title="距离间距检查"
        subtitle="基于你的球包落点数据"
        onBack={() => router.back()}
      />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.unitRow}>
          <Pressable
            style={[styles.unitChip, unit === 'm' && styles.unitChipOn]}
            onPress={() => setUnit('m')}
          >
            <Text style={[styles.unitChipTxt, unit === 'm' && styles.unitChipTxtOn]}>m</Text>
          </Pressable>
          <Pressable
            style={[styles.unitChip, unit === 'y' && styles.unitChipOn]}
            onPress={() => setUnit('y')}
          >
            <Text style={[styles.unitChipTxt, unit === 'y' && styles.unitChipTxtOn]}>码</Text>
          </Pressable>
        </View>

        {notEnough ? (
          <View style={styles.card}>
            <Text style={styles.empty}>
              前往球包页填写落点距离后，间距分析自动生成
            </Text>
            <Pressable style={styles.linkBtn} onPress={() => router.push('/my-bag')}>
              <Text style={styles.linkBtnText}>前往球包 →</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {summary ? (
              <View style={styles.card}>
                <Text style={styles.summaryText}>
                  共 {summary.count} 支 · 最长 {display(summary.max)} · 最短 {display(summary.min)}{' '}
                  · 平均间距 {display(summary.avgGap)}
                </Text>
              </View>
            ) : null}

            <View style={styles.card}>
              {spacingClubs.map((club, index) => {
                const gapM =
                  index > 0 ? spacingClubs[index - 1].carryM - club.carryM : null;
                const status = typeof gapM === 'number' ? gapStatus(gapM) : null;
                return (
                  <View key={club.id} style={styles.row}>
                    <View style={styles.nameCol}>
                      <Text style={styles.clubName}>{club.name}</Text>
                      {club.targetM != null ? (
                        <Text style={styles.targetHint}>目标: {display(club.targetM)}</Text>
                      ) : null}
                    </View>
                    <Text style={styles.distance}>{display(club.carryM)}</Text>
                    <Text
                      style={[
                        styles.gap,
                        status ? { color: gapColor(status) } : styles.gapMuted,
                      ]}
                    >
                      {typeof gapM === 'number' && status ? gapText(gapM, status) : '—'}
                    </Text>
                  </View>
                );
              })}
              {putters.length > 0 ? (
                <>
                  <View style={styles.putterSep} />
                  {putters.map((club) => (
                    <View key={club.id} style={styles.row}>
                      <Text style={styles.clubName}>{club.name}</Text>
                      <Text style={styles.distance}>—</Text>
                      <Text style={[styles.gap, styles.gapMuted]}>—</Text>
                    </View>
                  ))}
                </>
              ) : null}
            </View>
          </>
        )}
      </ScrollView>

      {!notEnough ? (
        <View style={styles.footer}>
          <Pressable style={styles.updateBtn} onPress={() => router.push('/my-bag')}>
            <Text style={styles.updateBtnText}>更新距离数据</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  flex: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 96,
  },
  unitRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  unitChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: DARK_PAGE.surface,
  },
  unitChipOn: {
    borderColor: GREEN,
    backgroundColor: DARK_PAGE.accentBg,
  },
  unitChipTxt: { fontSize: 13, fontWeight: '700', color: TEXT_SECONDARY },
  unitChipTxtOn: { color: GREEN },
  card: {
    backgroundColor: CARD_FILL,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 12,
    marginBottom: 10,
  },
  empty: { fontSize: 13, color: TEXT_SECONDARY, lineHeight: 20, marginBottom: 10 },
  linkBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: GREEN,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: DARK_PAGE.surface,
  },
  linkBtnText: { color: GREEN, fontSize: 13, fontWeight: '700' },
  summaryText: { fontSize: 14, color: TEXT_PRIMARY, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 0.5,
    borderBottomColor: DARK_PAGE.divider,
    paddingVertical: 10,
    gap: 8,
  },
  nameCol: { flex: 1, minWidth: 0 },
  clubName: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '600' },
  targetHint: { marginTop: 2, fontSize: 11, color: TEXT_SECONDARY, fontWeight: '500' },
  distance: { width: 72, color: TEXT_PRIMARY, fontSize: 13, textAlign: 'right', fontWeight: '600' },
  gap: { width: 122, fontSize: 12, textAlign: 'right', fontWeight: '700' },
  gapMuted: { color: TEXT_SECONDARY, fontWeight: '500' },
  putterSep: {
    height: 1,
    backgroundColor: DARK_PAGE.divider,
    marginVertical: 8,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: CARD_FILL,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
  },
  updateBtn: {
    backgroundColor: GREEN,
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 13,
  },
  updateBtnText: { color: DARK_PAGE.onAccent, fontSize: 16, fontWeight: '700' },
});
