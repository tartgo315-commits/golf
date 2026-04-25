import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { DARK_PAGE } from '@/constants/theme';

const BG = DARK_PAGE.bg;
const CARD_FILL = DARK_PAGE.card;
const BORDER = DARK_PAGE.cardBorder;
const TEXT_PRIMARY = DARK_PAGE.text;
const TEXT_SECONDARY = DARK_PAGE.textSecondary;

export default function GripToolScreen() {
  const router = useRouter();
  const [palmCm, setPalmCm] = useState('');

  const recommendation = useMemo(() => {
    const v = Number(palmCm);
    if (!Number.isFinite(v) || v <= 0) return '请输入手围后查看推荐';
    if (v < 18) return '推荐：Standard（标准）';
    if (v < 20.5) return '推荐：Midsize（中号）';
    return '推荐：Oversize（加粗）';
  }, [palmCm]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      <Pressable onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backTxt}>← 返回</Text>
      </Pressable>
      <Text style={styles.title}>握把选择</Text>
      <View style={styles.card}>
        <Text style={styles.label}>手围（cm）</Text>
        <TextInput
          value={palmCm}
          onChangeText={setPalmCm}
          style={styles.input}
          placeholder="例如 19.5"
          placeholderTextColor={DARK_PAGE.textMuted}
          keyboardType="decimal-pad"
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.result}>{recommendation}</Text>
        <Text style={styles.note}>可结合击球反馈再微调（防左/防右与手腕释放节奏）。</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  content: { padding: 16, paddingBottom: 32 },
  backBtn: { marginBottom: 8, alignSelf: 'flex-start' },
  backTxt: { color: TEXT_SECONDARY, fontWeight: '600' },
  title: { fontSize: 24, fontWeight: '700', color: TEXT_PRIMARY, marginBottom: 12 },
  card: {
    backgroundColor: CARD_FILL,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
    marginBottom: 10,
  },
  label: { fontSize: 12, color: TEXT_SECONDARY, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: DARK_PAGE.inputBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: TEXT_PRIMARY,
    backgroundColor: DARK_PAGE.inputBg,
  },
  result: { fontSize: 18, color: TEXT_PRIMARY, fontWeight: '700', marginBottom: 6 },
  note: { fontSize: 13, color: TEXT_SECONDARY },
});
