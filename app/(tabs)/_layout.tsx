import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarLabelStyle: {
          fontSize: 12,
          lineHeight: 16,
          marginBottom: 2,
        },
        tabBarStyle: Platform.OS === 'web' ? webTabBarStyle : undefined,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '首页',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: '装备库',
          tabBarIcon: ({ color }) => <MaterialIcons name="storage" size={26} color={color} />,
        }}
      />
      <Tabs.Screen
        name="compare"
        options={{
          title: '对比',
          tabBarIcon: ({ color }) => <MaterialIcons name="bar-chart" size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: '收藏',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="heart.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '设置',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="gearshape.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}

const webTabBarStyle = {
  width: '100%' as const,
  borderTopWidth: StyleSheet.hairlineWidth,
  height: 68,
  paddingTop: 6,
  paddingBottom: 8,
};
