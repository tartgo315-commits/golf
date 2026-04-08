import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { readJson, writeJson } from '@/lib/local-storage';
import { COMPARE_PRODUCTS_KEY, PRODUCT_CATEGORIES, PRODUCT_DB, type ProductCategory, type ProductItem } from '@/lib/product-db';

const GREEN = '#166534';
const GREEN_LIGHT = '#dcfce7';
const BG = '#f3f4f6';
const WHITE = '#ffffff';
const BORDER = '#e5e7eb';
const TEXT_PRIMARY = '#111827';
const TEXT_SECONDARY = '#6b7280';
const TEXT_TERTIARY = '#9ca3af';
const RED = '#b91c1c';

type CompareProducts = ProductItem[];

export default function ProductsScreen() {
  const router = useRouter();
  const [keyword, setKeyword] = useState('');
  const [activeCategory, setActiveCategory] = useState<ProductCategory>('一号木');
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [tips, setTips] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      const selected = readJson<CompareProducts>(COMPARE_PRODUCTS_KEY, []);
      setCompareIds(selected.map((item) => item.id));
      return () => {};
    }, []),
  );

  const filteredProducts = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return PRODUCT_DB.filter((item) => {
      if (item.category !== activeCategory) return false;
      if (!q) return true;
      const searchable = `${item.brand} ${item.model} ${item.crowdTag} ${Object.values(item.params).join(' ')}`.toLowerCase();
      return searchable.includes(q);
    });
  }, [activeCategory, keyword]);

  const compareCount = compareIds.length;

  function saveCompare(nextIds: string[]) {
    const selectedItems = PRODUCT_DB.filter((item) => nextIds.includes(item.id));
    writeJson(COMPARE_PRODUCTS_KEY, selectedItems);
    setCompareIds(nextIds);
  }

  function toggleCompare(item: ProductItem) {
    const exists = compareIds.includes(item.id);
    if (exists) {
      const nextIds = compareIds.filter((id) => id !== item.id);
      saveCompare(nextIds);
      setTips(`已移除：${item.brand} ${item.model}`);
      return;
    }
    if (compareIds.length >= 3) {
      setTips('最多选择3个产品，请先移除一个再添加。');
      return;
    }
    const nextIds = [...compareIds, item.id];
    saveCompare(nextIds);
    setTips(`已加入对比：${item.brand} ${item.model}`);
  }

  return (
    <View style={s.container}>
      <View style={s.topBar}>
        <Text style={s.title}>装备库</Text>
        <TouchableOpacity style={s.compareEntry} onPress={() => router.push('/(tabs)/compare')}>
          <Text style={s.compareEntryText}>查看对比（{compareCount}/3）</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        value={keyword}
        onChangeText={setKeyword}
        placeholder="搜索品牌、型号或参数"
        placeholderTextColor={TEXT_TERTIARY}
        style={s.searchInput}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterRow}>
        {PRODUCT_CATEGORIES.map((category) => {
          const active = category === activeCategory;
          return (
            <TouchableOpacity
              key={category}
              style={[s.chip, active && s.chipActive]}
              onPress={() => setActiveCategory(category)}>
              <Text style={[s.chipText, active && s.chipTextActive]}>{category}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {tips ? <Text style={s.tips}>{tips}</Text> : null}

      <ScrollView contentContainerStyle={s.list}>
        {filteredProducts.map((item) => {
          const inCompare = compareIds.includes(item.id);
          return (
            <View key={item.id} style={s.card}>
              <View style={s.headerRow}>
                <Text style={s.model}>{item.brand} {item.model}</Text>
                <View style={s.tag}>
                  <Text style={s.tagText}>{item.crowdTag}</Text>
                </View>
              </View>

              <View style={s.paramsWrap}>
                {Object.entries(item.params).map(([k, v]) => (
                  <View key={k} style={s.paramRow}>
                    <Text style={s.paramKey}>{k}</Text>
                    <Text style={s.paramValue}>{v}</Text>
                  </View>
                ))}
              </View>

              <View style={s.buttonRow}>
                <TouchableOpacity
                  style={[s.compareBtn, inCompare && s.compareBtnActive]}
                  onPress={() => toggleCompare(item)}>
                  <Text style={[s.compareBtnText, inCompare && s.compareBtnTextActive]}>{inCompare ? '已加入对比' : '加入对比'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.moreBtn}
                  onPress={() => setExpandedId((prev) => (prev === item.id ? null : item.id))}>
                  <Text style={s.moreBtnText}>{expandedId === item.id ? '收起' : '了解更多'}</Text>
                </TouchableOpacity>
              </View>

              {expandedId === item.id ? <Text style={s.notes}>{item.notes || '该产品适合做针对性试打，结合挥速与击球点进一步确认。'}</Text> : null}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG, padding: 16 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '700', color: TEXT_PRIMARY },
  compareEntry: {
    backgroundColor: GREEN,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  compareEntryText: { color: WHITE, fontSize: 12, fontWeight: '700' },
  searchInput: {
    backgroundColor: WHITE,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: BORDER,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: TEXT_PRIMARY,
  },
  filterRow: { marginTop: 10, marginBottom: 8 },
  chip: {
    backgroundColor: WHITE,
    borderWidth: 0.5,
    borderColor: BORDER,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: GREEN_LIGHT,
    borderColor: GREEN,
  },
  chipText: { fontSize: 12, color: TEXT_SECONDARY },
  chipTextActive: { color: GREEN, fontWeight: '600' },
  tips: { fontSize: 12, color: RED, marginBottom: 8 },
  list: { paddingBottom: 24 },
  card: {
    backgroundColor: WHITE,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: BORDER,
    padding: 14,
    marginBottom: 8,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  model: { fontSize: 14, fontWeight: '700', color: TEXT_PRIMARY, flex: 1, marginRight: 8 },
  tag: { backgroundColor: GREEN_LIGHT, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { color: GREEN, fontSize: 11, fontWeight: '600' },
  paramsWrap: { marginBottom: 10 },
  paramRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  paramKey: { fontSize: 12, color: TEXT_TERTIARY },
  paramValue: { fontSize: 12, color: TEXT_PRIMARY, fontWeight: '500' },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  compareBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: GREEN,
    paddingVertical: 9,
    alignItems: 'center',
  },
  compareBtnActive: { backgroundColor: GREEN },
  compareBtnText: { fontSize: 12, fontWeight: '700', color: GREEN },
  compareBtnTextActive: { color: WHITE },
  moreBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 9,
    alignItems: 'center',
  },
  moreBtnText: { fontSize: 12, fontWeight: '700', color: TEXT_SECONDARY },
  notes: { marginTop: 8, color: TEXT_SECONDARY, fontSize: 12, lineHeight: 18 },
});
