import { useFocusEffect } from '@react-navigation/native';
import { type Href, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { USER_PROFILE_KEY, type StoredUserProfile } from '@/lib/app-storage';
import { calcHandicapIndex, loadHandicapRecords, type HandicapRecord } from '@/lib/handicap';
import { readJson } from '@/lib/local-storage';

const HEADER_BG = '#1a3a1a';
const PRIMARY_BTN = '#1a6b2e';
const WHITE = '#ffffff';
const BG_PAGE = '#f3f4f6';
const STAT_CARD_BG = '#e8eaed';
const CARD_BORDER = '#e5e7eb';
const TEXT_PRIMARY = '#111827';
const TEXT_SECONDARY = '#6b7280';
const TEXT_MUTED = '#9ca3af';
const HEADER_MUTED = 'rgba(255,255,255,0.72)';

const PAD_H = 16;
const CARD_GAP = 10;

type ProfileJson = StoredUserProfile & { nickname?: string; name?: string };

function toDateMs(date: string) {
  return Number.isFinite(Date.parse(date)) ? Date.parse(date) : 0;
}

function grossStrokes(item: HandicapRecord): number {
  const hasHoles = item.holeDetails.length > 0;
  return hasHoles ? item.holeDetails.reduce((sum, h) => sum + h.strokes, 0) : item.adjustedGrossScore;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function daysSinceRoundOne(dateStr: string, now: Date): number | null {
  const ms = toDateMs(dateStr);
  if (!ms) return null;
  const diff = startOfDay(now) - startOfDay(new Date(ms));
  return Math.max(0, Math.round(diff / 86400000));
}

function countRoundsThisMonth(records: HandicapRecord[], now: Date): number {
  const y = now.getFullYear();
  const m = now.getMonth();
  let n = 0;
  for (const r of records) {
    const ms = toDateMs(r.date);
    if (!ms) continue;
    const d = new Date(ms);
    if (d.getFullYear() === y && d.getMonth() === m) n += 1;
  }
  return n;
}

function safeLoadRecords(): HandicapRecord[] {
  try {
    const list = loadHandicapRecords();
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export default function HomeDashboardScreen() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [handicapNum, setHandicapNum] = useState<string | null>(null);
  const [recentScoreDisplay, setRecentScoreDisplay] = useState<string>('--');
  const [monthlyCount, setMonthlyCount] = useState<string>('--');
  const [headerMetaLine, setHeaderMetaLine] = useState('差点待计算');
  const [recentRounds, setRecentRounds] = useState<HandicapRecord[]>([]);

  useFocusEffect(
    useCallback(() => {
      let records: HandicapRecord[] = [];
      try {
        const profile = readJson<ProfileJson | null>(USER_PROFILE_KEY, null);
        const name = profile?.nickname?.trim() || profile?.name?.trim() || '';
        setDisplayName(name);

        records = safeLoadRecords();
        const sorted = [...records].sort((a, b) => toDateMs(b.date) - toDateMs(a.date));
        setRecentRounds(sorted.slice(0, 3));

        const idx = calcHandicapIndex(records);
        const hasIndex = typeof idx === 'number';
        setHandicapNum(hasIndex ? idx.toFixed(1) : null);

        const latest = sorted[0];
        const gross = latest ? grossStrokes(latest) : null;
        setRecentScoreDisplay(gross !== null ? String(gross) : '--');

        const now = new Date();
        setMonthlyCount(String(countRoundsThisMonth(records, now)));

        if (!hasIndex) {
          setHeaderMetaLine('差点待计算');
        } else {
          const days = latest ? daysSinceRoundOne(latest.date, now) : null;
          const daysPart = days === null ? '—' : String(days);
          setHeaderMetaLine(`差点 ${idx.toFixed(1)} · 最近一轮 ${daysPart} 天前`);
        }
      } catch {
        setDisplayName('');
        setHandicapNum(null);
        setRecentScoreDisplay('--');
        setMonthlyCount('--');
        setHeaderMetaLine('差点待计算');
        setRecentRounds([]);
      }
      return () => {};
    }, []),
  );

  const welcomeLine = displayName ? `欢迎回来，${displayName}` : '欢迎回来';
  const handicapStat = handicapNum ?? '--';

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View style={s.headerRow}>
          <Text style={s.brand}>GolfMate</Text>
          <TouchableOpacity
            style={s.settingsBtn}
            onPress={() => router.push('/(tabs)/settings' as Href)}
            accessibilityRole="button">
            <Text style={s.settingsBtnText}>设置</Text>
          </TouchableOpacity>
        </View>
        <Text style={s.welcome}>{welcomeLine}</Text>
        <Text style={s.metaSmall}>{headerMetaLine}</Text>

        <View style={s.statRow}>
          <View style={s.statCell}>
            <Text style={s.statValue}>{handicapStat}</Text>
            <Text style={s.statLabel}>差点</Text>
          </View>
          <View style={s.statCell}>
            <Text style={s.statValue}>{recentScoreDisplay}</Text>
            <Text style={s.statLabel}>最近成绩</Text>
          </View>
          <View style={s.statCell}>
            <Text style={s.statValue}>{monthlyCount}</Text>
            <Text style={s.statLabel}>本月轮数</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}>
        <Text style={s.sectionLabel}>快捷操作</Text>
        <TouchableOpacity
          style={s.btnPrimary}
          activeOpacity={0.88}
          onPress={() => router.push('/(tabs)/score' as Href)}>
          <Text style={s.btnPrimaryText}>＋ 开始记成绩</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.btnSecondary}
          activeOpacity={0.88}
          onPress={() => router.push('/(tabs)/bet' as Href)}>
          <Text style={s.btnSecondaryText}>设置赌球游戏</Text>
        </TouchableOpacity>

        <Text style={[s.sectionLabel, s.sectionSpaced]}>最近成绩</Text>
        {recentRounds.length > 0 ? (
          recentRounds.map((r) => (
            <TouchableOpacity
              key={r.id}
              style={s.scoreCard}
              activeOpacity={0.86}
              onPress={() => router.push(`/handicap/${r.id}` as Href)}>
              <View style={s.scoreCardLeft}>
                <Text style={s.courseName} numberOfLines={2}>
                  {r.courseName || '—'}
                </Text>
                <Text style={s.courseDate}>{r.date || '—'}</Text>
              </View>
              <View style={s.scoreBadge}>
                <Text style={s.scoreBadgeText}>{grossStrokes(r)}</Text>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <Text style={s.emptyHint}>暂无成绩，去记录第一轮吧</Text>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG_PAGE },
  header: {
    backgroundColor: HEADER_BG,
    paddingHorizontal: PAD_H,
    paddingTop: Platform.OS === 'web' ? 50 : (StatusBar.currentHeight || 36) + 8,
    paddingBottom: CARD_GAP,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: { fontSize: 20, fontWeight: '700', color: WHITE },
  settingsBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  settingsBtnText: { color: WHITE, fontSize: 13, fontWeight: '600' },
  welcome: { fontSize: 14, color: WHITE, marginTop: CARD_GAP, fontWeight: '500' },
  metaSmall: { fontSize: 12, color: HEADER_MUTED, marginTop: 6 },
  statRow: {
    flexDirection: 'row',
    gap: CARD_GAP,
    marginTop: CARD_GAP,
  },
  statCell: {
    flex: 1,
    minWidth: 0,
    backgroundColor: STAT_CARD_BG,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: { fontSize: 24, fontWeight: '800', color: TEXT_PRIMARY },
  statLabel: { fontSize: 12, color: TEXT_SECONDARY, marginTop: 4 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: PAD_H,
    paddingTop: CARD_GAP,
    paddingBottom: 28,
  },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: TEXT_PRIMARY, marginBottom: CARD_GAP },
  sectionSpaced: { marginTop: CARD_GAP },
  btnPrimary: {
    backgroundColor: PRIMARY_BTN,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: CARD_GAP,
  },
  btnPrimaryText: { color: WHITE, fontSize: 15, fontWeight: '700' },
  btnSecondary: {
    borderWidth: 1,
    borderColor: PRIMARY_BTN,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: CARD_GAP,
    backgroundColor: 'transparent',
  },
  btnSecondaryText: { color: PRIMARY_BTN, fontSize: 15, fontWeight: '600' },
  scoreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: WHITE,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: CARD_BORDER,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: CARD_GAP,
  },
  scoreCardLeft: { flex: 1, minWidth: 0, paddingRight: 12 },
  courseName: { fontSize: 14, fontWeight: '700', color: TEXT_PRIMARY },
  courseDate: { fontSize: 12, color: TEXT_SECONDARY, marginTop: 4 },
  scoreBadge: {
    backgroundColor: HEADER_BG,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 44,
    alignItems: 'center',
  },
  scoreBadgeText: { fontSize: 14, fontWeight: '800', color: WHITE },
  emptyHint: { fontSize: 14, color: TEXT_MUTED, lineHeight: 22 },
});
