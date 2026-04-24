import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import type { InAppPayload, NotificationType } from '@/utils/pushNotification';
import { navigateFromNotificationData, setInAppNotificationPresenter } from '@/utils/pushNotification';

const CARD = '#16261c';
const TITLE = '#fff';
const BODY = '#a8b5ac';
const FRIEND = '#b5ff3a';
const AMEND = '#e89b3a';
const TRAIN = '#3ac5a8';

function iconColor(t: NotificationType): string {
  if (t === 'friend_request' || t === 'friend_accepted' || t === 'handicap_updated') return FRIEND;
  if (t === 'amendment_request' || t === 'amendment_result') return AMEND;
  if (t === 'training_reminder') return TRAIN;
  return FRIEND;
}

function TypeIcon({ type }: { type: NotificationType }) {
  const c = iconColor(type);
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={10} stroke={c} strokeWidth={1.6} />
      <Path d="M12 8v4l2 2" stroke={c} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

function InAppBanner({ payload, onDismiss }: { payload: InAppPayload | null; onDismiss: () => void }) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-160)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    Animated.timing(translateY, {
      toValue: -160,
      duration: 220,
      useNativeDriver: true,
    }).start(() => onDismiss());
  }, [onDismiss, translateY]);

  useEffect(() => {
    if (!payload) {
      translateY.setValue(-160);
      return;
    }
    translateY.setValue(-160);
    Animated.spring(translateY, {
      toValue: 0,
      friction: 8,
      tension: 65,
      useNativeDriver: true,
    }).start();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => dismiss(), 3000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [payload, dismiss, translateY]);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 8,
      onPanResponderRelease: (_, g) => {
        if (g.dy < -24) dismiss();
      },
    }),
  ).current;

  if (!payload) return null;

  const onPressBar = () => {
    navigateFromNotificationData(payload.type, payload.data);
    dismiss();
  };

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          paddingTop: (Platform.OS === 'web' ? 12 : insets.top) + 8,
          transform: [{ translateY }],
        },
      ]}
      {...pan.panHandlers}>
      <Pressable style={styles.card} onPress={onPressBar}>
        <TypeIcon type={payload.type} />
        <View style={styles.textCol}>
          <Text style={styles.title} numberOfLines={1}>
            {payload.title}
          </Text>
          <Text style={styles.body} numberOfLines={2}>
            {payload.body}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export function InAppNotificationRoot({ children }: { children: React.ReactNode }) {
  const [payload, setPayload] = useState<InAppPayload | null>(null);

  useEffect(() => {
    setInAppNotificationPresenter((p) => setPayload(p));
    return () => setInAppNotificationPresenter(undefined);
  }, []);

  return (
    <View style={styles.root}>
      {children}
      <View style={styles.overlay} pointerEvents="box-none">
        <InAppBanner payload={payload} onDismiss={() => setPayload(null)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    pointerEvents: 'box-none',
  },
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    paddingHorizontal: 12,
    pointerEvents: 'box-none',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: CARD,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    pointerEvents: 'auto',
  },
  textCol: { flex: 1, minWidth: 0 },
  title: { fontSize: 13, fontWeight: '700', color: TITLE },
  body: { fontSize: 12, fontWeight: '500', color: BODY, marginTop: 4 },
});
