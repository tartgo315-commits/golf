import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { HandicapRecord } from '@/lib/handicap';
import { isRoundLockedSync, roundLockCountdownLabel } from '@/utils/roundLock';

const LOCK_STROKE = '#5a6b5f';
const COUNTDOWN = '#e89b3a';

type Props = {
  round: HandicapRecord;
};

export function RoundLockIndicator({ round }: Props) {
  const locked = isRoundLockedSync(round);
  const showCountdown = round.handicapProcessed === true && !locked;
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!showCountdown) return;
    const id = setInterval(() => setTick((x) => x + 1), 60_000);
    return () => clearInterval(id);
  }, [showCountdown]);

  if (locked) {
    return (
      <Pressable
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="成绩已锁定"
        onPress={() => Alert.alert('提示', '成绩已锁定，超过 24 小时无法修改')}>
        <Svg width={12} height={12} viewBox="0 0 12 12" fill="none">
          <Path
            d="M3 5.5V4a2.5 2.5 0 015 0v1.5M2.5 5.5h7v5h-7v-5z"
            stroke={LOCK_STROKE}
            strokeWidth={1.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </Pressable>
    );
  }

  if (showCountdown) {
    const label = roundLockCountdownLabel(round);
    if (!label) return null;
    return (
      <Text style={styles.countdown} numberOfLines={1}>
        {label}
      </Text>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  countdown: {
    fontSize: 11,
    fontWeight: '600',
    color: COUNTDOWN,
    maxWidth: 120,
    textAlign: 'right',
  },
});
