import { Text, View } from 'react-native';

export default function ProfileScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: '#07120b', padding: 20 }}>
      <Text style={{ color: '#c9ff4a', fontSize: 24 }}>个人档案</Text>
      <Text style={{ color: '#fff', marginTop: 12 }}>测试页面</Text>
    </View>
  );
}
