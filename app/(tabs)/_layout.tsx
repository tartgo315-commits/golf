import { Tabs } from 'expo-router';
import React from 'react';
import { Image, View } from 'react-native';

const tabBarIconSource = require('../../assets/images/golf-check-icon.png');

const TabIcon = ({ focused }: { focused?: boolean }) => (
  <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
    <Image
      source={tabBarIconSource}
      style={{ width: 22, height: 22, opacity: focused ? 1 : 0.42 }}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
    />
  </View>
);

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
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="score"
        options={{
          title: '成绩',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="handicap"
        options={{
          title: '差点',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="fitting"
        options={{
          title: '配杆',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="bet"
        options={{
          title: '球局设定',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} />,
        }}
      />
      <Tabs.Screen name="products" options={{ href: null, title: '装备库' }} />
      <Tabs.Screen name="compare" options={{ href: null, title: '对比' }} />
      <Tabs.Screen name="favorites" options={{ href: null, title: '收藏' }} />
      <Tabs.Screen name="settings" options={{ href: null, title: '设置' }} />
    </Tabs>
  );
}
