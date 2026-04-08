import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { USER_PROFILE_KEY, type StoredUserProfile } from '@/lib/app-storage';
import { readJson, writeJson } from '@/lib/local-storage';
import { COMPARE_PRODUCTS_KEY } from '@/lib/product-db';

const GREEN = '#166534';
const GREEN_LIGHT = '#dcfce7';
const BG = '#f3f4f6';
const WHITE = '#ffffff';
const BORDER = '#e5e7eb';
const TEXT_PRIMARY = '#111827';
const TEXT_SECONDARY = '#6b7280';
const TEXT_TERTIARY = '#9ca3af';
const MASK = 'rgba(0,0,0,0.3)';

export const PRODUCTS = [
  { id: 'ping-g430-max', category: 'driver-head', brand: 'Ping', model: 'G430 Max', type: '宽容', loft: '10.5°', volume: '460cc', cg: '深重心', handicap: '12+', price: '¥3200' },
  { id: 'tm-qi10', category: 'driver-head', brand: 'TaylorMade', model: 'Qi10', type: '距离', loft: '9°', volume: '460cc', cg: '中重心', handicap: '8-18', price: '¥3800' },
  { id: 'titleist-tsr3', category: 'driver-head', brand: 'Titleist', model: 'TSR3', type: '操控', loft: '10°', volume: '450cc', cg: '浅重心', handicap: '0-10', price: '¥4200' },
  { id: 'callaway-paradym', category: 'driver-head', brand: 'Callaway', model: 'Paradym', type: '宽容', loft: '10.5°', volume: '460cc', cg: '深重心', handicap: '10+', price: '¥3500' },
  { id: 'cobra-aerojet-ls', category: 'driver-head', brand: 'Cobra', model: 'Aerojet LS', type: '低旋', loft: '9°', volume: '460cc', cg: '前重心', handicap: '5以下', price: '¥2800' },
  { id: 'srixon-zx5', category: 'driver-head', brand: 'Srixon', model: 'ZX5 MkII', type: '均衡', loft: '10.5°', volume: '460cc', cg: '中重心', handicap: '8-15', price: '¥2600' },

  { id: 'ventus-blue-6s', category: 'shaft-driver', brand: 'Fujikura', model: 'Ventus Blue 6S', type: '低旋稳定', weight: '63g', trajectory: '中低', kickPoint: '高', flex: 'S', speed: '90+mph' },
  { id: 'ventus-red-6s', category: 'shaft-driver', brand: 'Fujikura', model: 'Ventus Red 6S', type: '高弹道', weight: '60g', trajectory: '中高', kickPoint: '低', flex: 'S', speed: '85-100mph' },
  { id: 'kaili-white-60s', category: 'shaft-driver', brand: 'Mitsubishi', model: "Kai'li White 60S", type: '弹射距离', weight: '60g', trajectory: '中高', kickPoint: '低', flex: 'S', speed: '80-95mph' },
  { id: 'tour-ad-iz-6s', category: 'shaft-driver', brand: 'Mitsubishi', model: 'Tour AD IZ 6S', type: '极低旋', weight: '65g', trajectory: '低', kickPoint: '高', flex: 'S', speed: '95+mph' },
  { id: 'tensei-av-blue', category: 'shaft-driver', brand: 'Mitsubishi', model: 'Tensei AV Blue 65S', type: '全能均衡', weight: '65g', trajectory: '中', kickPoint: '中', flex: 'S', speed: '85-100mph' },
  { id: 'aldila-ascent', category: 'shaft-driver', brand: 'Aldila', model: 'Ascent Blue 60S', type: '性价比', weight: '62g', trajectory: '中', kickPoint: '中', flex: 'S', speed: '80-95mph' },

  { id: 'ping-i230', category: 'iron', brand: 'Ping', model: 'i230', type: '操控', topline: '薄', cg: '低重心', handicap: '0-10', price: '¥8500(5-PW)' },
  { id: 'callaway-apex', category: 'iron', brand: 'Callaway', model: 'Apex', type: '宽容', topline: '中厚', cg: '低深重心', handicap: '5-15', price: '¥7800' },
  { id: 'tm-p790', category: 'iron', brand: 'TaylorMade', model: 'P790', type: '均衡', topline: '中厚', cg: '中空锻造', handicap: '5-15', price: '¥9200' },
  { id: 'titleist-t200', category: 'iron', brand: 'Titleist', model: 'T200', type: '均衡', topline: '中等', cg: '速度口袋', handicap: '5-12', price: '¥8800' },
  { id: 'mizuno-jpx923', category: 'iron', brand: 'Mizuno', model: 'JPX923 Hot Metal', type: '宽容距离', topline: '厚', cg: '低重心', handicap: '15+', price: '¥6500' },

  { id: 'dg-x100', category: 'shaft-iron', brand: 'True Temper', model: 'DG X100', type: '极硬低旋', weight: '130g', trajectory: '低', flex: 'X', speed: '100+mph' },
  { id: 'kbs-tour-s', category: 'shaft-iron', brand: 'KBS', model: 'Tour S', type: '稳定均衡', weight: '120g', trajectory: '中', flex: 'S', speed: '90-105mph' },
  { id: 'ns-pro-950', category: 'shaft-iron', brand: 'Nippon', model: 'NS Pro 950 GH', type: '轻量弹柔', weight: '95g', trajectory: '中高', flex: 'S', speed: '75-95mph' },
  { id: 'dg-s200', category: 'shaft-iron', brand: 'True Temper', model: 'DG S200', type: '经典稳定', weight: '125g', trajectory: '中低', flex: 'S', speed: '90-100mph' },

  { id: 'gp-tour-velvet', category: 'grip', brand: 'Golf Pride', model: 'Tour Velvet', type: '全天候经典', size: 'Standard/Midsize', weight: '50g', price: '¥45/个' },
  { id: 'lamkin-crossline', category: 'grip', brand: 'Lamkin', model: 'Crossline', type: '防滑耐用', size: 'Standard/Midsize', weight: '52g', price: '¥55/个' },
  { id: 'superstroke-traxion', category: 'grip', brand: 'SuperStroke', model: 'Traxion Pistol', type: '推杆专用', size: 'Midsize', weight: '75g', price: '¥180/个' },
  { id: 'gp-mcc-plus4', category: 'grip', brand: 'Golf Pride', model: 'MCC Plus4', type: '中下手减压', size: 'Standard/Midsize', weight: '52g', price: '¥65/个' },
] as const;

type Product = (typeof PRODUCTS)[number];

const CATEGORY_TABS = [
  { key: 'driver-head', label: '一号木' },
  { key: 'fairway-head', label: '球道木' },
  { key: 'iron', label: '铁杆' },
  { key: 'wedge', label: '挖起杆' },
  { key: 'putter', label: '推杆' },
  { key: 'shaft-driver', label: '杆身' },
  { key: 'grip', label: '握把' },
] as const;

function brandStyle(brand: string) {
  if (brand === 'Ping') return { bg: '#0066CC', text: 'P' };
  if (brand === 'TaylorMade') return { bg: '#CC0000', text: 'TM' };
  if (brand === 'Titleist') return { bg: '#333333', text: 'T' };
  if (brand === 'Callaway') return { bg: '#FF6600', text: 'C' };
  if (brand === 'Fujikura') return { bg: '#6600CC', text: 'F' };
  if (brand === 'Mitsubishi') return { bg: '#CC0000', text: 'M' };
  if (brand === 'Cobra') return { bg: '#FFAA00', text: 'C' };
  if (brand === 'Mizuno') return { bg: '#0044AA', text: 'M' };
  return { bg: '#6b7280', text: brand.slice(0, 1).toUpperCase() };
}

function toParams(product: Product): Record<string, string> {
  const out: Record<string, string> = {};
  Object.entries(product).forEach(([k, v]) => {
    if (['id', 'category', 'brand', 'model', 'type'].includes(k)) return;
    out[k] = String(v);
  });
  return out;
}

function localMatchScore(product: Product, profile: StoredUserProfile | null) {
  let score = 55;
  const reasons: string[] = [];
  const speed = Number(profile?.swingSpeedMph) || 90;
  const handicap = Number(profile?.handicap) || 15;
  const height = Number(profile?.heightCm) || 170;

  if ('speed' in product && product.speed) {
    const hit = String(product.speed).includes('+') ? speed >= Number(String(product.speed).replace('+mph', '')) : true;
    if (hit) {
      score += 20;
      reasons.push(`你的挥速${speed}mph与推荐挥速区间接近 ✓`);
    } else {
      score -= 10;
      reasons.push(`你的挥速${speed}mph与该产品推荐区间有差距`);
    }
  }

  if ('handicap' in product && product.handicap) {
    const h = String(product.handicap);
    if ((h.includes('+') && handicap >= Number(h.replace('+', ''))) || (h.includes('-') && handicap >= Number(h.split('-')[0]) && handicap <= Number(h.split('-')[1]))) {
      score += 18;
      reasons.push(`你的差点${handicap}与产品定位（${h}）匹配 ✓`);
    } else {
      reasons.push(`你的差点${handicap}与产品定位（${h}）略有偏差`);
      score -= 8;
    }
  }

  if (height < 165 || height > 182) {
    reasons.push(`你的身高${height}cm建议试打时确认杆长微调。`);
    score += 4;
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(score)));
  const summary = finalScore >= 75 ? '适合' : finalScore >= 55 ? '基本适合' : '不太适合';
  return { finalScore, reasons: reasons.slice(0, 3), summary };
}

export default function ProductsScreen() {
  const router = useRouter();
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORY_TABS)[number]['key']>('driver-head');
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [match, setMatch] = useState<{ product: Product; score: number; reasons: string[]; summary: string } | null>(null);

  useFocusEffect(
    useCallback(() => {
      const selected = readJson<any[]>(COMPARE_PRODUCTS_KEY, []);
      setCompareIds(selected.map((x) => x.id));
      return () => {};
    }, []),
  );

  const products = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return PRODUCTS.filter((p) => {
      if (p.category !== category) return false;
      if (!q) return true;
      return `${p.brand} ${p.model} ${p.type} ${Object.values(p).join(' ')}`.toLowerCase().includes(q);
    });
  }, [category, keyword]);

  function saveCompare(nextIds: string[]) {
    const picked = PRODUCTS.filter((x) => nextIds.includes(x.id)).map((x) => ({
      id: x.id,
      category: x.category,
      brand: x.brand,
      model: x.model,
      crowdTag: x.type,
      params: toParams(x),
    }));
    writeJson(COMPARE_PRODUCTS_KEY, picked);
    setCompareIds(nextIds);
  }

  function onCompare(product: Product) {
    const exists = compareIds.includes(product.id);
    if (exists) {
      saveCompare(compareIds.filter((x) => x !== product.id));
      return;
    }
    if (compareIds.length >= 3) return;
    saveCompare([...compareIds, product.id]);
  }

  function onMatch(product: Product) {
    const profile = readJson<StoredUserProfile | null>(USER_PROFILE_KEY, null);
    const result = localMatchScore(product, profile);
    setMatch({ product, score: result.finalScore, reasons: result.reasons, summary: result.summary });
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>装备库</Text>
        <TextInput value={keyword} onChangeText={setKeyword} style={s.search} placeholder="搜索品牌、型号或参数" placeholderTextColor={TEXT_TERTIARY} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} showsVerticalScrollIndicator={false} bounces={false} style={s.tabs}>
          {CATEGORY_TABS.map((tab) => {
            const active = tab.key === category;
            return (
              <TouchableOpacity key={tab.key} style={[s.tab, active && s.tabOn]} onPress={() => setCategory(tab.key)}>
                <Text style={[s.tabText, active && s.tabTextOn]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView style={s.list} contentContainerStyle={s.listContent} showsVerticalScrollIndicator={false} bounces={false}>
        {products.map((product) => {
          const b = brandStyle(product.brand);
          const inCompare = compareIds.includes(product.id);
          const params = toParams(product);
          const paramRows = Object.entries(params).slice(0, 3);
          return (
            <View key={product.id} style={s.card}>
              <View style={s.left}>
                <View style={[s.logo, { backgroundColor: b.bg }]}>
                  <Text style={s.logoText}>{b.text}</Text>
                </View>
              </View>
              <View style={s.right}>
                <Text style={s.model}>{product.brand} {product.model}</Text>
                <View style={s.tag}><Text style={s.tagText}>{product.type}</Text></View>
                {paramRows.map(([k, v]) => (
                  <View key={k} style={s.paramRow}>
                    <Text style={s.paramKey}>{k}</Text>
                    <Text style={s.paramVal}>{String(v)}</Text>
                  </View>
                ))}
                <View style={s.btnRow}>
                  <TouchableOpacity style={s.btn} onPress={() => router.push(`/product/${product.id}` as any)}>
                    <Text style={s.btnText}>查看详情</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.btn} onPress={() => onMatch(product)}>
                    <Text style={s.btnText}>匹配测试</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.btnMain, inCompare && s.btnMainOn]} onPress={() => onCompare(product)}>
                    <Text style={[s.btnMainText, inCompare && s.btnMainTextOn]}>{inCompare ? '已对比' : '+ 对比'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {compareIds.length > 0 ? (
        <View style={s.compareBar}>
          <Text style={s.compareText}>已选 {compareIds.length} 个产品</Text>
          <TouchableOpacity style={s.compareBtn} onPress={() => router.push('/(tabs)/compare')}>
            <Text style={s.compareBtnText}>查看对比</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {match ? (
        <View style={s.modalMask}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>匹配测试</Text>
            <Text style={s.modalSub}>{match.product.brand} {match.product.model}</Text>
            <Text style={s.modalScore}>匹配度评分：{match.score}</Text>
            {match.reasons.map((r) => <Text key={r} style={s.modalReason}>- {r}</Text>)}
            <Text style={s.modalSummary}>结论：{match.summary}</Text>
            <TouchableOpacity style={s.modalClose} onPress={() => setMatch(null)}>
              <Text style={s.modalCloseText}>关闭</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG, paddingTop: Platform.OS === 'web' ? 44 : 16 },
  header: { paddingHorizontal: 16, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: '800', color: TEXT_PRIMARY, marginBottom: 8 },
  search: { backgroundColor: WHITE, borderRadius: 12, borderWidth: 0.5, borderColor: BORDER, paddingHorizontal: 12, paddingVertical: 10, color: TEXT_PRIMARY, fontSize: 13 },
  tabs: { marginTop: 10 },
  tab: { borderWidth: 0.5, borderColor: BORDER, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: WHITE, marginRight: 8 },
  tabOn: { borderColor: GREEN, backgroundColor: GREEN_LIGHT },
  tabText: { fontSize: 12, color: TEXT_SECONDARY },
  tabTextOn: { color: GREEN, fontWeight: '700' },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 96 },
  card: { backgroundColor: WHITE, borderWidth: 0.5, borderColor: BORDER, borderRadius: 14, padding: 12, marginBottom: 8, flexDirection: 'row', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  left: { width: 82, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  logo: { width: 72, height: 72, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: WHITE, fontSize: 20, fontWeight: '800' },
  right: { flex: 1 },
  model: { fontSize: 16, fontWeight: '800', color: TEXT_PRIMARY, marginBottom: 6 },
  tag: { alignSelf: 'flex-start', backgroundColor: GREEN_LIGHT, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 6 },
  tagText: { color: GREEN, fontSize: 11, fontWeight: '700' },
  paramRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  paramKey: { fontSize: 12, color: TEXT_TERTIARY },
  paramVal: { fontSize: 12, color: TEXT_PRIMARY, fontWeight: '600' },
  btnRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  btn: { flex: 1, borderRadius: 9, borderWidth: 1, borderColor: BORDER, alignItems: 'center', paddingVertical: 8 },
  btnText: { fontSize: 11, color: TEXT_SECONDARY, fontWeight: '700' },
  btnMain: { flex: 1, borderRadius: 9, borderWidth: 1, borderColor: GREEN, alignItems: 'center', paddingVertical: 8 },
  btnMainOn: { backgroundColor: GREEN },
  btnMainText: { fontSize: 11, color: GREEN, fontWeight: '800' },
  btnMainTextOn: { color: WHITE },
  compareBar: { position: 'absolute', left: 12, right: 12, bottom: 12, backgroundColor: WHITE, borderRadius: 12, borderWidth: 0.5, borderColor: BORDER, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  compareText: { color: TEXT_PRIMARY, fontSize: 12, fontWeight: '600' },
  compareBtn: { backgroundColor: GREEN, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  compareBtnText: { color: WHITE, fontSize: 12, fontWeight: '700' },
  modalMask: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: MASK, justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: WHITE, borderRadius: 14, borderWidth: 0.5, borderColor: BORDER, padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: TEXT_PRIMARY, marginBottom: 4 },
  modalSub: { fontSize: 12, color: TEXT_SECONDARY, marginBottom: 8 },
  modalScore: { color: GREEN, fontSize: 16, fontWeight: '800', marginBottom: 8 },
  modalReason: { fontSize: 12, color: TEXT_SECONDARY, lineHeight: 18, marginBottom: 3 },
  modalSummary: { marginTop: 6, fontSize: 13, color: TEXT_PRIMARY, fontWeight: '700' },
  modalClose: { marginTop: 12, backgroundColor: GREEN, borderRadius: 10, alignItems: 'center', paddingVertical: 10 },
  modalCloseText: { color: WHITE, fontSize: 13, fontWeight: '700' },
});
