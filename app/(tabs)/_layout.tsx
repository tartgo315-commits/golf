import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, View } from 'react-native';

import { THEME } from '@/constants/theme';

const TAB_ICON_SIZE = 24;

function TabHomeIcon({ color, focused }: { color: string; focused: boolean }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Ionicons name="home-outline" size={TAB_ICON_SIZE} color={color} />
      <View
        style={{
          height: 6,
          marginTop: 2,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <View
          style={{
            width: 4,
            height: 4,
            borderRadius: 2,
            backgroundColor: focused ? THEME.tabActive : 'transparent',
          }}
        />
      </View>
    </View>
  );
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
          borderTopColor: 'rgba(255,255,255,0.07)',
          borderTopWidth: 1,
          height: 60,
          paddingBottom: Platform.OS === 'ios' ? 10 : 8,
          elevation: 0,
        },
        tabBarActiveTintColor: THEME.tabActive,
        tabBarInactiveTintColor: THEME.tabInactive,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        tabBarIcon: ({ route, focused }) => {
          const c = focused ? THEME.tabActive : THEME.tabInactive;
          const routeName = route?.name;
          switch (routeName) {
            case 'index':
              return <Ionicons name="home-outline" size={TAB_ICON_SIZE} color={c} />;
            case 'score':
              return <Ionicons name="document-text-outline" size={TAB_ICON_SIZE} color={c} />;
            case 'handicap':
              return <Ionicons name="trending-up-outline" size={TAB_ICON_SIZE} color={c} />;
            case 'fitting':
              return <Ionicons name="golf-outline" size={TAB_ICON_SIZE} color={c} />;
            case 'bet':
              return <Ionicons name="time-outline" size={TAB_ICON_SIZE} color={c} />;
            default:
              return (
                <Ionicons name="ellipse-outline" size={TAB_ICON_SIZE} color={THEME.tabInactive} />
              );
          }
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '首页',
          tabBarIcon: ({ color, focused }) => (
            <TabHomeIcon color={color} focused={focused} />
          ),
        }}
      />
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
