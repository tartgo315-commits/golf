import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LEGAL_CONTACT_EMAIL, LEGAL_EFFECTIVE_DATE_CN } from '@/constants/legal';

const BG = '#0d1b11';
const TITLE = '#e8f0e5';
const BODY = '#a8b5ac';

export default function PrivacyPolicyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Text style={styles.backTxt}>← 返回</Text>
        </Pressable>
        <Text style={styles.headerTitle}>隐私政策</Text>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.meta}>生效日期：{LEGAL_EFFECTIVE_DATE_CN}</Text>

        <Text style={styles.h}>我们收集哪些数据</Text>
        <Text style={styles.p}>
          为提供差点追踪、成绩管理与训练提醒等功能，我们可能处理：您主动录入的
          <Text style={styles.strong}>成绩记录</Text>与相关统计、
          <Text style={styles.strong}>差点数据</Text>及历史曲线、用于设备识别与通知投递的
          <Text style={styles.strong}>设备标识符</Text>，以及经您授权后由系统提供的
          <Text style={styles.strong}>推送通知 Token</Text>（用于训练提醒与好友相关通知）。
        </Text>

        <Text style={styles.h}>我们不收集的内容</Text>
        <Text style={styles.p}>
          本应用不会将您的精确地理位置作为用户画像或广告用途上传。若您授予定位权限，该权限
          <Text style={styles.strong}>仅用于在设备本地或会话内搜索附近球场名称</Text>，我们不会将连续定位轨迹或坐标上传至我们的服务器用于追踪您。
        </Text>

        <Text style={styles.h}>数据如何存储</Text>
        <Text style={styles.p}>
          成绩、训练计划等默认保存在您设备上的 <Text style={styles.strong}>AsyncStorage（本地）</Text>
          中。若您使用好友或云端同步相关能力，我们可能通过
          <Text style={styles.strong}> Vercel KV</Text> 等托管存储保存与账号关联的最小数据集（例如
          <Text style={styles.strong}>用户 ID</Text>与您选择公开的
          <Text style={styles.strong}>差点摘要数据</Text>），以便好友列表与对比功能正常工作。
        </Text>

        <Text style={styles.h}>数据共享</Text>
        <Text style={styles.p}>
          我们不会出售您的个人数据，也不会将其共享给第三方广告商用于跨应用追踪。好友相关功能仅在您主动使用并同意展示时，向好友展示您
          <Text style={styles.strong}>选择公开的差点等有限资料</Text>。
        </Text>

        <Text style={styles.h}>您的权利与数据删除</Text>
        <Text style={styles.p}>
          您可随时在应用的「设置」中导出 JSON 备份，或通过「删除账号」清除本设备上的全部本地数据。若您同时使用云端能力，发布前请确保在服务端完成账号注销流程（如有）。
        </Text>

        <Text style={styles.h}>联系我们</Text>
        <Text style={styles.p}>
          有关本隐私政策的疑问，请发送邮件至：{' '}
          <Text style={styles.strong}>{LEGAL_CONTACT_EMAIL}</Text>
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: { paddingHorizontal: 16, paddingBottom: 12 },
  backBtn: { alignSelf: 'flex-start', paddingVertical: 6 },
  backTxt: { color: BODY, fontSize: 15 },
  headerTitle: { marginTop: 4, fontSize: 20, fontWeight: '800', color: TITLE },
  scroll: { flex: 1 },
  meta: { paddingHorizontal: 16, marginBottom: 16, fontSize: 12, color: BODY, opacity: 0.85 },
  h: {
    paddingHorizontal: 16,
    marginTop: 18,
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '700',
    color: TITLE,
  },
  p: {
    paddingHorizontal: 16,
    fontSize: 13,
    lineHeight: 13 * 1.8,
    color: BODY,
  },
  strong: { fontWeight: '700', color: '#c5d4c8' },
});
