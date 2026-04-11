import Ionicons from '@expo/vector-icons/Ionicons';
import { type Href, router, useSegments } from 'expo-router';
import * as Font from 'expo-font';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ComponentProps } from 'react';

import { THEME } from '@/constants/theme';

export const TOP_TABS = [
  { key: 'index' as const, label: '首页', icon: 'home-outline' as const },
  { key: 'score' as const, label: '成绩', icon: 'document-text-outline' as const },
  { key: 'handicap' as const, label: '差点', icon: 'trending-up-outline' as const },
  { key: 'fitting' as const, label: '配杆', icon: 'golf-outline' as const },
  { key: 'bet' as const, label: '赌球', icon: 'time-outline' as const },
] as const;

const TAB_ICON_SIZE = 26;

const TOP_TAB_FALLBACK: Record<(typeof TOP_TABS)[number]['key'], string> = {
  index: '🏠',
  score: '📋',
  handicap: '📈',
  fitting: '⛳',
  bet: '⏱',
};

type IonName = ComponentProps<typeof Ionicons>['name'];

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
  const [ionReady] = Font.useFonts({ ...Ionicons.font });
  const useGlyph = Platform.OS === 'web' && !ionReady;

  return (
    <View style={styles.topTabBar}>
      {TOP_TABS.map((tab) => {
        const isActive = segment === tab.key;
        const iconColor = isActive ? THEME.tabActive : THEME.tabInactive;
        return (
          <Pressable key={tab.key} style={styles.topTab} onPress={() => router.push(tabHref(tab.key))}>
            {useGlyph ? (
              <Text style={[styles.topTabGlyph, { opacity: isActive ? 1 : 0.55 }]}>
                {TOP_TAB_FALLBACK[tab.key]}
              </Text>
            ) : (
              <Ionicons name={tab.icon as IonName} size={TAB_ICON_SIZE} color={iconColor} style={styles.topTabIcon} />
            )}
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
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  topTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  topTabIcon: {
    marginBottom: 4,
  },
  topTabGlyph: {
    fontSize: TAB_ICON_SIZE,
    lineHeight: TAB_ICON_SIZE,
    marginBottom: 4,
    textAlign: 'center',
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
