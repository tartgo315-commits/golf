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

import { CourseStrategyAiFlow } from '@/components/CourseStrategyAiFlow';
import { TAB_BAR_SCROLL_EXTRA } from '@/constants/theme';

const PAGE_BG = '#0d1b11';
const CARD_BG = '#16261c';
const ACCENT = '#b5ff3a';
const ACCENT_TEXT = '#0d1b11';
const TEXT_MAIN = '#e8f0e5';
const TEXT_SEC = '#a8b5ac';
const TEXT_TERTIARY = '#8a9a8e';
const TEXT_MUTED = '#5a6b5f';
const BORDER_SUB = 'rgba(255,255,255,0.08)';
const INPUT_BG = '#0d1b11';
const INPUT_BORDER = 'rgba(255,255,255,0.06)';
const PLACEHOLDER = '#5a6b5f';
const SEG_OUTER = '#0d1b11';
const SEG_SELECTED = '#2d5436';
const DIVIDER = 'rgba(255,255,255,0.06)';
const WIN = '#b5ff3a';
const LOSS = '#f87171';
const AVATAR_OTHER_BG = 'rgba(255,255,255,0.04)';

type BetMode = 'match' | 'nassau' | 'stableford' | 'stroke';

type PlayerRow = { name: string; hcp: string };

type UnitPreset = '500' | '1000' | '2000' | 'custom';

function detectUnitPreset(str: string): UnitPreset {
  const n = parseInt(str.replace(/\s|,|，/g, ''), 10);
  if (!Number.isFinite(n)) return 'custom';
  if (n === 500) return '500';
  if (n === 1000) return '1000';
  if (n === 2000) return '2000';
  return 'custom';
}

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
  { id: 'match' as const, title: '比洞', sub: 'Match' },
  { id: 'nassau' as const, title: 'Nassau', sub: '(3x9)' },
  { id: 'stableford' as const, title: '积分赛', sub: 'Stableford' },
  { id: 'stroke' as const, title: '比杆', sub: 'Stroke' },
] as const;

function PlayerAvatar({ index, name }: { index: number; name: string }) {
  const isMe = index === 0;
  const raw = name.trim();
  const letter = raw.length > 0 ? raw.charAt(0).toUpperCase() : '我';
  const label = isMe ? letter : String(index + 1);
  return (
    <View style={[s.avatar, isMe ? s.avatarMe : s.avatarOther]}>
      <Text style={[s.avatarTxt, isMe ? s.avatarTxtMe : s.avatarTxtOther]}>{label}</Text>
    </View>
  );
}

export default function BetScreen() {
  const [players, setPlayers] = useState<PlayerRow[]>([
    { name: '', hcp: '18' },
    { name: '', hcp: '18' },
  ]);
  const [mode, setMode] = useState<BetMode>('match');
  const [unitStr, setUnitStr] = useState('1000');
  const [unitPreset, setUnitPreset] = useState<UnitPreset>('1000');
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

  const applyUnitPreset = (p: UnitPreset) => {
    if (p === 'custom') {
      setUnitPreset('custom');
      return;
    }
    const map = { '500': '500', '1000': '1000', '2000': '2000' } as const;
    setUnitStr(map[p]);
    setUnitPreset(p);
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

  const onUnitTextChange = (t: string) => {
    const next = t.replace(/[^0-9]/g, '');
    setUnitStr(next);
    setUnitPreset(detectUnitPreset(next));
  };

  const inputBase = {
    backgroundColor: INPUT_BG,
    borderColor: INPUT_BORDER,
    color: TEXT_MAIN,
  };

  const gridInput = {
    ...inputBase,
    borderWidth: 1,
    borderRadius: 6,
  };

  return (
    <View style={[s.root, { backgroundColor: PAGE_BG }]}>
      <View style={s.header}>
        <Text style={s.headerTitle}>比赛设置</Text>
        <Text style={s.headerSub}>AI 战术分析 · 比洞 · Nassau · 积分赛</Text>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
        keyboardShouldPersistTaps="handled">
        <CourseStrategyAiFlow>
          <>
            <View style={s.sectionHead}>
              <Text style={s.sectionHeadTitle}>本局玩家</Text>
              <Text style={s.sectionHeadMeta}>
                {players.length} / 4
              </Text>
            </View>
            <View style={s.card}>
              {players.map((pl, idx) => (
                <View key={idx} style={s.playerRow}>
                  <PlayerAvatar index={idx} name={pl.name} />
                  <TextInput
                    style={[s.inputName, inputBase]}
                    placeholder="名字"
                    placeholderTextColor={PLACEHOLDER}
                    value={pl.name}
                    onChangeText={(t) => updatePlayer(idx, 'name', t)}
                  />
                  <TextInput
                    style={[s.inputHcp, inputBase]}
                    placeholder="—"
                    placeholderTextColor={PLACEHOLDER}
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

            <Text style={s.sectionLabel}>玩法</Text>
            <View style={s.segOuter}>
              {MODE_LABELS.map((m) => {
                const active = mode === m.id;
                return (
                  <Pressable
                    key={m.id}
                    style={[s.segChip, active && s.segChipOn]}
                    onPress={() => setMode(m.id)}>
                    <Text style={[s.segTitle, active && s.segTitleOn]}>{m.title}</Text>
                    <Text style={[s.segSub, active && s.segSubOn]}>{m.sub}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={s.sectionLabel}>单位金额</Text>
            <View style={s.card}>
              <View style={s.unitRow}>
                <Text style={s.unitYen}>¥</Text>
                <TextInput
                  style={s.unitInput}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={TEXT_MUTED}
                  value={unitStr}
                  onChangeText={onUnitTextChange}
                />
                <Text style={s.unitSuffix}>/ 洞</Text>
              </View>
              <View style={s.unitPills}>
                {(
                  [
                    { id: '500' as const, label: '500' },
                    { id: '1000' as const, label: '1000' },
                    { id: '2000' as const, label: '2000' },
                    { id: 'custom' as const, label: '自定义' },
                  ] as const
                ).map((pill) => {
                  const sel = unitPreset === pill.id;
                  return (
                    <Pressable
                      key={pill.id}
                      style={[s.unitPill, sel && s.unitPillOn]}
                      onPress={() => applyUnitPreset(pill.id)}>
                      <Text style={[s.unitPillTxt, sel && s.unitPillTxtOn]}>{pill.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
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
                          style={[s.gridCell, gridInput]}
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
                          style={[s.gridCell, gridInput]}
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
              <Text style={s.gridHint}>
                每格填该洞净杆（按差点让杆后的杆数，用于比洞）
              </Text>
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
                      <Text style={s.resultName}>
                        {players[i]?.name?.trim() || `玩家 ${i + 1}`}
                      </Text>
                      <Text style={[s.resultAmt, { color: amt >= 0 ? WIN : LOSS }]}>
                        {amt >= 0 ? '+' : '-'}¥{Math.abs(amt)}
                      </Text>
                    </View>
                  ))
                : null}
            </View>
          </>
        </CourseStrategyAiFlow>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: PAGE_BG,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: TEXT_MAIN,
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  headerSub: { fontSize: 12, fontWeight: '600', color: TEXT_TERTIARY, lineHeight: 17 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 32 + TAB_BAR_SCROLL_EXTRA,
  },

  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginTop: 4,
  },
  sectionHeadTitle: { fontSize: 13, fontWeight: '700', color: TEXT_SEC },
  sectionHeadMeta: { fontSize: 11, fontWeight: '600', color: TEXT_MUTED },

  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_SEC,
    marginBottom: 8,
    marginTop: 12,
  },
  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: CARD_BG,
    padding: 14,
    marginBottom: 4,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarMe: { backgroundColor: ACCENT },
  avatarOther: { backgroundColor: AVATAR_OTHER_BG },
  avatarTxt: { fontSize: 14, fontWeight: '800' },
  avatarTxtMe: { color: ACCENT_TEXT },
  avatarTxtOther: { color: TEXT_SEC },
  inputName: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 14,
    fontWeight: '600',
  },
  inputHcp: {
    width: 54,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 4,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 15,
    fontWeight: '800',
    color: ACCENT,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  addPlayerBtn: {
    marginTop: 4,
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  addPlayerText: { fontSize: 14, fontWeight: '700', color: ACCENT },

  segOuter: {
    flexDirection: 'row',
    backgroundColor: SEG_OUTER,
    borderRadius: 9,
    padding: 3,
    gap: 4,
    marginBottom: 8,
  },
  segChip: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 10,
    paddingHorizontal: 2,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  segChipOn: { backgroundColor: SEG_SELECTED },
  segTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_TERTIARY,
    textAlign: 'center',
  },
  segTitleOn: { fontWeight: '800', color: ACCENT },
  segSub: {
    fontSize: 10,
    fontWeight: '600',
    color: TEXT_TERTIARY,
    opacity: 0.75,
    marginTop: 2,
    textAlign: 'center',
  },
  segSubOn: { color: ACCENT, opacity: 0.85 },

  unitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  unitYen: { fontSize: 18, fontWeight: '700', color: TEXT_MUTED },
  unitInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '800',
    color: ACCENT,
    letterSpacing: -1,
    paddingVertical: 4,
    minWidth: 0,
  },
  unitSuffix: { fontSize: 13, fontWeight: '600', color: TEXT_SEC },
  unitPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  unitPill: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER_SUB,
    backgroundColor: 'transparent',
  },
  unitPillOn: {
    backgroundColor: SEG_SELECTED,
    borderColor: SEG_SELECTED,
  },
  unitPillTxt: { fontSize: 13, fontWeight: '700', color: TEXT_TERTIARY },
  unitPillTxtOn: { fontWeight: '800', color: ACCENT },

  calcBtn: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: ACCENT,
  },
  calcBtnText: { fontSize: 16, fontWeight: '800', color: ACCENT_TEXT },
  errorText: { marginTop: 10, fontSize: 13, fontWeight: '600', color: LOSS },
  bannerText: { marginTop: 10, fontSize: 14, fontWeight: '600', color: TEXT_SEC, textAlign: 'center' },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DIVIDER,
  },
  resultName: { fontSize: 15, fontWeight: '600', color: TEXT_MAIN, flex: 1 },
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
    color: TEXT_MUTED,
  },
  gridCell: {
    width: 34,
    height: 34,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    padding: 0,
  },
  gridGap: { width: 12 },
  gridHint: { marginTop: 8, fontSize: 11, fontWeight: '600', color: TEXT_SEC, lineHeight: 16 },
});
