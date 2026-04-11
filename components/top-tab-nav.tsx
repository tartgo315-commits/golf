import { type Href, router, useSegments } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  TabSvgBet,
  TabSvgFitting,
  TabSvgHandicap,
  TabSvgHome,
  TabSvgScore,
} from '@/components/golfmate-tab-icons';
import { THEME } from '@/constants/theme';

export const TOP_TABS = [
  { key: 'index' as const, label: '首页' },
  { key: 'score' as const, label: '成绩' },
  { key: 'handicap' as const, label: '差点' },
  { key: 'fitting' as const, label: '配杆' },
  { key: 'bet' as const, label: '赌球' },
] as const;

const TAB_ICON_SIZE = 26;

function TopTabIcon({ tabKey, color }: { tabKey: (typeof TOP_TABS)[number]['key']; color: string }) {
  const s = TAB_ICON_SIZE;
  switch (tabKey) {
    case 'index':
      return <TabSvgHome color={color} size={s} />;
    case 'score':
      return <TabSvgScore color={color} size={s} />;
    case 'handicap':
      return <TabSvgHandicap color={color} size={s} />;
    case 'fitting':
      return <TabSvgFitting color={color} size={s} />;
    case 'bet':
      return <TabSvgBet color={color} size={s} />;
    default:
      return null;
  }
}

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

export function TopTabNav() {
  const segments = useSegments();
  const segment = getActiveTabKey(segments);

  return (
    <View style={styles.topTabBar}>
      {TOP_TABS.map((tab) => {
        const isActive = segment === tab.key;
        const iconColor = isActive ? THEME.tabActive : THEME.tabInactive;
        return (
          <Pressable key={tab.key} style={styles.topTab} onPress={() => router.push(tabHref(tab.key))}>
            <View style={styles.topTabIcon}>
              <TopTabIcon tabKey={tab.key} color={iconColor} />
            </View>
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
    backgroundColor: THEME.bg,
    borderBottomWidth: 0.5,
    borderBottomColor: THEME.border,
  },
  topTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  topTabIcon: {
    marginBottom: 4,
    height: TAB_ICON_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topTabLabel: {
    fontSize: 13,
    color: THEME.text3,
  },
  topTabLabelActive: {
    fontSize: 13,
    color: THEME.tabActive,
    fontWeight: '600',
  },
  topTabUnderline: {
    height: 2,
    width: 24,
    backgroundColor: THEME.tabActive,
    borderRadius: 1,
    marginTop: 4,
  },
  topTabUnderlineSpacer: {
    height: 2,
    marginTop: 4,
  },
});
