import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { GOLF } from '@/constants/golfTheme';
import { createBetsForRound, createRound, searchFriendsByEmailOrUsername } from '@/lib/scorecardApi';
import {
  SIDE_GAME_CATALOG,
  isPlayerCountOkForGame,
  sideGameTypeShortLabel,
} from '@/utils/sideGameCatalog';

const TEE_OPTS = [
  { key: 'white', label: '白' },
  { key: 'yellow', label: '黄' },
  { key: 'blue', label: '蓝' },
  { key: 'red', label: '红' },
];

const PAR_OPTS = [70, 71, 72, 73, 74];

function toOptInt(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.round(n));
}

function digitsOnly(t) {
  return String(t ?? '').replace(/[^0-9]/g, '');
}

function makeBetDraftId() {
  return `bd_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

const BET_TYPE_ORDER = [
  'match_play',
  'stroke_play',
  'stableford',
  'nassau_pack',
  'points_8421',
  'fixed_lasi',
  'rotating_lasi',
  'landlord',
  'trumpet',
];

function gameCardTitle(type) {
  return sideGameTypeShortLabel(type);
}

export default function NewRoundScreen() {
  const router = useRouter();
  const [courseName, setCourseName] = useState('');
  const [teeColor, setTeeColor] = useState('white');
  const [playedAt, setPlayedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [holes, setHoles] = useState(18);
  const [weather, setWeather] = useState('');
  const [teeTime, setTeeTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [front9Minutes, setFront9Minutes] = useState('');
  const [back9Minutes, setBack9Minutes] = useState('');
  const [parSetting, setParSetting] = useState(72);

  const [friendQuery, setFriendQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [picked, setPicked] = useState([]); // { userId, username }

  const [mode, setMode] = useState('score'); // 'score' | 'wager'
  const [isPublicBets, setIsPublicBets] = useState(false);
  const [visibility, setVisibility] = useState('public'); // 'public' | 'friends' | 'private'
  const [betDrafts, setBetDrafts] = useState(() => [
    { id: makeBetDraftId(), gameType: 'match_play', unitStr: '1000', settlementTiming: 'per_hole' },
  ]);

  const [creating, setCreating] = useState(false);

  const canCreate = useMemo(() => {
    return courseName.trim().length > 0 && (holes === 9 || holes === 18) && !creating;
  }, [courseName, holes, creating]);

  async function onSearch() {
    const q = friendQuery.trim();
    if (!q) return;
    try {
      setSearching(true);
      const list = await searchFriendsByEmailOrUsername(q);
      setSearchResults(list);
      if (list.length === 0) {
        Alert.alert('搜索球友', '未找到该用户');
      }
    } catch (e) {
      Alert.alert('搜索球友', e instanceof Error ? e.message : '搜索失败，请重试');
    } finally {
      setSearching(false);
    }
  }

  function togglePick(u) {
    setPicked((prev) => {
      const exists = prev.some((x) => x.userId === u.userId);
      if (exists) return prev.filter((x) => x.userId !== u.userId);
      return [...prev, u];
    });
  }

  async function onCreate() {
    if (!canCreate) return;
    try {
      setCreating(true);
      const playerCount = 1 + picked.length;
      if (mode === 'wager') {
        const ok = betDrafts.every((b) => isPlayerCountOkForGame(b.gameType, playerCount));
        if (!ok) {
          Alert.alert('新建一局', '当前球友人数与所选玩法不匹配，请调整玩法或球友人数');
          return;
        }
      }
      const { roundId } = await createRound({
        courseName,
        teeColor,
        playedAt,
        holes: holes === 9 ? 9 : 18,
        playerUserIds: picked.map((x) => x.userId),
        weather,
        teeTime,
        durationMinutes: toOptInt(durationMinutes),
        front9Minutes: toOptInt(front9Minutes),
        back9Minutes: toOptInt(back9Minutes),
        parSetting,
        visibility,
      });

      if (mode === 'wager') {
        const payload = betDrafts.slice(0, 4).map((b, idx) => ({
          betType: b.gameType,
          unitAmount: Number(digitsOnly(b.unitStr || '1000')) || 1000,
          settlementTiming: b.settlementTiming === 'end_total' ? 'end_total' : 'per_hole',
          sortOrder: idx,
          isPublic: isPublicBets,
        }));
        await createBetsForRound(roundId, payload);
      }
      router.replace(`/rounds/${roundId}`);
    } catch (e) {
      Alert.alert('新建一局', e instanceof Error ? e.message : '创建失败，请重试');
    } finally {
      setCreating(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <Text style={styles.backText}>‹ 返回</Text>
        </Pressable>

        <Text style={styles.title}>新建一局</Text>
        <Text style={styles.subtitle}>填写基本信息并邀请球友</Text>

        <View style={styles.card}>
          <Text style={styles.label}>球场名称</Text>
          <TextInput
            style={styles.input}
            value={courseName}
            onChangeText={setCourseName}
            placeholder="例如 XX 高尔夫俱乐部"
            placeholderTextColor={GOLF.muted}
          />

          <Text style={styles.label}>发球台颜色</Text>
          <View style={styles.row}>
            {TEE_OPTS.map((o) => {
              const on = o.key === teeColor;
              return (
                <Pressable
                  key={o.key}
                  onPress={() => setTeeColor(o.key)}
                  style={[styles.chip, on && styles.chipOn]}
                >
                  <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{o.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>日期</Text>
          <TextInput
            style={styles.input}
            value={playedAt}
            onChangeText={setPlayedAt}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={GOLF.muted}
          />

          <Text style={styles.label}>洞数</Text>
          <View style={styles.row}>
            {[9, 18].map((h) => {
              const on = h === holes;
              return (
                <Pressable key={h} onPress={() => setHoles(h)} style={[styles.chip, on && styles.chipOn]}>
                  <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{h} 洞</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>上场天气（选填）</Text>
          <TextInput
            style={styles.input}
            value={weather}
            onChangeText={setWeather}
            placeholder="如：晴天 28℃ 微风"
            placeholderTextColor={GOLF.muted}
          />

          <Text style={styles.label}>开球时间（选填）</Text>
          <TextInput
            style={styles.input}
            value={teeTime}
            onChangeText={setTeeTime}
            placeholder="如：07:32"
            placeholderTextColor={GOLF.muted}
          />

          <Text style={styles.label}>整场用时（选填，分钟）</Text>
          <TextInput
            style={styles.input}
            value={durationMinutes}
            onChangeText={setDurationMinutes}
            placeholder="例如 255"
            placeholderTextColor={GOLF.muted}
            keyboardType="number-pad"
          />

          <Text style={styles.label}>前9用时（选填，分钟）</Text>
          <TextInput
            style={styles.input}
            value={front9Minutes}
            onChangeText={setFront9Minutes}
            placeholder="例如 125"
            placeholderTextColor={GOLF.muted}
            keyboardType="number-pad"
          />

          <Text style={styles.label}>后9用时（选填，分钟）</Text>
          <TextInput
            style={styles.input}
            value={back9Minutes}
            onChangeText={setBack9Minutes}
            placeholder="例如 130"
            placeholderTextColor={GOLF.muted}
            keyboardType="number-pad"
          />

          <Text style={styles.label}>标准杆设置（选填）</Text>
          <View style={styles.row}>
            {PAR_OPTS.map((p) => {
              const on = p === parSetting;
              return (
                <Pressable key={p} onPress={() => setParSetting(p)} style={[styles.chip, on && styles.chipOn]}>
                  <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{`Par${p}`}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>邀请球友</Text>
          <Text style={styles.sectionSub}>输入邮箱或昵称搜索（仅显示已注册用户）</Text>

          <View style={styles.searchRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              value={friendQuery}
              onChangeText={setFriendQuery}
              placeholder="例如 golfer@example.com 或 Lee"
              placeholderTextColor={GOLF.muted}
              autoCapitalize="none"
            />
            <Pressable style={[styles.searchBtn, searching && styles.disabled]} onPress={onSearch} disabled={searching}>
              {searching ? <ActivityIndicator color="#fff" /> : <Text style={styles.searchBtnTxt}>搜索</Text>}
            </Pressable>
          </View>

          {searchResults.map((u) => {
            const on = picked.some((x) => x.userId === u.userId);
            return (
              <Pressable key={u.userId} onPress={() => togglePick(u)} style={styles.pickRow}>
                <Text style={styles.pickName}>{u.username}</Text>
                <Text style={[styles.pickMeta, on && { color: GOLF.accent }]}>{on ? '已添加' : '添加'}</Text>
              </Pressable>
            );
          })}

          {picked.length > 0 ? (
            <View style={styles.pickedWrap}>
              <Text style={styles.pickedTitle}>已添加：</Text>
              <Text style={styles.pickedText}>{picked.map((x) => x.username).join(' · ')}</Text>
            </View>
          ) : null}
        </View>

        {/* 可见范围 */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>成绩可见范围</Text>
          <Text style={styles.sectionSub}>控制本局成绩在动态流中的显示范围</Text>
          <View style={[styles.row, { marginTop: 10, flexWrap: 'wrap' }]}>
            {[
              { key: 'public', label: '🌐 公开' },
              { key: 'friends', label: '👥 仅好友' },
              { key: 'private', label: '🔒 仅自己' },
            ].map((opt) => (
              <Pressable
                key={opt.key}
                onPress={() => setVisibility(opt.key)}
                style={[styles.chip, visibility === opt.key && styles.chipOn]}
              >
                <Text style={[styles.chipTxt, visibility === opt.key && styles.chipTxtOn]}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>赌球设置</Text>
          <Text style={styles.sectionSub}>可选：只记成绩或配置本场赌局（最多 4 个）</Text>

          <View style={[styles.row, { marginTop: 10 }]}>
            <Pressable
              onPress={() => setMode('score')}
              style={[styles.chip, mode === 'score' && styles.chipOn]}
            >
              <Text style={[styles.chipTxt, mode === 'score' && styles.chipTxtOn]}>只记成绩</Text>
            </Pressable>
            <Pressable
              onPress={() => setMode('wager')}
              style={[styles.chip, mode === 'wager' && styles.chipOn]}
            >
              <Text style={[styles.chipTxt, mode === 'wager' && styles.chipTxtOn]}>赌球</Text>
            </Pressable>
          </View>

          {mode === 'wager' ? (
            <>
              <Text style={styles.label}>玩法选择（人数不符会置灰）</Text>
              {betDrafts.slice(0, 4).map((bd, idx) => {
                const playerCount = 1 + picked.length;
                const title = `赌局 ${idx + 1}`;
                return (
                  <View key={bd.id} style={styles.betBlock}>
                    <View style={styles.betHead}>
                      <Text style={styles.betTitle}>{title}</Text>
                      {betDrafts.length > 1 ? (
                        <Pressable
                          onPress={() => setBetDrafts((prev) => prev.filter((x) => x.id !== bd.id))}
                          hitSlop={8}
                        >
                          <Text style={styles.betRemove}>移除</Text>
                        </Pressable>
                      ) : null}
                    </View>

                    <View style={styles.betCards}>
                      {BET_TYPE_ORDER.map((t) => {
                        const ok = isPlayerCountOkForGame(t, playerCount);
                        const on = bd.gameType === t;
                        const disabled = !ok;
                        return (
                          <Pressable
                            key={t}
                            onPress={() => {
                              if (disabled) return;
                              setBetDrafts((prev) =>
                                prev.map((x) => (x.id === bd.id ? { ...x, gameType: t } : x)),
                              );
                            }}
                            style={[
                              styles.betCard,
                              on && styles.betCardOn,
                              disabled && styles.betCardDisabled,
                            ]}
                            disabled={disabled}
                          >
                            <Text style={[styles.betCardTxt, on && styles.betCardTxtOn]}>
                              {gameCardTitle(t)}
                            </Text>
                            <Text style={styles.betCardSub}>
                              {SIDE_GAME_CATALOG.find((e) => e.type === t)?.playersLabel ?? ''}
                            </Text>
                            {t !== 'match_play' && t !== 'stroke_play' ? (
                              <Text style={styles.betCardSoon}>即将上线</Text>
                            ) : null}
                          </Pressable>
                        );
                      })}
                    </View>

                    <Text style={styles.label}>单位金额（默认 1000）</Text>
                    <TextInput
                      style={styles.input}
                      value={bd.unitStr}
                      onChangeText={(v) =>
                        setBetDrafts((prev) =>
                          prev.map((x) => (x.id === bd.id ? { ...x, unitStr: digitsOnly(v) } : x)),
                        )
                      }
                      placeholder="1000"
                      placeholderTextColor={GOLF.muted}
                      keyboardType="number-pad"
                    />

                    <Text style={styles.label}>结算节奏</Text>
                    <View style={styles.row}>
                      <Pressable
                        onPress={() =>
                          setBetDrafts((prev) =>
                            prev.map((x) =>
                              x.id === bd.id ? { ...x, settlementTiming: 'per_hole' } : x,
                            ),
                          )
                        }
                        style={[styles.chip, bd.settlementTiming === 'per_hole' && styles.chipOn]}
                      >
                        <Text
                          style={[
                            styles.chipTxt,
                            bd.settlementTiming === 'per_hole' && styles.chipTxtOn,
                          ]}
                        >
                          一洞一算
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() =>
                          setBetDrafts((prev) =>
                            prev.map((x) =>
                              x.id === bd.id ? { ...x, settlementTiming: 'end_total' } : x,
                            ),
                          )
                        }
                        style={[styles.chip, bd.settlementTiming === 'end_total' && styles.chipOn]}
                      >
                        <Text
                          style={[
                            styles.chipTxt,
                            bd.settlementTiming === 'end_total' && styles.chipTxtOn,
                          ]}
                        >
                          打完一起算
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}

              {betDrafts.length < 4 ? (
                <Pressable
                  style={[styles.addBetBtn, creating && styles.disabled]}
                  onPress={() =>
                    setBetDrafts((prev) => [
                      ...prev,
                      { id: makeBetDraftId(), gameType: 'match_play', unitStr: '1000', settlementTiming: 'per_hole' },
                    ])
                  }
                  disabled={creating}
                >
                  <Text style={styles.addBetTxt}>＋ 添加另一个赌局</Text>
                </Pressable>
              ) : null}

              <View style={styles.privacyRow}>
                <Pressable
                  onPress={() => setIsPublicBets((x) => !x)}
                  style={[styles.toggle, isPublicBets && styles.toggleOn]}
                >
                  <View style={[styles.toggleKnob, isPublicBets && styles.toggleKnobOn]} />
                </Pressable>
                <View style={{ flex: 1 }}>
                  <Text style={styles.privacyTitle}>公开展示赌局</Text>
                  <Text style={styles.privacySub}>开启后赌局状态将在动态流中展示</Text>
                </View>
              </View>
            </>
          ) : null}
        </View>

        <Pressable style={[styles.primary, (!canCreate || creating) && styles.disabled]} onPress={onCreate} disabled={!canCreate || creating}>
          <Text style={styles.primaryTxt}>{creating ? '创建中…' : '开始记分'}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: GOLF.bg },
  scroll: { padding: 18, paddingTop: Platform.OS === 'web' ? 44 : 22, paddingBottom: 40 },
  back: { marginBottom: 10, alignSelf: 'flex-start' },
  backText: { color: GOLF.accent, fontSize: 16, fontWeight: '700' },
  title: { color: GOLF.text, fontSize: 26, fontWeight: '900', marginTop: 4 },
  subtitle: { color: GOLF.muted, marginTop: 6, marginBottom: 14, lineHeight: 20 },
  card: {
    backgroundColor: GOLF.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GOLF.border,
    padding: 16,
    marginBottom: 12,
  },
  label: { color: GOLF.muted, fontSize: 13, fontWeight: '700', marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: GOLF.inputBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: GOLF.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: GOLF.text,
    fontSize: 15,
    marginBottom: 6,
  },
  row: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginTop: 2 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: GOLF.border,
    backgroundColor: GOLF.inputBg,
  },
  chipOn: { borderColor: GOLF.accent, backgroundColor: 'rgba(94,207,154,0.18)' },
  chipTxt: { color: GOLF.muted, fontWeight: '800' },
  chipTxtOn: { color: GOLF.text },
  sectionTitle: { color: GOLF.text, fontSize: 16, fontWeight: '900' },
  sectionSub: { color: GOLF.muted, marginTop: 6, lineHeight: 18, fontSize: 13 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  searchBtn: { backgroundColor: GOLF.accentDark, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 },
  searchBtnTxt: { color: '#fff', fontWeight: '900' },
  disabled: { opacity: 0.6 },
  pickRow: {
    marginTop: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  pickName: { color: GOLF.text, fontWeight: '800' },
  pickMeta: { color: GOLF.muted, fontWeight: '800' },
  pickedWrap: { marginTop: 10 },
  pickedTitle: { color: GOLF.muted, fontWeight: '800' },
  pickedText: { color: GOLF.text, marginTop: 4, lineHeight: 20 },
  betBlock: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  betHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  betTitle: { color: GOLF.text, fontWeight: '900' },
  betRemove: { color: GOLF.danger, fontWeight: '900' },
  betCards: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4, marginBottom: 8 },
  betCard: {
    width: '48%',
    minWidth: 150,
    backgroundColor: GOLF.inputBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: GOLF.border,
    padding: 12,
  },
  betCardOn: { borderColor: GOLF.accent, backgroundColor: 'rgba(94,207,154,0.14)' },
  betCardDisabled: { opacity: 0.35 },
  betCardTxt: { color: GOLF.text, fontWeight: '900', fontSize: 14 },
  betCardTxtOn: { color: GOLF.text },
  betCardSub: { color: GOLF.muted, marginTop: 6, fontSize: 12, fontWeight: '700' },
  betCardSoon: { color: GOLF.muted, marginTop: 8, fontSize: 12, fontWeight: '900' },
  addBetBtn: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GOLF.border,
    backgroundColor: GOLF.inputBg,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addBetTxt: { color: GOLF.text, fontWeight: '900' },
  privacyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 },
  toggle: {
    width: 44,
    height: 26,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: GOLF.border,
    backgroundColor: 'rgba(255,255,255,0.08)',
    padding: 2,
    justifyContent: 'center',
  },
  toggleOn: { backgroundColor: 'rgba(94,207,154,0.22)', borderColor: 'rgba(94,207,154,0.45)' },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.55)',
    transform: [{ translateX: 0 }],
  },
  toggleKnobOn: { backgroundColor: '#fff', transform: [{ translateX: 16 }] },
  privacyTitle: { color: GOLF.text, fontWeight: '900' },
  privacySub: { color: GOLF.muted, marginTop: 4, fontSize: 12, lineHeight: 16 },
  primary: {
    backgroundColor: GOLF.gold,
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 6,
  },
  primaryTxt: { color: '#1a2e22', fontSize: 16, fontWeight: '900' },
});

