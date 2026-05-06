import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function ProfileScreen() {
  return (
    <View style={styles.root}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.title}>个人档案</Text>
        <Text style={styles.text}>内容加载中...</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#07120b',
    ...(Platform.OS === 'web' ? ({ height: '100vh' } as any) : {}),
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 20,
    flexGrow: 1,
  },
  title: {
    color: '#c9ff4a',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  text: {
    color: '#ffffff',
    fontSize: 16,
  },
});
