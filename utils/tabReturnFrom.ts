import type { Href } from 'expo-router';

export function pickFromParam(raw: string | string[] | undefined): string | undefined {
  if (raw == null) return undefined;
  return Array.isArray(raw) ? raw[0] : raw;
}

/** 无子栈可 pop 时回到 Tabs 根（默认首页 Tab） */
export const TABS_ROOT_HREF = '/(tabs)' as Href;

/** `?from=` 与底部 Tab / 常用隐藏页对应 */
export const TAB_RETURN_FROM: Record<string, Href> = {
  score: '/score',
  index: '/(tabs)',
  ai: '/(tabs)/ai' as Href,
  fitting: '/fitting',
  bet: '/bet',
  settings: '/settings',
};

export function returnHrefForFrom(from: string | undefined): Href | null {
  if (!from) return null;
  return TAB_RETURN_FROM[from] ?? null;
}

/** 全部场次列表（带回到来源 Tab 的 query） */
export function handicapHistoryHref(originTab: string | undefined): Href {
  const o = originTab && originTab.length > 0 ? originTab : 'score';
  return `/handicap/history?from=${encodeURIComponent(o)}` as Href;
}

/** 差点总览（带 from 便于再返回） */
export function handicapIndexHref(originTab: string | undefined): Href {
  const o = originTab && originTab.length > 0 ? originTab : 'score';
  return `/handicap?from=${encodeURIComponent(o)}` as Href;
}
