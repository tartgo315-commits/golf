import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LEGAL_CONTACT_EMAIL, LEGAL_EFFECTIVE_DATE_CN } from '@/constants/legal';

const BG = '#0d1b11';
const TITLE = '#e8f0e5';
const BODY = '#a8b5ac';

export default function TermsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Text style={styles.backTxt}>← 返回</Text>
        </Pressable>
        <Text style={styles.headerTitle}>用户协议</Text>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.meta}>生效日期：{LEGAL_EFFECTIVE_DATE_CN}</Text>

        <Text style={styles.h}>服务说明</Text>
        <Text style={styles.p}>
          GolfMate（高尔夫伴侣）向您提供差点估算、成绩记录、训练与社交辅助等工具。应用内展示的差点指数与趋势基于您录入的成绩与通用规则计算，
          <Text style={styles.strong}>仅供参考与自我训练管理</Text>
          ，不构成世界差点系统（WHS）或任何官方机构的认证、备案或替代证明。
        </Text>

        <Text style={styles.h}>用户责任</Text>
        <Text style={styles.p}>
          您应如实、完整地记录成绩与球场信息，不得利用漏洞或虚假数据恶意操纵差点展示。若发现异常模式，我们可能限制部分功能以保护其他用户。
        </Text>

        <Text style={styles.h}>数据归属</Text>
        <Text style={styles.p}>
          您在本应用中录入的<Text style={styles.strong}>成绩与相关统计数据归您所有</Text>
          。您可随时导出或按本应用流程删除本地数据。
        </Text>

        <Text style={styles.h}>免责声明</Text>
        <Text style={styles.p}>
          球场难度值（Course Rating）、坡度（Slope）等数据可能来源于公开资料或用户输入，
          <Text style={styles.strong}>可能与球场官方公布值存在差异</Text>
          。计算与建议请以球场及官方机构最新公布为准。
        </Text>

        <Text style={styles.h}>违规与终止</Text>
        <Text style={styles.p}>
          若您违反法律法规、本协议或恶意干扰服务，我们保留暂停或终止向您提供服务、并在必要时
          <Text style={styles.strong}>封禁关联设备标识</Text>的权利。
        </Text>

        <Text style={styles.h}>联系我们</Text>
        <Text style={styles.p}>
          如有争议或咨询，请联系： <Text style={styles.strong}>{LEGAL_CONTACT_EMAIL}</Text>
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
