import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { calcDifferential, loadHandicapRecords, saveHandicapRecords, type HandicapRecord } from '@/lib/handicap';

const GREEN = '#166534';
const BG = '#f3f4f6';
const WHITE = '#ffffff';
const BORDER = '#e5e7eb';
const TEXT_PRIMARY = '#111827';
const TEXT_SECONDARY = '#6b7280';
const RED = '#dc2626';
const LIGHT_GREEN = '#dcfce7';

type Draft = {
  date: string;
  courseName: string;
  courseRating: string;
  slopeRating: string;
  adjustedGrossScore: string;
  holes: 18 | 9;
  notes: string;
};

export default function HandicapDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [records, setRecords] = useState<HandicapRecord[]>([]);
  const [record, setRecord] = useState<HandicapRecord | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);

  useEffect(() => {
    const loaded = loadHandicapRecords();
    setRecords(loaded);
    const matched = loaded.find((item) => item.id === id) ?? null;
    setRecord(matched);
    if (matched) {
      setDraft({
        date: matched.date,
        courseName: matched.courseName,
        courseRating: String(matched.courseRating),
        slopeRating: String(matched.slopeRating),
        adjustedGrossScore: String(matched.adjustedGrossScore),
        holes: matched.holes,
        notes: matched.notes,
      });
    }
  }, [id]);

  const previewDiff = useMemo(() => {
    if (!draft) return null;
    const gross = Number(draft.adjustedGrossScore);
    const cr = Number(draft.courseRating);
    const sr = Number(draft.slopeRating);
    if (!Number.isFinite(gross) || !Number.isFinite(cr) || !Number.isFinite(sr) || sr <= 0) return null;
    return calcDifferential(gross, cr, sr, draft.holes);
  }, [draft]);

  function backToList() {
    router.replace('/handicap');
  }

  function onBackPress() {
    if (!isEditing) {
      backToList();
      return;
    }
    const leave = () => {
      setIsEditing(false);
      backToList();
    };
    if (Platform.OS === 'web' && typeof globalThis.confirm === 'function') {
      if (globalThis.confirm('放弃修改？')) leave();
      return;
    }
    Alert.alert('提示', '放弃修改？', [
      { text: '继续编辑', style: 'cancel' },
      { text: '放弃', style: 'destructive', onPress: leave },
    ]);
  }

  function onSave() {
    if (!record || !draft) return;
    const gross = Number(draft.adjustedGrossScore);
    const cr = Number(draft.courseRating);
    const sr = Number(draft.slopeRating);
    if (!Number.isFinite(gross) || !Number.isFinite(cr) || !Number.isFinite(sr) || sr <= 0) return;

    const updated: HandicapRecord = {
      ...record,
      date: draft.date.trim(),
      courseName: draft.courseName.trim(),
      courseRating: cr,
      slopeRating: sr,
      adjustedGrossScore: gross,
      holes: draft.holes,
      scoreDifferential: calcDifferential(gross, cr, sr, draft.holes),
      notes: draft.notes.trim(),
    };

    const next = records.map((item) => (item.id === updated.id ? updated : item));
    saveHandicapRecords(next);
    setRecords(next);
    setRecord(updated);
    setIsEditing(false);
  }

  function onDelete() {
    if (!record) return;
    const remove = () => {
      const next = records.filter((item) => item.id !== record.id);
      saveHandicapRecords(next);
      router.replace('/handicap');
    };
    if (Platform.OS === 'web' && typeof globalThis.confirm === 'function') {
      if (globalThis.confirm('确认删除这场成绩？')) remove();
      return;
    }
    Alert.alert('删除成绩', '确认删除这场成绩？', [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: remove },
    ]);
  }

  if (!record || !draft) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <Pressable onPress={backToList} style={styles.backBtn}>
            <Text style={styles.backTxt}>← 返回</Text>
          </Pressable>
          <Text style={styles.title}>成绩详情</Text>
          <View style={styles.card}>
            <Text style={styles.empty}>未找到这场成绩。</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} bounces={false}>
        <View style={styles.headerRow}>
          <Pressable onPress={onBackPress} style={styles.backBtn}>
            <Text style={styles.backTxt}>← 返回</Text>
          </Pressable>
          <Text style={styles.title}>成绩详情</Text>
          <Pressable style={styles.editBtn} onPress={() => (isEditing ? onSave() : setIsEditing(true))}>
            <Text style={styles.editBtnText}>{isEditing ? '保存' : '编辑'}</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>日期</Text>
          {isEditing ? (
            <TextInput value={draft.date} onChangeText={(v) => setDraft((prev) => (prev ? { ...prev, date: v } : prev))} style={styles.input} />
          ) : (
            <Text style={styles.value}>{record.date}</Text>
          )}

          <Text style={styles.label}>球场名称</Text>
          {isEditing ? (
            <TextInput
              value={draft.courseName}
              onChangeText={(v) => setDraft((prev) => (prev ? { ...prev, courseName: v } : prev))}
              style={styles.input}
            />
          ) : (
            <Text style={styles.value}>{record.courseName}</Text>
          )}

          <Text style={styles.label}>球场难度系数</Text>
          {isEditing ? (
            <TextInput
              value={draft.courseRating}
              onChangeText={(v) => setDraft((prev) => (prev ? { ...prev, courseRating: v } : prev))}
              style={styles.input}
              keyboardType="decimal-pad"
            />
          ) : (
            <Text style={styles.value}>{record.courseRating}</Text>
          )}

          <Text style={styles.label}>坡度系数</Text>
          {isEditing ? (
            <TextInput
              value={draft.slopeRating}
              onChangeText={(v) => setDraft((prev) => (prev ? { ...prev, slopeRating: v } : prev))}
              style={styles.input}
              keyboardType="number-pad"
            />
          ) : (
            <Text style={styles.value}>{record.slopeRating}</Text>
          )}

          <Text style={styles.label}>洞数</Text>
          {isEditing ? (
            <View style={styles.chipRow}>
              <Pressable style={[styles.chip, draft.holes === 18 && styles.chipOn]} onPress={() => setDraft((prev) => (prev ? { ...prev, holes: 18 } : prev))}>
                <Text style={[styles.chipTxt, draft.holes === 18 && styles.chipTxtOn]}>18洞</Text>
              </Pressable>
              <Pressable style={[styles.chip, draft.holes === 9 && styles.chipOn]} onPress={() => setDraft((prev) => (prev ? { ...prev, holes: 9 } : prev))}>
                <Text style={[styles.chipTxt, draft.holes === 9 && styles.chipTxtOn]}>9洞</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={styles.value}>{record.holes}洞</Text>
          )}

          <Text style={styles.label}>调整后总杆</Text>
          {isEditing ? (
            <TextInput
              value={draft.adjustedGrossScore}
              onChangeText={(v) => setDraft((prev) => (prev ? { ...prev, adjustedGrossScore: v } : prev))}
              style={styles.input}
              keyboardType="number-pad"
            />
          ) : (
            <Text style={styles.value}>{record.adjustedGrossScore}</Text>
          )}

          <Text style={styles.label}>微差</Text>
          <Text style={styles.value}>{typeof previewDiff === 'number' ? previewDiff.toFixed(1) : record.scoreDifferential.toFixed(1)}</Text>

          <Text style={styles.label}>备注</Text>
          {isEditing ? (
            <TextInput value={draft.notes} onChangeText={(v) => setDraft((prev) => (prev ? { ...prev, notes: v } : prev))} style={styles.notesInput} multiline textAlignVertical="top" />
          ) : (
            <Text style={styles.value}>{record.notes || '—'}</Text>
          )}
        </View>

        <Pressable style={styles.deleteBtn} onPress={onDelete}>
          <Text style={styles.deleteBtnText}>删除这场成绩</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: Platform.OS === 'web' ? 44 : 16, paddingBottom: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8 },
  backBtn: { alignSelf: 'flex-start' },
  backTxt: { color: GREEN, fontWeight: '600' },
  title: { flex: 1, textAlign: 'center', fontSize: 20, fontWeight: '700', color: TEXT_PRIMARY },
  editBtn: {
    borderWidth: 0.5,
    borderColor: GREEN,
    borderRadius: 10,
    backgroundColor: LIGHT_GREEN,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  editBtnText: { color: GREEN, fontSize: 13, fontWeight: '700' },
  card: { backgroundColor: WHITE, borderRadius: 14, borderWidth: 0.5, borderColor: BORDER, padding: 14, marginBottom: 10 },
  label: { fontSize: 12, color: TEXT_SECONDARY, marginBottom: 6, marginTop: 6 },
  value: { fontSize: 14, color: TEXT_PRIMARY, fontWeight: '600' },
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
  chipRow: { flexDirection: 'row', gap: 8, marginBottom: 2 },
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
  deleteBtn: {
    backgroundColor: RED,
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 12,
  },
  deleteBtnText: { color: WHITE, fontSize: 15, fontWeight: '700' },
  empty: { fontSize: 13, color: TEXT_SECONDARY },
});
