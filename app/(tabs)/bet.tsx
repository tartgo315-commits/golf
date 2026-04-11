import { useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TopTabNav } from '@/components/top-tab-nav';
import { TAB_BAR_SCROLL_EXTRA } from '@/constants/theme';

const HEADER_BG = '#121212';
const GREEN_BTN = '#166534';
const WHITE = '#ffffff';
const BG = '#f5f5f0';
const BORDER = '#e5e7eb';
const TEXT_MAIN = '#111827';
const TEXT_SECONDARY = '#6b7280';
const WIN = '#166534';
const LOSS = '#dc2626';

type BetMode = 'match' | 'nassau' | 'stableford' | 'stroke';

type PlayerRow = { name: string; hcp: string };

/** 每洞净杆（已含让杆）最低者赢得该洞 1 分，并列则平分。 */
function holePointsFromNets(nets: number[]): number[] {
  const min = Math.min(...nets);
  const winCount = nets.filter((v) => v === min).length;
  return nets.map((v) => (v === min ? 1 / winCount : 0));
}

function sumPointsForHoles(
  netByHole: number[][],
  holeFrom: number,
  holeToExclusive: number,
): number[] {
  const n = netByHole.length;
  const totals = Array.from({ length: n }, () => 0);
  for (let h = holeFrom; h < holeToExclusive; h++) {
    const nets = netByHole.map((row) => row[h]);
    const pts = holePointsFromNets(nets);
    for (let p = 0; p < n; p++) totals[p] += pts[p];
  }
  return totals;
}

function payoutsFromPoints(points: number[], unit: number): number[] {
  if (points.length === 0) return [];
  const mean = points.reduce((a, b) => a + b, 0) / points.length;
  return points.map((p) => Math.round((p - mean) * unit));
}

function payoutsMatchPlay(netByHole: number[][], unit: number): number[] {
  const points = sumPointsForHoles(netByHole, 0, 18);
  return payoutsFromPoints(points, unit);
}

function payoutsNassau(netByHole: number[][], unit: number): number[] {
  const front = sumPointsForHoles(netByHole, 0, 9);
  const back = sumPointsForHoles(netByHole, 9, 18);
  const full = sumPointsForHoles(netByHole, 0, 18);
  const n = netByHole.length;
  const sum = Array.from({ length: n }, () => 0);
  for (let i = 0; i < n; i++) {
    sum[i] += payoutsFromPoints(front, unit)[i];
    sum[i] += payoutsFromPoints(back, unit)[i];
    sum[i] += payoutsFromPoints(full, unit)[i];
  }
  return sum;
}

const emptyScores = (rows: number, cols: number) =>
  Array.from({ length: rows }, () => Array.from({ length: cols }, () => ''));

const MODE_LABELS = [
  { id: 'match' as const, title: '比洞', sub: 'Match Play' },
  { id: 'nassau' as const, title: 'Nassau', sub: '' },
  { id: 'stableford' as const, title: '积分赛', sub: 'Stableford' },
  { id: 'stroke' as const, title: '比杆', sub: 'Stroke Play' },
] as const;

export default function BetScreen() {
  const insets = useSafeAreaInsets();
  const padTop = Math.max(insets.top, 8);

  const [players, setPlayers] = useState<PlayerRow[]>([
    { name: '', hcp: '18' },
    { name: '', hcp: '18' },
  ]);
  const [mode, setMode] = useState<BetMode>('match');
  const [unitStr, setUnitStr] = useState('1000');
  const [scores, setScores] = useState<string[][]>(() => emptyScores(2, 18));
  const [payouts, setPayouts] = useState<number[] | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canAddPlayer = players.length < 4;

  const addPlayer = () => {
    if (players.length >= 4) return;
    const nextLen = players.length + 1;
    setPlayers((p) => [...p, { name: '', hcp: '18' }]);
    setScores((prev) => {
      const next = emptyScores(nextLen, 18);
      for (let r = 0; r < Math.min(nextLen, prev.length); r++) {
        for (let c = 0; c < 18; c++) next[r][c] = prev[r][c] ?? '';
      }
      return next;
    });
  };

  const updatePlayer = (index: number, field: keyof PlayerRow, value: string) => {
    setPlayers((p) => p.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const updateCell = (playerIdx: number, holeIdx: number, value: string) => {
    setScores((rows) =>
      rows.map((row, ri) =>
        ri === playerIdx ? row.map((cell, ci) => (ci === holeIdx ? value : cell)) : row,
      ),
    );
  };

  const handleCalculate = () => {
    setError(null);
    setBanner(null);
    setPayouts(null);

    if (mode === 'stableford' || mode === 'stroke') {
      setBanner('积分赛与比杆即将支持');
      return;
    }

    if (players.length < 2) {
      setError('至少需要 2 名玩家');
      return;
    }

    for (let i = 0; i < players.length; i++) {
      const n = parseInt(players[i].hcp.replace(/\s/g, ''), 10);
      if (!Number.isFinite(n) || n < 0 || n > 54) {
        setError('差点请输入 0–54 的整数');
        return;
      }
    }

    const unit = parseInt(unitStr.replace(/\s|,|，/g, ''), 10);
    if (!Number.isFinite(unit) || unit <= 0) {
      setError('单位金额请输入正整数');
      return;
    }

    const netByHole: number[][] = [];
    for (let p = 0; p < players.length; p++) {
      const row: number[] = [];
      for (let h = 0; h < 18; h++) {
        const raw = scores[p]?.[h]?.trim() ?? '';
        if (raw === '') {
          setError(`请填写第 ${p + 1} 位玩家第 ${h + 1} 洞的净杆`);
          return;
        }
        const v = parseInt(raw, 10);
        if (!Number.isFinite(v) || v < 1 || v > 15) {
          setError(`净杆须为 1–15 的整数（玩家 ${p + 1} 洞 ${h + 1}）`);
          return;
        }
        row.push(v);
      }
      netByHole.push(row);
    }

    const out =
      mode === 'nassau' ? payoutsNassau(netByHole, unit) : payoutsMatchPlay(netByHole, unit);

    setPayouts(out);
  };

  return (
    <View style={s.root}>
      <View style={[s.header, { paddingTop: padTop }]}>
        <Text style={s.headerTitle}>赌球</Text>
        <Text style={s.headerSub}>比洞 · Nassau · 积分赛</Text>
      </View>

      <TopTabNav />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
        keyboardShouldPersistTaps="handled">
        <Text style={s.sectionLabel}>本局玩家</Text>
        <View style={s.card}>
          {players.map((pl, idx) => (
            <View key={idx} style={s.playerRow}>
              <TextInput
                style={[s.input, s.inputName]}
                placeholder="名字"
                placeholderTextColor={TEXT_SECONDARY}
                value={pl.name}
                onChangeText={(t) => updatePlayer(idx, 'name', t)}
              />
              <TextInput
                style={[s.input, s.inputHcp]}
                placeholder="差点"
                placeholderTextColor={TEXT_SECONDARY}
                keyboardType="number-pad"
                value={pl.hcp}
                onChangeText={(t) => updatePlayer(idx, 'hcp', t.replace(/[^0-9]/g, ''))}
              />
            </View>
          ))}
          {canAddPlayer ? (
            <Pressable style={s.addPlayerBtn} onPress={addPlayer}>
              <Text style={s.addPlayerText}>+ 添加玩家</Text>
            </Pressable>
          ) : null}
        </View>

        <Text style={s.sectionLabel}>赌法</Text>
        <View style={s.card}>
          <View style={s.modeRow}>
            {MODE_LABELS.map((m) => {
              const active = mode === m.id;
              return (
                <Pressable
                  key={m.id}
                  style={[s.modeChip, active && s.modeChipActive]}
                  onPress={() => setMode(m.id)}>
                  <Text style={[s.modeChipTitle, active && s.modeChipTitleActive]}>{m.title}</Text>
                  {m.sub ? (
                    <Text style={[s.modeChipSub, active && s.modeChipSubActive]} numberOfLines={1}>
                      {m.sub}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        <Text style={s.sectionLabel}>单位金额（¥）</Text>
        <View style={s.card}>
          <TextInput
            style={s.inputFull}
            keyboardType="number-pad"
            value={unitStr}
            onChangeText={(t) => setUnitStr(t.replace(/[^0-9]/g, ''))}
          />
        </View>

        <Text style={s.sectionLabel}>各洞成绩</Text>
        <View style={s.card}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled>
            <View>
              <View style={s.gridHeaderRow}>
                {Array.from({ length: 9 }, (_, i) => (
                  <Text key={`h-${i}`} style={s.gridHoleLabel}>
                    {i + 1}
                  </Text>
                ))}
                <View style={s.gridGap} />
                {Array.from({ length: 9 }, (_, i) => (
                  <Text key={`h2-${i}`} style={s.gridHoleLabel}>
                    {i + 10}
                  </Text>
                ))}
              </View>
              {players.map((_, pi) => (
                <View key={pi} style={s.gridPlayerRow}>
                  {Array.from({ length: 9 }, (_, hi) => (
                    <TextInput
                      key={`c-${pi}-${hi}`}
                      style={s.gridCell}
                      keyboardType="number-pad"
                      maxLength={2}
                      value={scores[pi]?.[hi] ?? ''}
                      onChangeText={(t) => updateCell(pi, hi, t.replace(/[^0-9]/g, ''))}
                    />
                  ))}
                  <View style={s.gridGap} />
                  {Array.from({ length: 9 }, (_, hi) => (
                    <TextInput
                      key={`c2-${pi}-${hi}`}
                      style={s.gridCell}
                      keyboardType="number-pad"
                      maxLength={2}
                      value={scores[pi]?.[hi + 9] ?? ''}
                      onChangeText={(t) => updateCell(pi, hi + 9, t.replace(/[^0-9]/g, ''))}
                    />
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>
          <Text style={s.gridHint}>每格填该洞净杆（按差点让杆后的杆数，用于比洞）</Text>
        </View>

        <Text style={s.sectionLabel}>结算</Text>
        <View style={s.card}>
          <Pressable style={s.calcBtn} onPress={handleCalculate}>
            <Text style={s.calcBtnText}>计算结果</Text>
          </Pressable>
          {error ? <Text style={s.errorText}>{error}</Text> : null}
          {banner ? <Text style={s.bannerText}>{banner}</Text> : null}
          {payouts
            ? payouts.map((amt, i) => (
                <View key={i} style={s.resultRow}>
                  <Text style={s.resultName}>{players[i]?.name?.trim() || `玩家 ${i + 1}`}</Text>
                  <Text style={[s.resultAmt, amt >= 0 ? s.resultWin : s.resultLoss]}>
                    {amt >= 0 ? '+' : '-'}¥{Math.abs(amt)}
                  </Text>
                </View>
              ))
            : null}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: {
    backgroundColor: HEADER_BG,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: WHITE },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.72)', marginTop: 6 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32 + TAB_BAR_SCROLL_EXTRA,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    marginBottom: 8,
    marginTop: 4,
  },
  card: {
    backgroundColor: WHITE,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    padding: 14,
    marginBottom: 12,
  },
  playerRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 15,
    color: TEXT_MAIN,
  },
  inputName: { flex: 1 },
  inputHcp: { width: 72, textAlign: 'center' as const },
  inputFull: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 16,
    color: TEXT_MAIN,
  },
  addPlayerBtn: {
    marginTop: 4,
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  addPlayerText: { color: GREEN_BTN, fontSize: 14, fontWeight: '600' },
  modeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modeChip: {
    flex: 1,
    minWidth: 72,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    backgroundColor: WHITE,
  },
  modeChipActive: {
    backgroundColor: GREEN_BTN,
    borderColor: GREEN_BTN,
  },
  modeChipTitle: { fontSize: 13, fontWeight: '700', color: TEXT_MAIN },
  modeChipTitleActive: { color: WHITE },
  modeChipSub: { fontSize: 9, color: TEXT_SECONDARY, marginTop: 2 },
  modeChipSubActive: { color: 'rgba(255,255,255,0.85)' },
  calcBtn: {
    backgroundColor: GREEN_BTN,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  calcBtnText: { color: WHITE, fontSize: 16, fontWeight: '700' },
  errorText: { marginTop: 10, fontSize: 13, color: LOSS },
  bannerText: { marginTop: 10, fontSize: 14, color: TEXT_SECONDARY, textAlign: 'center' },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
  },
  resultName: { fontSize: 15, fontWeight: '600', color: TEXT_MAIN, flex: 1 },
  resultAmt: { fontSize: 17, fontWeight: '800' },
  resultWin: { color: WIN },
  resultLoss: { color: LOSS },
  gridHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  gridPlayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  gridHoleLabel: {
    width: 34,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  gridCell: {
    width: 34,
    height: 34,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    borderRadius: 6,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_MAIN,
    padding: 0,
  },
  gridGap: { width: 12 },
  gridHint: { marginTop: 8, fontSize: 11, color: TEXT_SECONDARY, lineHeight: 16 },
});
