import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

/**
 * 占位页：后续接入握把与挥重影响说明。
 */
export default function GripSelectScreen() {
  const router = useRouter();

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>握把选择</Text>
      <Text style={styles.body}>尺寸、材质与对挥重的影响将在此展示。功能开发中。</Text>
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
