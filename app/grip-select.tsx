import { Redirect } from 'expo-router';

/** 旧路径保留：统一跳转到 tools 下的握把选择 */
export default function GripSelectLegacyRedirect() {
  return <Redirect href="/tools/grip" />;
}
