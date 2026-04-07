import { Stack, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const GREEN = '#166534';
const GREEN_LIGHT = '#dcfce7';
const WHITE = '#ffffff';
const BG = '#f3f4f6';
const BORDER = '#e5e7eb';
const TEXT_PRIMARY = '#111827';
const TEXT_SECONDARY = '#4b5563';
const TEXT_TERTIARY = '#374151';
const TEXT_HINT = '#9ca3af';
const GREEN_BORDER_SOFT = 'rgba(22,101,52,0.2)';

/** 经验法则：约每加长 1" +6 挥重点；杆头约每 +7g +1 挥重点（演示用，非精密测量） */
function estimateSwingWeightPoints(
  baseD: number,
  lengthVs45In: number,
  headDeltaG: number,
): { d: number; detail: string } {
  const lengthPts = lengthVs45In * 6;
  const headPts = headDeltaG / 7;
  const raw = baseD + lengthPts + headPts;
  const d = Math.max(0, Math.min(9, Math.round(raw)));
  const detail = `长度项 ${lengthPts >= 0 ? '+' : ''}${lengthPts.toFixed(1)}　杆头项 ${headPts >= 0 ? '+' : ''}${headPts.toFixed(1)}`;
  return { d, detail };
}

const BASE_OPTIONS = [0, 1, 2, 3, 4, 5, 6] as const;

export default function SwingWeightScreen() {
  const router = useRouter();
  const [baseD, setBaseD] = useState(2);
  const [lengthStr, setLengthStr] = useState('0');
  const [headStr, setHeadStr] = useState('0');
  const [result, setResult] = useState<{ d: number; detail: string } | null>(null);

  const onCalc = useCallback(() => {
    const len = Number(lengthStr.replace(/,/g, '.')) || 0;
    const head = Number(headStr.replace(/,/g, '.')) || 0;
    setResult(estimateSwingWeightPoints(baseD, len, head));
  }, [baseD, lengthStr, headStr]);

  const hint = useMemo(
    () =>
      '以 45 英寸一号木为参考：杆长每加长约 1 英寸约 +6 挥重点；杆头约每 +7g 约 +1 挥重点。结果为经验估算，请以挥重秤实测为准。',
    [],
  );

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: '挥重计算器', headerBackTitle: '返回' }} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.lead}>用杆长与杆头重量变化，从「基准挥重」推算大致目标挥重刻度（D 档）。</Text>

      <Text style={styles.label}>基准挥重（起点）</Text>
      <View style={styles.chipRow}>
        {BASE_OPTIONS.map((n) => (
          <Pressable
            key={n}
            onPress={() => setBaseD(n)}
            style={({ pressed }) => [
              styles.chip,
              baseD === n && styles.chipOn,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: baseD === n }}>
            <Text style={[styles.chipTxt, baseD === n && styles.chipTxtOn]}>D{n}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>杆长相对 45 英寸的增减（英寸）</Text>
      <TextInput
        style={styles.input}
        value={lengthStr}
        onChangeText={setLengthStr}
        keyboardType="decimal-pad"
        placeholder="例如 0.5 表示比 45 英寸长半英寸"
        placeholderTextColor={TEXT_HINT}
      />
      <Text style={styles.hint}>正数 = 比 45 英寸更长；负数 = 更短。</Text>

      <Text style={styles.label}>杆头重量相对基准的增减（克）</Text>
      <TextInput
        style={styles.input}
        value={headStr}
        onChangeText={setHeadStr}
        keyboardType="numbers-and-punctuation"
        placeholder="例如 +7 或 -7"
        placeholderTextColor={TEXT_HINT}
      />
      <Text style={styles.hint}>正数加重杆头、负数减轻；可与配重螺丝调整对应。</Text>

      <Pressable onPress={onCalc} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
        <Text style={styles.primaryTxt}>推算目标挥重</Text>
      </Pressable>

      {result != null && (
        <View style={styles.resultBox}>
          <Text style={styles.resultLabel}>估算结果</Text>
          <Text style={styles.resultValue}>约 D{result.d}</Text>
          <Text style={styles.resultDetail}>{result.detail}</Text>
        </View>
      )}

      <View style={styles.noteBox}>
        <Text style={styles.note}>{hint}</Text>
      </View>

      <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
        <Text style={styles.secondaryTxt}>返回</Text>
      </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40, flexGrow: 1 },
  lead: { fontSize: 14, color: TEXT_SECONDARY, lineHeight: 22, marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', color: TEXT_TERTIARY, marginBottom: 8 },
  hint: { fontSize: 11, color: TEXT_HINT, marginTop: 4, marginBottom: 16 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: WHITE,
    borderWidth: 0.5,
    borderColor: BORDER,
  },
  chipOn: { backgroundColor: GREEN_LIGHT, borderColor: GREEN },
  chipTxt: { fontSize: 14, fontWeight: '600', color: TEXT_SECONDARY },
  chipTxtOn: { color: GREEN },
  input: {
    backgroundColor: WHITE,
    borderWidth: 0.5,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: TEXT_PRIMARY,
  },
  primary: {
    marginTop: 8,
    backgroundColor: GREEN,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryTxt: { color: WHITE, fontSize: 16, fontWeight: '700' },
  resultBox: {
    marginTop: 20,
    backgroundColor: GREEN_LIGHT,
    borderRadius: 14,
    padding: 16,
    borderWidth: 0.5,
    borderColor: GREEN_BORDER_SOFT,
  },
  resultLabel: { fontSize: 12, color: GREEN, fontWeight: '600', marginBottom: 4 },
  resultValue: { fontSize: 28, fontWeight: '800', color: TEXT_PRIMARY, marginBottom: 8 },
  resultDetail: { fontSize: 12, color: TEXT_SECONDARY },
  noteBox: {
    marginTop: 20,
    backgroundColor: WHITE,
    borderRadius: 14,
    padding: 14,
    borderWidth: 0.5,
    borderColor: BORDER,
  },
  note: { fontSize: 12, color: TEXT_SECONDARY, lineHeight: 18 },
  secondary: {
    marginTop: 20,
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: GREEN,
  },
  secondaryTxt: { color: GREEN, fontWeight: '700', fontSize: 15 },
  pressed: { opacity: 0.9 },
});
