import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

/**
 * 占位页：后续接入挥重计算逻辑。
 */
export default function SwingWeightScreen() {
  const router = useRouter();

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>挥重计算器</Text>
      <Text style={styles.body}>输入杆身与杆头数据、目标长度后，将在此推算目标挥重。功能开发中。</Text>
      <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}>
        <Text style={styles.btnText}>返回</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: 24,
    backgroundColor: '#f0f2f1',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#14261c',
    marginBottom: 12,
  },
  body: {
    fontSize: 15,
    lineHeight: 24,
    color: '#3d5247',
    marginBottom: 24,
  },
  btn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#166534',
  },
  btnPressed: {
    opacity: 0.9,
  },
  btnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
