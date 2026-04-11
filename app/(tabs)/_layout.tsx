import { Tabs } from 'expo-router';
import React from 'react';

export default function TabLayout() {
  return (
    <Tabs tabBar={() => null} screenOptions={{ headerShown: false }}>
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
