import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, View } from 'react-native';

import {
  TabSvgBet,
  TabSvgFitting,
  TabSvgHandicap,
  TabSvgHome,
  TabSvgScore,
} from '@/components/golfmate-tab-icons';
import { THEME } from '@/constants/theme';

const TAB_ICON_SIZE = 24;
const TAB_BAR_HEIGHT = 62;

function TabBarIconSlot({
  children,
  focused,
  showDot,
}: {
  children: React.ReactNode;
  focused: boolean;
  showDot: boolean;
}) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'flex-start', minWidth: 40 }}>
      {children}
      <View
        style={{
          height: 8,
          marginTop: 2,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {showDot ? (
          <View
            style={{
              width: 4,
              height: 4,
              borderRadius: 2,
              backgroundColor: focused ? THEME.tabActive : 'transparent',
            }}
          />
        ) : null}
      </View>
    </View>
  );
}

function TabBarRouteIcon({
  routeName,
  color,
  focused,
}: {
  routeName?: string;
  color: string;
  focused: boolean;
}) {
  const hidden =
    routeName === 'products' ||
    routeName === 'compare' ||
    routeName === 'favorites' ||
    routeName === 'settings';
  if (hidden || !routeName) {
    return <View style={{ width: TAB_ICON_SIZE, height: TAB_ICON_SIZE + 10 }} />;
  }

  const s = TAB_ICON_SIZE;

  switch (routeName) {
    case 'index':
      return (
        <TabBarIconSlot focused={focused} showDot>
          <TabSvgHome color={color} size={s} />
        </TabBarIconSlot>
      );
    case 'score':
      return (
        <TabBarIconSlot focused={focused} showDot={false}>
          <TabSvgScore color={color} size={s} />
        </TabBarIconSlot>
      );
    case 'handicap':
      return (
        <TabBarIconSlot focused={focused} showDot={false}>
          <TabSvgHandicap color={color} size={s} />
        </TabBarIconSlot>
      );
    case 'fitting':
      return (
        <TabBarIconSlot focused={focused} showDot={false}>
          <TabSvgFitting color={color} size={s} />
        </TabBarIconSlot>
      );
    case 'bet':
      return (
        <TabBarIconSlot focused={focused} showDot={false}>
          <TabSvgBet color={color} size={s} />
        </TabBarIconSlot>
      );
    default:
      return (
        <TabBarIconSlot focused={focused} showDot={false}>
          <View style={{ width: s, height: s }} />
        </TabBarIconSlot>
      );
  }
}

export default function TabLayout() {
  return (
    <Tabs
      sceneContainerStyle={{ flex: 1 }}
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: THEME.bg },
        headerTintColor: THEME.text1,
        headerShadowVisible: false,
        tabBarStyle: {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: THEME.bg,
          borderTopWidth: 1,
          borderTopColor: THEME.border,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          height: TAB_BAR_HEIGHT,
          paddingTop: 6,
          paddingBottom: Platform.OS === 'ios' ? 10 : 8,
          paddingHorizontal: 4,
          elevation: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.35,
          shadowRadius: 10,
        },
        tabBarActiveTintColor: THEME.tabActive,
        tabBarInactiveTintColor: THEME.tabInactive,
        tabBarShowLabel: true,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: 0 },
        tabBarItemStyle: { paddingTop: 2 },
        tabBarIcon: ({ route, focused, color }) => (
          <TabBarRouteIcon routeName={route?.name} color={color} focused={focused} />
        ),
      }}>
      <Tabs.Screen name="index" options={{ title: '首页' }} />
      <Tabs.Screen name="score" options={{ title: '成绩' }} />
      <Tabs.Screen name="handicap" options={{ title: '差点' }} />
      <Tabs.Screen name="fitting" options={{ title: '配杆' }} />
      <Tabs.Screen name="bet" options={{ title: '赌球' }} />
      <Tabs.Screen name="products" options={{ href: null, title: '装备库' }} />
      <Tabs.Screen name="compare" options={{ href: null, title: '对比' }} />
      <Tabs.Screen name="favorites" options={{ href: null, title: '收藏' }} />
      <Tabs.Screen name="settings" options={{ href: null, title: '设置' }} />
    </Tabs>
  );
}
