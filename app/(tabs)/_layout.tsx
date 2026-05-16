import { BottomTabBar } from '@react-navigation/bottom-tabs';
import { Tabs, useGlobalSearchParams, usePathname } from 'expo-router';
import React, { useMemo } from 'react';
import type { ComponentProps } from 'react';
import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { fontSizeData } from '@/constants/theme';
const homeIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 12L12 4l9 8"/><path d="M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9"/></svg>`;

const scoreIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M7 9h10M7 13h6"/></svg>`;

const fittingIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 20L18 4M18 4l-2 8M18 4l2 2"/></svg>`;

const betIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 20V4"/><path d="M4 5h14l-3 5 3 5H4"/></svg>`;

const aiIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M5.6 18.4l2.8-2.8"/></svg>`;

const TabIcon = ({ color, xml }: { color?: string; xml: string }) => {
  const c = typeof color === 'string' && color.length > 0 ? color : '#c9ff4a';
  return (
    <View style={{ width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }}>
      <SvgXml xml={xml.replace(/currentColor/g, c)} width={22} height={22} />
    </View>
  );
};

type TabBarProps = ComponentProps<typeof BottomTabBar>;

const TAB_LABEL_SIZE = fontSizeData.tabLabel;
const TAB_BAR_HEIGHT = 56;

/**
 * 在 `/handicap` 栈内时，Tab 导航的 focused 路由是隐藏的 `handicap`，底部可见 Tab 会全灰。
 * 按 `?from=` / `?outer=` 把「高亮」映射回来源 Tab（统计页「详细›」为 from=score → 高亮统计）。
 */
function HandicapAwareTabBar(props: TabBarProps) {
  const pathname = usePathname() ?? '';
  const g = useGlobalSearchParams<{ from?: string | string[]; outer?: string | string[] }>();
  const fromRaw = g.from;
  const outerRaw = g.outer;
  const fromStr = Array.isArray(fromRaw) ? fromRaw[0] : fromRaw;
  const outerStr = Array.isArray(outerRaw) ? outerRaw[0] : outerRaw;

  const state = useMemo(() => {
    if (!pathname.includes('handicap')) return props.state;
    const routes = props.state.routes;
    const pick = (name: string) => {
      const i = routes.findIndex((r) => r.name === name);
      return i >= 0 ? i : props.state.index;
    };
    let target: 'index' | 'score' | 'ai' | 'fitting' | 'bet' = 'score';
    if (fromStr === 'hcp') {
      if (outerStr === 'index') target = 'index';
      else if (outerStr === 'ai') target = 'ai';
      else if (outerStr === 'fitting') target = 'fitting';
      else if (outerStr === 'bet') target = 'bet';
      else target = 'score';
    } else if (fromStr === 'index') target = 'index';
    else if (fromStr === 'ai') target = 'ai';
    else if (fromStr === 'fitting') target = 'fitting';
    else if (fromStr === 'bet') target = 'bet';
    return { ...props.state, index: pick(target) };
  }, [fromStr, outerStr, pathname, props.state]);

  /**
   * BottomTabBar 只会把 options.tabBarStyle 画到外层容器上，传入组件的 `style` 不参与布局合并。
   * 安全区与高度一律在 TabLayout 的 screenOptions.tabBarStyle 里计算。
   */
  return <BottomTabBar {...props} state={state} />;
}

export default function TabLayout() {
  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      /**
       * TabBar `position: 'absolute'` 不占文档流高度；给场景底部留白，避免 ScrollView 最后一项被挡住。
       * 与 tabBarStyle.height（外框总高）一致，避免内容被 Tab 条盖住或重复留白不一致。
       */
      sceneContainerStyle: { paddingBottom: TAB_BAR_HEIGHT },
      tabBarActiveTintColor: '#c9ff4a',
      tabBarInactiveTintColor: 'rgba(244,255,238,0.42)',
      tabBarItemStyle: { flex: 1 },
      tabBarLabelStyle: { fontSize: TAB_LABEL_SIZE, fontWeight: '600' as const, marginTop: 2 },
      tabBarIconStyle: { marginBottom: 0 },
      tabBarStyle: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(7,18,11,0.96)',
        borderTopColor: 'rgba(225,255,218,0.10)',
        borderTopWidth: 1,
        paddingTop: 4,
        paddingBottom: 6,
        height: TAB_BAR_HEIGHT,
      },
    }),
    [],
  );

  return (
    <Tabs tabBar={(p) => <HandicapAwareTabBar {...p} />} screenOptions={screenOptions}>
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
          title: '统计',
          tabBarIcon: ({ color }) => <TabIcon color={color} xml={scoreIcon} />,
        }}
      />
      <Tabs.Screen
        name="bet"
        options={{
          title: '开局',
          tabBarIcon: ({ color }) => <TabIcon color={color} xml={betIcon} />,
        }}
      />
      <Tabs.Screen
        name="fitting"
        options={{
          title: '球包',
          tabBarIcon: ({ color }) => <TabIcon color={color} xml={fittingIcon} />,
        }}
      />
      <Tabs.Screen
        name="ai"
        options={{
          title: 'AI',
          tabBarIcon: ({ color }) => <TabIcon color={color} xml={aiIcon} />,
        }}
      />
      <Tabs.Screen name="scorecard" options={{ href: null, title: '记分' }} />
      <Tabs.Screen name="handicap" options={{ href: null, title: '差点' }} />
      <Tabs.Screen name="products" options={{ href: null, title: '装备库' }} />
      <Tabs.Screen name="compare" options={{ href: null, title: '对比' }} />
      <Tabs.Screen name="favorites" options={{ href: null, title: '收藏' }} />
      <Tabs.Screen name="settings" options={{ href: null, title: '设置' }} />
    </Tabs>
  );
}
