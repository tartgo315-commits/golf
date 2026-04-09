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
  grip: string;
  lengthNote: string;
  shaftWeight: string;
  budgetNote: string;
  reason: string;
  flex: 'R' | 'S' | 'X';
  swingSpeed: number;
  handicap: number;
  headStyle: string;
};

function parseProfileNumbers(profile: StoredUserProfile | null) {
  const swingSpeed = Number(profile?.swingSpeedMph) || 90;
  const handicap = Number(profile?.handicap) || 18;
  const heightCm = Number(profile?.heightCm) || 170;
  const wristToFloor = Number(profile?.wristToFloorCm) || 0;
  const handCm = Number(profile?.handCircumferenceCm) || 0;
  const yearsPlaying = Number(profile?.yearsPlaying) || 0;
  const budget = Number(profile?.budgetPerClub) || 0;
  const ballFlight = profile?.ballFlight || 'mid';
  const shotShape = profile?.shotShape || 'straight';
  const tempo = profile?.swingTempo || 'medium';
  const currentBrand = profile?.currentBrand || '';

  return {
    swingSpeed,
    handicap,
    heightCm,
    wristToFloor,
    handCm,
    yearsPlaying,
    budget,
    ballFlight,
    shotShape,
    tempo,
    currentBrand,
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

function gripSizeByHand(handCm: number): string {
  if (handCm === 0) return '标准';
  if (handCm < 17) return '欠码（Undersize）';
  if (handCm <= 19) return '标准（Standard）';
  if (handCm <= 21) return '中码（Midsize）';
  return '大码（Jumbo）';
}

function lengthAdjust(wristToFloor: number, heightCm: number): string {
  if (wristToFloor === 0) {
    if (heightCm >= 190) return '+0.5"';
    if (heightCm >= 183) return '+0.25"';
    if (heightCm >= 175) return '标准';
    if (heightCm >= 168) return '-0.25"';
    return '-0.5"';
  }
  if (wristToFloor >= 85) return '+0.5"';
  if (wristToFloor >= 80) return '+0.25"';
  if (wristToFloor >= 73) return '标准';
  if (wristToFloor >= 68) return '-0.25"';
  return '-0.5"';
}

function shaftWeightHint(tempo: string): string {
  if (tempo === 'fast') return '偏重杆身（65g以上）';
  if (tempo === 'slow') return '偏轻杆身（50g以下）';
  return '中等重量杆身（55-65g）';
}

function recommendDriver(answers: Record<string, string>, profile: StoredUserProfile | null): RecommendationSpec {
  const { swingSpeed, handicap, heightCm, wristToFloor, handCm, ballFlight, shotShape, tempo, budget, currentBrand, yearsPlaying } =
    parseProfileNumbers(profile);
  const flex = flexBySwingSpeed(swingSpeed);
  const headStyle = headStyleByHandicap(handicap);
  const grip = gripSizeByHand(handCm);
  const lengthNote = lengthAdjust(wristToFloor, heightCm);
  const shaftWeight = shaftWeightHint(tempo);
  const budgetNote = budget > 0 ? `预算约¥${budget}，建议优先考虑二手或上一代旗舰` : '';
  const joined = Object.values(answers).join('|');

  if (shotShape === 'slice' || shotShape === 'fade' || joined.includes('right') || joined.includes('forgiving')) {
    return {
      model: '宽容稳定一号木',
      head: `Ping G430 Max（${headStyle}）`,
      shaft: `Kai'li White 60${flex}`,
      length: lengthNote === '标准' ? '45.5"' : `45.5" → ${lengthNote}`,
      swingWeight: tempo === 'fast' ? 'D3' : 'D2',
      grip,
      lengthNote,
      shaftWeight,
      budgetNote,
      reason: `你的档案显示挥速${swingSpeed}mph、差点${handicap}，${shotShape === 'slice' ? '存在右曲倾向，' : ''}G430 Max 的高MOI更容易保持上球率。搭配 Kai'li White 60${flex} 节奏更稳，弹道更可控。${budgetNote}${currentBrand ? `你当前使用${currentBrand}，建议试打对比后决定。` : ''}`,
      flex,
      swingSpeed,
      handicap,
      headStyle,
    };
  }
  if (shotShape === 'hook' || shotShape === 'draw' || ballFlight === 'low' || joined.includes('control')) {
    return {
      model: '操控型一号木',
      head: `Titleist TSR3（${headStyle}）`,
      shaft: `Ventus Blue 6${flex}`,
      length: lengthNote === '标准' ? '45.5"' : `45.5" → ${lengthNote}`,
      swingWeight: 'D3',
      grip,
      lengthNote,
      shaftWeight,
      budgetNote,
      reason: `你的档案显示${shotShape === 'draw' || shotShape === 'hook' ? '偏左曲球路，' : ''}${ballFlight === 'low' ? '弹道偏低，' : ''}TSR3 可操控性更强，Ventus Blue 6${flex} 帮助压低侧旋、稳定弹道窗口。`,
      flex,
      swingSpeed,
      handicap,
      headStyle,
    };
  }

  if (ballFlight === 'high') {
    return {
      model: '低旋距离型一号木',
      head: `TaylorMade Qi10（${headStyle}）`,
      shaft: `Ventus TR Red 6${flex}`,
      length: lengthNote === '标准' ? '45.5"' : `45.5" → ${lengthNote}`,
      swingWeight: 'D2',
      grip,
      lengthNote,
      shaftWeight,
      budgetNote,
      reason: `你的弹道已偏高，Ventus TR Red 低旋设计配合 Qi10 的低重心有助于压低旋转、提升落点距离。挥速${swingSpeed}mph 推荐 ${flex} 硬度。`,
      flex,
      swingSpeed,
      handicap,
      headStyle,
    };
  }

  return {
    model: '均衡距离一号木',
    head: `${yearsPlaying >= 8 ? 'Titleist GT2' : 'TaylorMade Qi10 Max'}（${headStyle}）`,
    shaft: `${currentBrand.toLowerCase().includes('titleist') ? 'Tensei 1K Black 65' : 'Ventus TR Blue 6'}${flex}`,
    length: lengthNote === '标准' ? '45.5"' : `45.5" → ${lengthNote}`,
    swingWeight: 'D2',
    grip,
    lengthNote,
    shaftWeight,
    budgetNote,
    reason: `挥速${swingSpeed}mph 推荐 ${flex} 硬度，差点${handicap} 推荐${headStyle}。该组合距离与容错均衡，后续可按实打弹道继续微调。${yearsPlaying > 0 ? `你有${yearsPlaying}年球龄，可更快适应微调后的参数。` : ''}`,
    flex,
    swingSpeed,
    handicap,
    headStyle,
  };
}

function recommendIron(answers: Record<string, string>, profile: StoredUserProfile | null): RecommendationSpec {
  const { swingSpeed, handicap, heightCm, wristToFloor, handCm, shotShape, tempo, budget } = parseProfileNumbers(profile);
  const flex = flexBySwingSpeed(swingSpeed);
  const headStyle = headStyleByHandicap(handicap);
  const grip = gripSizeByHand(handCm);
  const lengthNote = lengthAdjust(wristToFloor, heightCm);
  const shaftWeight = shaftWeightHint(tempo);
  const budgetNote = budget > 0 ? `预算约¥${budget}` : '';

  if (answers.i2 === 'thin' || handicap < 10) {
    return {
      model: '操控型铁杆',
      head: `Ping i230（${headStyle}）`,
      shaft: 'DG X100',
      length: lengthNote === '标准' ? '标准' : `标准 → ${lengthNote}`,
      swingWeight: 'D3',
      grip,
      lengthNote,
      shaftWeight,
      budgetNote,
      reason: `差点${handicap}、偏好薄顶线，i230 更贴近操控取向。DG X100 适合追求穿透弹道和精准落点。杆长建议${lengthNote}。${shotShape === 'hook' ? '你偏左曲时，建议调平杆面角和 lie 角。' : ''}`,
      flex,
      swingSpeed,
      handicap,
      headStyle,
    };
  }
  if (answers.i3 === 'thin' || answers.i3 === 'fat' || handicap > 20) {
    return {
      model: '宽容型铁杆',
      head: `Callaway Apex（${headStyle}）`,
      shaft: `KBS Tour ${flex}`,
      length: lengthNote === '标准' ? '标准' : `标准 → ${lengthNote}`,
      swingWeight: 'D2',
      grip,
      lengthNote,
      shaftWeight,
      budgetNote,
      reason: `差点${handicap}，击球稳定性需提升，Apex 对打点偏差更友好。KBS Tour ${flex} 帮助建立稳定触球节奏。杆长建议${lengthNote}，握把推荐${grip}。`,
      flex,
      swingSpeed,
      handicap,
      headStyle,
    };
  }
  return {
    model: '均衡型铁杆',
    head: `TaylorMade P790（${headStyle}）`,
    shaft: `KBS Tour ${flex}`,
    length: lengthNote === '标准' ? '标准' : `标准 → ${lengthNote}`,
    swingWeight: 'D2',
    grip,
    lengthNote,
    shaftWeight,
    budgetNote,
    reason: `P790 在距离、容错和手感之间均衡，适合差点${handicap}的球友。挥速${swingSpeed}mph 推荐 ${flex} 硬度，杆长建议${lengthNote}，握把推荐${grip}。`,
    flex,
    swingSpeed,
    handicap,
    headStyle,
  };
}

function recommendFairway(answers: Record<string, string>, profile: StoredUserProfile | null): RecommendationSpec {
  const { swingSpeed, handicap, heightCm, wristToFloor, handCm, ballFlight, shotShape, tempo } = parseProfileNumbers(profile);
  const flex = flexBySwingSpeed(swingSpeed);
  const headStyle = headStyleByHandicap(handicap);
  const grip = gripSizeByHand(handCm);
  const lengthNote = lengthAdjust(wristToFloor, heightCm);
  const shaftWeight = shaftWeightHint(tempo);

  if (ballFlight === 'low' || answers.f4 === 'launch') {
    return {
      model: '易起飞球道木',
      head: 'Ping G430 SFT 3W',
      shaft: `Ventus Blue 7${flex}`,
      length: lengthNote === '标准' ? '43.0"' : `43.0" → ${lengthNote}`,
      swingWeight: 'D1',
      grip,
      lengthNote,
      shaftWeight,
      budgetNote: '',
      reason: `弹道偏低，SFT 设计配合 Ventus Blue 帮助提升起飞角和落点。挥速${swingSpeed}mph 推荐 ${flex} 硬度。`,
      flex,
      swingSpeed,
      handicap,
      headStyle,
    };
  }

  if (shotShape === 'slice' || answers.f3 === 'right') {
    return {
      model: '防右曲球道木',
      head: 'TaylorMade Qi10 SIM2 Max D 3W',
      shaft: `Kai'li White 70${flex}`,
      length: lengthNote === '标准' ? '43.0"' : `43.0" → ${lengthNote}`,
      swingWeight: 'D2',
      grip,
      lengthNote,
      shaftWeight,
      budgetNote: '',
      reason: '存在右曲倾向，偏Draw面设计的球道木可帮助纠正弹道。Kai\'li White 节奏感好，适合容错优先的打法。',
      flex,
      swingSpeed,
      handicap,
      headStyle,
    };
  }

  return {
    model: '均衡球道木',
    head: 'Callaway Paradym Ai Smoke 3W',
    shaft: `Ventus TR Blue 7${flex}`,
    length: lengthNote === '标准' ? '43.0"' : `43.0" → ${lengthNote}`,
    swingWeight: 'D2',
    grip,
    lengthNote,
    shaftWeight,
    budgetNote: '',
    reason: `挥速${swingSpeed}mph 推荐 ${flex} 硬度，差点${handicap} 推荐${headStyle}。该组合距离与稳定性均衡，从球道和发球台均可使用。`,
    flex,
    swingSpeed,
    handicap,
    headStyle,
  };
}

function recommendWedge(answers: Record<string, string>, profile: StoredUserProfile | null): RecommendationSpec {
  const { swingSpeed, handicap, handCm, yearsPlaying } = parseProfileNumbers(profile);
  const flex: 'R' | 'S' | 'X' = swingSpeed >= 100 ? 'S' : 'R';
  const headStyle = headStyleByHandicap(handicap);
  const grip = gripSizeByHand(handCm);

  if (answers.w3 === '52' || answers.w1 === '100') {
    return {
      model: 'Gap Wedge 配置',
      head: 'Titleist Vokey SM10 52°',
      shaft: 'DG S200',
      length: '35.5"',
      swingWeight: 'D4',
      grip,
      lengthNote: '标准',
      shaftWeight: '重型杆身',
      budgetNote: '',
      reason: `以100码内为主，52° Gap Wedge 搭配 DG S200 可提供稳定旋转和距离控制。差点${handicap}建议先打好距离感，再升级更高旋转楔形杆。${yearsPlaying > 0 ? `你有${yearsPlaying}年经验，可更快建立手感。` : ''}`,
      flex,
      swingSpeed,
      handicap,
      headStyle,
    };
  }

  if (answers.w3 === '60' || answers.w2 === 'need') {
    return {
      model: '短打精准配置',
      head: 'Cleveland RTX 6 ZipCore 56°+60°',
      shaft: 'DG Spinner',
      length: '35.25"',
      swingWeight: 'D4',
      grip,
      lengthNote: '标准',
      shaftWeight: '重型杆身',
      budgetNote: '',
      reason: '短打需要改善，Cleveland RTX 6 的 ZipCore 设计在各开放角度都有稳定旋转表现。建议56°+60°组合覆盖沙坑和果岭周围。',
      flex,
      swingSpeed,
      handicap,
      headStyle,
    };
  }

  return {
    model: '标准挖起杆组合',
    head: 'Titleist Vokey SM10 52°/56°',
    shaft: 'DG S200',
    length: '35.5"',
    swingWeight: 'D4',
    grip,
    lengthNote: '标准',
    shaftWeight: '重型杆身',
    budgetNote: '',
    reason: `Vokey SM10 是业余球友通用选择，52°/56°组合覆盖大多数场景。DG S200 提供稳定反馈，差点${handicap}下帮助建立一致旋转和落点。`,
    flex,
    swingSpeed,
    handicap,
    headStyle,
  };
}

function recommendPutter(answers: Record<string, string>, profile: StoredUserProfile | null): RecommendationSpec {
  const { heightCm, handCm, handicap, yearsPlaying } = parseProfileNumbers(profile);
  const headStyle = headStyleByHandicap(handicap);
  const grip = gripSizeByHand(handCm);

  let putterLength = '34"';
  if (heightCm >= 190) putterLength = '35"';
  else if (heightCm >= 183) putterLength = '34.5"';
  else if (heightCm < 170) putterLength = '33"';

  if (answers.p1 === 'straight' || answers.p1 === 'unknown') {
    return {
      model: '直线型推杆',
      head: 'Odyssey White Hot OG #1',
      shaft: '标准钢杆身',
      length: putterLength,
      swingWeight: 'E0',
      grip: `${grip}（推荐SuperStroke握把）`,
      lengthNote: putterLength,
      shaftWeight: '标准',
      budgetNote: '',
      reason: `直线推击弧适合 Face-balanced 设计，Odyssey #1 配合 White Hot 软感杆面，帮助稳定推击节奏。身高${heightCm}cm 推荐杆长${putterLength}。`,
      flex: 'R',
      swingSpeed: 0,
      handicap,
      headStyle,
    };
  }

  if (answers.p1 === 'arc-big' || answers.p3 === 'blade') {
    return {
      model: '弧线型刀背推杆',
      head: 'Titleist Scotty Cameron Special Select Newport 2',
      shaft: '标准钢杆身',
      length: putterLength,
      swingWeight: 'D9',
      grip: `${grip}（推荐标准圆形握把）`,
      lengthNote: putterLength,
      shaftWeight: '标准',
      budgetNote: '',
      reason: `明显弧线推击适合 Toe-hang 刀背推杆。Newport 2 经典杆颈设计配合自然弧线运动，手感反馈直接。身高${heightCm}cm 推荐杆长${putterLength}。`,
      flex: 'R',
      swingSpeed: 0,
      handicap,
      headStyle,
    };
  }

  return {
    model: '均衡槌头推杆',
    head: yearsPlaying >= 8 ? 'Scotty Cameron Phantom X5' : 'Ping Anser 2D',
    shaft: '标准钢杆身',
    length: putterLength,
    swingWeight: 'E0',
    grip: `${grip}（推荐中粗握把）`,
    lengthNote: putterLength,
    shaftWeight: '标准',
    budgetNote: '',
    reason: `槌头设计容错更高，适合差点${handicap}的球友建立稳定推击。身高${heightCm}cm 推荐杆长${putterLength}，握把建议${grip}。`,
    flex: 'R',
    swingSpeed: 0,
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
    if (category === 'fairway') return recommendFairway(answers, profile);
    if (category === 'wedge') return recommendWedge(answers, profile);
    if (category === 'putter') return recommendPutter(answers, profile);
    return null;
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
        <View style={styles.row}>
          <Text style={styles.label}>推荐握把尺寸</Text>
          <Text style={styles.value}>{result.grip}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>建议杆长修正</Text>
          <Text style={styles.value}>{result.lengthNote}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>杆身重量建议</Text>
          <Text style={styles.value}>{result.shaftWeight}</Text>
        </View>
        {result.budgetNote ? (
          <View style={styles.row}>
            <Text style={styles.label}>预算备注</Text>
            <Text style={styles.value}>{result.budgetNote}</Text>
          </View>
        ) : null}
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
