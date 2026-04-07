import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FAVORITES_KEY, type FavoriteRecommendation } from '@/lib/app-storage';
import { readJson, writeJson } from '@/lib/local-storage';

const WHITE = '#ffffff';
const BG = '#f3f4f6';
const BORDER = '#e5e7eb';
const GREEN = '#166534';
const TEXT_PRIMARY = '#111827';
const TEXT_SECONDARY = '#6b7280';

export default function FavoritesScreen() {
  const router = useRouter();
  const [items, setItems] = useState<FavoriteRecommendation[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const list = readJson<FavoriteRecommendation[]>(FAVORITES_KEY, []);
      if (active) setItems(list);
      return () => {
        active = false;
      };
    }, []),
  );

  function removeItem(id: string) {
    const next = items.filter((x) => x.id !== id);
    setItems(next);
    writeJson(FAVORITES_KEY, next);
  }

  function iconByType(type: string) {
    if (type === 'driver') return '🏌';
    if (type === 'iron') return '⛳';
    if (type === 'fairway') return '🌿';
    if (type === 'wedge') return '△';
    if (type === 'putter') return '⌇';
    return '◈';
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>我的收藏</Text>
      {items.length === 0 ? (
        <View>
          <Text style={styles.empty}>还没有收藏，去做问卷吧</Text>
          <Pressable style={styles.goBtn} onPress={() => router.push('/')}>
            <Text style={styles.goBtnTxt}>去首页</Text>
          </Pressable>
        </View>
      ) : (
        items.map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={styles.rowTop}>
              <Text style={styles.type}>{iconByType(item.type)} {item.type}</Text>
              <Pressable onPress={() => removeItem(item.id)}>
                <Text style={styles.delete}>删除</Text>
              </Pressable>
            </View>
            <Text style={styles.model}>{item.model}</Text>
            <Text style={styles.date}>{new Date(item.savedAt).toLocaleString()}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  content: { padding: 16, paddingBottom: 24 },
  title: { fontSize: 22, fontWeight: '700', color: TEXT_PRIMARY, marginBottom: 12 },
  empty: { fontSize: 14, color: TEXT_SECONDARY, marginTop: 8 },
  goBtn: { marginTop: 12, backgroundColor: GREEN, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, alignSelf: 'flex-start' },
  goBtnTxt: { color: WHITE, fontWeight: '700' },
  card: { backgroundColor: WHITE, borderWidth: 0.5, borderColor: BORDER, borderRadius: 14, padding: 14, marginBottom: 10 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  type: { fontSize: 12, color: GREEN, marginBottom: 4, fontWeight: '600' },
  delete: { fontSize: 12, color: TEXT_SECONDARY },
  model: { fontSize: 14, color: TEXT_PRIMARY, fontWeight: '600', marginBottom: 4 },
  date: { fontSize: 12, color: TEXT_SECONDARY },
});
