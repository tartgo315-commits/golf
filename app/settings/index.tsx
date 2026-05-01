import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { type Href, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LEGAL_CONTACT_EMAIL } from '@/constants/legal';
import { useAuth } from '@/contexts/auth-context';
import {
  applyTrainingReminderFromStorage,
  loadTrainingReminderSettings,
  saveTrainingReminderSettings,
  type TrainingReminderSettings,
} from '@/utils/pushNotification';
import { exportUserDataJson } from '@/utils/dataExport';
import {
  loadNotificationPrefs,
  saveNotificationPrefs,
  type NotificationPrefs,
} from '@/utils/notificationPrefs';
import {
  clearAppCache,
  clearLogoutSessionKeys,
  wipeAllLocalUserData,
} from '@/utils/storageMaintenance';
import {
  loadHandicapRecords,
  saveHandicapRecords,
  type HandicapRecord,
} from '@/lib/handicap';
import { THEME } from '@/constants/theme';

const PAGE_BG = THEME.bg;
const CARD = THEME.card;
const BORDER = THEME.border;
const TEXT_MAIN = THEME.text2;
const TEXT_SEC = THEME.text3;
const TEXT_MUTED = THEME.text3;
const HEADER_TITLE = THEME.text1;
const DANGER_BG = 'rgba(217,72,72,0.06)';
const DANGER_TEXT = '#d94848';
const MOCK_CLEAR_BG = 'rgba(217,72,72,0.08)';

const KEY_DISPLAY_NAME = '@gca_social_display_name_v1';
const KEY_INVITE = '@gca_social_invite_code_v1';

const MINUTE_OPTIONS = [0, 15, 30, 45] as const;

function looksLikeMockHandicapRecord(r: HandicapRecord): boolean {
  if (r.isMockData === true) return true;
  const n = r.courseName.toLowerCase();
  return n.includes('模拟') || n.includes('mock') || n.includes('test');
}

function appVersionLabel(): string {
  const ver =
    (typeof Constants.expoConfig?.version === 'string' && Constants.expoConfig.version) || '1.0.0';
  const build =
    Platform.OS === 'ios'
      ? (Constants.nativeBuildVersion ?? Constants.expoConfig?.ios?.buildNumber ?? '1')
      : Platform.OS === 'android'
        ? String(Constants.expoConfig?.android?.versionCode ?? 1)
        : '1';
  return `${ver} (${build})`;
}

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, signOut } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [training, setTraining] = useState<TrainingReminderSettings>({
    enabled: false,
    hour: 20,
    minute: 0,
  });
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>({
    friendEnabled: true,
    handicapUpdateEnabled: true,
  });
  const [timeOpen, setTimeOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const versionLine = useMemo(() => appVersionLabel(), []);

  const refreshProfile = useCallback(async () => {
    const [n, inv] = await Promise.all([
      AsyncStorage.getItem(KEY_DISPLAY_NAME),
      AsyncStorage.getItem(KEY_INVITE),
    ]);
    setDisplayName(n?.trim() || '');
    setInviteCode(inv?.trim() || '');
  }, []);

  useEffect(() => {
    void refreshProfile();
    void (async () => {
      const [trRaw, np] = await Promise.all([
        loadTrainingReminderSettings(),
        loadNotificationPrefs(),
      ]);
      const allowed = MINUTE_OPTIONS as unknown as number[];
      const snap =
        allowed.find((m) => m === trRaw.minute) ??
        allowed.reduce(
          (best, m) => (Math.abs(m - trRaw.minute) < Math.abs(best - trRaw.minute) ? m : best),
          allowed[0],
        );
      const tr = { ...trRaw, minute: snap };
      setTraining(tr);
      if (snap !== trRaw.minute) await saveTrainingReminderSettings(tr);
      setNotifPrefs(np);
    })();
  }, [refreshProfile]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }, []);

  const onExport = useCallback(async () => {
    const r = await exportUserDataJson();
    if (r.empty) {
      showToast('暂无数据可导出');
      return;
    }
    if (!r.ok) showToast('导出失败，请稍后重试');
  }, [showToast]);

  const onClearMockHandicapData = useCallback(() => {
    Alert.alert(
      '清除测试数据',
      '将删除所有标记为模拟的成绩，以及球场名含「模拟」或 mock / test 的记录，确认？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            const records = loadHandicapRecords();
            const keep = records.filter((r) => !looksLikeMockHandicapRecord(r));
            const removed = records.length - keep.length;
            saveHandicapRecords(keep);
            showToast(removed > 0 ? `已删除 ${removed} 条测试成绩` : '没有匹配的测试成绩');
          },
        },
      ],
    );
  }, [showToast]);

  const onClearCache = useCallback(() => {
    Alert.alert('清除缓存', '将清除球场详情缓存与好友列表缓存，不会删除成绩记录。', [
      { text: '取消', style: 'cancel' },
      {
        text: '清除',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await clearAppCache();
            showToast('缓存已清除');
          })();
        },
      },
    ]);
  }, [showToast]);

  const persistTraining = useCallback(async (next: TrainingReminderSettings) => {
    setTraining(next);
    await saveTrainingReminderSettings(next);
    await applyTrainingReminderFromStorage();
  }, []);

  const persistNotif = useCallback(async (next: NotificationPrefs) => {
    setNotifPrefs(next);
    await saveNotificationPrefs(next);
  }, []);

  const onLogout = useCallback(() => {
    Alert.alert(
      '退出登录',
      '将清除登录状态、设备标识与本地社交缓存；成绩与训练等数据将保留在本机。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '退出登录',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              await clearLogoutSessionKeys();
              await signOut();
              showToast('已退出登录');
              router.back();
            })();
          },
        },
      ],
    );
  }, [router, showToast, signOut]);

  const onDeleteAccount = useCallback(() => {
    Alert.alert(
      '删除账号',
      '将永久清除本设备上的全部应用数据（含成绩与训练），且不可恢复。确定继续？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            Alert.alert('再次确认', '此操作无法撤销。', [
              { text: '取消', style: 'cancel' },
              {
                text: '确认删除',
                style: 'destructive',
                onPress: () => {
                  void (async () => {
                    await wipeAllLocalUserData();
                    await signOut();
                    showToast('账号数据已删除');
                    router.replace('/login' as Href);
                  })();
                },
              },
            ]);
          },
        },
      ],
    );
  }, [router, showToast, signOut]);

  const openFeedback = useCallback(() => {
    const subject = encodeURIComponent('GolfMate 反馈');
    const body = encodeURIComponent(
      `应用版本：${versionLine}\n平台：${Platform.OS}\n\n请描述问题或建议：\n`,
    );
    const url = `mailto:${LEGAL_CONTACT_EMAIL}?subject=${subject}&body=${body}`;
    void Linking.openURL(url).catch(() => showToast('无法打开邮件客户端'));
  }, [showToast, versionLine]);

  const profileName = displayName || session?.email?.split('@')[0] || '未设置';
  const inviteLabel = inviteCode || '—';

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Text style={styles.backTxt}>← 返回</Text>
        </Pressable>
        <Text style={styles.title}>设置</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionLabel}>账号</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowTitle}>我的资料</Text>
          </View>
          <View style={styles.subBlock}>
            <Text style={styles.subLine}>
              名字：<Text style={styles.subStrong}>{profileName}</Text>
            </Text>
            <Text style={styles.subLine}>
              邀请码：<Text style={styles.subStrong}>{inviteLabel}</Text>
            </Text>
          </View>
          <View style={styles.divider} />
          <Pressable
            style={styles.rowPress}
            onPress={() => router.push('/(tabs)/settings' as Href)}
            android_ripple={{ color: 'rgba(255,255,255,0.06)' }}
          >
            <Text style={styles.rowTitle}>我的档案</Text>
            <Text style={styles.chev}>›</Text>
          </Pressable>
          <Text style={styles.rowHint}>差点、身高、挥速等</Text>
        </View>

        <Text style={styles.sectionLabel}>通知</Text>
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.rowTitle}>每日训练提醒</Text>
              <Pressable
                onPress={() => training.enabled && setTimeOpen(true)}
                disabled={!training.enabled}
              >
                <Text style={[styles.timeLink, !training.enabled && { opacity: 0.45 }]}>
                  提醒时间 {String(training.hour).padStart(2, '0')}:
                  {String(training.minute).padStart(2, '0')}（点击修改）
                </Text>
              </Pressable>
            </View>
            <Switch
              value={training.enabled}
              onValueChange={(v) => void persistTraining({ ...training, enabled: v })}
              trackColor={{ false: 'rgba(255,255,255,0.15)', true: 'rgba(201,255,74,0.5)' }}
              thumbColor={training.enabled ? '#c9ff4a' : '#ffffff'}
              ios_backgroundColor="rgba(255,255,255,0.15)"
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.rowBetween}>
            <Text style={styles.rowTitle}>好友通知</Text>
            <Switch
              value={notifPrefs.friendEnabled}
              onValueChange={(v) => void persistNotif({ ...notifPrefs, friendEnabled: v })}
              trackColor={{ false: 'rgba(255,255,255,0.15)', true: 'rgba(201,255,74,0.5)' }}
              thumbColor={notifPrefs.friendEnabled ? '#c9ff4a' : '#ffffff'}
              ios_backgroundColor="rgba(255,255,255,0.15)"
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.rowBetween}>
            <Text style={styles.rowTitle}>差点更新通知</Text>
            <Switch
              value={notifPrefs.handicapUpdateEnabled}
              onValueChange={(v) => void persistNotif({ ...notifPrefs, handicapUpdateEnabled: v })}
              trackColor={{ false: 'rgba(255,255,255,0.15)', true: 'rgba(201,255,74,0.5)' }}
              thumbColor={notifPrefs.handicapUpdateEnabled ? '#c9ff4a' : '#ffffff'}
              ios_backgroundColor="rgba(255,255,255,0.15)"
            />
          </View>
        </View>

        <Text style={styles.sectionLabel}>数据</Text>
        <View style={styles.card}>
          <Pressable style={styles.rowPress} onPress={() => void onExport()}>
            <Text style={styles.rowTitle}>导出数据</Text>
            <Text style={styles.chev}>›</Text>
          </Pressable>
          <Text style={styles.rowHint}>生成 JSON，含成绩、差点历史、训练计划</Text>
          <View style={styles.divider} />
          <Pressable style={styles.rowPress} onPress={onClearCache}>
            <Text style={styles.rowTitle}>清除缓存</Text>
            <Text style={styles.chev}>›</Text>
          </Pressable>
          <View style={styles.divider} />
          <Pressable
            style={[styles.rowPress, styles.mockClearRow]}
            onPress={onClearMockHandicapData}
            android_ripple={{ color: 'rgba(217,72,72,0.12)' }}
          >
            <Text style={styles.mockClearTxt}>清除测试数据</Text>
            <Text style={styles.chevMuted}>›</Text>
          </Pressable>
          <Text style={styles.rowHint}>
            删除带模拟标记的记录，或名称含「模拟」、mock、test 的旧数据（不误删真实成绩）
          </Text>
        </View>

        <Text style={styles.sectionLabel}>关于</Text>
        <View style={styles.aboutCard}>
          <Pressable style={styles.aboutRow} onPress={() => router.push('/legal/privacy' as Href)}>
            <Text style={styles.rowTitle}>隐私政策</Text>
            <Text style={styles.chev}>›</Text>
          </Pressable>
          <View style={styles.aboutDivider} />
          <Pressable style={styles.aboutRow} onPress={() => router.push('/legal/terms' as Href)}>
            <Text style={styles.rowTitle}>用户协议</Text>
            <Text style={styles.chev}>›</Text>
          </Pressable>
          <View style={styles.aboutDivider} />
          <View style={styles.aboutRow}>
            <Text style={styles.rowTitle}>版本号</Text>
            <Text style={styles.versionRight}>{versionLine}</Text>
          </View>
          <View style={styles.aboutDivider} />
          <Pressable style={styles.aboutRow} onPress={openFeedback}>
            <Text style={styles.rowTitle}>提交反馈</Text>
            <Text style={styles.chev}>›</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>账号与安全</Text>
        <View style={[styles.card, styles.dangerCard]}>
          <Pressable style={styles.rowPress} onPress={onLogout}>
            <Text style={styles.dangerTxt}>退出登录</Text>
          </Pressable>
          <View style={styles.dividerDanger} />
          <Pressable style={styles.rowPress} onPress={onDeleteAccount}>
            <Text style={styles.dangerTxt}>删除账号与全部数据</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal
        visible={timeOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setTimeOpen(false)}
      >
        <Pressable style={styles.modalMask} onPress={() => setTimeOpen(false)}>
          <Pressable style={styles.modalBox} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>选择提醒时间</Text>
            <View style={styles.pickerRow}>
              <ScrollView style={styles.pickerCol}>
                {Array.from({ length: 24 }, (_, h) => (
                  <Pressable
                    key={h}
                    style={[styles.pickerCell, training.hour === h && styles.pickerCellOn]}
                    onPress={() => void persistTraining({ ...training, hour: h })}
                  >
                    <Text style={[styles.pickerTxt, training.hour === h && styles.pickerTxtOn]}>
                      {String(h).padStart(2, '0')}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Text style={styles.pickerSep}>:</Text>
              <ScrollView style={styles.pickerCol}>
                {MINUTE_OPTIONS.map((m) => (
                  <Pressable
                    key={m}
                    style={[styles.pickerCell, training.minute === m && styles.pickerCellOn]}
                    onPress={() => void persistTraining({ ...training, minute: m })}
                  >
                    <Text style={[styles.pickerTxt, training.minute === m && styles.pickerTxtOn]}>
                      {String(m).padStart(2, '0')}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
            <Pressable style={styles.modalDone} onPress={() => setTimeOpen(false)}>
              <Text style={styles.modalDoneTxt}>完成</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {toast ? (
        <View style={styles.toastWrap} pointerEvents="none">
          <View style={styles.toastInner}>
            <Text style={styles.toastTxt}>{toast}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PAGE_BG },
  header: { paddingHorizontal: 16, paddingBottom: 8 },
  backBtn: { alignSelf: 'flex-start', paddingVertical: 6 },
  backTxt: { color: TEXT_SEC, fontSize: 15 },
  title: { marginTop: 4, fontSize: 22, fontWeight: '800', color: HEADER_TITLE },
  scroll: { flex: 1 },
  sectionLabel: {
    marginTop: 20,
    marginBottom: 8,
    marginHorizontal: 16,
    fontSize: 12,
    fontWeight: '700',
    color: TEXT_MUTED,
    letterSpacing: 0.5,
  },
  card: {
    marginHorizontal: 16,
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    overflow: 'hidden',
  },
  row: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  rowTitle: { fontSize: 16, fontWeight: '700', color: TEXT_MAIN },
  rowHint: {
    fontSize: 12,
    color: TEXT_MUTED,
    paddingHorizontal: 16,
    paddingBottom: 12,
    marginTop: -4,
  },
  subBlock: { paddingHorizontal: 16, paddingBottom: 12 },
  subLine: { fontSize: 13, color: TEXT_SEC, marginTop: 6, lineHeight: 20 },
  subStrong: { fontWeight: '700', color: TEXT_MAIN },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: BORDER, marginLeft: 16 },
  rowPress: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  chev: { fontSize: 22, color: TEXT_MUTED, fontWeight: '300' },
  chevMuted: { fontSize: 22, color: 'rgba(217,72,72,0.45)', fontWeight: '300' },
  mockClearRow: { backgroundColor: MOCK_CLEAR_BG },
  mockClearTxt: { fontSize: 16, fontWeight: '700', color: DANGER_TEXT },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  timeLink: { marginTop: 6, fontSize: 13, color: '#c9ff4a', fontWeight: '600' },
  aboutCard: {
    marginHorizontal: 16,
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    overflow: 'hidden',
  },
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  aboutDivider: { height: StyleSheet.hairlineWidth, backgroundColor: BORDER },
  versionRight: { fontSize: 14, color: TEXT_SEC, fontWeight: '600' },
  dangerCard: {
    backgroundColor: DANGER_BG,
    borderColor: 'rgba(217,72,72,0.2)',
  },
  dividerDanger: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(217,72,72,0.15)',
    marginLeft: 16,
  },
  dangerTxt: { fontSize: 16, fontWeight: '700', color: DANGER_TEXT },
  modalMask: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalBox: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: TEXT_MAIN,
    marginBottom: 12,
    textAlign: 'center',
  },
  pickerRow: { flexDirection: 'row', alignItems: 'stretch', justifyContent: 'center', height: 220 },
  pickerCol: { width: 72, maxHeight: 220 },
  pickerSep: {
    fontSize: 22,
    fontWeight: '800',
    color: TEXT_MAIN,
    alignSelf: 'center',
    marginHorizontal: 6,
  },
  pickerCell: {
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    marginBottom: 4,
  },
  pickerCellOn: { backgroundColor: 'rgba(181,255,58,0.12)' },
  pickerTxt: { fontSize: 16, color: TEXT_SEC },
  pickerTxtOn: { color: '#b5ff3a', fontWeight: '800' },
  modalDone: {
    marginTop: 12,
    backgroundColor: 'rgba(181,255,58,0.15)',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalDoneTxt: { fontSize: 15, fontWeight: '800', color: '#b5ff3a' },
  toastWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 48,
  },
  toastInner: {
    backgroundColor: 'rgba(22,38,28,0.95)',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
  },
  toastTxt: { color: TEXT_MAIN, fontSize: 14, fontWeight: '600' },
});
