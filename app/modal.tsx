import { Redirect } from 'expo-router';

/** 模板占位路由：直接进入主 Tab，避免死链 */
export default function ModalScreen() {
  return <Redirect href="/(tabs)" />;
}
