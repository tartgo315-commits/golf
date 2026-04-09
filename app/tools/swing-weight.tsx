import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { readJson, writeJson } from '@/lib/local-storage';

const GREEN = '#166534';
const WHITE = '#ffffff';
const BG = '#f3f4f6';
const BORDER = '#e5e7eb';
const TEXT_PRIMARY = '#111827';
const TEXT_SECONDARY = '#6b7280';
const SWING_WEIGHT_LOG_KEY = 'swing_weight_log';
const CLUBS = ['一号木', '3木', '5木', '4铁', '5铁', '6铁', '7铁', '8铁', '9铁', 'PW', 'GW', 'SW', '推杆'];

export default function SwingWeightToolScreen() {
  const router = useRouter();
  const [lengthInch, setLengthInch] = useState('');
  const [headWeight, setHeadWeight] = useState('');
  const [shaftWeight, setShaftWeight] = useState('');
  const [estimate, setEstimate] = useState<{ value: string; diff: number } | null>(null);
  const [log, setLog] = useState<Record<string, string>>({});
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    const saved = readJson<Record<string, string>>(SWING_WEIGHT_LOG_KEY, {});
    setLog(saved);
  }, []);

  function onCalculate() {
    const l = Number(lengthInch) || 45;
    const h = Number(headWeight) || 200;
    const s = Number(shaftWeight) || 60;
    const points = 2 + (l - 45) * 6 + (h - 200) / 7 + (s - 60) / 15;
    const dPoint = Math.max(0, Math.min(9, Math.round(points)));
    setEstimate({ value: `D${dPoint}`, diff: dPoint - 2 });
  }

  function onSaveLog() {
    writeJson(SWING_WEIGHT_LOG_KEY, log);
    setEditMode(false);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} bounces={false}>
      <Pressable onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backTxt}>← 返回</Text>
      </Pressable>
      <Text style={styles.title}>挥重计算器</Text>

      <View style={styles.card}>
        <Text style={styles.label}>杆长（英寸）</Text>
        <TextInput value={lengthInch} onChangeText={setLengthInch} style={styles.input} placeholder="例如 45" keyboardType="decimal-pad" />
        <Text style={styles.label}>杆头重量（g）</Text>
        <TextInput value={headWeight} onChangeText={setHeadWeight} style={styles.input} placeholder="例如 200" keyboardType="decimal-pad" />
        <Text style={styles.label}>杆身重量（g）</Text>
        <TextInput value={shaftWeight} onChangeText={setShaftWeight} style={styles.input} placeholder="例如 60" keyboardType="decimal-pad" />

        <Pressable style={styles.calcBtn} onPress={onCalculate}>
          <Text style={styles.calcBtnTxt}>计算</Text>
        </Pressable>
      </View>

      {estimate ? (
        <View style={styles.card}>
          <Text style={styles.result}>估算挥重：{estimate.value}</Text>
          <Text style={styles.note}>目标 D2，当前{estimate.diff === 0 ? '与目标一致' : estimate.diff > 0 ? `偏重 +${estimate.diff}` : `偏轻 ${estimate.diff}`}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <View style={styles.logHeader}>
          <Text style={styles.logTitle}>我的球杆挥重记录</Text>
          <Pressable onPress={() => (editMode ? onSaveLog() : setEditMode(true))}>
            <Text style={styles.editBtn}>{editMode ? '保存' : '编辑'}</Text>
          </Pressable>
        </View>

        {CLUBS.map((club) => (
          <View key={club} style={styles.logRow}>
            <Text style={styles.clubName}>{club}</Text>
            {editMode ? (
              <TextInput
                value={log[club] || ''}
                onChangeText={(v) => setLog((prev) => ({ ...prev, [club]: v }))}
                style={styles.logInput}
                placeholder="如 D2"
                autoCapitalize="characters"
              />
            ) : (
              <Text style={[styles.logValue, !log[club] && styles.logEmpty]}>
                {log[club] || '—'}
              </Text>
            )}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  content: { paddingHorizontal: 16, paddingTop: Platform.OS === 'web' ? 44 : 16, paddingBottom: 32 },
  backBtn: { marginBottom: 8, alignSelf: 'flex-start' },
  backTxt: { color: GREEN, fontWeight: '600' },
  title: { fontSize: 22, fontWeight: '700', color: TEXT_PRIMARY, marginBottom: 12 },
  card: { backgroundColor: WHITE, borderRadius: 14, borderWidth: 0.5, borderColor: BORDER, padding: 14, marginBottom: 10 },
  label: { fontSize: 12, color: TEXT_SECONDARY, marginBottom: 6, marginTop: 6 },
  input: { borderWidth: 0.5, borderColor: BORDER, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: TEXT_PRIMARY, backgroundColor: WHITE },
  calcBtn: { marginTop: 10, backgroundColor: GREEN, borderRadius: 10, alignItems: 'center', paddingVertical: 10 },
  calcBtnTxt: { color: WHITE, fontWeight: '700' },
  result: { fontSize: 18, color: TEXT_PRIMARY, fontWeight: '700', marginBottom: 6 },
  note: { fontSize: 13, color: TEXT_SECONDARY },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  logTitle: { fontSize: 14, fontWeight: '700', color: TEXT_PRIMARY },
  editBtn: { fontSize: 13, color: GREEN, fontWeight: '600' },
  logRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f3f4f6',
  },
  clubName: { fontSize: 13, color: TEXT_PRIMARY },
  logValue: { fontSize: 13, fontWeight: '600', color: TEXT_PRIMARY },
  logEmpty: { color: '#d1d5db' },
  logInput: {
    borderWidth: 0.5,
    borderColor: BORDER,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 13,
    color: TEXT_PRIMARY,
    width: 60,
    textAlign: 'center',
    backgroundColor: WHITE,
  },
});
