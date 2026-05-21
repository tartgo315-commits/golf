import { useFocusEffect } from '@react-navigation/native';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ScreenHeader } from '@/components/ScreenHeader';
import { ScoreHandicapTabContent } from '@/components/ScoreHandicapTabContent';
import { TAB_BAR_SCROLL_EXTRA, THEME } from '@/constants/theme';
import { loadHandicapRecords, normalizeHandicapRecords, type HandicapRecord } from '@/lib/handicap';
import {
  pickFromParam,
  returnHrefForFrom,
  TABS_ROOT_HREF,
} from '@/utils/tabReturnFrom';

const PAGE_BG = THEME.bg;
const BTN_BG = '#1e3a26';
const BTN_BORDER = '#2d5436';
const ACCENT = THEME.accent;

export default function HandicapIndexScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: string | string[] }>();
  const returnHref = useMemo(() => returnHrefForFrom(pickFromParam(params.from)), [params.from]);

  const [records, setRecords] = useState<HandicapRecord[]>([]);

  const reload = useCallback(() => {
    void (async () => {
      const raw = await loadHandicapRecords();
      setRecords(normalizeHandicapRecords(raw));
    })();
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
      return () => {};
    }, [reload]),
  );

  const onBack = useCallback(() => {
    // 带 from 的入口（统计/首页等）在 Tab 嵌套下常无可靠 history；优先回到来源 Tab，避免误回首页
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
      <ScreenHeader
        variant="tab"
        title="差点"
        subtitle="WHS 记录与趋势"
        onBack={onBack}
        trailing={
          <Pressable
            style={styles.addBtn}
            onPress={() => {
              const outer = pickFromParam(params.from) ?? 'index';
              router.push(`/handicap/add?from=hcp&outer=${encodeURIComponent(outer)}` as Href);
            }}
            accessibilityRole="button"
            accessibilityLabel="添加记分"
          >
            <Text style={styles.addBtnTxt}>+ 添加</Text>
          </Pressable>
        }
      />
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
