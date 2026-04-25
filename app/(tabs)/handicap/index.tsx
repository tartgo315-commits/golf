import { useFocusEffect } from '@react-navigation/native';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ScoreHandicapTabContent } from '@/components/ScoreHandicapTabContent';
import { TAB_BAR_SCROLL_EXTRA } from '@/constants/theme';
import { loadHandicapRecords, normalizeHandicapRecords, type HandicapRecord } from '@/lib/handicap';
import {
  pickFromParam,
  returnHrefForFrom,
  TABS_ROOT_HREF,
} from '@/utils/tabReturnFrom';

const PAGE_BG = '#0d1b11';
const WHITE = '#ffffff';
const SUBTITLE = '#8a9a8e';
const BTN_BG = '#1e3a26';
const BTN_BORDER = '#2d5436';
const ACCENT = '#b5ff3a';

export default function HandicapIndexScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: string | string[] }>();
  const returnHref = useMemo(() => returnHrefForFrom(pickFromParam(params.from)), [params.from]);

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

  const onBack = useCallback(() => {
    // 带 from 的入口（成绩/首页等）在 Tab 嵌套下常无可靠 history；优先回到来源 Tab，避免误回首页
    if (returnHref) {
      router.replace(returnHref);
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(TABS_ROOT_HREF);
  }, [router, returnHref]);

  return (
    <View style={styles.root}>
      <View style={styles.titleBar}>
        <View style={styles.titleTopRow}>
          <Pressable
            onPress={onBack}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="返回上一页"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 6 }}
          >
            <Text style={styles.backTxt}>‹ 返回</Text>
          </Pressable>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>差点</Text>
            <Text style={styles.subtitle}>WHS 记录与趋势</Text>
          </View>
          <Pressable
            style={styles.addBtn}
            onPress={() => {
              const outer = pickFromParam(params.from) ?? 'index';
              router.push(`/handicap/add?from=hcp&outer=${encodeURIComponent(outer)}` as Href);
            }}
            accessibilityRole="button"
            accessibilityLabel="添加成绩"
          >
            <Text style={styles.addBtnTxt}>+ 添加</Text>
          </Pressable>
        </View>
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
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: PAGE_BG,
  },
  titleTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  backBtn: { flexShrink: 0, paddingVertical: 4, paddingRight: 2, marginTop: 2 },
  backTxt: { fontSize: 15, fontWeight: '600', color: SUBTITLE },
  titleBlock: { flex: 1, minWidth: 0, paddingHorizontal: 4 },
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
