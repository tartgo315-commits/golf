import React from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';

const PHONE_WIDTH = 390;
const PHONE_HEIGHT = 844;

/**
 * On web: centers a fixed-aspect “phone” frame so the app does not stretch on desktop.
 * On native: passthrough (full screen).
 */
const PAD = 24; // matches webOuter padding 12 * 2
const MIN_FRAME_W = 280;
const MIN_FRAME_H = 400;

export function WebPhoneFrame({ children }: { children: React.ReactNode }) {
  const { width: winW, height: winH } = useWindowDimensions();

  if (Platform.OS !== 'web') {
    return <View style={styles.nativeRoot}>{children}</View>;
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
  webOuter: {
    flex: 1,
    width: '100%',
    backgroundColor: '#9aa89e',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  /** Fallback when window height is 0 during SSR / hydration (react-native-web). */
  webOuterMinViewport: {
    minHeight: '100vh',
  },
  webPhone: {
    borderRadius: 28,
    backgroundColor: '#0f0f0f',
    overflow: 'hidden',
    borderWidth: 5,
    borderColor: '#1c1c1c',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 16,
  },
  webPhoneInner: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 22,
    backgroundColor: '#f0f2f1',
  },
});
