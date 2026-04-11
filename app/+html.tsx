import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

import { THEME } from '@/constants/theme';

/** Before JS paints, avoid a white flash if #root height is still 0. */
const ROOT_SURFACE_CSS = `body{margin:0;background-color:${THEME.bg}}`;

export default function RootHtml({ children }: PropsWithChildren) {
  return (
    <html lang="zh-CN">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="配杆顾问" />
        <meta name="theme-color" content="#101512" />
        <link rel="manifest" href="/manifest.json" />
        <ScrollViewStyleReset />
        <style id="gca-root-surface" dangerouslySetInnerHTML={{ __html: ROOT_SURFACE_CSS }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
