import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { USER_PROFILE_KEY, type StoredUserProfile } from '@/lib/app-storage';
import { readJson, writeJson } from '@/lib/local-storage';
import { COMPARE_PRODUCTS_KEY } from '@/lib/product-db';

import { PRODUCTS } from '@/app/(tabs)/products';

const GREEN = '#166534';
const GREEN_LIGHT = '#dcfce7';
const BG = '#f3f4f6';
const WHITE = '#ffffff';
const BORDER = '#e5e7eb';
const TEXT_PRIMARY = '#111827';
const TEXT_SECONDARY = '#6b7280';
const MASK = 'rgba(0,0,0,0.35)';

type Product = (typeof PRODUCTS)[number];

function toParams(product: Product): Record<string, string> {
  const out: Record<string, string> = {};
  Object.entries(product).forEach(([k, v]) => {
    if (['id', 'category', 'brand', 'model', 'type'].includes(k)) return;
    out[k] = String(v);
  });
  return out;
}

function localScore(product: Product, profile: StoredUserProfile | null) {
  let score = 55;
  const reasons: string[] = [];
  const speed = Number(profile?.swingSpeedMph) || 90;
  const handicap = Number(profile?.handicap) || 15;
  const height = Number(profile?.heightCm) || 170;

  if ('speed' in product && product.speed) {
    const speedText = String(product.speed);
    const ok = speedText.includes('+') ? speed >= Number(speedText.replace('+mph', '')) : true;
    if (ok) {
      score += 20;
      reasons.push(`你的挥速${speed}mph与该产品定位相符 ✓`);
    } else {
      score -= 8;
      reasons.push(`你的挥速${speed}mph与推荐区间存在差距`);
    }
  }

  if ('handicap' in product && product.handicap) {
    const h = String(product.handicap);
    if (h.includes('+')) {
      const min = Number(h.replace('+', '').replace('以下', ''));
      if (!Number.isNaN(min) && handicap >= min) {
        score += 18;
        reasons.push(`你的差点${handicap}与该定位（${h}）匹配 ✓`);
      } else {
        score -= 8;
        reasons.push(`你的差点${handicap}与定位（${h}）偏差较大`);
      }
    } else if (h.includes('-')) {
      const [a, b] = h.split('-').map(Number);
      if (!Number.isNaN(a) && !Number.isNaN(b) && handicap >= a && handicap <= b) {
        score += 18;
        reasons.push(`你的差点${handicap}处于推荐区间（${h}）✓`);
      } else {
        score -= 8;
        reasons.push(`你的差点${handicap}不在推荐区间（${h}）`);
      }
    }
  }

  if (height < 165 || height > 182) reasons.push(`你的身高${height}cm建议试打时关注杆长微调。`);
  const finalScore = Math.max(0, Math.min(100, Math.round(score)));
  const summary = finalScore >= 75 ? '适合' : finalScore >= 55 ? '基本适合' : '不太适合';
  return { finalScore, summary, reasons: reasons.slice(0, 3), speed, handicap, height };
}

export default function ProductDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const product = useMemo(() => PRODUCTS.find((x) => x.id === String(id)), [id]);
  const [aiIntro, setAiIntro] = useState('正在获取产品信息...');
  const [introLoading, setIntroLoading] = useState(true);
  const [tip, setTip] = useState('');
  const [matchModal, setMatchModal] = useState<{ score: number; summary: string; ai: string } | null>(null);
  const [matching, setMatching] = useState(false);

  useEffect(() => {
    let active = true;
    async function runIntro() {
      if (!product) return;
      const key = typeof window !== 'undefined' ? (window.localStorage.getItem('anthropic_key') || '').trim() : '';
      if (!key) {
        if (active) {
          setAiIntro('填写 API Key 后可获取 AI 详细介绍（设置页填写）');
          setIntroLoading(false);
        }
        return;
      }
      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 300,
            messages: [
              {
                role: 'user',
                content: `请用中文介绍高尔夫装备：${product.brand} ${product.model}。包含：1.核心技术特点 2.适合什么球手 3.与同类产品的主要区别 4.用户口碑。控制在200字以内，语言专业但易懂。`,
              },
            ],
          }),
        });
        if (!res.ok) throw new Error('api fail');
        const json = await res.json();
        const text = Array.isArray(json?.content) ? json.content.map((c: any) => c?.text || '').join('') : '';
        if (active) setAiIntro(text || 'AI暂未返回内容，请稍后重试。');
      } catch {
        if (active) setAiIntro('AI介绍获取失败，请稍后重试。');
      } finally {
        if (active) setIntroLoading(false);
      }
    }
    runIntro();
    return () => {
      active = false;
    };
  }, [product]);

  function addCompare() {
    if (!product) return;
    const list = readJson<any[]>(COMPARE_PRODUCTS_KEY, []);
    if (list.some((x) => x.id === product.id)) {
      setTip('该产品已在对比栏中。');
      return;
    }
    if (list.length >= 3) {
      setTip('最多加入3个产品，请先移除一个。');
      return;
    }
    const next = [...list, { id: product.id, category: product.category, brand: product.brand, model: product.model, crowdTag: product.type, params: toParams(product) }];
    writeJson(COMPARE_PRODUCTS_KEY, next);
    setTip('已加入对比。');
  }

  async function runMatch() {
    if (!product || matching) return;
    setMatching(true);
    try {
      const profile = readJson<StoredUserProfile | null>(USER_PROFILE_KEY, null);
      const local = localScore(product, profile);
      const key = typeof window !== 'undefined' ? (window.localStorage.getItem('anthropic_key') || '').trim() : '';
      if (!key) {
        setMatchModal({
          score: local.finalScore,
          summary: local.summary,
          ai: '未配置 API Key，当前仅展示本地匹配结果。',
        });
        return;
      }

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 260,
          messages: [
            {
              role: 'user',
              content: `用户档案：挥速${local.speed}mph，差点${local.handicap}，身高${local.height}cm。产品：${product.brand} ${product.model}，参数：${JSON.stringify(toParams(product))}。请分析：1.这款产品是否适合该用户 2.具体适合/不适合的原因 3.综合推荐意见。用中文回答，100字以内，给出明确结论。`,
            },
          ],
        }),
      });

      let aiText = '';
      if (res.ok) {
        const json = await res.json();
        aiText = Array.isArray(json?.content) ? json.content.map((c: any) => c?.text || '').join('') : '';
      }
      setMatchModal({
        score: local.finalScore,
        summary: local.summary,
        ai: aiText || local.reasons.join('；'),
      });
    } finally {
      setMatching(false);
    }
  }

  if (!product) {
    return (
      <View style={s.center}>
        <Text style={s.title}>未找到产品</Text>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backBtnText}>返回</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false} bounces={false}>
        <TouchableOpacity style={s.backLink} onPress={() => router.back()}>
          <Text style={s.backText}>← 返回</Text>
        </TouchableOpacity>

        <View style={s.card}>
          <Text style={s.model}>{product.brand} {product.model}</Text>
          <View style={s.typeTag}>
            <Text style={s.typeTagText}>{product.type}</Text>
          </View>
          {Object.entries(toParams(product)).map(([k, v]) => (
            <View key={k} style={s.row}>
              <Text style={s.rowKey}>{k}</Text>
              <Text style={s.rowVal}>{v}</Text>
            </View>
          ))}
        </View>

        <View style={s.card}>
          <Text style={s.sectionTitle}>AI详细介绍</Text>
          <Text style={s.aiText}>{introLoading ? '正在获取产品信息...' : aiIntro}</Text>
        </View>

        <TouchableOpacity style={s.mainBtn} onPress={runMatch} disabled={matching}>
          <Text style={s.mainBtnText}>{matching ? '分析中...' : '匹配测试'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.ghostBtn} onPress={addCompare}>
          <Text style={s.ghostBtnText}>加入对比</Text>
        </TouchableOpacity>
        {tip ? <Text style={s.tip}>{tip}</Text> : null}
      </ScrollView>

      {matchModal ? (
        <View style={s.modalMask}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>匹配测试结果</Text>
            <Text style={s.modalScore}>匹配度评分：{matchModal.score}</Text>
            <Text style={s.modalAi}>{matchModal.ai}</Text>
            <Text style={s.modalSummary}>结论：{matchModal.summary}</Text>
            <TouchableOpacity style={s.modalBtn} onPress={() => setMatchModal(null)}>
              <Text style={s.modalBtnText}>关闭</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  scroll: { flex: 1 },
  content: { padding: 16, paddingTop: Platform.OS === 'web' ? 44 : 16, paddingBottom: 28 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: BG },
  title: { fontSize: 20, fontWeight: '700', color: TEXT_PRIMARY, marginBottom: 12 },
  backBtn: { backgroundColor: GREEN, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  backBtnText: { color: WHITE, fontWeight: '700' },
  backLink: { alignSelf: 'flex-start', marginBottom: 8 },
  backText: { color: GREEN, fontWeight: '700' },
  card: { backgroundColor: WHITE, borderRadius: 14, borderWidth: 0.5, borderColor: BORDER, padding: 14, marginBottom: 10 },
  model: { fontSize: 20, color: TEXT_PRIMARY, fontWeight: '800', marginBottom: 8 },
  typeTag: { alignSelf: 'flex-start', backgroundColor: GREEN_LIGHT, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 8 },
  typeTagText: { color: GREEN, fontSize: 11, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  rowKey: { color: TEXT_SECONDARY, fontSize: 12 },
  rowVal: { color: TEXT_PRIMARY, fontSize: 12, fontWeight: '600' },
  sectionTitle: { fontSize: 14, color: TEXT_PRIMARY, fontWeight: '700', marginBottom: 6 },
  aiText: { fontSize: 12, color: TEXT_SECONDARY, lineHeight: 20 },
  mainBtn: { backgroundColor: GREEN, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginBottom: 8 },
  mainBtnText: { color: WHITE, fontWeight: '700', fontSize: 14 },
  ghostBtn: { borderWidth: 1, borderColor: GREEN, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  ghostBtnText: { color: GREEN, fontWeight: '700', fontSize: 14 },
  tip: { marginTop: 8, textAlign: 'center', color: GREEN, fontSize: 12 },
  modalMask: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: MASK, justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: WHITE, borderRadius: 14, borderWidth: 0.5, borderColor: BORDER, padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: TEXT_PRIMARY, marginBottom: 8 },
  modalScore: { color: GREEN, fontSize: 15, fontWeight: '800', marginBottom: 8 },
  modalAi: { fontSize: 12, color: TEXT_SECONDARY, lineHeight: 20 },
  modalSummary: { marginTop: 8, fontSize: 13, color: TEXT_PRIMARY, fontWeight: '700' },
  modalBtn: { marginTop: 12, backgroundColor: GREEN, borderRadius: 10, alignItems: 'center', paddingVertical: 10 },
  modalBtnText: { color: WHITE, fontSize: 13, fontWeight: '700' },
});
