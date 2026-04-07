import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const GREEN = '#166534';
const GREEN_LIGHT = '#dcfce7';
const WHITE = '#ffffff';
const BG = '#f3f4f6';
const BORDER = '#e5e7eb';
const TEXT_PRIMARY = '#111827';
const TEXT_SECONDARY = '#6b7280';
const TEXT_TERTIARY = '#9ca3af';
const TEXT_DISABLED = '#d1d5db';
const CARD_SELECTED = '#f0faf4';

// ── 数据 ──────────────────────────────────────────────
const SHAFTS = {
  一号木: [
    {
      name: 'Ventus Blue 6S',
      brand: 'Fujikura',
      弹道: '中低',
      旋转: '低旋',
      重量: '63g',
      手感: '硬实',
      kickPoint: '高',
      recommended: true,
    },
    {
      name: "Kai'li White 60S",
      brand: 'Mitsubishi',
      弹道: '中高',
      旋转: '中旋',
      重量: '60g',
      手感: '弹柔',
      kickPoint: '低',
      recommended: false,
    },
    {
      name: 'Tour AD IZ 6S',
      brand: 'Mitsubishi',
      弹道: '低',
      旋转: '极低旋',
      重量: '65g',
      手感: '稳定',
      kickPoint: '高',
      recommended: false,
    },
  ],
  铁杆: [
    {
      name: 'DG X100',
      brand: 'True Temper',
      弹道: '低',
      旋转: '低旋',
      重量: '130g',
      手感: '极硬',
      kickPoint: '—',
      recommended: false,
    },
    {
      name: 'KBS Tour S',
      brand: 'KBS',
      弹道: '中',
      旋转: '中旋',
      重量: '120g',
      手感: '稳定',
      kickPoint: '—',
      recommended: true,
    },
    {
      name: 'NS Pro 950',
      brand: 'Nippon',
      弹道: '中高',
      旋转: '中旋',
      重量: '95g',
      手感: '轻弹',
      kickPoint: '—',
      recommended: false,
    },
  ],
  球道木: [
    {
      name: 'Ventus Blue 7S',
      brand: 'Fujikura',
      弹道: '中低',
      旋转: '低旋',
      重量: '72g',
      手感: '硬实',
      kickPoint: '高',
      recommended: true,
    },
    {
      name: 'Tour AD DI 7S',
      brand: 'Mitsubishi',
      弹道: '中',
      旋转: '中旋',
      重量: '70g',
      手感: '全能',
      kickPoint: '中',
      recommended: false,
    },
    {
      name: 'Tensei AV 75S',
      brand: 'Mitsubishi',
      弹道: '中',
      旋转: '中旋',
      重量: '75g',
      手感: '稳定',
      kickPoint: '中',
      recommended: false,
    },
  ],
};

const HEADS = {
  一号木: [
    {
      name: 'Ping G430 Max',
      type: '宽容型',
      杆面角: '10.5°',
      体积: '460cc',
      重心: '深',
      宽容度: 5,
      操控性: 3,
      差点: '12+',
      recommended: true,
    },
    {
      name: 'TaylorMade Qi10',
      type: '距离型',
      杆面角: '9°',
      体积: '460cc',
      重心: '中',
      宽容度: 4,
      操控性: 4,
      差点: '6–15',
      recommended: false,
    },
    {
      name: 'Titleist TSR3',
      type: '操控型',
      杆面角: '10°',
      体积: '450cc',
      重心: '浅',
      宽容度: 3,
      操控性: 5,
      差点: '0–8',
      recommended: false,
    },
  ],
  铁杆: [
    {
      name: 'Ping i230',
      type: '精准型',
      杆面角: '—',
      体积: '—',
      重心: '低',
      宽容度: 3,
      操控性: 5,
      差点: '0–10',
      recommended: false,
    },
    {
      name: 'Callaway Apex',
      type: '宽容型',
      杆面角: '—',
      体积: '—',
      重心: '低深',
      宽容度: 4,
      操控性: 4,
      差点: '5–15',
      recommended: true,
    },
    {
      name: 'TaylorMade P790',
      type: '中空锻造',
      杆面角: '—',
      体积: '—',
      重心: '中',
      宽容度: 4,
      操控性: 4,
      差点: '5–15',
      recommended: false,
    },
  ],
};

type QuizOption = { id: string; label: string };
type QuizKey = 'speed' | 'hcp' | 'flight' | 'budget';
type QuizQuestion = { key: QuizKey; title: string; options: QuizOption[] };

const QUIZ_QUESTIONS: QuizQuestion[] = [
  { key: 'speed', title: '您的一号木挥速？', options: [{ id: 'lt75', label: '75mph以下' }, { id: '75to90', label: '75–90mph' }, { id: '90to105', label: '90–105mph' }, { id: 'gt105', label: '105mph以上' }] },
  { key: 'hcp', title: '您的差点？', options: [{ id: '25plus', label: '25以上' }, { id: '15to25', label: '15–25' }, { id: '8to15', label: '8–15' }, { id: 'lt8', label: '8以下' }] },
  { key: 'flight', title: '弹道偏好？', options: [{ id: 'high', label: '高弹道（追距离）' }, { id: 'mid', label: '中弹道（均衡）' }, { id: 'low', label: '低弹道（控球）' }] },
  { key: 'budget', title: '套杆预算？', options: [{ id: 'entry', label: '¥3000以下' }, { id: 'mid', label: '¥3000–8000' }, { id: 'high', label: '¥8000以上' }] },
];

type ShaftRow = (typeof SHAFTS)['一号木'][number];
const SHAFT_FIELDS: (keyof ShaftRow)[] = ['弹道', '旋转', '重量', '手感', 'kickPoint'];

// ── 组件 ──────────────────────────────────────────────
function Stars({ count, max = 5 }: { count: number; max?: number }) {
  return (
    <Text style={{ fontSize: 11 }}>
      {Array.from({ length: max }, (_, i) => (
        <Text key={i} style={{ color: i < count ? GREEN : TEXT_DISABLED }}>
          ★
        </Text>
      ))}
    </Text>
  );
}

function ShaftTab() {
  const [clubType, setClubType] = useState<keyof typeof SHAFTS>('一号木');
  const shafts = SHAFTS[clubType];

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipRow}>
        {(Object.keys(SHAFTS) as (keyof typeof SHAFTS)[]).map((k) => (
          <TouchableOpacity
            key={k}
            onPress={() => setClubType(k)}
            style={[s.chip, clubType === k && s.chipActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: clubType === k }}>
            <Text style={[s.chipText, clubType === k && s.chipTextActive]}>{k}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView horizontal={true} showsHorizontalScrollIndicator={false}>
        <View style={s.cardRow}>
          {shafts.map((sh) => (
            <View key={sh.name} style={[s.shaftCard, sh.recommended && s.cardHighlight]}>
              {sh.recommended && (
                <View style={s.badge}>
                  <Text style={s.badgeText}>推荐</Text>
                </View>
              )}
              <Text style={s.cardTitle} numberOfLines={2}>
                {sh.name}
              </Text>
              <Text style={s.cardBrand}>{sh.brand}</Text>
              {SHAFT_FIELDS.map((f) => (
                <View key={String(f)} style={s.cardRow2}>
                  <Text style={s.fieldLabel}>{f === 'kickPoint' ? '拐点' : String(f)}</Text>
                  <Text style={s.fieldValue}>{String(sh[f])}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={s.infoBox}>
        <Text style={s.infoText}>弹道偏高 → 选 Kai&apos;li 系列　弹道偏低 → 选 IZ / Ventus Blue</Text>
      </View>
    </View>
  );
}

/** 杆头对比：一号木三款（与需求一致），纵向卡片避免 48% 栅格出现 2+1 */
function HeadTab() {
  const heads = HEADS['一号木'];

  return (
    <View>
      <Text style={s.headIntro}>一号木杆头</Text>
      <View style={s.headColumn}>
        {heads.map((h) => (
          <View key={h.name} style={[s.headCardFull, h.recommended && s.cardHighlight]}>
            {h.recommended && (
              <View style={s.badgeFit}>
                <Text style={s.badgeFitText}>适合你</Text>
              </View>
            )}
            <Text style={s.cardTitle}>{h.name}</Text>
            <Text style={s.cardBrand}>{h.type}</Text>
            {[
              ['杆面角', h.杆面角],
              ['体积', h.体积],
              ['重心', h.重心],
              ['适合差点', h.差点],
            ].map(([k, v]) => (
              <View key={k} style={s.cardRow2}>
                <Text style={s.fieldLabel}>{k}</Text>
                <Text style={s.fieldValue}>{v}</Text>
              </View>
            ))}
            <View style={s.cardRow2}>
              <Text style={s.fieldLabel}>宽容度</Text>
              <Stars count={h.宽容度} />
            </View>
            <View style={s.cardRow2}>
              <Text style={s.fieldLabel}>操控性</Text>
              <Stars count={h.操控性} />
            </View>
          </View>
        ))}
      </View>

      <View style={s.infoBox}>
        <Text style={s.infoText}>差点 12+ 优先宽容度　差点 8 以下可选操控型</Text>
      </View>
    </View>
  );
}

function RecommendTab() {
  const [answers, setAnswers] = useState<Partial<Record<QuizKey, string>>>({});
  const [showResult, setShowResult] = useState(false);

  const pickedHcp = answers.hcp;
  const pickedFlight = answers.flight;
  const pickedBudget = answers.budget;
  const allAnswered = QUIZ_QUESTIONS.every((q) => Boolean(answers[q.key]));

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

  function chooseOption(key: QuizKey, optionId: string) {
    setAnswers((prev) => ({ ...prev, [key]: optionId }));
    if (showResult) setShowResult(false);
  }

  function onViewResult() {
    if (!allAnswered) return;
    setShowResult(true);
  }

  function resetQuiz() {
    setAnswers({});
    setShowResult(false);
  }

  return (
    <View style={s.recommendWrap}>
      <ScrollView style={s.scroll} contentContainerStyle={s.recommendContent} keyboardShouldPersistTaps="handled">
        <Text style={s.recommendTitle}>套杆推荐</Text>
        <Text style={s.recommendSub}>回答以下问题，获取专属配杆方案</Text>

        {QUIZ_QUESTIONS.map((q) => (
          <View key={q.key} style={s.questionCard}>
            <Text style={s.cardQuestion}>{q.title}</Text>
            {q.options.map((opt) => {
              const active = answers[q.key] === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[s.optionRow, active && s.optionRowActive]}
                  onPress={() => chooseOption(q.key, opt.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}>
                  <Text style={[s.optionCheck, active && s.optionCheckActive]}>{active ? '✓' : ''}</Text>
                  <Text style={s.optionLabel}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        {showResult ? (
          <View style={s.resultCard}>
            <Text style={s.cardTitle}>推荐套杆：{setName}</Text>
            <View style={s.cardRow2}>
              <Text style={s.fieldLabel}>一号木</Text>
              <Text style={s.fieldValue}>{driverHead} / {driverShaft}</Text>
            </View>
            <View style={s.cardRow2}>
              <Text style={s.fieldLabel}>铁杆</Text>
              <Text style={s.fieldValue}>{ironSet}</Text>
            </View>
            <View style={s.cardRow2}>
              <Text style={s.fieldLabel}>挖起杆</Text>
              <Text style={s.fieldValue}>{wedgeSet}</Text>
            </View>
            <View style={s.cardRow2}>
              <Text style={s.fieldLabel}>推杆</Text>
              <Text style={s.fieldValue}>{putter}</Text>
            </View>
            <TouchableOpacity style={s.resetBtn} onPress={resetQuiz} accessibilityRole="button" accessibilityLabel="重新填写">
              <Text style={s.resetBtnText}>重新填写</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>

      <View style={s.fixedActionBar}>
        <TouchableOpacity
          style={[s.submitBtn, !allAnswered && s.submitBtnDisabled]}
          onPress={onViewResult}
          disabled={!allAnswered}
          accessibilityRole="button"
          accessibilityLabel="查看推荐结果">
          <Text style={s.submitBtnText}>查看推荐结果</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function CompareScreen() {
  const [tab, setTab] = useState(2);
  const TABS = ['杆身对比', '杆头对比', '套杆推荐'];

  return (
    <View style={s.container}>
      <View style={s.tabBar}>
        {TABS.map((t, i) => (
          <Pressable
            key={t}
            onPress={() => setTab(i)}
            style={({ pressed }) => [s.tabBtn, tab === i && s.tabActive, pressed && s.tabPressed]}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === i }}>
            <Text style={[s.tabText, tab === i && s.tabTextActive]}>{t}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 2 ? (
        <RecommendTab />
      ) : (
        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
          {tab === 0 ? <ShaftTab /> : <HeadTab />}
        </ScrollView>
      )}
    </View>
  );
}

// ── 样式 ─────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: WHITE,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
  },
  tabBtn: {
    flex: 1,
    minHeight: 48,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: GREEN, backgroundColor: GREEN_LIGHT },
  tabPressed: { opacity: 0.88 },
  tabText: { fontSize: 13, color: TEXT_SECONDARY },
  tabTextActive: { fontSize: 13, color: GREEN, fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32, flexGrow: 1 },

  chipRow: { marginBottom: 12 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: WHITE,
    borderWidth: 0.5,
    borderColor: BORDER,
    marginRight: 8,
  },
  chipActive: { backgroundColor: GREEN_LIGHT, borderColor: GREEN },
  chipText: { fontSize: 12, color: TEXT_SECONDARY },
  chipTextActive: { color: GREEN, fontWeight: '500' },

  cardRow: { flexDirection: 'row', paddingBottom: 4, paddingRight: 10 },

  shaftCard: {
    width: 150,
    marginRight: 10,
    backgroundColor: WHITE,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: BORDER,
    padding: 12,
  },
  headIntro: { fontSize: 13, fontWeight: '600', color: GREEN, marginBottom: 10 },
  headColumn: { gap: 8, marginBottom: 8 },
  headCardFull: {
    width: '100%',
    backgroundColor: WHITE,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: BORDER,
    padding: 14,
  },
  badgeFit: {
    alignSelf: 'flex-start',
    backgroundColor: GREEN,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 8,
  },
  badgeFitText: { fontSize: 10, color: WHITE, fontWeight: '700' },

  cardHighlight: { borderWidth: 2, borderColor: GREEN },
  badge: {
    backgroundColor: GREEN_LIGHT,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  badgeText: { fontSize: 10, color: GREEN, fontWeight: '500' },

  cardTitle: { fontSize: 13, fontWeight: '600', color: TEXT_PRIMARY, marginBottom: 2 },
  cardBrand: { fontSize: 11, color: TEXT_TERTIARY, marginBottom: 10 },
  cardRow2: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  fieldLabel: { fontSize: 11, color: TEXT_TERTIARY },
  fieldValue: { fontSize: 11, color: TEXT_PRIMARY, fontWeight: '500', flexShrink: 1, textAlign: 'right' },

  infoBox: { backgroundColor: GREEN_LIGHT, borderRadius: 10, padding: 10 },
  infoText: { fontSize: 12, color: GREEN },

  recommendWrap: { flex: 1 },
  recommendContent: { padding: 16, paddingBottom: 120 },
  recommendTitle: { fontSize: 22, fontWeight: '700', color: TEXT_PRIMARY, marginBottom: 6 },
  recommendSub: { fontSize: 13, color: TEXT_SECONDARY, marginBottom: 14 },
  questionCard: {
    backgroundColor: WHITE,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: BORDER,
  },
  cardQuestion: { fontSize: 14, fontWeight: '600', color: TEXT_PRIMARY, marginBottom: 10 },
  optionRow: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionRowActive: { borderColor: GREEN, backgroundColor: CARD_SELECTED },
  optionCheck: { width: 18, marginRight: 8, fontSize: 14, color: GREEN, fontWeight: '700' },
  optionCheckActive: { color: GREEN },
  optionLabel: { flex: 1, fontSize: 13, color: TEXT_PRIMARY },

  resultCard: {
    backgroundColor: WHITE,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: BORDER,
    padding: 14,
    marginBottom: 12,
  },
  resetBtn: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: GREEN,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  resetBtnText: { fontSize: 13, fontWeight: '700', color: GREEN },
  fixedActionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: WHITE,
    borderTopWidth: 0.5,
    borderTopColor: BORDER,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  submitBtn: {
    backgroundColor: GREEN,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  submitBtnDisabled: { backgroundColor: TEXT_DISABLED },
  submitBtnText: { fontSize: 14, fontWeight: '700', color: WHITE },
});
