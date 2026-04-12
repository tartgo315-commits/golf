import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ScorecardEntry } from '@/components/ScorecardEntry';
import { DARK_PAGE } from '@/constants/theme';

const BG = DARK_PAGE.bg;

export default function HandicapAddScreen() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <ScorecardEntry onBack={() => router.back()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
});
