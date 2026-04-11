import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { type Href, router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { THEME } from '@/constants/theme';
import { USER_PROFILE_KEY, type StoredUserProfile } from '@/lib/app-storage';
import { readJson } from '@/lib/local-storage';

interface HandicapRecord {
  id: string;
  date: string;
  courseName: string;
  adjustedGrossScore: number;
  totalPutts?: number;
  greensInRegulation?: number;
  fairwaysHit?: number;
  fairwaysTotal?: number;
  holes: number;
  scoreDifferential: number;
  slopeRating?: number;
}

type ProfileJson = StoredUserProfile & { nickname?: string; name?: string };

function calcHandicap(recs: HandicapRecord[]): string | null {
  if (recs.length < 3) return null;
  const n =
    recs.length <= 6
      ? 1
      : recs.length <= 8
        ? 2
        : recs.length <= 11
          ? 3
          : recs.length <= 14
            ? 4
            : recs.length <= 16
              ? 5
              : recs.length <= 18
                ? 6
                : 8;
  const sorted = [...recs].sort((a, b) => a.scoreDifferential - b.scoreDifferential).slice(0, n);
  return ((sorted.reduce((s, r) => s + r.scoreDifferential, 0) / sorted.length) * 0.96).toFixed(1);
}

function daysSince(dateStr: string): string {
  const d = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  return d === 0 ? '今天' : d === 1 ? '昨天' : `${d}天前`;
}

function greetingPrefixCn(): string {
  const h = new Date().getHours();
  if (h < 12) return '早上好';
  if (h < 18) return '下午好';
  return '晚上好';
}

function holesLabel(holes: number | string | undefined): string {
  const n = typeof holes === 'number' ? holes : Number(holes);
  const v = Number.isFinite(n) && n > 0 ? n : 18;
  return `${v}`;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [records, setRecords] = useState<HandicapRecord[]>([]);
  const [firstName, setFirstName] = useState('');

  const load = useCallback(() => {
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
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      return () => {};
    }, [load]),
  );

  const sorted = useMemo(
    () => [...records].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [records],
  );

  const recent20 = useMemo(
    () => sorted.slice(0, 20),
    [sorted],
  );

  const avgScore = useMemo(() => {
    if (!recent20.length) return null;
    return Math.round(recent20.reduce((s, r) => s + r.adjustedGrossScore, 0) / recent20.length);
  }, [recent20]);

  const avgPutts = useMemo(() => {
    const puttsRounds = recent20.filter((r) => r.holes === 18);
    if (!puttsRounds.length) return null;
    const sum = puttsRounds.reduce((s, r) => s + (Number(r.totalPutts) || 0), 0);
    return Math.round(sum / puttsRounds.length);
  }, [recent20]);

  const avgGir = useMemo(() => {
    const girRounds = recent20.filter(
      (r) => r.greensInRegulation != null && r.holes && Number(r.holes) > 0,
    );
    if (!girRounds.length) return null;
    const sum = girRounds.reduce(
      (s, r) => s + ((r.greensInRegulation as number) / Number(r.holes)) * 100,
      0,
    );
    return Math.round(sum / girRounds.length);
  }, [recent20]);

  const bestScore = useMemo(() => {
    if (!recent20.length) return null;
    return Math.min(...recent20.map((r) => r.adjustedGrossScore));
  }, [recent20]);

  const hcpStr = useMemo(() => calcHandicap(records), [records]);

  const bestDiff = useMemo(() => {
    if (!recent20.length) return null;
    return Math.min(...recent20.map((r) => r.scoreDifferential));
  }, [recent20]);

  const needMore = Math.max(0, 3 - records.length);
  const progressPct = Math.min(100, (records.length / 3) * 100);
  const progress20Pct = Math.min(100, (recent20.length / 20) * 100);

  const headerPadTop = Math.max(insets.top, 16);

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingTop: headerPadTop }]}
        showsVerticalScrollIndicator={false}
        bounces={false}>
        {/* ① Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerGreetSmall}>{greetingPrefixCn()}</Text>
            {firstName ? <Text style={styles.headerName}>{firstName}</Text> : null}
          </View>
          <TouchableOpacity
            style={styles.profileBtn}
            onPress={() => router.push('/(tabs)/settings' as Href)}
            hitSlop={8}
            accessibilityRole="button"
            activeOpacity={0.88}>
            <Text style={styles.profileBtnText}>我的档案</Text>
          </TouchableOpacity>
        </View>

        {/* ② 英雄卡 */}
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>WHS 差点指数</Text>
          {hcpStr != null ? (
            <>
              <View style={styles.heroRow}>
                <Text style={styles.heroHcp}>{hcpStr}</Text>
                {bestDiff != null ? (
                  <View style={styles.heroBest}>
                    <Text style={styles.heroBestLabel}>历史最佳</Text>
                    <Text style={styles.heroBestVal}>{bestDiff.toFixed(1)}</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress20Pct}%` }]} />
              </View>
            </>
          ) : (
            <>
              <Text style={styles.heroPending}>待生成</Text>
              <View style={styles.capsule}>
                <Text style={styles.capsuleText}>还需 {needMore} 场</Text>
              </View>
              <View style={styles.progressLabelRow}>
                <Text style={styles.progressLabel}>进度</Text>
                <Text style={styles.progressLabelRight}>
                  {records.length} / 3 场
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
              </View>
            </>
          )}
        </View>

        {/* ③ 近20场平均 */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionLeft}>近20场平均</Text>
          <Text style={styles.sectionRight}>共 {records.length} 场记录</Text>
        </View>
        <View style={styles.statGrid}>
          <View style={styles.statCell}>
            <Text style={styles.statNum}>{avgScore != null ? String(avgScore) : '--'}</Text>
            <Text style={styles.statLbl}>平均总杆</Text>
            <Text style={styles.statSub}>
              {'最佳 ' + (bestScore != null ? String(bestScore) : '--')}
            </Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statNum}>{avgPutts != null ? String(avgPutts) : '--'}</Text>
            <Text style={styles.statLbl}>平均推杆</Text>
            <Text style={styles.statSub}>
              {'每洞 ' + (avgPutts != null ? (avgPutts / 18).toFixed(1) : '--')}
            </Text>
          </View>
          <View style={styles.statCell}>
            <Text
              style={[
                styles.statNum,
                avgGir != null ? styles.statNumGir : undefined,
              ]}>
              {avgGir != null ? `${avgGir}%` : '--'}
            </Text>
            <Text style={styles.statLbl}>平均GIR</Text>
            {avgGir != null ? (
              <Text style={styles.statSubGir}>↑ 果岭命中</Text>
            ) : (
              <Text style={styles.statSubMuted}>暂无数据</Text>
            )}
          </View>
        </View>

        {/* ④ 快捷操作 */}
        <Text style={styles.sectionTitle}>快捷操作</Text>
        <View style={styles.quickRow}>
          <TouchableOpacity
            style={styles.btnPrimary}
            activeOpacity={0.88}
            onPress={() => router.push('/(tabs)/score' as Href)}>
            <Text style={{ fontSize: 20, fontWeight: '900', color: THEME.bg }}>+</Text>
            <Text style={{ fontSize: 15, fontWeight: '800', color: THEME.bg }}>记成绩</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.btnSecondary}
            activeOpacity={0.88}
            onPress={() => router.push('/(tabs)/bet' as Href)}>
            <Text style={{ fontSize: 16, color: 'rgba(255,255,255,0.8)' }}>¥</Text>
            <Text style={{ fontSize: 15, fontWeight: '700', color: 'rgba(255,255,255,0.9)' }}>
              赌球
            </Text>
          </TouchableOpacity>
        </View>

        {/* ⑤ 最近成绩 */}
        <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>最近成绩</Text>
        {sorted.length === 0 ? (
          <Text style={styles.empty}>暂无成绩，去记录第一轮吧</Text>
        ) : (
          sorted.slice(0, 3).map((r) => {
            const holesN = Number(r.holes) || 18;
            const girPct =
              r.greensInRegulation != null && holesN > 0
                ? Math.round((r.greensInRegulation / holesN) * 100)
                : null;
            const fwPct =
              r.fairwaysTotal && r.fairwaysTotal > 0 && r.fairwaysHit != null
                ? Math.round((r.fairwaysHit / r.fairwaysTotal) * 100)
                : null;
            const putts = r.totalPutts != null ? r.totalPutts : null;

            return (
              <Pressable
                key={r.id}
                style={styles.card}
                onPress={() => router.push(`/handicap/${r.id}` as Href)}>
                <View style={styles.cardTop}>
                  <View style={styles.cardTopLeft}>
                    <Text style={styles.courseName}>{r.courseName}</Text>
                    <Text style={styles.courseMeta}>
                      {daysSince(r.date)} · {holesLabel(r.holes)}洞
                    </Text>
                  </View>
                  <View style={styles.scoreBadge}>
                    <Text style={styles.scoreBadgeText}>{r.adjustedGrossScore}</Text>
                  </View>
                </View>
                <View style={styles.chips}>
                  <View style={styles.chipAccent}>
                    <Text style={styles.chipAccentText}>微差 {r.scoreDifferential.toFixed(1)}</Text>
                  </View>
                  {putts != null ? (
                    <View style={styles.chipNeutral}>
                      <Text style={styles.chipNeutralText}>推杆 {putts}</Text>
                    </View>
                  ) : null}
                  {girPct != null ? (
                    <View style={styles.chipAccent}>
                      <Text style={styles.chipAccentText}>GIR {girPct}%</Text>
                    </View>
                  ) : null}
                  {fwPct != null ? (
                    <View style={styles.chipNeutral}>
                      <Text style={styles.chipNeutralText}>球道 {fwPct}%</Text>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: THEME.bg },
  scroll: { flex: 1, backgroundColor: THEME.bg },
  scrollContent: { paddingBottom: 32 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 18,
    paddingBottom: 10,
  },
  headerLeft: { flex: 1, paddingRight: 12 },
  headerGreetSmall: { fontSize: 11, color: 'rgba(255,255,255,0.5)' },
  headerName: { fontSize: 20, color: THEME.text1, fontWeight: '700', marginTop: 4 },
  profileBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  profileBtnText: { fontSize: 11, color: 'rgba(255,255,255,0.85)' },

  hero: {
    marginHorizontal: 14,
    marginBottom: 10,
    borderRadius: 20,
    padding: 18,
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.accentBorder,
  },
  heroLabel: { fontSize: 10, color: 'rgba(255,255,255,0.6)' },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 6,
  },
  heroHcp: { fontSize: 52, color: THEME.text1, fontWeight: '800' },
  heroBest: {
    alignItems: 'flex-end',
    paddingTop: 8,
  },
  heroBestLabel: { fontSize: 10, color: THEME.text3 },
  heroBestVal: { fontSize: 16, color: THEME.accent, fontWeight: '700' },
  heroPending: {
    fontSize: 24,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '700',
    marginTop: 8,
  },
  capsule: {
    alignSelf: 'flex-start',
    marginTop: 10,
    backgroundColor: 'rgba(163,230,53,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  capsuleText: { fontSize: 12, color: THEME.accent, fontWeight: '600' },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  progressLabel: { fontSize: 10, color: THEME.text3 },
  progressLabelRight: { fontSize: 10, color: THEME.text4 },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginTop: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: THEME.accent,
  },

  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    marginBottom: 6,
  },
  sectionLeft: { fontSize: 10, color: 'rgba(255,255,255,0.5)' },
  sectionRight: { fontSize: 10, color: 'rgba(255,255,255,0.35)' },
  statGrid: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  statCell: {
    flex: 1,
    backgroundColor: THEME.surface,
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
  },
  statNum: { fontSize: 18, color: THEME.text1, fontWeight: '700' },
  statNumGir: { fontSize: 15 },
  statLbl: { fontSize: 10, color: THEME.text3, marginTop: 4 },
  statSub: { fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4 },
  statSubGir: { fontSize: 10, color: THEME.accent, fontWeight: '600', marginTop: 4 },
  statSubMuted: { fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4 },

  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.text3,
    paddingHorizontal: 18,
    marginTop: 8,
    marginBottom: 8,
  },
  sectionTitleSpaced: { marginTop: 16 },

  quickRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  btnPrimary: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    backgroundColor: THEME.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  btnSecondary: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },

  empty: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.3)',
    fontSize: 13,
    paddingVertical: 24,
  },
  card: {
    marginHorizontal: 14,
    marginBottom: 8,
    backgroundColor: THEME.surface,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTopLeft: { flex: 1, paddingRight: 10 },
  courseName: { fontSize: 13, color: THEME.text1, fontWeight: '600' },
  courseMeta: { fontSize: 11, color: THEME.text3, marginTop: 4 },
  scoreBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: THEME.accentBg,
    borderWidth: 1.5,
    borderColor: 'rgba(163,230,53,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreBadgeText: { fontSize: 14, color: THEME.accent, fontWeight: '800' },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 10,
  },
  chipAccent: {
    backgroundColor: THEME.accentBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  chipAccentText: { fontSize: 10, color: THEME.accent, fontWeight: '600' },
  chipNeutral: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  chipNeutralText: { fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
});
