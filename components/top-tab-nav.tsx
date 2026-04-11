import { type Href, router, useSegments } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export const TOP_TABS = [
  { key: 'index' as const, label: '首页' },
  { key: 'score' as const, label: '成绩' },
  { key: 'handicap' as const, label: '差点' },
  { key: 'fitting' as const, label: '配杆' },
  { key: 'bet' as const, label: '赌球' },
] as const;

function getActiveTabKey(segments: readonly string[]): string {
  const i = segments.indexOf('(tabs)');
  if (i !== -1) {
    const rest = segments.slice(i + 1);
    const leaf = rest[rest.length - 1] ?? '';
    if (leaf === 'score' || leaf === 'handicap' || leaf === 'fitting' || leaf === 'bet') return leaf;
    return 'index';
  }
  if (segments.includes('handicap')) return 'handicap';
  if (segments.includes('score')) return 'score';
  if (segments.includes('fitting')) return 'fitting';
  if (segments.includes('bet')) return 'bet';
  return 'index';
}

function tabHref(key: (typeof TOP_TABS)[number]['key']): Href {
  if (key === 'index') return '/(tabs)' as Href;
  return `/(tabs)/${key}` as Href;
}

const TOP_TAB_WHITE = '#ffffff';
const TOP_TAB_BORDER = '#e8e8e8';
const TOP_TAB_MUTED = '#888888';
const TOP_TAB_ACTIVE = '#1a6b2e';

export function TopTabNav() {
  const segments = useSegments();
  const segment = getActiveTabKey(segments);

  return (
    <View style={styles.topTabBar}>
      {TOP_TABS.map((tab) => {
        const isActive = segment === tab.key;
        return (
          <Pressable key={tab.key} style={styles.topTab} onPress={() => router.push(tabHref(tab.key))}>
            <Text style={isActive ? styles.topTabLabelActive : styles.topTabLabel}>{tab.label}</Text>
            {isActive ? <View style={styles.topTabUnderline} /> : <View style={styles.topTabUnderlineSpacer} />}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  topTabBar: {
    flexDirection: 'row',
    backgroundColor: TOP_TAB_WHITE,
    borderBottomWidth: 0.5,
    borderBottomColor: TOP_TAB_BORDER,
  },
  topTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
  },
  topTabLabel: {
    fontSize: 13,
    color: TOP_TAB_MUTED,
  },
  topTabLabelActive: {
    fontSize: 13,
    color: TOP_TAB_ACTIVE,
    fontWeight: '600',
  },
  topTabUnderline: {
    height: 2,
    width: 24,
    backgroundColor: TOP_TAB_ACTIVE,
    borderRadius: 1,
    marginTop: 4,
  },
  topTabUnderlineSpacer: {
    height: 2,
    marginTop: 4,
  },
});
