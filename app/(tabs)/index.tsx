import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { type Href, router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface HandicapRecord {
  id: string;
  date: string;
  courseName: string;
  adjustedGrossScore: number;
  scoreDifferential: number;
  holes: number;
}

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

export default function HomeScreen() {
  const [records, setRecords] = useState<HandicapRecord[]>([]);

  useFocusEffect(
    useCallback(() => {
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
    }, []),
  );

  const sorted = [...records].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const latest = sorted[0];
  const hcp = calcHandicap(records);
  const monthCount = thisMonthCount(records);

  const subLine =
    hcp === '--'
      ? '差点待计算'
      : `差点 ${hcp} · 最近一轮${latest ? lastRoundSubphrase(latest.date) : '--'}`;

  const statHcp = hcp;
  const statRecent = latest ? String(latest.adjustedGrossScore) : '--';
  const statMonth = records.length === 0 ? '--' : String(monthCount);

  const headerPadTop = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 16 : 16;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: headerPadTop }]}>
        <View style={styles.headerTop}>
          <Text style={styles.appName}>GolfMate</Text>
          <TouchableOpacity style={styles.settingsBtn} onPress={() => router.push('/(tabs)/settings' as Href)}>
            <Text style={styles.settingsBtnText}>设置</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.greeting}>欢迎回来</Text>
        <Text style={styles.subGreeting}>{subLine}</Text>
      </View>

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

        <Text style={styles.sectionLabelQuick}>快捷操作</Text>
        <TouchableOpacity style={styles.btnPrimary} onPress={() => router.push('/(tabs)/score' as Href)} activeOpacity={0.88}>
          <Text style={styles.btnPrimaryText}>＋ 开始记成绩</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnGhost} onPress={() => router.push('/(tabs)/bet' as Href)} activeOpacity={0.88}>
          <Text style={styles.btnGhostText}>设置赌球游戏</Text>
        </TouchableOpacity>

        <Text style={styles.sectionLabelScores}>最近成绩</Text>
        {sorted.length === 0 ? (
          <Text style={styles.empty}>暂无成绩，去记录第一轮吧</Text>
        ) : (
          sorted.slice(0, 3).map((r) => (
            <TouchableOpacity
              key={r.id}
              style={styles.scoreCard}
              onPress={() => router.push(`/handicap/${r.id}` as Href)}
              activeOpacity={0.88}>
              <View>
                <Text style={styles.courseName}>{r.courseName}</Text>
                <Text style={styles.scoreDate}>{r.date}</Text>
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

const GREEN_DARK = '#1a3a1a';
const GREEN_BTN = '#1a6b2e';
const BG_SCROLL = '#f5f5f0';
const WHITE = '#ffffff';

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG_SCROLL,
  },

  header: {
    backgroundColor: GREEN_DARK,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  appName: {
    color: WHITE,
    fontSize: 20,
    fontWeight: '600',
  },
  settingsBtn: {
    borderWidth: 1,
    borderColor: WHITE,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  settingsBtnText: { color: WHITE, fontSize: 13 },
  greeting: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '500',
    marginTop: 8,
  },
  subGreeting: {
    color: WHITE,
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
  },

  scrollView: {
    flex: 1,
    backgroundColor: BG_SCROLL,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  statsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: WHITE,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  statVal: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1a1a1a',
    textAlign: 'center',
  },
  statLbl: {
    fontSize: 11,
    color: '#888',
    marginTop: 3,
    textAlign: 'center',
  },

  sectionLabelQuick: {
    fontSize: 11,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: 8,
  },
  sectionLabelScores: {
    fontSize: 11,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: 8,
  },

  btnPrimary: {
    backgroundColor: GREEN_BTN,
    marginHorizontal: 16,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    color: WHITE,
    fontSize: 15,
    fontWeight: '600',
  },

  btnGhost: {
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WHITE,
  },
  btnGhostText: {
    color: GREEN_DARK,
    fontSize: 15,
    fontWeight: '500',
  },

  scoreCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: WHITE,
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  courseName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  scoreDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  scoreBadge: {
    backgroundColor: GREEN_DARK,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  scoreBadgeText: {
    color: WHITE,
    fontSize: 15,
    fontWeight: '700',
  },

  empty: {
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
    paddingVertical: 20,
  },
});
