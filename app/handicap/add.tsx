import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { calcDifferential, loadHandicapRecords, makeHandicapRecordId, saveHandicapRecords, type HandicapRecord } from '@/lib/handicap';

const GREEN = '#166534';
const BG = '#f3f4f6';
const WHITE = '#ffffff';
const BORDER = '#e5e7eb';
const TEXT_PRIMARY = '#111827';
const TEXT_SECONDARY = '#6b7280';
const RED = '#dc2626';
const LIGHT_GREEN = '#dcfce7';

type HelpType = 'course' | 'slope' | null;

function todayStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function HandicapAddScreen() {
  const router = useRouter();
  const [date, setDate] = useState(todayStr());
  const [courseName, setCourseName] = useState('');
  const [courseRating, setCourseRating] = useState('');
  const [slopeRating, setSlopeRating] = useState('113');
  const [holes, setHoles] = useState<18 | 9>(18);
  const [adjustedGrossScore, setAdjustedGrossScore] = useState('');
  const [notes, setNotes] = useState('');
  const [helpType, setHelpType] = useState<HelpType>(null);
  const [error, setError] = useState('');

  const previewDiff = useMemo(() => {
    const gross = Number(adjustedGrossScore);
    const cr = Number(courseRating);
    const sr = Number(slopeRating);
    if (!Number.isFinite(gross) || !Number.isFinite(cr) || !Number.isFinite(sr) || sr <= 0) return null;
    return calcDifferential(gross, cr, sr, holes);
  }, [adjustedGrossScore, courseRating, holes, slopeRating]);

  function onSave() {
    const gross = Number(adjustedGrossScore);
    const cr = Number(courseRating);
    const sr = Number(slopeRating);
    if (!date.trim() || !courseName.trim()) {
      setError('请填写日期和球场名称');
      return;
    }
    if (!Number.isFinite(gross) || !Number.isFinite(cr) || !Number.isFinite(sr) || sr <= 0) {
      setError('请填写有效的评分和成绩数据');
      return;
    }
    setError('');

    const record: HandicapRecord = {
      id: makeHandicapRecordId(),
      date: date.trim(),
      courseName: courseName.trim(),
      courseRating: cr,
      slopeRating: sr,
      adjustedGrossScore: gross,
      holes,
      scoreDifferential: calcDifferential(gross, cr, sr, holes),
      notes: notes.trim(),
    };

    const records = loadHandicapRecords();
    saveHandicapRecords([record, ...records]);
    router.replace('/handicap');
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} bounces={false}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backTxt}>← 返回</Text>
        </Pressable>
        <Text style={styles.title}>添加成绩</Text>

        <View style={styles.card}>
          <Text style={styles.label}>日期</Text>
          <View style={styles.inline}>
            <TextInput value={date} onChangeText={setDate} style={[styles.input, styles.inlineInput]} placeholder="YYYY-MM-DD" />
            <Pressable style={styles.todayBtn} onPress={() => setDate(todayStr())}>
              <Text style={styles.todayBtnText}>今天</Text>
            </Pressable>
          </View>

          <Text style={styles.label}>球场名称</Text>
          <TextInput value={courseName} onChangeText={setCourseName} style={styles.input} placeholder="例如 XX Golf Club" />

          <View style={styles.labelRow}>
            <Text style={styles.label}>球场难度系数（Course Rating）</Text>
            <Pressable onPress={() => setHelpType('course')}>
              <Text style={styles.help}>❓</Text>
            </Pressable>
          </View>
          <TextInput value={courseRating} onChangeText={setCourseRating} style={styles.input} placeholder="例如 72.4" keyboardType="decimal-pad" />

          <View style={styles.labelRow}>
            <Text style={styles.label}>坡度系数（Slope Rating）</Text>
            <Pressable onPress={() => setHelpType('slope')}>
              <Text style={styles.help}>❓</Text>
            </Pressable>
          </View>
          <TextInput value={slopeRating} onChangeText={setSlopeRating} style={styles.input} placeholder="默认 113" keyboardType="number-pad" />

          <Text style={styles.label}>洞数</Text>
          <View style={styles.chipRow}>
            <Pressable style={[styles.chip, holes === 18 && styles.chipOn]} onPress={() => setHoles(18)}>
              <Text style={[styles.chipTxt, holes === 18 && styles.chipTxtOn]}>18洞</Text>
            </Pressable>
            <Pressable style={[styles.chip, holes === 9 && styles.chipOn]} onPress={() => setHoles(9)}>
              <Text style={[styles.chipTxt, holes === 9 && styles.chipTxtOn]}>9洞</Text>
            </Pressable>
          </View>

          <Text style={styles.label}>调整后总杆</Text>
          <TextInput value={adjustedGrossScore} onChangeText={setAdjustedGrossScore} style={styles.input} placeholder="例如 92" keyboardType="number-pad" />

          <Text style={styles.label}>备注（选填）</Text>
          <TextInput value={notes} onChangeText={setNotes} style={styles.notesInput} placeholder="天气、果岭速度等" multiline textAlignVertical="top" />

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        <View style={styles.previewCard}>
          <Text style={styles.previewLabel}>本场微差</Text>
          <Text style={styles.previewValue}>{typeof previewDiff === 'number' ? previewDiff.toFixed(1) : '--'}</Text>
        </View>

        <Pressable style={styles.saveBtn} onPress={onSave}>
          <Text style={styles.saveBtnText}>保存成绩</Text>
        </Pressable>
      </ScrollView>

      <Modal transparent visible={helpType !== null} animationType="fade" onRequestClose={() => setHelpType(null)}>
        <View style={styles.modalMask}>
          <View style={styles.modalCard}>
            {helpType === 'course' ? (
              <Text style={styles.modalDesc}>
                球场难度系数由高尔夫球场官方评定，通常印在记分卡上，代表零差点球手的预期成绩
              </Text>
            ) : null}
            {helpType === 'slope' ? (
              <Text style={styles.modalDesc}>
                坡度系数反映球场对差点球手的难度，标准值为113，数值越高越难，也在记分卡上
              </Text>
            ) : null}
            <Pressable style={styles.modalBtn} onPress={() => setHelpType(null)}>
              <Text style={styles.modalBtnText}>知道了</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: Platform.OS === 'web' ? 44 : 16, paddingBottom: 20 },
  backBtn: { marginBottom: 8, alignSelf: 'flex-start' },
  backTxt: { color: GREEN, fontWeight: '600' },
  title: { fontSize: 22, fontWeight: '700', color: TEXT_PRIMARY, marginBottom: 10 },
  card: { backgroundColor: WHITE, borderRadius: 14, borderWidth: 0.5, borderColor: BORDER, padding: 14, marginBottom: 10 },
  label: { fontSize: 12, color: TEXT_SECONDARY, marginBottom: 6, marginTop: 6 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  help: { color: TEXT_SECONDARY, fontSize: 12 },
  input: {
    borderWidth: 0.5,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: WHITE,
    fontSize: 14,
    color: TEXT_PRIMARY,
  },
  notesInput: {
    borderWidth: 0.5,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 86,
    backgroundColor: WHITE,
    fontSize: 14,
    color: TEXT_PRIMARY,
  },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inlineInput: { flex: 1 },
  todayBtn: {
    borderWidth: 0.5,
    borderColor: GREEN,
    backgroundColor: LIGHT_GREEN,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  todayBtnText: { color: GREEN, fontSize: 13, fontWeight: '700' },
  chipRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  chip: {
    borderWidth: 0.5,
    borderColor: BORDER,
    borderRadius: 999,
    backgroundColor: WHITE,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipOn: { borderColor: GREEN, backgroundColor: LIGHT_GREEN },
  chipTxt: { fontSize: 13, color: TEXT_SECONDARY },
  chipTxtOn: { color: GREEN, fontWeight: '700' },
  error: { marginTop: 8, fontSize: 12, color: RED },
  previewCard: { backgroundColor: WHITE, borderRadius: 14, borderWidth: 0.5, borderColor: BORDER, padding: 14, marginBottom: 10 },
  previewLabel: { fontSize: 13, color: TEXT_SECONDARY, marginBottom: 6 },
  previewValue: { fontSize: 28, color: GREEN, fontWeight: '800' },
  saveBtn: {
    backgroundColor: GREEN,
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 13,
  },
  saveBtnText: { color: WHITE, fontSize: 16, fontWeight: '700' },
  modalMask: {
    flex: 1,
    backgroundColor: 'rgba(17,24,39,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: WHITE,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: BORDER,
    padding: 14,
  },
  modalDesc: { fontSize: 13, color: TEXT_SECONDARY, lineHeight: 20, marginBottom: 10 },
  modalBtn: {
    backgroundColor: GREEN,
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 10,
  },
  modalBtnText: { color: WHITE, fontSize: 14, fontWeight: '700' },
});
