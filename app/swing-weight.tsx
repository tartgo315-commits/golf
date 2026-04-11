import { Redirect } from 'expo-router';

/** 旧路径保留：统一跳转到 tools 下的挥重计算器 */
export default function SwingWeightLegacyRedirect() {
  return <Redirect href="/tools/swing-weight" />;
}
