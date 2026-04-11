import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';

const TAB_ACTIVE = '#166534';
const TAB_INACTIVE = '#687076';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const tabBarPaddingBottom = Platform.OS === 'web' ? 20 : Math.max(insets.bottom, 8);
  const tabBarHeight = (Platform.OS === 'web' ? 70 : 49) + tabBarPaddingBottom;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: TAB_ACTIVE,
        tabBarInactiveTintColor: TAB_INACTIVE,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarLabelStyle: {
          fontSize: 12,
          lineHeight: 16,
          marginBottom: 2,
        },
        tabBarStyle: {
          ...tabBarBaseStyle,
          paddingBottom: tabBarPaddingBottom,
          height: tabBarHeight,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '首页',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="fitting"
        options={{
          title: '配杆',
          tabBarIcon: ({ color }) => <MaterialIcons name="build" size={26} color={color} />,
        }}
      />
      <Tabs.Screen
        name="score"
        options={{
          title: '成绩',
          tabBarIcon: ({ color }) => <MaterialIcons name="check-circle" size={26} color={color} />,
        }}
      />
      <Tabs.Screen
        name="handicap"
        options={{
          title: '差点',
          tabBarIcon: ({ color }) => <MaterialIcons name="show-chart" size={26} color={color} />,
        }}
      />
      <Tabs.Screen
        name="bet"
        options={{
          title: '赌球',
          tabBarIcon: ({ color }) => <MaterialIcons name="attach-money" size={26} color={color} />,
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          href: null,
          title: '装备库',
        }}
      />
      <Tabs.Screen
        name="compare"
        options={{
          href: null,
          title: '对比',
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          href: null,
          title: '收藏',
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          href: null,
          title: '设置',
        }}
      />
    </Tabs>
  );
}

const tabBarBaseStyle = {
  width: '100%' as const,
  borderTopWidth: StyleSheet.hairlineWidth,
};
