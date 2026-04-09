import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const tabBarPaddingBottom = Platform.OS === 'web' ? 20 : Math.max(insets.bottom, 8);
  const tabBarHeight = (Platform.OS === 'web' ? 70 : 49) + tabBarPaddingBottom;

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

const tabBarBaseStyle = {
  width: '100%' as const,
  borderTopWidth: StyleSheet.hairlineWidth,
};
