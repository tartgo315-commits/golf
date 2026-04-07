import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

const GREEN = '#166534';
const WHITE = '#ffffff';
const BG = '#f3f4f6';
const BORDER = '#e5e7eb';
const TEXT_PRIMARY = '#111827';
const TEXT_SECONDARY = '#6b7280';

export default function SwingWeightToolScreen() {
  const router = useRouter();
  const [lengthInch, setLengthInch] = useState('');
  const [headWeight, setHeadWeight] = useState('');
  const [shaftWeight, setShaftWeight] = useState('');
  const [estimate, setEstimate] = useState<{ value: string; diff: number } | null>(null);

  function onCalculate() {
    const l = Number(lengthInch) || 45;
    const h = Number(headWeight) || 200;
    const s = Number(shaftWeight) || 60;
    const points = 2 + (l - 45) * 6 + (h - 200) / 7 + (s - 60) / 15;
    const dPoint = Math.max(0, Math.min(9, Math.round(points)));
    setEstimate({ value: `D${dPoint}`, diff: dPoint - 2 });
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  content: { padding: 16, paddingBottom: 32 },
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
});
