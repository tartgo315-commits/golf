import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { RoundLockIndicator } from '@/components/RoundLockIndicator';
import { DARK_PAGE } from '@/constants/theme';
import {
  calcDifferential,
  loadHandicapRecords,
  recordHasPendingRoundStats,
  saveHandicapRecords,
  type HandicapRecord,
} from '@/lib/handicap';
import { isRoundLocked, markHandicapProcessingComplete } from '@/utils/roundLock';

const GREEN = DARK_PAGE.accent;
const BG = DARK_PAGE.bg;
const CARD_FILL = DARK_PAGE.card;
const BORDER = DARK_PAGE.cardBorder;
const TEXT_PRIMARY = DARK_PAGE.text;
const TEXT_SECONDARY = DARK_PAGE.textSecondary;
const RED = '#dc2626';
const LIGHT_GREEN = DARK_PAGE.chipBg;
const ORANGE = '#e89b3a';

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
  const [statsPutts, setStatsPutts] = useState('');
  const [statsFwHit, setStatsFwHit] = useState('');
  const [statsFwTotal, setStatsFwTotal] = useState('');
  const [statsGir, setStatsGir] = useState('');

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
      setStatsPutts(matched.totalPutts == null ? '' : String(matched.totalPutts));
      setStatsFwHit(matched.fairwaysHit == null ? '' : String(matched.fairwaysHit));
      setStatsFwTotal(matched.fairwaysTotal == null ? '' : String(matched.fairwaysTotal));
      setStatsGir(matched.greensInRegulation == null ? '' : String(matched.greensInRegulation));
    }
  }, [id]);

  const locked = useMemo(() => (record ? isRoundLocked(record) : false), [record]);
  const statsPending = useMemo(() => (record ? recordHasPendingRoundStats(record) : false), [record]);

  useEffect(() => {
    if (locked) setIsEditing(false);
  }, [locked]);

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
    if (!record || !draft || locked) return;
    const gross = Number(draft.adjustedGrossScore);
    const cr = Number(draft.courseRating);
    const sr = Number(draft.slopeRating);
    if (!Number.isFinite(gross) || !Number.isFinite(cr) || !Number.isFinite(sr) || sr <= 0) return;

    const updated = markHandicapProcessingComplete(
      {
        ...record,
        date: draft.date.trim(),
        courseName: draft.courseName.trim(),
        courseRating: cr,
        slopeRating: sr,
        adjustedGrossScore: gross,
        holes: draft.holes,
        scoreDifferential: calcDifferential(gross, cr, sr, draft.holes),
        notes: draft.notes.trim(),
      },
      true,
    );

    const next = records.map((item) => (item.id === updated.id ? updated : item));
    saveHandicapRecords(next);
    const reloaded = loadHandicapRecords();
    setRecords(reloaded);
    setRecord(reloaded.find((x) => x.id === updated.id) ?? updated);
    setIsEditing(false);
  }

  function parseOptionalNonNegInt(s: string): number | null | 'invalid' {
    const t = s.trim();
    if (!t) return null;
    if (!/^\d+$/.test(t)) return 'invalid';
    const n = Number(t);
    if (!Number.isFinite(n) || n < 0) return 'invalid';
    return Math.round(n);
  }

  function onSaveStatsOnly() {
    if (!record) return;
    const tp = parseOptionalNonNegInt(statsPutts);
    const fh = parseOptionalNonNegInt(statsFwHit);
    const ft = parseOptionalNonNegInt(statsFwTotal);
    const gir = parseOptionalNonNegInt(statsGir);
    if (tp === 'invalid' || fh === 'invalid' || ft === 'invalid' || gir === 'invalid') {
      Alert.alert('提示', '请输入有效的非负整数，或留空表示暂不填写。');
      return;
    }
    if (ft != null && ft > 0 && fh == null) {
      Alert.alert('提示', '已填写球道总数时请同时填写球道命中数。');
      return;
    }
    if (fh != null && ft == null) {
      Alert.alert('提示', '已填写球道命中时请同时填写球道总数。');
      return;
    }
    if (ft != null && ft > 0 && fh != null && fh > ft) {
      Alert.alert('提示', '球道命中数不能大于球道总数。');
      return;
    }
    const updated: HandicapRecord = {
      ...record,
      totalPutts: tp,
      fairwaysHit: fh,
      fairwaysTotal: ft,
      greensInRegulation: gir,
    };
    const next = records.map((item) => (item.id === updated.id ? updated : item));
    saveHandicapRecords(next);
    const reloaded = loadHandicapRecords();
    setRecords(reloaded);
    const nextRec = reloaded.find((x) => x.id === record.id) ?? updated;
    setRecord(nextRec);
    setStatsPutts(nextRec.totalPutts == null ? '' : String(nextRec.totalPutts));
    setStatsFwHit(nextRec.fairwaysHit == null ? '' : String(nextRec.fairwaysHit));
    setStatsFwTotal(nextRec.fairwaysTotal == null ? '' : String(nextRec.fairwaysTotal));
    setStatsGir(nextRec.greensInRegulation == null ? '' : String(nextRec.greensInRegulation));
    Alert.alert('已保存', '统计字段已更新。');
  }

  function onDelete() {
    if (!record || locked) return;
    const remove = () => {
      const next = records.filter((item) => item.id !== record.id);
      saveHandicapRecords(next);
      router.replace('/handicap');
    };
    if (Platform.OS === 'web' && typeof globalThis.confirm === 'function') {
      if (globalThis.confirm('删除后差点将重新计算，确认删除？')) remove();
      return;
    }
    Alert.alert('删除成绩', '删除后差点将重新计算，确认删除？', [
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
          <View style={styles.headerRight}>
            <RoundLockIndicator round={record} />
            {!locked ? (
              <Pressable style={styles.editBtn} onPress={() => (isEditing ? onSave() : setIsEditing(true))}>
                <Text style={styles.editBtnText}>{isEditing ? '保存' : '编辑'}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>日期</Text>
          {isEditing && !locked ? (
            <TextInput value={draft.date} onChangeText={(v) => setDraft((prev) => (prev ? { ...prev, date: v } : prev))} style={styles.input} />
          ) : (
            <Text style={styles.value}>{record.date}</Text>
          )}

          <Text style={styles.label}>球场名称</Text>
          {isEditing && !locked ? (
            <TextInput
              value={draft.courseName}
              onChangeText={(v) => setDraft((prev) => (prev ? { ...prev, courseName: v } : prev))}
              style={styles.input}
            />
          ) : (
            <Text style={styles.value}>{record.courseName}</Text>
          )}

          <Text style={styles.label}>球场难度系数</Text>
          {isEditing && !locked ? (
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
          {isEditing && !locked ? (
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
          {isEditing && !locked ? (
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
          {isEditing && !locked ? (
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
          {isEditing && !locked ? (
            <TextInput value={draft.notes} onChangeText={(v) => setDraft((prev) => (prev ? { ...prev, notes: v } : prev))} style={styles.notesInput} multiline textAlignVertical="top" />
          ) : (
            <Text style={styles.value}>{record.notes || '—'}</Text>
          )}
        </View>

        {locked ? (
          <View style={styles.card}>
            <Text style={styles.statsIntro}>
              成绩已锁定 · 总杆数不可修改{'\n'}推杆、球道、GIR 等统计数据不影响差点，仍可修正
            </Text>
            <View style={styles.statsTitleRow}>
              <Text style={styles.statsSectionTitle}>统计修正</Text>
              {statsPending ? <Text style={styles.statsPendingBadge}>待补填</Text> : null}
            </View>
            <Text style={styles.label}>推杆总数</Text>
            <View style={styles.statInputRow}>
              {record.totalPutts == null ? <View style={styles.statPendingDot} /> : <View style={styles.statDotSpacer} />}
              <TextInput value={statsPutts} onChangeText={setStatsPutts} style={styles.inputFlex} keyboardType="number-pad" />
            </View>
            <Text style={styles.label}>球道上球道数</Text>
            <View style={styles.statInputRow}>
              {record.fairwaysTotal == null ? <View style={styles.statPendingDot} /> : <View style={styles.statDotSpacer} />}
              <TextInput value={statsFwTotal} onChangeText={setStatsFwTotal} style={styles.inputFlex} keyboardType="number-pad" />
            </View>
            <Text style={styles.label}>球道命中</Text>
            <View style={styles.statInputRow}>
              {record.fairwaysHit == null ? <View style={styles.statPendingDot} /> : <View style={styles.statDotSpacer} />}
              <TextInput value={statsFwHit} onChangeText={setStatsFwHit} style={styles.inputFlex} keyboardType="number-pad" />
            </View>
            <Text style={styles.label}>上果岭数（GIR）</Text>
            <View style={styles.statInputRow}>
              {record.greensInRegulation == null ? <View style={styles.statPendingDot} /> : <View style={styles.statDotSpacer} />}
              <TextInput value={statsGir} onChangeText={setStatsGir} style={styles.inputFlex} keyboardType="number-pad" />
            </View>
            <Pressable style={styles.statsSaveBtn} onPress={onSaveStatsOnly}>
              <Text style={styles.statsSaveBtnTxt}>保存统计</Text>
            </Pressable>
          </View>
        ) : null}

        {!locked ? (
          <Pressable style={styles.deleteBtn} onPress={onDelete}>
            <Text style={styles.deleteBtnText}>删除这场成绩</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: Platform.OS === 'web' ? 44 : 16, paddingBottom: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8 },
  backBtn: { width: 56 },
  backTxt: { color: TEXT_SECONDARY, fontWeight: '600' },
  title: { flex: 1, textAlign: 'center', fontSize: 20, fontWeight: '700', color: TEXT_PRIMARY },
  headerRight: { minWidth: 88, alignItems: 'flex-end', gap: 6 },
  editBtn: {
    borderWidth: 0.5,
    borderColor: GREEN,
    borderRadius: 10,
    backgroundColor: LIGHT_GREEN,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  editBtnText: { color: GREEN, fontSize: 13, fontWeight: '700' },
  card: { backgroundColor: CARD_FILL, borderRadius: 14, borderWidth: 1, borderColor: BORDER, padding: 14, marginBottom: 10 },
  statsIntro: {
    fontSize: 11,
    fontWeight: '500',
    color: '#8a9a8e',
    lineHeight: 16,
    marginBottom: 10,
  },
  statsTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  statsSectionTitle: { fontSize: 15, fontWeight: '700', color: TEXT_PRIMARY },
  statsPendingBadge: { fontSize: 11, fontWeight: '700', color: ORANGE },
  statInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  statPendingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ORANGE,
  },
  statDotSpacer: { width: 8, height: 8 },
  inputFlex: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: DARK_PAGE.inputBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: DARK_PAGE.inputBg,
    fontSize: 14,
    color: TEXT_PRIMARY,
  },
  statsSaveBtn: {
    marginTop: 14,
    backgroundColor: ORANGE,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  statsSaveBtnTxt: { fontSize: 14, fontWeight: '700', color: '#0d1b11' },
  label: { fontSize: 12, color: TEXT_SECONDARY, marginBottom: 6, marginTop: 6 },
  value: { fontSize: 14, color: TEXT_PRIMARY, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: DARK_PAGE.inputBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: DARK_PAGE.inputBg,
    fontSize: 14,
    color: TEXT_PRIMARY,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: DARK_PAGE.inputBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 86,
    backgroundColor: DARK_PAGE.inputBg,
    fontSize: 14,
    color: TEXT_PRIMARY,
  },
  chipRow: { flexDirection: 'row', gap: 8, marginBottom: 2 },
  chip: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 999,
    backgroundColor: DARK_PAGE.surface,
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
  deleteBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  empty: { fontSize: 13, color: TEXT_SECONDARY },
});
