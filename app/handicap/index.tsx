import { useFocusEffect } from '@react-navigation/native';
import { type Href, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ScoreHandicapTabContent } from '@/components/ScoreHandicapTabContent';
import { TAB_BAR_SCROLL_EXTRA } from '@/constants/theme';
import { loadHandicapRecords, normalizeHandicapRecords, type HandicapRecord } from '@/lib/handicap';

const PAGE_BG = '#0d1b11';
const WHITE = '#ffffff';
const SUBTITLE = '#8a9a8e';
const BTN_BG = '#1e3a26';
const BTN_BORDER = '#2d5436';
const ACCENT = '#b5ff3a';

export default function HandicapIndexScreen() {
  const router = useRouter();
  const [records, setRecords] = useState<HandicapRecord[]>([]);

  const reload = useCallback(() => {
    setRecords(normalizeHandicapRecords(loadHandicapRecords()));
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
      return () => {};
    }, [reload]),
  );

  return (
    <View style={styles.root}>
      <View style={styles.titleBar}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>差点</Text>
          <Text style={styles.subtitle}>WHS 记录与趋势</Text>
        </View>
        <Pressable
          style={styles.addBtn}
          onPress={() => router.push('/handicap/add' as Href)}
          accessibilityRole="button"
          accessibilityLabel="添加成绩"
        >
          <Text style={styles.addBtnTxt}>+ 添加</Text>
        </Pressable>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <ScoreHandicapTabContent records={records} onRecordsUpdated={reload} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PAGE_BG },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 24 + TAB_BAR_SCROLL_EXTRA,
  },
  titleBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 12,
    backgroundColor: PAGE_BG,
  },
  titleBlock: { flex: 1, minWidth: 0 },
  title: { fontSize: 22, fontWeight: '800', color: WHITE, marginBottom: 4, letterSpacing: -0.5 },
  subtitle: { fontSize: 12, fontWeight: '500', color: SUBTITLE, lineHeight: 17 },
  addBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: BTN_BG,
    borderWidth: 1,
    borderColor: BTN_BORDER,
  },
  addBtnTxt: { fontSize: 14, fontWeight: '700', color: ACCENT },
});
