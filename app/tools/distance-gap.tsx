import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

const GREEN = '#166534';
const BG = '#f3f4f6';
const WHITE = '#ffffff';
const BORDER = '#e5e7eb';
const TEXT_PRIMARY = '#111827';
const TEXT_SECONDARY = '#6b7280';
const ORANGE = '#d97706';
const RED = '#dc2626';

const CLUBS = ['一号木', '3木', '5木', '4铁', '5铁', '6铁', '7铁', '8铁', '9铁', 'PW', 'GW', 'SW'];

type GapStatus = 'normal' | 'large' | 'small';
type GapResult = {
  fromClub: string;
  fromDistance: number;
  toClub: string;
  toDistance: number;
  diff: number;
  status: GapStatus;
};

export default function DistanceGapScreen() {
  const router = useRouter();
  const [distances, setDistances] = useState<Record<string, string>>({});
  const [results, setResults] = useState<GapResult[]>([]);
  const [checked, setChecked] = useState(false);

  function updateDistance(club: string, value: string) {
    setDistances((prev) => ({ ...prev, [club]: value }));
  }

  function onCheckGaps() {
    const filled = CLUBS.map((club) => {
      const raw = distances[club]?.trim() ?? '';
      const value = Number(raw);
      return Number.isFinite(value) && value > 0 ? { club, value } : null;
    }).filter((item): item is { club: string; value: number } => Boolean(item));

    const next: GapResult[] = [];
    for (let i = 0; i < filled.length - 1; i += 1) {
      const from = filled[i];
      const to = filled[i + 1];
      const diff = Math.abs(from.value - to.value);
      let status: GapStatus = 'normal';
      if (diff > 20) status = 'large';
      else if (diff < 8) status = 'small';
      next.push({
        fromClub: from.club,
        fromDistance: from.value,
        toClub: to.club,
        toDistance: to.value,
        diff,
        status,
      });
    }

    setResults(next);
    setChecked(true);
  }

  const summary = useMemo(() => {
    const total = results.length;
    const normal = results.filter((item) => item.status === 'normal').length;
    const warn = total - normal;
    return { total, normal, warn };
  }, [results]);

  function statusText(status: GapStatus) {
    if (status === 'normal') return '✓ 正常';
    if (status === 'large') return '⚠️ 偏大，考虑增加球杆';
    return '⚠️ 太近，可能重复';
  }

  function statusColor(status: GapStatus) {
    if (status === 'normal') return GREEN;
    if (status === 'large') return ORANGE;
    return RED;
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} bounces={false}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backTxt}>← 返回</Text>
        </Pressable>
        <Text style={styles.title}>距离间距检查</Text>
        <Text style={styles.desc}>输入你每支球杆的平均落点距离（码），理想间距为每支相差 10-15 码</Text>

        <View style={styles.card}>
          {CLUBS.map((club) => (
            <View key={club} style={styles.row}>
              <Text style={styles.clubName}>{club}</Text>
              <TextInput
                value={distances[club] ?? ''}
                onChangeText={(value) => updateDistance(club, value)}
                style={styles.input}
                keyboardType="number-pad"
                placeholder="—"
                placeholderTextColor={TEXT_SECONDARY}
              />
            </View>
          ))}
        </View>

        {checked ? (
          <View style={styles.card}>
            <Text style={styles.resultTitle}>检查结果</Text>
            {results.length ? (
              <>
                {results.map((item, idx) => (
                  <Text key={`${item.fromClub}-${item.toClub}-${idx}`} style={[styles.resultLine, { color: statusColor(item.status) }]}>
                    {item.fromClub}({item.fromDistance}) → {item.toClub}({item.toDistance}) 差距：{item.diff}码 {statusText(item.status)}
                  </Text>
                ))}
                <Text style={styles.summary}>
                  共检查 {summary.total} 个间距，{summary.normal} 个正常，{summary.warn} 个需注意
                </Text>
              </>
            ) : (
              <Text style={styles.empty}>请至少输入两支球杆的距离再检查。</Text>
            )}
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.checkBtn} onPress={onCheckGaps}>
          <Text style={styles.checkBtnText}>检查间距</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  flex: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'web' ? 44 : 16,
    paddingBottom: 96,
  },
  backBtn: { marginBottom: 8, alignSelf: 'flex-start' },
  backTxt: { color: GREEN, fontWeight: '600' },
  title: { fontSize: 22, fontWeight: '700', color: TEXT_PRIMARY, marginBottom: 8 },
  desc: { fontSize: 13, color: TEXT_SECONDARY, lineHeight: 20, marginBottom: 12 },
  card: {
    backgroundColor: WHITE,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: BORDER,
    padding: 12,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  clubName: { fontSize: 14, color: TEXT_PRIMARY, fontWeight: '600' },
  input: {
    width: 96,
    borderWidth: 0.5,
    borderColor: BORDER,
    borderRadius: 10,
    backgroundColor: WHITE,
    color: TEXT_PRIMARY,
    fontSize: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    textAlign: 'center',
  },
  resultTitle: { fontSize: 16, color: TEXT_PRIMARY, fontWeight: '700', marginBottom: 8 },
  resultLine: { fontSize: 13, lineHeight: 20, marginBottom: 6 },
  summary: { marginTop: 8, fontSize: 13, color: TEXT_PRIMARY, fontWeight: '700' },
  empty: { fontSize: 13, color: TEXT_SECONDARY },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: WHITE,
    borderTopWidth: 0.5,
    borderTopColor: BORDER,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  checkBtn: {
    backgroundColor: GREEN,
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 13,
  },
  checkBtnText: { color: WHITE, fontSize: 16, fontWeight: '700' },
});
