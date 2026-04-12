import { Tabs } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';

const homeIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 12L12 4l9 8"/><path d="M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9"/></svg>`;

const scoreIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M7 9h10M7 13h6"/></svg>`;

const handicapIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l5-5 4 4 9-9"/></svg>`;

const fittingIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 20L18 4M18 4l-2 8M18 4l2 2"/></svg>`;

const betIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>`;

const TabIcon = ({ color, xml }: { color?: string; xml: string }) => {
  const c = typeof color === 'string' && color.length > 0 ? color : '#a3e635';
  return (
    <View style={{ width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }}>
      <SvgXml xml={xml.replace(/currentColor/g, c)} width={22} height={22} />
    </View>
  );
};

export default function TabLayout() {
  return (
    <Tabs
      sceneContainerStyle={{ flex: 1 }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#a3e635',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.4)',
        tabBarStyle: {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: '#0d1f10',
          borderTopColor: 'rgba(255,255,255,0.07)',
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '首页',
          tabBarIcon: ({ color }) => <TabIcon color={color} xml={homeIcon} />,
        }}
      />
      <Tabs.Screen
        name="score"
        options={{
          title: '成绩',
          tabBarIcon: ({ color }) => <TabIcon color={color} xml={scoreIcon} />,
        }}
      />
      <Tabs.Screen
        name="handicap"
        options={{
          title: '差点',
          tabBarIcon: ({ color }) => <TabIcon color={color} xml={handicapIcon} />,
        }}
      />
      <Tabs.Screen
        name="fitting"
        options={{
          title: '配杆',
          tabBarIcon: ({ color }) => <TabIcon color={color} xml={fittingIcon} />,
        }}
      />
      <Tabs.Screen
        name="bet"
        options={{
          title: '赌球',
          tabBarIcon: ({ color }) => <TabIcon color={color} xml={betIcon} />,
        }}
      />
      <Tabs.Screen name="products" options={{ href: null, title: '装备库' }} />
      <Tabs.Screen name="compare" options={{ href: null, title: '对比' }} />
      <Tabs.Screen name="favorites" options={{ href: null, title: '收藏' }} />
      <Tabs.Screen name="settings" options={{ href: null, title: '设置' }} />
    </Tabs>
  );
}
