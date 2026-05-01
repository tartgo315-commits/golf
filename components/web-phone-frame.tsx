import React from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';

import { THEME } from '@/constants/theme';

const PHONE_WIDTH = 390;
const PHONE_HEIGHT = 844;

/**
 * On web: centers a fixed-aspect “phone” frame so the app does not stretch on desktop.
 * On native: passthrough (full screen).
 */
const PAD = 36; // matches webOuter padding 18 * 2
const MIN_FRAME_W = 280;
const MIN_FRAME_H = 400;

/** RN Web 支持 100vh；RN 类型未收录，用于 minHeight */
const MIN_HEIGHT_VH = '100vh' as import('react-native').DimensionValue;

export function WebPhoneFrame({ children }: { children: React.ReactNode }) {
  const { width: winW, height: winH } = useWindowDimensions();

  if (Platform.OS !== 'web') {
    return <View style={styles.nativeRoot}>{children}</View>;
  }

  // On real mobile browsers, render full-bleed to avoid clipped viewport.
  if (winW > 0 && winW <= 768) {
    return <View style={[styles.nativeRoot, styles.nativeRootWeb]}>{children}</View>;
  }

  // Static export / first paint often has winW === 0; winW - 24 becomes negative and collapses the frame.
  const innerW = winW > PAD ? winW - PAD : PHONE_WIDTH;
  const innerH = winH > PAD ? winH - PAD : PHONE_HEIGHT;
  const frameW = Math.min(PHONE_WIDTH, Math.max(MIN_FRAME_W, innerW));
  const frameH = Math.min(PHONE_HEIGHT, Math.max(MIN_FRAME_H, innerH));

  return (
    <View style={[styles.webOuter, winH > 0 ? { minHeight: winH } : styles.webOuterMinViewport]}>
      <View style={[styles.webPhone, { width: frameW, height: frameH }]}>
        <View style={styles.webPhoneInner}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  nativeRoot: {
    flex: 1,
  },
  /** Web full-bleed: default RN root has no bg — empty flex subtree shows browser white. */
  nativeRootWeb: {
    width: '100%',
    minHeight: MIN_HEIGHT_VH,
    backgroundColor: THEME.bg,
  },
  webOuter: {
    flex: 1,
    width: '100%',
    backgroundColor: '#07120b',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  /** Fallback when window height is 0 during SSR / hydration (react-native-web). */
  webOuterMinViewport: {
    minHeight: MIN_HEIGHT_VH,
  },
  webPhone: {
    borderRadius: 34,
    backgroundColor: '#07120b',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(225,255,218,0.16)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.48,
    shadowRadius: 38,
    elevation: 20,
  },
  webPhoneInner: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 33,
    backgroundColor: THEME.bg,
  },
});
