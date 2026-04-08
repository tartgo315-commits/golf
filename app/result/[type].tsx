import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FAVORITES_KEY, USER_PROFILE_KEY, type StoredUserProfile } from '@/lib/app-storage';
import { readJson, writeJson } from '@/lib/local-storage';
import { normalizeClubTypeParam } from '@/lib/quiz-routing';

const QUIZ_PAYLOAD_KEY = 'last_quiz';
const WHITE = '#ffffff';
const BG = '#f3f4f6';
const BORDER = '#e5e7eb';
const GREEN = '#166534';
const TEXT_PRIMARY = '#111827';
const TEXT_SECONDARY = '#6b7280';

type QuizType = 'driver' | 'iron' | 'fairway' | 'wedge' | 'putter';
type StoredQuiz = { category: QuizType; answers: Record<string, string> };
type RecommendationSpec = {
  model: string;
  head: string;
  shaft: string;
  length: string;
  swingWeight: string;
  reason: string;
  flex: 'R' | 'S' | 'X';
  swingSpeed: number;
  handicap: number;
  headStyle: string;
};

function parseProfileNumbers(profile: StoredUserProfile | null) {
  return {
    swingSpeed: Number(profile?.swingSpeedMph) || 90,
    handicap: Number(profile?.handicap) || 18,
  };
}

function flexBySwingSpeed(speed: number): 'R' | 'S' | 'X' {
  if (speed < 85) return 'R';
  if (speed <= 100) return 'S';
  return 'X';
}

function headStyleByHandicap(handicap: number) {
  if (handicap > 18) return '宽容型';
  if (handicap >= 8) return '均衡型';
  return '操控型';
}

function defaultSpec(category: QuizType): RecommendationSpec {
  return {
    model:
      category === 'fairway'
        ? '球道木推荐方案'
        : category === 'wedge'
          ? '挖起杆推荐方案'
          : category === 'putter'
            ? '推杆推荐方案'
            : '基础推荐方案',
    head:
      category === 'fairway'
        ? 'G430 SFT 3W'
        : category === 'wedge'
          ? 'Vokey SM10 52/56'
          : category === 'putter'
            ? 'Odyssey Tri-Hot 5K'
            : 'G430 Max',
    shaft:
      category === 'fairway'
        ? 'Ventus Blue 7S'
        : category === 'wedge'
          ? 'DG S200'
          : category === 'putter'
            ? '标准钢杆身'
            : 'Ventus TR Blue 6S',
    length: category === 'fairway' ? '43.0"' : category === 'putter' ? '34"' : '标准',
    swingWeight: category === 'putter' ? 'E0' : 'D2',
    reason: '该方案在容错、距离和稳定性之间较均衡，适合作为默认起点，后续可再按实打反馈微调。',
    flex: 'S',
    swingSpeed: 90,
    handicap: 18,
    headStyle: '均衡型',
  };
}

function recommendDriver(answers: Record<string, string>, profile: StoredUserProfile | null): RecommendationSpec {
  const { swingSpeed, handicap } = parseProfileNumbers(profile);
  const flex = flexBySwingSpeed(swingSpeed);
  const headStyle = headStyleByHandicap(handicap);
  const joined = Object.values(answers).join('|');
  if (joined.includes('right') || joined.includes('high') || joined.includes('forgiving')) {
    return {
      model: '宽容稳定一号木',
      head: `${headStyle}杆头：Ping G430 Max`,
      shaft: `Kai'li White 60${flex}`,
      length: '45.5"',
      swingWeight: 'D2',
      reason: '你的答案更偏向纠正右曲并提高击球容错，G430 Max 的高容错更容易保持上球率。搭配 Kai\'li White 60S 能让节奏更稳，弹道更可控。',
      flex,
      swingSpeed,
      handicap,
      headStyle,
    };
  }
  if (joined.includes('left') || joined.includes('low') || joined.includes('control')) {
    return {
      model: '操控型一号木',
      head: `${headStyle}杆头：Titleist TSR3`,
      shaft: `Ventus Blue 6${flex}`,
      length: '45"',
      swingWeight: 'D3',
      reason: '你的偏好更偏向控球与低弹道，TSR3 的可操控性更适合主动做球。Ventus Blue 6S 在稳定性与手感之间平衡，便于压低侧旋。',
      flex,
      swingSpeed,
      handicap,
      headStyle,
    };
  }
  return {
    model: '均衡距离一号木',
    head: `${headStyle}杆头：TaylorMade Qi10`,
    shaft: `Ventus TR Blue 6${flex}`,
    length: '45.5"',
    swingWeight: 'D2',
    reason: '你的选项呈现中性分布，优先推荐均衡的距离与容错组合。该配置上手快，后续也方便按挥速与手感继续微调。',
    flex,
    swingSpeed,
    handicap,
    headStyle,
  };
}

function recommendIron(answers: Record<string, string>, profile: StoredUserProfile | null): RecommendationSpec {
  const { swingSpeed, handicap } = parseProfileNumbers(profile);
  const flex = flexBySwingSpeed(swingSpeed);
  const headStyle = headStyleByHandicap(handicap);
  if (answers.i2 === 'thin') {
    return {
      model: '刀背取向铁杆方案',
      head: `${headStyle}杆头：Ping i230`,
      shaft: `DG X100（${flex}）`,
      length: '标准',
      swingWeight: 'D3',
      reason: '你偏好更薄顶线与更直接反馈，i230 更贴近操控取向。DG X100 更适合追求杆面控制与穿透弹道的击球节奏。',
      flex,
      swingSpeed,
      handicap,
      headStyle,
    };
  }
  if (answers.i3 === 'thin' || answers.i3 === 'fat') {
    return {
      model: '宽容铁杆方案',
      head: `${headStyle}杆头：Callaway Apex`,
      shaft: `KBS Tour ${flex}`,
      length: '标准 +0.25"',
      swingWeight: 'D2',
      reason: '你当前在击球稳定性上需要更高容错，Apex 对打点偏差更友好。KBS Tour S 提供稳健弹道与可接受反馈，帮助你更快建立稳定触球。',
      flex,
      swingSpeed,
      handicap,
      headStyle,
    };
  }
  return {
    model: '均衡铁杆方案',
    head: `${headStyle}杆头：TaylorMade P790`,
    shaft: `KBS Tour ${flex}`,
    length: '标准',
    swingWeight: 'D2',
    reason: '该组合在距离、容错和手感之间表现均衡，适合大多数业余球友。先保证稳定落点，再逐步升级到更强操控取向。',
    flex,
    swingSpeed,
    handicap,
    headStyle,
  };
}

export default function ResultByTypeScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const { type: rawType, answers: answersParam } = useLocalSearchParams<{ type?: string; answers?: string }>();
  const category = normalizeClubTypeParam(rawType) as QuizType | null;
  const [answers, setAnswers] = useState<Record<string, string> | null>(null);
  const [saved, setSaved] = useState(false);
  const profile = readJson<StoredUserProfile | null>(USER_PROFILE_KEY, null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: '配杆结果' });
  }, [navigation]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!category) return;
      if (answersParam) {
        try {
          const parsed = JSON.parse(decodeURIComponent(String(answersParam))) as Record<string, string>;
          if (active) setAnswers(parsed);
          return;
        } catch {}
      }
      const parsed = readJson<StoredQuiz | null>(QUIZ_PAYLOAD_KEY, null);
      if (!parsed || !active) return;
      if (parsed.category === category) setAnswers(parsed.answers);
    })();
    return () => {
      active = false;
    };
  }, [answersParam, category]);

  const result = useMemo(() => {
    if (!category || !answers) return null;
    if (category === 'driver') return recommendDriver(answers, profile);
    if (category === 'iron') return recommendIron(answers, profile);
    const base = defaultSpec(category);
    const { swingSpeed, handicap } = parseProfileNumbers(profile);
    const flex = flexBySwingSpeed(swingSpeed);
    const headStyle = headStyleByHandicap(handicap);
    return { ...base, flex, swingSpeed, handicap, headStyle, shaft: `${base.shaft}（${flex}）` };
  }, [answers, category, profile]);

  async function onSaveFavorite() {
    if (!result || !category) return;
    const list = readJson<any[]>(FAVORITES_KEY, []);
    const typeLabel = category === 'driver' ? '一号木' : category === 'iron' ? '铁杆' : category === 'fairway' ? '球道木' : category === 'wedge' ? '挖起杆' : '推杆';
    const item = {
      id: `${Date.now()}`,
      type: typeLabel,
      model: `${result.head} / ${result.shaft}`,
      headRec: result.head,
      shaftRec: result.shaft,
      flex: result.flex,
      swingSpeed: result.swingSpeed,
      handicap: result.handicap,
      savedAt: new Date().toISOString(),
    };
    writeJson(FAVORITES_KEY, [item, ...list]);
    setSaved(true);
  }

  if (!category || !result) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>未找到问卷结果，请先完成测试。</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} bounces={false}>
      <Pressable onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backTxt}>← 返回</Text>
      </Pressable>

      <View style={styles.card}>
        <Text style={styles.title}>{category === 'driver' ? '一号木推荐结果' : category === 'iron' ? '铁杆推荐结果' : category === 'fairway' ? '球道木推荐结果' : category === 'wedge' ? '挖起杆推荐结果' : '推杆推荐结果'}</Text>
        <View style={styles.row}><Text style={styles.label}>推荐杆头型号</Text><Text style={styles.value}>{result.head}</Text></View>
        <View style={styles.row}><Text style={styles.label}>推荐杆身</Text><Text style={styles.value}>{result.shaft}</Text></View>
        <View style={styles.row}><Text style={styles.label}>建议杆长</Text><Text style={styles.value}>{result.length}</Text></View>
        <View style={styles.row}><Text style={styles.label}>目标挥重</Text><Text style={styles.value}>{result.swingWeight}</Text></View>
        <Text style={styles.profileExplain}>根据你的挥速 {result.swingSpeed}mph，推荐 {result.flex} 硬度杆身</Text>
        <Text style={styles.profileExplain}>根据你的差点 {result.handicap}，推荐{result.headStyle}杆头</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.reasonTitle}>推荐理由</Text>
        <Text style={styles.reasonBody}>{result.reason}</Text>
      </View>

      <Pressable style={styles.primaryBtn} onPress={onSaveFavorite}>
        <Text style={styles.primaryTxt}>{saved ? '已保存到收藏' : '保存到收藏'}</Text>
      </Pressable>
      <Pressable style={styles.secondaryBtn} onPress={() => router.replace({ pathname: '/quiz/[type]', params: { type: rawType ?? category } })}>
        <Text style={styles.secondaryTxt}>重新测试</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: BG },
  scroll: { padding: 16, paddingTop: Platform.OS === 'web' ? 44 : 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  muted: { color: TEXT_SECONDARY },
  backBtn: { marginBottom: 12, alignSelf: 'flex-start' },
  backTxt: { fontSize: 14, color: GREEN, fontWeight: '600' },
  card: { backgroundColor: WHITE, borderRadius: 14, borderWidth: 0.5, borderColor: BORDER, padding: 16, marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '700', color: TEXT_PRIMARY, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, gap: 12 },
  label: { fontSize: 13, color: TEXT_SECONDARY },
  value: { fontSize: 13, color: TEXT_PRIMARY, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  reasonTitle: { fontSize: 15, fontWeight: '700', color: TEXT_PRIMARY, marginBottom: 6 },
  reasonBody: { fontSize: 13, lineHeight: 20, color: TEXT_SECONDARY },
  profileExplain: { fontSize: 12, color: GREEN, marginTop: 4 },
  primaryBtn: { backgroundColor: GREEN, borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginBottom: 10 },
  primaryTxt: { color: WHITE, fontWeight: '700', fontSize: 15 },
  secondaryBtn: { borderColor: GREEN, borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  secondaryTxt: { color: GREEN, fontWeight: '700', fontSize: 15 },
});
