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
import { TAB_BAR_SCROLL_EXTRA } from '@/constants/theme';

const BG = '#0d1f10';
const WHITE = '#ffffff';
const CARD = 'rgba(255,255,255,0.05)';
const CARD_BORDER = 'rgba(255,255,255,0.08)';
const TEXT_SECONDARY = 'rgba(255,255,255,0.55)';
const SECTION_LABEL = 'rgba(255,255,255,0.45)';
const PLACEHOLDER = 'rgba(255,255,255,0.35)';
const INPUT_BG = 'rgba(255,255,255,0.06)';
const INPUT_BORDER = 'rgba(255,255,255,0.12)';
const ACCENT = '#a3e635';
const ACCENT_TEXT = '#0d1f10';
const MODE_SELECTED_BG = '#1a3820';
const MODE_UNSELECTED_BG = 'rgba(255,255,255,0.08)';
const DIVIDER = 'rgba(255,255,255,0.08)';
const WIN = '#a3e635';
const LOSS = '#f87171';
const HEADER_SUB = 'rgba(255,255,255,0.5)';

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

  const inputBase = {
    backgroundColor: INPUT_BG,
    borderColor: INPUT_BORDER,
    color: WHITE,
  };

  return (
    <View style={[s.root, { backgroundColor: BG }]}>
      <View style={s.header}>
        <Text style={[s.headerTitle, { color: WHITE }]}>赌球</Text>
        <Text style={[s.headerSub, { color: HEADER_SUB }]}>比洞 · Nassau · 积分赛</Text>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
        keyboardShouldPersistTaps="handled">
        <Text style={[s.sectionLabel, { color: SECTION_LABEL }]}>本局玩家</Text>
        <View style={[s.card, { backgroundColor: CARD, borderColor: CARD_BORDER }]}>
          {players.map((pl, idx) => (
            <View key={idx} style={s.playerRow}>
              <TextInput
                style={[s.input, s.inputName, inputBase]}
                placeholder="名字"
                placeholderTextColor={PLACEHOLDER}
                value={pl.name}
                onChangeText={(t) => updatePlayer(idx, 'name', t)}
              />
              <TextInput
                style={[s.input, s.inputHcp, inputBase]}
                placeholder="差点"
                placeholderTextColor={PLACEHOLDER}
                keyboardType="number-pad"
                value={pl.hcp}
                onChangeText={(t) => updatePlayer(idx, 'hcp', t.replace(/[^0-9]/g, ''))}
              />
            </View>
          ))}
          {canAddPlayer ? (
            <Pressable style={s.addPlayerBtn} onPress={addPlayer}>
              <Text style={[s.addPlayerText, { color: ACCENT }]}>+ 添加玩家</Text>
            </Pressable>
          ) : null}
        </View>

        <Text style={[s.sectionLabel, { color: SECTION_LABEL }]}>赌法</Text>
        <View style={[s.card, { backgroundColor: CARD, borderColor: CARD_BORDER }]}>
          <View style={s.modeRow}>
            {MODE_LABELS.map((m) => {
              const active = mode === m.id;
              return (
                <Pressable
                  key={m.id}
                  style={[
                    s.modeChip,
                    {
                      backgroundColor: active ? MODE_SELECTED_BG : MODE_UNSELECTED_BG,
                      borderColor: active ? MODE_SELECTED_BG : 'rgba(255,255,255,0.08)',
                    },
                  ]}
                  onPress={() => setMode(m.id)}>
                  <Text
                    style={[
                      s.modeChipTitle,
                      { color: active ? ACCENT : WHITE },
                    ]}>
                    {m.title}
                  </Text>
                  {m.sub ? (
                    <Text
                      style={[
                        s.modeChipSub,
                        { color: active ? ACCENT : TEXT_SECONDARY },
                      ]}
                      numberOfLines={1}>
                      {m.sub}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        <Text style={[s.sectionLabel, { color: SECTION_LABEL }]}>单位金额（¥）</Text>
        <View style={[s.card, { backgroundColor: CARD, borderColor: CARD_BORDER }]}>
          <TextInput
            style={[s.inputFull, inputBase]}
            keyboardType="number-pad"
            placeholderTextColor={PLACEHOLDER}
            value={unitStr}
            onChangeText={(t) => setUnitStr(t.replace(/[^0-9]/g, ''))}
          />
        </View>

        <Text style={[s.sectionLabel, { color: SECTION_LABEL }]}>各洞成绩</Text>
        <View style={[s.card, { backgroundColor: CARD, borderColor: CARD_BORDER }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled>
            <View>
              <View style={s.gridHeaderRow}>
                {Array.from({ length: 9 }, (_, i) => (
                  <Text key={`h-${i}`} style={[s.gridHoleLabel, { color: SECTION_LABEL }]}>
                    {i + 1}
                  </Text>
                ))}
                <View style={s.gridGap} />
                {Array.from({ length: 9 }, (_, i) => (
                  <Text key={`h2-${i}`} style={[s.gridHoleLabel, { color: SECTION_LABEL }]}>
                    {i + 10}
                  </Text>
                ))}
              </View>
              {players.map((_, pi) => (
                <View key={pi} style={s.gridPlayerRow}>
                  {Array.from({ length: 9 }, (_, hi) => (
                    <TextInput
                      key={`c-${pi}-${hi}`}
                      style={[s.gridCell, inputBase]}
                      keyboardType="number-pad"
                      maxLength={2}
                      placeholderTextColor={PLACEHOLDER}
                      value={scores[pi]?.[hi] ?? ''}
                      onChangeText={(t) => updateCell(pi, hi, t.replace(/[^0-9]/g, ''))}
                    />
                  ))}
                  <View style={s.gridGap} />
                  {Array.from({ length: 9 }, (_, hi) => (
                    <TextInput
                      key={`c2-${pi}-${hi}`}
                      style={[s.gridCell, inputBase]}
                      keyboardType="number-pad"
                      maxLength={2}
                      placeholderTextColor={PLACEHOLDER}
                      value={scores[pi]?.[hi + 9] ?? ''}
                      onChangeText={(t) => updateCell(pi, hi + 9, t.replace(/[^0-9]/g, ''))}
                    />
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>
          <Text style={[s.gridHint, { color: TEXT_SECONDARY }]}>
            每格填该洞净杆（按差点让杆后的杆数，用于比洞）
          </Text>
        </View>

        <Text style={[s.sectionLabel, { color: SECTION_LABEL }]}>结算</Text>
        <View style={[s.card, { backgroundColor: CARD, borderColor: CARD_BORDER }]}>
          <Pressable style={[s.calcBtn, { backgroundColor: ACCENT }]} onPress={handleCalculate}>
            <Text style={[s.calcBtnText, { color: ACCENT_TEXT }]}>计算结果</Text>
          </Pressable>
          {error ? (
            <Text style={[s.errorText, { color: LOSS }]}>{error}</Text>
          ) : null}
          {banner ? (
            <Text style={[s.bannerText, { color: TEXT_SECONDARY }]}>{banner}</Text>
          ) : null}
          {payouts
            ? payouts.map((amt, i) => (
                <View
                  key={i}
                  style={[s.resultRow, { borderTopColor: DIVIDER }]}>
                  <Text style={[s.resultName, { color: WHITE }]}>
                    {players[i]?.name?.trim() || `玩家 ${i + 1}`}
                  </Text>
                  <Text
                    style={[
                      s.resultAmt,
                      { color: amt >= 0 ? WIN : LOSS },
                    ]}>
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
  root: { flex: 1 },
  header: {
    backgroundColor: '#0d1f10',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 24, fontWeight: '700', marginBottom: 2 },
  headerSub: { fontSize: 12 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32 + TAB_BAR_SCROLL_EXTRA,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 4,
  },
  card: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginBottom: 12,
  },
  playerRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 15,
  },
  inputName: { flex: 1 },
  inputHcp: { width: 72, textAlign: 'center' as const },
  inputFull: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 16,
  },
  addPlayerBtn: {
    marginTop: 4,
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  addPlayerText: { fontSize: 14, fontWeight: '600' },
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
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  modeChipTitle: { fontSize: 13, fontWeight: '700' },
  modeChipSub: { fontSize: 9, marginTop: 2 },
  calcBtn: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  calcBtnText: { fontSize: 16, fontWeight: '800' },
  errorText: { marginTop: 10, fontSize: 13 },
  bannerText: { marginTop: 10, fontSize: 14, textAlign: 'center' },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  resultName: { fontSize: 15, fontWeight: '600', flex: 1 },
  resultAmt: { fontSize: 17, fontWeight: '800' },
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
  },
  gridCell: {
    width: 34,
    height: 34,
    borderWidth: 1,
    borderRadius: 6,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    padding: 0,
  },
  gridGap: { width: 12 },
  gridHint: { marginTop: 8, fontSize: 11, lineHeight: 16 },
});
