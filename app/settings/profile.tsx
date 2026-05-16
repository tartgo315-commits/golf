import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { type Href, useRouter } from 'expo-router';
import { type ReactNode, useCallback, useState } from 'react';
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

import { DARK_PAGE, STACK_SCREEN_TOP_PADDING } from '../../constants/theme';
import {
  ageFromIso,
  emptyUserProfile,
  parseUserProfile,
  type UserProfileStorage,
  zodiacFromIso,
} from '../../lib/app-storage';

const USER_PROFILE_KEY = 'user_profile';
const PAGE_BG = '#07120b';
const CARD_BG = '#102018';
const ACCENT = '#c9ff4a';

const BLOOD: Array<'A' | 'B' | 'AB' | 'O'> = ['A', 'B', 'AB', 'O'];
const GLOVES = ['S', 'M', 'ML', 'L', 'XL'] as const;
const FINGERS = ['短', '中', '长'] as const;
const GOLF_AGE_OPTS = ['< 1年', '1-3年', '3-5年', '5-10年', '10年以上'] as const;
const TEMPO_OPTS = ['慢', '中', '快'] as const;
const FLIGHT_OPTS = ['左曲', '直', '右曲'] as const;

function isValidIsoDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(y, mo, d);
  return dt.getFullYear() === y && dt.getMonth() === mo && dt.getDate() === d;
}

function parseOptionalNumber(raw: string): number | null {
  const t = raw.trim();
  if (t === '') return null;
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfileStorage>(() => emptyUserProfile());
  const [courseDraft, setCourseDraft] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [hydrating, setHydrating] = useState(true);
  const [saving, setSaving] = useState(false);
  const [wristHelpOpen, setWristHelpOpen] = useState(false);

  const hydrate = useCallback(async () => {
    setHydrating(true);
    try {
      const raw = await AsyncStorage.getItem(USER_PROFILE_KEY);
      if (raw) {
        try {
          setProfile(parseUserProfile(JSON.parse(raw)));
        } catch {
          setProfile(emptyUserProfile());
        }
      } else {
        setProfile(emptyUserProfile());
      }
    } finally {
      setHydrating(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void hydrate();
    }, [hydrate]),
  );

  function patch<K extends keyof UserProfileStorage>(key: K, value: UserProfileStorage[K]) {
    setProfile((prev) => ({ ...prev, [key]: value }));
  }

  async function onSave() {
    setSaving(true);
    setSaveMessage('');
    try {
      if (profile.birthday.trim() && !isValidIsoDate(profile.birthday)) {
        setSaveMessage('生日须为 YYYY-MM-DD');
        return;
      }
      if (profile.height != null && (profile.height < 80 || profile.height > 260)) {
        setSaveMessage('身高应在 80–260 cm');
        return;
      }
      if (profile.handicap != null) {
        const h = profile.handicap;
        if (h < 0 || h > 54) {
          setSaveMessage('WHS 差点须在 0–54');
          return;
        }
      }
      const payload: UserProfileStorage = {
        ...profile,
        handicap:
          profile.handicap == null ? null : (Math.round(profile.handicap * 10) / 10) as number,
        homeCourses: profile.homeCourses.slice(0, 3),
      };
      await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(payload));
      setProfile(payload);
      setSaveMessage('已保存');
    } catch {
      setSaveMessage('保存失败');
    } finally {
      setSaving(false);
    }
  }

  function addCourse() {
    const name = courseDraft.trim();
    if (!name || profile.homeCourses.length >= 3) return;
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

  const birthdayOk = profile.birthday.trim() && isValidIsoDate(profile.birthday);
  const ageStr = birthdayOk ? String(ageFromIso(profile.birthday) ?? '—') : '—';
  const zodiacStr = birthdayOk ? zodiacFromIso(profile.birthday) : '—';

  function Row({ label, right, hint }: { label: string; right: ReactNode; hint?: string }) {
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

  function Chips<T extends string>(opts: readonly T[], value: string, onPick: (v: T) => void) {
    return (
      <View style={styles.chipRow}>
        {opts.map((opt) => {
          const on = value === opt;
          return (
            <Pressable
              key={String(opt)}
              onPress={() => onPick(opt)}
              style={[styles.chip, on && styles.chipOn]}
              disabled={hydrating || saving}
            >
              <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{opt}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
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
                style={styles.input}
                placeholderTextColor={DARK_PAGE.textMuted}
                placeholder="昵称"
                editable={!hydrating && !saving}
              />
            }
          />
          <Row
            label="生日"
            right={
              <View style={styles.rowInline}>
                <TextInput
                  value={profile.birthday}
                  onChangeText={(t) => patch('birthday', t)}
                  style={[styles.input, styles.inputBirth]}
                  placeholderTextColor={DARK_PAGE.textMuted}
                  placeholder="YYYY-MM-DD"
                  autoCapitalize="none"
                  editable={!hydrating && !saving}
                />
                <Text style={styles.meta}>年龄 {ageStr}</Text>
                <Text style={styles.meta}>星座 {zodiacStr}</Text>
              </View>
            }
          />
          <Row
            label="血型"
            right={
              <View style={styles.chipRow}>
                {BLOOD.map((b) => {
                  const on = profile.bloodType === b;
                  return (
                    <Pressable
                      key={b}
                      onPress={() => patch('bloodType', b)}
                      style={[styles.chip, on && styles.chipOn]}
                      disabled={hydrating || saving}
                    >
                      <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{b}</Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  onPress={() => patch('bloodType', '')}
                  style={[styles.chip, profile.bloodType === '' && styles.chipOn]}
                  disabled={hydrating || saving}
                >
                  <Text style={[styles.chipTxt, profile.bloodType === '' && styles.chipTxtOn]}>
                    不填
                  </Text>
                </Pressable>
              </View>
            }
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
                    disabled={hydrating || saving}
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

        <Text style={styles.sectionTitle}>身体数据</Text>
        <View style={styles.card}>
          <Row
            label="身高（cm）"
            right={
              <TextInput
                value={profile.height == null ? '' : String(profile.height)}
                onChangeText={(t) => patch('height', parseOptionalNumber(t))}
                style={styles.input}
                placeholderTextColor={DARK_PAGE.textMuted}
                placeholder="175"
                keyboardType="decimal-pad"
                editable={!hydrating && !saving}
              />
            }
          />
          <Row
            label="体重（kg）"
            right={
              <TextInput
                value={profile.weight == null ? '' : String(profile.weight)}
                onChangeText={(t) => patch('weight', parseOptionalNumber(t))}
                style={styles.input}
                placeholderTextColor={DARK_PAGE.textMuted}
                placeholder="72"
                keyboardType="decimal-pad"
                editable={!hydrating && !saving}
              />
            }
          />
          <Row
            label="手腕到地面（cm）"
            right={
              <View style={styles.rowInline}>
                <TextInput
                  value={profile.wristToFloor == null ? '' : String(profile.wristToFloor)}
                  onChangeText={(t) => patch('wristToFloor', parseOptionalNumber(t))}
                  style={[styles.input, { flex: 1, minWidth: 80 }]}
                  placeholderTextColor={DARK_PAGE.textMuted}
                  placeholder="81"
                  keyboardType="decimal-pad"
                  editable={!hydrating && !saving}
                />
                <Pressable onPress={() => setWristHelpOpen(true)} style={styles.helpBtn}>
                  <Text style={styles.helpBtnTxt}>?</Text>
                </Pressable>
              </View>
            }
            hint="自然站立，手腕骨到地面"
          />
          <Row
            label="手套大小"
            right={Chips(GLOVES, profile.gloveSize, (v) => patch('gloveSize', v))}
          />
          <Row
            label="手指长度"
            right={Chips(FINGERS, profile.fingerLength, (v) => patch('fingerLength', v))}
          />
        </View>

        <Text style={styles.sectionTitle}>球技数据</Text>
        <View style={styles.card}>
          <Row
            label="WHS 差点"
            right={
              <TextInput
                value={profile.handicap == null ? '' : String(profile.handicap)}
                onChangeText={(t) => {
                  const n = parseOptionalNumber(t);
                  patch('handicap', n == null ? null : Math.round(n * 10) / 10);
                }}
                style={styles.input}
                placeholderTextColor={DARK_PAGE.textMuted}
                placeholder="0–54"
                keyboardType="decimal-pad"
                editable={!hydrating && !saving}
              />
            }
          />
          <Pressable onPress={() => router.push('/handicap?from=settings' as Href)} style={styles.linkRow}>
            <Text style={styles.linkTxt}>查看差点记录 →</Text>
          </Pressable>
          <Row
            label="挥速（mph）"
            right={
              <TextInput
                value={profile.driverSpeed == null ? '' : String(profile.driverSpeed)}
                onChangeText={(t) => patch('driverSpeed', parseOptionalNumber(t))}
                style={styles.input}
                placeholderTextColor={DARK_PAGE.textMuted}
                placeholder="95"
                keyboardType="decimal-pad"
                editable={!hydrating && !saving}
              />
            }
          />
          <Row label="球龄" right={Chips(GOLF_AGE_OPTS, profile.golfAge, (v) => patch('golfAge', v))} />
          <Row
            label="挥杆节奏"
            right={Chips(TEMPO_OPTS, profile.swingTempo, (v) => patch('swingTempo', v))}
          />
          <Row
            label="惯用球路"
            right={Chips(FLIGHT_OPTS, profile.ballFlight, (v) => patch('ballFlight', v))}
          />
          <Row
            label="常打球场"
            right={
              <View style={styles.courseCol}>
                {profile.homeCourses.map((c, i) => (
                  <View key={`${c}-${i}`} style={styles.courseRow}>
                    <Text style={styles.courseName} numberOfLines={1}>
                      {c}
                    </Text>
                    <Pressable onPress={() => removeCourse(i)} hitSlop={8}>
                      <Text style={styles.removeTxt}>删除</Text>
                    </Pressable>
                  </View>
                ))}
                {profile.homeCourses.length < 3 ? (
                  <View style={styles.courseAdd}>
                    <TextInput
                      value={courseDraft}
                      onChangeText={setCourseDraft}
                      style={[styles.input, { flex: 1 }]}
                      placeholderTextColor={DARK_PAGE.textMuted}
                      placeholder="球场名称"
                      onSubmitEditing={addCourse}
                      editable={!hydrating && !saving}
                    />
                    <Pressable onPress={addCourse} style={styles.addBtn} disabled={hydrating || saving}>
                      <Text style={styles.addBtnTxt}>添加</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Text style={styles.rowHint}>最多 3 个</Text>
                )}
              </View>
            }
          />
        </View>

        <View style={styles.saveSection}>
          <Pressable
            style={[styles.saveBtn, (hydrating || saving) && { opacity: 0.6 }]}
            onPress={() => void onSave()}
            disabled={hydrating || saving}
          >
            <Text style={styles.saveBtnTxt}>保存</Text>
          </Pressable>
          {saveMessage ? <Text style={styles.saveMsg}>{saveMessage}</Text> : null}
        </View>
      </ScrollView>

      <Modal transparent visible={wristHelpOpen} animationType="fade" onRequestClose={() => setWristHelpOpen(false)}>
        <Pressable style={styles.modalMask} onPress={() => setWristHelpOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>手腕到地面</Text>
            <Text style={styles.modalBody}>
              自然站立，双臂放松垂于体侧，从手腕横纹最低点垂直量到地面的距离。建议穿普通鞋站在平地上测量。常见约 76–86 cm。
            </Text>
            <Pressable style={styles.modalOk} onPress={() => setWristHelpOpen(false)}>
              <Text style={styles.modalOkTxt}>知道了</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PAGE_BG,
    ...(Platform.OS === 'web' ? ({ minHeight: '100vh' } as any) : {}),
  },
  scroll: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: STACK_SCREEN_TOP_PADDING,
    paddingBottom: 16,
    backgroundColor: PAGE_BG,
  },
  saveSection: {
    marginTop: 24,
    marginBottom: 40,
    width: '100%',
    alignSelf: 'stretch',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: ACCENT,
    marginTop: 14,
    marginBottom: 8,
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: DARK_PAGE.cardBorder,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  rowBlock: { marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: 10 },
  rowLabel: {
    width: 108,
    flexShrink: 0,
    fontSize: 13,
    color: DARK_PAGE.textSecondary,
  },
  rowRight: { flex: 1, minWidth: 0 },
  rowHint: { fontSize: 11, color: DARK_PAGE.textMuted, marginLeft: 118, marginTop: 4 },
  rowInline: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, flex: 1 },
  input: {
    borderWidth: 1,
    borderColor: DARK_PAGE.inputBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: DARK_PAGE.inputBg,
    fontSize: 14,
    color: DARK_PAGE.text,
  },
  inputBirth: { minWidth: 120, maxWidth: 160 },
  meta: { fontSize: 12, color: ACCENT, fontWeight: '600' },
  helpBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: DARK_PAGE.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DARK_PAGE.surface,
  },
  helpBtnTxt: { fontSize: 13, color: DARK_PAGE.textMuted },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: DARK_PAGE.cardBorder,
    backgroundColor: DARK_PAGE.surface,
  },
  chipOn: { borderColor: ACCENT, backgroundColor: DARK_PAGE.chipBg },
  chipTxt: { fontSize: 13, color: DARK_PAGE.textSecondary },
  chipTxtOn: { color: ACCENT, fontWeight: '700' },
  linkRow: { marginBottom: 10, marginLeft: 118 },
  linkTxt: { color: ACCENT, fontSize: 12, fontWeight: '700' },
  courseCol: { flex: 1, gap: 8 },
  courseRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  courseName: { flex: 1, fontSize: 14, color: DARK_PAGE.text },
  removeTxt: { fontSize: 13, color: DARK_PAGE.worstText, fontWeight: '600' },
  courseAdd: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: DARK_PAGE.cardBorder,
    backgroundColor: DARK_PAGE.surface,
  },
  addBtnTxt: { fontSize: 13, color: ACCENT, fontWeight: '700' },
  saveBtn: {
    width: '100%',
    alignSelf: 'stretch',
    backgroundColor: '#c9ff4a',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnTxt: { color: '#07120b', fontWeight: '700', fontSize: 16 },
  saveMsg: { marginTop: 12, fontSize: 12, color: ACCENT, textAlign: 'center' },
  modalMask: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: CARD_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: DARK_PAGE.cardBorder,
    padding: 16,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: DARK_PAGE.text, marginBottom: 10 },
  modalBody: { fontSize: 14, color: DARK_PAGE.textSecondary, lineHeight: 22, marginBottom: 14 },
  modalOk: {
    alignSelf: 'flex-end',
    backgroundColor: ACCENT,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  modalOkTxt: { color: DARK_PAGE.onAccent, fontWeight: '700', fontSize: 14 },
});
