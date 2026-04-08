import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { readJson } from '@/lib/local-storage';
import { COMPARE_PRODUCTS_KEY, type ProductItem } from '@/lib/product-db';

const GREEN = '#166534';
const GREEN_LIGHT = '#dcfce7';
const BG = '#f3f4f6';
const WHITE = '#ffffff';
const BORDER = '#e5e7eb';
const TEXT_PRIMARY = '#111827';
const TEXT_SECONDARY = '#6b7280';
const TEXT_TERTIARY = '#9ca3af';
const BEST_BG = '#dcfce7';
const BEST_TEXT = '#166534';
const WORST_BG = '#fee2e2';
const WORST_TEXT = '#991b1b';

type QuizOption = { id: string; label: string };
type QuizKey = 'speed' | 'hcp' | 'flight' | 'budget';
type QuizQuestion = { key: QuizKey; title: string; options: QuizOption[] };

const QUIZ_QUESTIONS: QuizQuestion[] = [
  { key: 'speed', title: '您的一号木挥速？', options: [{ id: 'lt75', label: '75mph以下' }, { id: '75to90', label: '75-90mph' }, { id: '90to105', label: '90-105mph' }, { id: 'gt105', label: '105mph以上' }] },
  { key: 'hcp', title: '您的差点？', options: [{ id: '25plus', label: '25以上' }, { id: '15to25', label: '15-25' }, { id: '8to15', label: '8-15' }, { id: 'lt8', label: '8以下' }] },
  { key: 'flight', title: '弹道偏好？', options: [{ id: 'high', label: '高弹道（追距离）' }, { id: 'mid', label: '中弹道（均衡）' }, { id: 'low', label: '低弹道（控球）' }] },
  { key: 'budget', title: '套杆预算？', options: [{ id: 'entry', label: '¥3000以下' }, { id: 'mid', label: '¥3000-8000' }, { id: 'high', label: '¥8000以上' }] },
];

function readMetricScore(raw: string): number | null {
  const match = raw.match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  return Number(match[0]);
}

function RecommendSection() {
  const [answers, setAnswers] = useState<Partial<Record<QuizKey, string>>>({});
  const [showResult, setShowResult] = useState(false);
  const allAnswered = QUIZ_QUESTIONS.every((q) => Boolean(answers[q.key]));

  const pickedHcp = answers.hcp;
  const pickedFlight = answers.flight;
  const pickedBudget = answers.budget;

  const setName =
    pickedHcp === 'lt8'
      ? '操控型套杆'
      : pickedHcp === '8to15'
        ? '宽容全能套杆'
        : pickedHcp === '15to25'
          ? '宽容稳定套杆'
          : '超宽容入门套杆';

  const driverHead =
    pickedHcp === 'lt8'
      ? 'Titleist TSR3 9°'
      : pickedHcp === '25plus'
        ? 'TaylorMade Stealth 10.5°'
        : 'Ping G430 Max 10.5°';
  const driverShaft =
    pickedHcp === 'lt8'
      ? 'Tour AD IZ 6X'
      : pickedHcp === '25plus'
        ? "Mitsubishi Kai'li 60R"
        : 'Fujikura Ventus Blue 6S';
  const ironSet =
    pickedHcp === 'lt8'
      ? 'Ping i230 4-PW / DG X100'
      : pickedHcp === '25plus'
        ? 'Callaway Rogue ST MAX 6-PW / NS Pro 950'
        : 'Callaway Apex 5-PW / KBS Tour S';
  const wedgeSet = pickedBudget === 'entry' ? 'Cleveland CBX 52/56' : 'Vokey SM10 50/54/58';
  const putter = pickedFlight === 'low' ? 'Scotty Cameron Phantom 5' : 'Odyssey Tri-Hot 5K';

  return (
    <View style={s.sectionCard}>
      <Text style={s.sectionTitle}>套杆推荐</Text>
      <Text style={s.sectionSub}>回答以下问题，获取专属配杆方案</Text>

      {QUIZ_QUESTIONS.map((q) => (
        <View key={q.key} style={s.questionCard}>
          <Text style={s.questionTitle}>{q.title}</Text>
          {q.options.map((opt) => {
            const active = answers[q.key] === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                style={[s.optionRow, active && s.optionRowActive]}
                onPress={() => {
                  setAnswers((prev) => ({ ...prev, [q.key]: opt.id }));
                  if (showResult) setShowResult(false);
                }}>
                <Text style={s.optionLabel}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      <TouchableOpacity
        style={[s.submitBtn, !allAnswered && s.submitBtnDisabled]}
        disabled={!allAnswered}
        onPress={() => setShowResult(true)}>
        <Text style={s.submitBtnText}>查看推荐结果</Text>
      </TouchableOpacity>

      {showResult ? (
        <View style={s.resultCard}>
          <Text style={s.resultTitle}>推荐套杆：{setName}</Text>
          <Text style={s.resultLine}>一号木：{driverHead} / {driverShaft}</Text>
          <Text style={s.resultLine}>铁杆：{ironSet}</Text>
          <Text style={s.resultLine}>挖起杆：{wedgeSet}</Text>
          <Text style={s.resultLine}>推杆：{putter}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function CompareScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<ProductItem[]>([]);

  useFocusEffect(
    useCallback(() => {
      const items = readJson<ProductItem[]>(COMPARE_PRODUCTS_KEY, []);
      setSelected(items.slice(0, 3));
      return () => {};
    }, []),
  );

  const rows = useMemo(() => {
    const baseRows = ['类别', '品牌型号', '适合人群标签'];
    const paramKeys = Array.from(new Set(selected.flatMap((item) => Object.keys(item.params))));
    return [...baseRows, ...paramKeys];
  }, [selected]);

  const rowValues = useMemo(() => {
    return rows.map((row) => {
      const values = selected.map((item) => {
        if (row === '类别') return item.category;
        if (row === '品牌型号') return `${item.brand} ${item.model}`;
        if (row === '适合人群标签') return item.crowdTag;
        return item.params[row] || '-';
      });
      return { row, values };
    });
  }, [rows, selected]);

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content} showsVerticalScrollIndicator={false} bounces={false}>
      <View style={s.sectionCard}>
        <Text style={s.sectionTitle}>产品对比</Text>
        <Text style={s.sectionSub}>从装备库选择最多3个产品进行横向参数对比</Text>
        <TouchableOpacity style={s.entryBtn} onPress={() => router.push('/(tabs)/products')}>
          <Text style={s.entryBtnText}>选择产品对比（已选 {selected.length}/3）</Text>
        </TouchableOpacity>

        {selected.length < 2 ? (
          <Text style={s.emptyText}>至少选择2个产品后可显示对比结果。</Text>
        ) : (
          <View style={s.tableWrap}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} showsVerticalScrollIndicator={false} bounces={false}>
              <View>
                {rowValues.map(({ row, values }) => {
                  const scores = values.map((v) => readMetricScore(v));
                  const comparable = scores.every((v) => typeof v === 'number');
                  const max = comparable ? Math.max(...(scores as number[])) : null;
                  const min = comparable ? Math.min(...(scores as number[])) : null;
                  const hasDiff = comparable ? max !== min : false;

                  return (
                    <View key={row} style={s.tableRow}>
                      <View style={[s.labelCell, row === '品牌型号' && s.headerCell]}>
                        <Text style={s.labelText}>{row}</Text>
                      </View>
                      {values.map((value, idx) => {
                        const score = scores[idx];
                        const isBest = hasDiff && score === max;
                        const isWorst = hasDiff && score === min;
                        return (
                          <View
                            key={`${row}-${idx}`}
                            style={[
                              s.valueCell,
                              row === '品牌型号' && s.headerCell,
                              isBest && s.bestCell,
                              isWorst && s.worstCell,
                            ]}>
                            <Text
                              style={[
                                s.valueText,
                                row === '品牌型号' && s.headerText,
                                isBest && s.bestText,
                                isWorst && s.worstText,
                              ]}>
                              {value}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  );
                })}
              </View>
            </ScrollView>
            <Text style={s.legend}>说明：绿色=当前行数值最高，红色=当前行数值最低。</Text>
          </View>
        )}
      </View>

      <RecommendSection />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  content: { padding: 16, paddingTop: Platform.OS === 'web' ? 44 : 16, paddingBottom: 24 },
  sectionCard: {
    backgroundColor: WHITE,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: BORDER,
    padding: 14,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: TEXT_PRIMARY, marginBottom: 6 },
  sectionSub: { fontSize: 12, color: TEXT_SECONDARY, marginBottom: 10 },
  entryBtn: {
    backgroundColor: GREEN,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  entryBtnText: { color: WHITE, fontSize: 13, fontWeight: '700' },
  emptyText: { fontSize: 12, color: TEXT_TERTIARY, marginTop: 6 },
  tableWrap: { marginTop: 6 },
  tableRow: { flexDirection: 'row' },
  labelCell: {
    width: 108,
    borderWidth: 0.5,
    borderColor: BORDER,
    paddingHorizontal: 8,
    paddingVertical: 10,
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
  },
  valueCell: {
    width: 180,
    borderWidth: 0.5,
    borderColor: BORDER,
    paddingHorizontal: 8,
    paddingVertical: 10,
    justifyContent: 'center',
    backgroundColor: WHITE,
  },
  headerCell: { backgroundColor: GREEN_LIGHT },
  labelText: { fontSize: 12, color: TEXT_SECONDARY, fontWeight: '600' },
  valueText: { fontSize: 12, color: TEXT_PRIMARY },
  headerText: { fontWeight: '700', color: GREEN },
  bestCell: { backgroundColor: BEST_BG },
  worstCell: { backgroundColor: WORST_BG },
  bestText: { color: BEST_TEXT, fontWeight: '700' },
  worstText: { color: WORST_TEXT, fontWeight: '700' },
  legend: { marginTop: 8, color: TEXT_TERTIARY, fontSize: 11 },
  questionCard: {
    borderWidth: 0.5,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  questionTitle: { fontSize: 13, fontWeight: '700', color: TEXT_PRIMARY, marginBottom: 8 },
  optionRow: {
    borderWidth: 0.5,
    borderColor: BORDER,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  optionRowActive: { borderColor: GREEN, backgroundColor: GREEN_LIGHT },
  optionLabel: { fontSize: 12, color: TEXT_PRIMARY },
  submitBtn: {
    backgroundColor: GREEN,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  submitBtnDisabled: { backgroundColor: '#9ca3af' },
  submitBtnText: { color: WHITE, fontSize: 13, fontWeight: '700' },
  resultCard: {
    marginTop: 10,
    borderWidth: 0.5,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#f9fafb',
  },
  resultTitle: { color: TEXT_PRIMARY, fontSize: 13, fontWeight: '700', marginBottom: 6 },
  resultLine: { fontSize: 12, color: TEXT_SECONDARY, marginBottom: 3 },
});
