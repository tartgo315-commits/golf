import { useFocusEffect } from '@react-navigation/native';
import { type Href, useRouter } from 'expo-router';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Circle, Line, Path, Svg } from 'react-native-svg';

import { DARK_PAGE } from '@/constants/theme';
import {
  ageFromIso,
  emptyUserProfile,
  loadUserProfile,
  type UserProfileStorage,
  USER_PROFILE_KEY,
  zodiacFromIso,
} from '@/lib/app-storage';
import { calcHandicapIndex, loadHandicapRecords } from '@/lib/handicap';
import { writeJson } from '@/lib/local-storage';

const CARD_FILL = DARK_PAGE.card;
const BG = DARK_PAGE.bg;
const BORDER = DARK_PAGE.cardBorder;
const GREEN = DARK_PAGE.accent;
const TEXT_PRIMARY = DARK_PAGE.text;
const TEXT_SECONDARY = DARK_PAGE.textSecondary;
const TEXT_TERTIARY = DARK_PAGE.textMuted;

const BLOOD: Array<'A' | 'B' | 'AB' | 'O'> = ['A', 'B', 'AB', 'O'];
const GLOVES = ['S', 'M', 'ML', 'L', 'XL'] as const;
const FINGERS = ['短', '中', '长'] as const;
const GOLF_AGE_OPTS = ['< 1年', '1-3年', '3-5年', '5-10年', '10年以上'] as const;
const TEMPO_OPTS = ['慢', '中', '快'] as const;
const FLIGHT_OPTS = ['左曲', '直', '右曲'] as const;

function WristToFloorDiagram() {
  return (
    <Svg width={220} height={120} viewBox="0 0 220 120">
      <Line x1="10" y1="104" x2="210" y2="104" stroke="#d1d5db" strokeWidth="2" />
      <Circle cx="92" cy="22" r="8" fill="none" stroke={GREEN} strokeWidth="2" />
      <Line x1="92" y1="30" x2="92" y2="62" stroke={GREEN} strokeWidth="2" />
      <Line x1="92" y1="40" x2="74" y2="54" stroke={GREEN} strokeWidth="2" />
      <Line x1="92" y1="40" x2="108" y2="54" stroke={GREEN} strokeWidth="2" />
      <Line x1="92" y1="62" x2="80" y2="90" stroke={GREEN} strokeWidth="2" />
      <Line x1="92" y1="62" x2="104" y2="90" stroke={GREEN} strokeWidth="2" />
      <Line x1="108" y1="54" x2="108" y2="66" stroke={GREEN} strokeWidth="2" />
      <Line
        x1="126"
        y1="66"
        x2="126"
        y2="104"
        stroke={GREEN}
        strokeWidth="2"
        strokeDasharray="4,4"
      />
      <Path d="M126 66 L122 72 L130 72 Z" fill={GREEN} />
      <Path d="M126 104 L122 98 L130 98 Z" fill={GREEN} />
    </Svg>
  );
}

function cmToInches(cm: number | null): string {
  if (cm == null || !Number.isFinite(cm)) return '—';
  const inch = cm / 2.54;
  return `${inch.toFixed(1)}"`;
}

function mphToKmh(mph: number | null): string {
  if (mph == null || !Number.isFinite(mph)) return '—';
  return `${(mph * 1.60934).toFixed(0)} km/h`;
}

function isValidIsoDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(y, mo, d);
  return dt.getFullYear() === y && dt.getMonth() === mo && dt.getDate() === d;
}

const PAGE_BG = '#07120b';

export default function UserProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const padBottom = 32 + (Number.isFinite(insets.bottom) ? Math.max(insets.bottom, 12) : 12);
  const [profile, setProfile] = useState<UserProfileStorage>(() => emptyUserProfile());
  const [handicapDisplay, setHandicapDisplay] = useState('暂无');
  const [saveMessage, setSaveMessage] = useState('');
  const [birthdayModal, setBirthdayModal] = useState(false);
  const [birthdayDraft, setBirthdayDraft] = useState('');
  const [courseDraft, setCourseDraft] = useState('');
  const [wristHelp, setWristHelp] = useState(false);
  const [hydrating, setHydrating] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [picker, setPicker] = useState<
    null | 'blood' | 'glove' | 'finger' | 'golfAge'
  >(null);

  const hydrate = useCallback(async () => {
    setHydrating(true);
    try {
      const p = await loadUserProfile();
      setProfile(p);
    } finally {
      setHydrating(false);
    }
  }, []);

  useEffect(() => {
    void loadHandicapRecords().then((recs) => {
      const currentIndex = calcHandicapIndex(recs);
      setHandicapDisplay(typeof currentIndex === 'number' ? currentIndex.toFixed(1) : '暂无');
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      void hydrate();
    }, [hydrate]),
  );

  function patch<K extends keyof UserProfileStorage>(key: K, value: UserProfileStorage[K]) {
    setProfile((prev) => ({ ...prev, [key]: value }));
  }

  function openBirthdayModal() {
    setBirthdayDraft(profile.birthday || '');
    setBirthdayModal(true);
  }

  function confirmBirthday() {
    const t = birthdayDraft.trim();
    if (t && !isValidIsoDate(t)) {
      setSaveMessage('生日格式须为 YYYY-MM-DD');
      return;
    }
    patch('birthday', t);
    setBirthdayModal(false);
    setSaveMessage('');
  }

  function parseOptionalNumber(raw: string): number | null {
    const t = raw.trim();
    if (t === '') return null;
    const n = Number(t.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }

  async function onSaveProfile() {
    setSavingProfile(true);
    setSaveMessage('');
    try {
      if (profile.birthday && !isValidIsoDate(profile.birthday)) {
        setSaveMessage('生日格式须为 YYYY-MM-DD');
        return;
      }
      if (profile.height != null && (profile.height < 80 || profile.height > 260)) {
        setSaveMessage('身高应在 80–260 cm');
        return;
      }
      if (profile.handicap != null) {
        const h = profile.handicap;
        if (h < 0 || h > 54) {
          setSaveMessage('WHS 差点须在 0–54 之间');
          return;
        }
      }
      const payload: UserProfileStorage = {
        ...profile,
        handicap:
          profile.handicap == null
            ? null
            : (Math.round(profile.handicap * 10) / 10) as number,
        homeCourses: profile.homeCourses.slice(0, 3),
      };
      const ok = await writeJson(USER_PROFILE_KEY, payload);
      setSaveMessage(ok ? '已保存到本机' : '保存失败，请重试');
      if (ok) setProfile(payload);
    } finally {
      setSavingProfile(false);
    }
  }

  function addCourse() {
    const name = courseDraft.trim();
    if (!name) return;
    if (profile.homeCourses.length >= 3) return;
    if (profile.homeCourses.includes(name)) {
      setCourseDraft('');
      return;
    }
    patch('homeCourses', [...profile.homeCourses, name]);
    setCourseDraft('');
  }

  function removeCourse(i: number) {
    patch(
      'homeCourses',
      profile.homeCourses.filter((_, idx) => idx !== i),
    );
  }

  const ageStr =
    profile.birthday && isValidIsoDate(profile.birthday)
      ? String(ageFromIso(profile.birthday) ?? '—')
      : '—';
  const zodiacStr =
    profile.birthday && isValidIsoDate(profile.birthday)
      ? zodiacFromIso(profile.birthday)
      : '—';

  function Row({
    label,
    right,
    hint,
  }: {
    label: string;
    right: ReactNode;
    hint?: string;
  }) {
    return (
      <View style={styles.rowBlock}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{label}</Text>
          <View style={styles.rowRight}>{right}</View>
        </View>
        {hint ? <Text style={styles.rowHint}>{hint}</Text> : null}
      </View>
    );
  }

  function ChipRow<T extends string>(opts: readonly T[], value: string, onPick: (v: T) => void) {
    return (
      <View style={styles.chipRow}>
        {opts.map((opt) => {
          const on = value === opt;
          return (
            <Pressable
              key={opt}
              onPress={() => onPick(opt)}
              style={[styles.chip, on && styles.chipOn]}
              disabled={hydrating || savingProfile}
            >
              <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{opt}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  function SelectTrigger(label: string, value: string, onPress: () => void) {
    return (
      <Pressable
        onPress={onPress}
        style={styles.selectTrigger}
        disabled={hydrating || savingProfile}
      >
        <Text style={[styles.selectTriggerTxt, !value && styles.selectTriggerPh]}>
          {value || `选择${label}`}
        </Text>
        <Text style={styles.chev}>▼</Text>
      </Pressable>
    );
  }

  return (
    <View
      style={[
        styles.pageRoot,
        Platform.OS === 'web' ? ({ minHeight: '100vh' } as const) : null,
      ]}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: padBottom },
          Platform.OS === 'web' ? styles.contentWeb : null,
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
      <Text style={styles.sectionTitle}>基本信息</Text>
      <View style={styles.card}>
        <Row
          label="名字/昵称"
          right={
            <TextInput
              value={profile.name}
              onChangeText={(t) => patch('name', t)}
              style={styles.inputFlex}
              placeholderTextColor={TEXT_TERTIARY}
              placeholder="例如 小李"
              editable={!hydrating && !savingProfile}
            />
          }
        />
        <Row
          label="头像"
          right={
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarPlaceholderTxt}>默认</Text>
            </View>
          }
        />
        <Row
          label="生日"
          right={
            <View style={styles.inlineBirth}>
              <Pressable
                onPress={openBirthdayModal}
                style={styles.dateBtn}
                disabled={hydrating || savingProfile}
              >
                <Text style={styles.dateBtnTxt}>
                  {profile.birthday && isValidIsoDate(profile.birthday)
                    ? profile.birthday
                    : '选择日期'}
                </Text>
              </Pressable>
              <Text style={styles.sideMeta}>年龄 {ageStr}</Text>
              <Text style={styles.sideMeta}>星座 {zodiacStr}</Text>
            </View>
          }
        />
        <Row
          label="血型"
          right={SelectTrigger('血型', profile.bloodType, () => setPicker('blood'))}
        />
        <Row
          label="惯用手"
          right={
            <View style={styles.chipRow}>
              {(['left', 'right'] as const).map((h) => (
                <Pressable
                  key={h}
                  onPress={() => patch('dominantHand', h)}
                  style={[styles.chip, profile.dominantHand === h && styles.chipOn]}
                  disabled={hydrating || savingProfile}
                >
                  <Text style={[styles.chipTxt, profile.dominantHand === h && styles.chipTxtOn]}>
                    {h === 'left' ? '左手' : '右手'}
                  </Text>
                </Pressable>
              ))}
            </View>
          }
        />
      </View>

      <Text style={styles.sectionTitle}>身体数据（配杆关键）</Text>
      <View style={styles.card}>
        <Row
          label="身高（cm）"
          right={
            <View style={styles.inlineEnd}>
              <TextInput
                value={profile.height == null ? '' : String(profile.height)}
                onChangeText={(t) => patch('height', parseOptionalNumber(t))}
                style={styles.inputNarrow}
                placeholderTextColor={TEXT_TERTIARY}
                placeholder="175"
                keyboardType="decimal-pad"
                editable={!hydrating && !savingProfile}
              />
              <Text style={styles.sideMeta}>≈ {cmToInches(profile.height)}</Text>
            </View>
          }
        />
        <Row
          label="体重（kg）"
          right={
            <TextInput
              value={profile.weight == null ? '' : String(profile.weight)}
              onChangeText={(t) => patch('weight', parseOptionalNumber(t))}
              style={styles.inputFlex}
              placeholderTextColor={TEXT_TERTIARY}
              placeholder="72"
              keyboardType="decimal-pad"
              editable={!hydrating && !savingProfile}
            />
          }
        />
        <Row
          label="手腕到地面（cm）"
          right={
            <View style={styles.inlineEnd}>
              <TextInput
                value={profile.wristToFloor == null ? '' : String(profile.wristToFloor)}
                onChangeText={(t) => patch('wristToFloor', parseOptionalNumber(t))}
                style={styles.inputNarrow}
                placeholderTextColor={TEXT_TERTIARY}
                placeholder="81"
                keyboardType="decimal-pad"
                editable={!hydrating && !savingProfile}
              />
              <Pressable onPress={() => setWristHelp(true)} style={styles.helpMini}>
                <Text style={styles.helpMiniTxt}>?</Text>
              </Pressable>
            </View>
          }
          hint="自然站立，手腕骨到地面"
        />
        <Row
          label="手套大小"
          right={SelectTrigger('手套', profile.gloveSize, () => setPicker('glove'))}
        />
        <Row
          label="手指长度"
          right={SelectTrigger('手指长度', profile.fingerLength, () => setPicker('finger'))}
        />
      </View>

      <Text style={styles.sectionTitle}>球技数据</Text>
      <View style={styles.card}>
        <View style={styles.rowBlock}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>WHS 差点</Text>
            <View style={styles.rowRight}>
              <TextInput
                value={profile.handicap == null ? '' : String(profile.handicap)}
                onChangeText={(t) => {
                  const n = parseOptionalNumber(t);
                  if (n == null) {
                    patch('handicap', null);
                    return;
                  }
                  patch('handicap', Math.round(n * 10) / 10);
                }}
                style={styles.inputFlex}
                placeholderTextColor={TEXT_TERTIARY}
                placeholder="0–54，一位小数"
                keyboardType="decimal-pad"
                editable={!hydrating && !savingProfile}
              />
            </View>
          </View>
          <Pressable
            onPress={() => router.push('/handicap?from=settings' as Href)}
            style={styles.linkUnder}
          >
            <Text style={styles.linkUnderTxt}>查看差点记录 →</Text>
          </Pressable>
          <View style={styles.readonlyBox}>
            <Text style={styles.readonlyLabel}>系统估算指数</Text>
            <Text style={styles.readonlyText}>{handicapDisplay}</Text>
          </View>
        </View>

        <Row
          label="挥速 Driver（mph）"
          right={
            <View style={styles.inlineEnd}>
              <TextInput
                value={profile.driverSpeed == null ? '' : String(profile.driverSpeed)}
                onChangeText={(t) => patch('driverSpeed', parseOptionalNumber(t))}
                style={styles.inputNarrow}
                placeholderTextColor={TEXT_TERTIARY}
                placeholder="95"
                keyboardType="decimal-pad"
                editable={!hydrating && !savingProfile}
              />
              <Text style={styles.sideMeta}>{mphToKmh(profile.driverSpeed)}</Text>
            </View>
          }
        />
        <Row
          label="球龄"
          right={SelectTrigger('球龄', profile.golfAge, () => setPicker('golfAge'))}
        />
        <Row
          label="挥杆节奏"
          right={
            <ChipRow
              opts={TEMPO_OPTS}
              value={profile.swingTempo}
              onPick={(v) => patch('swingTempo', v)}
            />
          }
        />
        <Row
          label="惯用球路"
          right={
            <ChipRow
              opts={FLIGHT_OPTS}
              value={profile.ballFlight}
              onPick={(v) => patch('ballFlight', v)}
            />
          }
        />
        <Row
          label="常打球场"
          right={
            <View style={styles.courseCol}>
              {profile.homeCourses.map((c, i) => (
                <View key={`${c}-${i}`} style={styles.courseItem}>
                  <Text style={styles.courseName} numberOfLines={1}>
                    {c}
                  </Text>
                  <Pressable onPress={() => removeCourse(i)} hitSlop={8}>
                    <Text style={styles.courseRemove}>删除</Text>
                  </Pressable>
                </View>
              ))}
              {profile.homeCourses.length < 3 ? (
                <View style={styles.courseAddRow}>
                  <TextInput
                    value={courseDraft}
                    onChangeText={setCourseDraft}
                    style={styles.inputFlex}
                    placeholderTextColor={TEXT_TERTIARY}
                    placeholder="球场名称"
                    onSubmitEditing={addCourse}
                    editable={!hydrating && !savingProfile}
                  />
                  <Pressable
                    onPress={addCourse}
                    style={styles.addCourseBtn}
                    disabled={hydrating || savingProfile}
                  >
                    <Text style={styles.addCourseBtnTxt}>添加</Text>
                  </Pressable>
                </View>
              ) : (
                <Text style={styles.rowHint}>最多 3 个</Text>
              )}
            </View>
          }
        />
      </View>

      <Pressable
        style={[styles.saveBtn, (hydrating || savingProfile) && { opacity: 0.6 }]}
        onPress={onSaveProfile}
        disabled={hydrating || savingProfile}
      >
        <Text style={styles.saveBtnTxt}>{savingProfile ? '保存中…' : '保存'}</Text>
      </Pressable>
      {saveMessage ? <Text style={styles.saveMsg}>{saveMessage}</Text> : null}

      <Modal transparent visible={birthdayModal} animationType="fade" onRequestClose={() => setBirthdayModal(false)}>
        <Pressable style={styles.modalMask} onPress={() => setBirthdayModal(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>生日（YYYY-MM-DD）</Text>
            <TextInput
              value={birthdayDraft}
              onChangeText={setBirthdayDraft}
              style={styles.input}
              placeholderTextColor={TEXT_TERTIARY}
              placeholder="1990-01-15"
              keyboardType="numbers-and-punctuation"
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalGhost} onPress={() => setBirthdayModal(false)}>
                <Text style={styles.modalGhostTxt}>取消</Text>
              </Pressable>
              <Pressable style={styles.modalOkBtn} onPress={confirmBirthday}>
                <Text style={styles.modalOkBtnText}>确定</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal transparent visible={picker !== null} animationType="fade" onRequestClose={() => setPicker(null)}>
        <Pressable style={styles.modalMask} onPress={() => setPicker(null)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>
              {picker === 'blood'
                ? '血型'
                : picker === 'glove'
                  ? '手套大小'
                  : picker === 'finger'
                    ? '手指长度'
                    : '球龄'}
            </Text>
            <View style={styles.pickerList}>
              {picker === 'blood'
                ? (
                    <>
                      <Pressable
                        style={styles.pickerItem}
                        onPress={() => {
                          patch('bloodType', '');
                          setPicker(null);
                        }}
                      >
                        <Text style={styles.pickerItemTxt}>不填</Text>
                      </Pressable>
                      {BLOOD.map((b) => (
                        <Pressable
                          key={b}
                          style={styles.pickerItem}
                          onPress={() => {
                            patch('bloodType', b);
                            setPicker(null);
                          }}
                        >
                          <Text style={styles.pickerItemTxt}>{b} 型</Text>
                        </Pressable>
                      ))}
                    </>
                  )
                : null}
              {picker === 'glove'
                ? GLOVES.map((g) => (
                    <Pressable
                      key={g}
                      style={styles.pickerItem}
                      onPress={() => {
                        patch('gloveSize', g);
                        setPicker(null);
                      }}
                    >
                      <Text style={styles.pickerItemTxt}>{g}</Text>
                    </Pressable>
                  ))
                : null}
              {picker === 'finger'
                ? FINGERS.map((f) => (
                    <Pressable
                      key={f}
                      style={styles.pickerItem}
                      onPress={() => {
                        patch('fingerLength', f);
                        setPicker(null);
                      }}
                    >
                      <Text style={styles.pickerItemTxt}>{f}</Text>
                    </Pressable>
                  ))
                : null}
              {picker === 'golfAge'
                ? GOLF_AGE_OPTS.map((g) => (
                    <Pressable
                      key={g}
                      style={styles.pickerItem}
                      onPress={() => {
                        patch('golfAge', g);
                        setPicker(null);
                      }}
                    >
                      <Text style={styles.pickerItemTxt}>{g}</Text>
                    </Pressable>
                  ))
                : null}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal transparent visible={wristHelp} animationType="fade" onRequestClose={() => setWristHelp(false)}>
        <View style={styles.modalMask}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>如何测量腕底距离</Text>
            <Text style={styles.modalDesc}>
              自然站立，双臂放松垂于体侧，{'\n'}
              从手腕横纹最低点垂直量到地面的距离。{'\n'}
              建议穿普通鞋站在平地上测量。
            </Text>
            <View style={styles.diagramWrap}>
              <WristToFloorDiagram />
            </View>
            <Text style={styles.modalHint}>通常在 76–86 cm 之间</Text>
            <Pressable style={styles.modalOkBtn} onPress={() => setWristHelp(false)}>
              <Text style={styles.modalOkBtnText}>知道了</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pageRoot: {
    flex: 1,
    width: '100%',
    backgroundColor: PAGE_BG,
  },
  container: { flex: 1, backgroundColor: PAGE_BG },
  content: {
    padding: 16,
    paddingTop: Platform.OS === 'web' ? 16 : 12,
  },
  contentWeb: {
    flexGrow: 1,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginTop: 16,
    marginBottom: 8,
  },
  card: {
    backgroundColor: CARD_FILL,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginBottom: 4,
  },
  rowBlock: { marginBottom: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    gap: 12,
  },
  rowLabel: {
    width: 112,
    flexShrink: 0,
    fontSize: 13,
    color: TEXT_SECONDARY,
    lineHeight: 18,
  },
  rowRight: { flex: 1, minWidth: 0 },
  rowHint: { fontSize: 11, color: TEXT_TERTIARY, marginLeft: 124, marginTop: 4 },
  inputFlex: {
    flex: 1,
    borderWidth: 1,
    borderColor: DARK_PAGE.inputBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: DARK_PAGE.inputBg,
    fontSize: 14,
    color: TEXT_PRIMARY,
  },
  inputNarrow: {
    minWidth: 72,
    flex: 1,
    maxWidth: 120,
    borderWidth: 1,
    borderColor: DARK_PAGE.inputBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: DARK_PAGE.inputBg,
    fontSize: 14,
    color: TEXT_PRIMARY,
  },
  input: {
    borderWidth: 1,
    borderColor: DARK_PAGE.inputBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: DARK_PAGE.inputBg,
    fontSize: 14,
    color: TEXT_PRIMARY,
    marginBottom: 12,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: DARK_PAGE.surface,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderTxt: { fontSize: 12, color: TEXT_TERTIARY },
  inlineBirth: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  dateBtn: {
    borderWidth: 1,
    borderColor: DARK_PAGE.inputBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: DARK_PAGE.inputBg,
  },
  dateBtnTxt: { fontSize: 14, color: TEXT_PRIMARY },
  sideMeta: { fontSize: 12, color: GREEN, fontWeight: '600' },
  inlineEnd: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  helpMini: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DARK_PAGE.surface,
  },
  helpMiniTxt: { fontSize: 13, color: TEXT_TERTIARY },
  selectTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: DARK_PAGE.inputBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: DARK_PAGE.inputBg,
  },
  selectTriggerTxt: { fontSize: 14, color: TEXT_PRIMARY, flex: 1 },
  selectTriggerPh: { color: TEXT_TERTIARY },
  chev: { fontSize: 10, color: TEXT_TERTIARY, marginLeft: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: DARK_PAGE.surface,
  },
  chipOn: { borderColor: GREEN, backgroundColor: DARK_PAGE.chipBg },
  chipTxt: { fontSize: 13, color: TEXT_SECONDARY },
  chipTxtOn: { color: GREEN, fontWeight: '700' },
  linkUnder: { marginLeft: 124, marginTop: 4, marginBottom: 8 },
  linkUnderTxt: { color: GREEN, fontSize: 12, fontWeight: '700' },
  readonlyBox: {
    marginLeft: 124,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: DARK_PAGE.inputBg,
  },
  readonlyLabel: { fontSize: 11, color: TEXT_TERTIARY, marginBottom: 2 },
  readonlyText: { fontSize: 14, color: TEXT_PRIMARY, fontWeight: '600' },
  courseCol: { flex: 1, gap: 8 },
  courseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  courseName: { flex: 1, fontSize: 14, color: TEXT_PRIMARY },
  courseRemove: { fontSize: 13, color: '#fca5a5', fontWeight: '600' },
  courseAddRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addCourseBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: DARK_PAGE.surface,
    borderWidth: 1,
    borderColor: BORDER,
  },
  addCourseBtnTxt: { fontSize: 13, color: GREEN, fontWeight: '700' },
  saveBtn: {
    marginTop: 16,
    backgroundColor: GREEN,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveBtnTxt: { color: DARK_PAGE.onAccent, fontWeight: '700', fontSize: 15 },
  saveMsg: { marginTop: 10, fontSize: 12, color: GREEN, textAlign: 'center' },
  modalMask: {
    flex: 1,
    backgroundColor: 'rgba(17,24,39,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: CARD_FILL,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: TEXT_PRIMARY, marginBottom: 10 },
  modalDesc: { fontSize: 13, color: TEXT_SECONDARY, lineHeight: 20, marginBottom: 10 },
  diagramWrap: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    backgroundColor: DARK_PAGE.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginBottom: 10,
  },
  modalHint: { fontSize: 12, color: GREEN, fontWeight: '700', marginBottom: 8 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  modalGhost: { paddingVertical: 10, paddingHorizontal: 14 },
  modalGhostTxt: { color: TEXT_SECONDARY, fontSize: 14 },
  modalOkBtn: {
    backgroundColor: GREEN,
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  modalOkBtnText: { color: DARK_PAGE.onAccent, fontSize: 14, fontWeight: '700' },
  pickerList: { gap: 4 },
  pickerItem: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: DARK_PAGE.inputBg,
    borderWidth: 1,
    borderColor: DARK_PAGE.inputBorder,
  },
  pickerItemTxt: { fontSize: 15, color: TEXT_PRIMARY },
});
