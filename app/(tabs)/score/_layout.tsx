import { Stack } from 'expo-router';

export default function ScoreStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { flex: 1, backgroundColor: '#0d1f10' },
      }}
    />
  );
}
