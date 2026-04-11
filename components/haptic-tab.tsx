import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';
import { StyleSheet, View } from 'react-native';

const TAB_INDICATOR = '#166534';

export function HapticTab({ accessibilityState, children, onPressIn, style, ...rest }: BottomTabBarButtonProps) {
  const selected = accessibilityState?.selected === true;
  return (
    <PlatformPressable
      {...rest}
      style={[styles.pressable, style]}
      onPressIn={(ev) => {
        if (process.env.EXPO_OS === 'ios') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onPressIn?.(ev);
      }}>
      {children}
      {selected ? (
        <View style={styles.indicatorTrack} pointerEvents="none">
          <View style={styles.indicatorBar} />
        </View>
      ) : null}
    </PlatformPressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    flex: 1,
  },
  indicatorTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 4,
    height: 3,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  indicatorBar: {
    width: 40,
    height: 3,
    borderRadius: 2,
    backgroundColor: TAB_INDICATOR,
  },
});
