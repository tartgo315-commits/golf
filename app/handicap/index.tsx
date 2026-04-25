import { Redirect } from 'expo-router';

/** 独立「差点」Tab 已并入成绩页；保留本路由以便旧链接与栈内 replace 跳转。 */
export default function HandicapIndexRedirect() {
  return <Redirect href="/(tabs)/score?tab=handicap" />;
}
