import React from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';

const PHONE_WIDTH = 390;
const PHONE_HEIGHT = 844;

/**
 * On web: centers a fixed-aspect “phone” frame so the app does not stretch on desktop.
 * On native: passthrough (full screen).
 */
export function WebPhoneFrame({ children }: { children: React.ReactNode }) {
  const { width: winW, height: winH } = useWindowDimensions();

  if (Platform.OS !== 'web') {
    return <View style={styles.nativeRoot}>{children}</View>;
  }

  const frameW = Math.min(PHONE_WIDTH, winW - 24);
  const frameH = Math.min(PHONE_HEIGHT, winH - 24);

  return (
    <View style={[styles.webOuter, { minHeight: winH }]}>
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
