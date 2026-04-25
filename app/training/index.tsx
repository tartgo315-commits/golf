import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { TrainingPlanCard } from '@/components/TrainingPlanCard';
import { loadHandicapRecords, type HandicapRecord } from '@/lib/handicap';
import type { TrainingCategory, TrainingItem } from '@/utils/trainingPlan';
import {
  loadTrainingReminderSettings,
  saveTrainingReminderSettings,
} from '@/utils/pushNotification';
import {
  addTrainingItem,
  archiveTrainingItem,
  checkInTrainingItem,
  deleteTrainingItem,
  getTrainingItems,
  getTrainingStats,
} from '@/utils/trainingPlan';

const PAGE_BG = '#0d1b11';
const CARD = '#16261c';
const ACCENT = '#b5ff3a';
const WHITE = '#ffffff';
const SUB = '#8a9a8e';
const MUTED = '#5a6b5f';
const TAB_BORDER = 'rgba(255,255,255,0.06)';
const OUTLINE = '#2d5436';
const INPUT_BG = 'rgba(255,255,255,0.05)';
const INPUT_BORDER = 'rgba(255,255,255,0.08)';

type TabId = 'all' | 'putt' | 'short' | 'long';

const TABS: { id: TabId; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'putt', label: '推杆' },
  { id: 'short', label: '短杆' },
  { id: 'long', label: '长杆' },
];

function formatRoundDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  if (!Number.isFinite(d.getTime())) return dateStr;
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function FlameIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 22c4.5 0 8-3 8-7.5 0-3.2-1.6-5.6-3.5-7.2-.3 2.1-1.5 3.6-3 4.2.2-1.4.1-3.1-.8-4.8C10.5 4 9 2 9 2S7 5 7 8.5C7 10 7.5 11.2 8.3 12 6.5 11 5 9 5 7c0 3.5 2.5 6.5 6 7.5.8.2 1 .8 1 1.5z"
        stroke="#e89b3a"
        strokeWidth={1.3}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function TrainingPlanScreen() {
  const router = useRouter();
  const [items, setItems] = useState<TrainingItem[]>([]);
  const [handicapRecords, setHandicapRecords] = useState<HandicapRecord[]>([]);
  const [stats, setStats] = useState({ totalItems: 0, checkedInToday: 0, streakDays: 0 });
  const [tab, setTab] = useState<TabId>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [remEnabled, setRemEnabled] = useState(false);
  const [remHour, setRemHour] = useState(20);
  const [remMinute, setRemMinute] = useState(0);
  const [draftContent, setDraftContent] = useState('');
  const [draftCat, setDraftCat] = useState<TrainingCategory>('putt');

  const roundById = useMemo(() => {
    const m = new Map<string, HandicapRecord>();
    for (const r of handicapRecords) m.set(r.id, r);
    return m;
  }, [handicapRecords]);

  const reload = useCallback(async () => {
    setHandicapRecords(loadHandicapRecords());
    const [list, st] = await Promise.all([getTrainingItems(), getTrainingStats()]);
    setItems(list);
    setStats(st);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
      return () => {};
    }, [reload]),
  );

  const filtered = useMemo(() => {
    if (tab === 'all') return items;
    return items.filter((x) => x.category === tab);
  }, [items, tab]);

  const onCheckIn = useCallback(
    async (id: string) => {
      const r = await checkInTrainingItem(id);
      if (r.ok) void reload();
    },
    [reload],
  );

  const onArchive = useCallback(
    async (id: string) => {
      await archiveTrainingItem(id);
      void reload();
    },
    [reload],
  );

  const onDelete = useCallback(
    async (id: string) => {
      await deleteTrainingItem(id);
      void reload();
    },
    [reload],
  );

  const openAdd = useCallback(() => {
    setDraftContent('');
    setDraftCat('putt');
    setModalOpen(true);
  }, []);

  const openSettings = useCallback(async () => {
    const s = await loadTrainingReminderSettings();
    setRemEnabled(s.enabled);
    setRemHour(s.hour);
    setRemMinute(s.minute);
    setSettingsOpen(true);
  }, []);

  const saveReminderSettings = useCallback(async () => {
    await saveTrainingReminderSettings({ enabled: remEnabled, hour: remHour, minute: remMinute });
    setSettingsOpen(false);
  }, [remEnabled, remHour, remMinute]);

  const submitManual = useCallback(async () => {
    const res = await addTrainingItem({
      source: 'manual',
      category: draftCat,
      content: draftContent,
    });
    if (!res.ok) {
      Alert.alert('提示', res.message);
      return;
    }
    setModalOpen(false);
    void reload();
  }, [draftCat, draftContent, reload]);

  const manualCats: { id: TrainingCategory; label: string }[] = [
    { id: 'putt', label: '推杆' },
    { id: 'short', label: '短杆' },
    { id: 'long', label: '长杆' },
    { id: 'strategy', label: '策略' },
  ];

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={10}
          accessibilityRole="button"
        >
          <Text style={styles.backTxt}>← 返回</Text>
        </Pressable>
        <View style={styles.headerMid}>
          <Text style={styles.title}>训练计划</Text>
          <Text style={styles.subtitle}>练习追踪</Text>
        </View>
        <View style={styles.headerRight}>
          <Pressable
            style={styles.gearBtn}
            onPress={() => void openSettings()}
            accessibilityRole="button"
            accessibilityLabel="提醒设置"
          >
            <Text style={styles.gearTxt}>⚙</Text>
          </Pressable>
          <Pressable
            onPress={openAdd}
            style={styles.addOutline}
            accessibilityRole="button"
            accessibilityLabel="添加训练"
          >
            <Text style={styles.addOutlineTxt}>+ 添加</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.statsCard}>
          <View style={styles.statsRow}>
            <View style={styles.statCol}>
              <Text style={styles.statNum}>{stats.checkedInToday}</Text>
              <Text style={styles.statLab}>今日打卡</Text>
            </View>
            <View style={styles.statCol}>
              <View style={styles.statNumRow}>
                <Text style={styles.statNum}>{stats.totalItems}</Text>
                <Text style={styles.statUnit}>项</Text>
              </View>
              <Text style={styles.statLab}>总计</Text>
            </View>
            <View style={[styles.statCol, styles.statColLast]}>
              <View style={styles.streakWrap}>
                <View style={styles.statNumRow}>
                  <Text style={styles.statNum}>{stats.streakDays}</Text>
                  <Text style={styles.statUnit}>天</Text>
                </View>
                {stats.streakDays > 0 ? <FlameIcon /> : null}
              </View>
              <Text style={styles.statLab}>连续</Text>
            </View>
          </View>
        </View>

        <View style={styles.tabBarWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={styles.tabScroll}
          >
            {TABS.map((t) => {
              const selected = tab === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => setTab(t.id)}
                  style={styles.tabItem}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.tabItemTxt, selected && styles.tabItemTxtSelected]}>
                    {t.label}
                  </Text>
                  {selected ? <View style={styles.tabUnderline} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTxt}>还没有训练计划{'\n'}AI 复盘后可一键保存建议</Text>
          </View>
        ) : (
          filtered.map((it) => {
            const rec = it.roundId ? roundById.get(it.roundId) : undefined;
            const roundMeta =
              rec && it.source === 'ai'
                ? {
                    dateLabel: formatRoundDateLabel(rec.date),
                    courseName: rec.courseName.trim() || '—',
                  }
                : null;
            return (
              <TrainingPlanCard
                key={it.id}
                item={it}
                roundMeta={roundMeta}
                onCheckIn={onCheckIn}
                onArchive={onArchive}
                onDelete={onDelete}
              />
            );
          })
        )}
      </ScrollView>

      <Modal
        visible={settingsOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSettingsOpen(false)}
      >
        <Pressable style={styles.settingsMask} onPress={() => setSettingsOpen(false)}>
          <Pressable style={styles.settingsSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.settingsTitle}>每日训练提醒</Text>
            <View style={styles.switchRow}>
              <Text style={styles.switchTitle}>开启每日提醒</Text>
              <Pressable
                style={[styles.switchTrack, remEnabled && styles.switchTrackOn]}
                onPress={() => setRemEnabled((v) => !v)}
                accessibilityRole="switch"
                accessibilityState={{ checked: remEnabled }}
              >
                <View
                  style={[
                    styles.switchKnob,
                    {
                      marginLeft: remEnabled ? 20 : 0,
                      backgroundColor: remEnabled ? ACCENT : MUTED,
                    },
                  ]}
                />
              </Pressable>
            </View>
            <Text style={styles.settingsLab}>提醒时间</Text>
            <View style={styles.wheelRowOuter}>
              <ScrollView
                style={styles.wheel}
                contentContainerStyle={styles.wheelContent}
                showsVerticalScrollIndicator={false}
                snapToInterval={36}
                decelerationRate="fast"
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <Pressable key={h} style={styles.wheelCell} onPress={() => setRemHour(h)}>
                    <Text style={[styles.wheelTxt, remHour === h && styles.wheelTxtOn]}>
                      {String(h).padStart(2, '0')}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Text style={styles.wheelColon}>:</Text>
              <ScrollView
                style={styles.wheel}
                contentContainerStyle={styles.wheelContent}
                showsVerticalScrollIndicator={false}
                snapToInterval={36}
                decelerationRate="fast"
              >
                {Array.from({ length: 60 }, (_, m) => (
                  <Pressable key={m} style={styles.wheelCell} onPress={() => setRemMinute(m)}>
                    <Text style={[styles.wheelTxt, remMinute === m && styles.wheelTxtOn]}>
                      {String(m).padStart(2, '0')}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
            <View style={styles.settingsActions}>
              <Pressable style={styles.modalCancel} onPress={() => setSettingsOpen(false)}>
                <Text style={styles.modalCancelTxt}>取消</Text>
              </Pressable>
              <Pressable style={styles.modalOk} onPress={() => void saveReminderSettings()}>
                <Text style={styles.modalOkTxt}>保存</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={modalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setModalOpen(false)}
      >
        <Pressable style={styles.modalMask} onPress={() => setModalOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>添加训练</Text>
            <Text style={styles.modalLab}>训练内容</Text>
            <TextInput
              style={styles.modalInput}
              value={draftContent}
              onChangeText={setDraftContent}
              placeholder="输入练习要点…"
              placeholderTextColor={MUTED}
              multiline
              textAlignVertical="top"
            />
            <Text style={styles.modalLab}>分类</Text>
            <View style={styles.chipRow}>
              {manualCats.map((c) => {
                const on = draftCat === c.id;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => setDraftCat(c.id)}
                    style={[styles.chip, on && styles.chipOn]}
                  >
                    <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{c.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={() => setModalOpen(false)}>
                <Text style={styles.modalCancelTxt}>取消</Text>
              </Pressable>
              <Pressable style={styles.modalOk} onPress={() => void submitManual()}>
                <Text style={styles.modalOkTxt}>确认添加</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PAGE_BG },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'web' ? 44 : 16,
    paddingBottom: 12,
    gap: 8,
  },
  backBtn: { paddingVertical: 4, minWidth: 56 },
  backTxt: { fontSize: 14, fontWeight: '600', color: SUB },
  headerMid: { flex: 1, minWidth: 0, alignItems: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  gearBtn: { paddingVertical: 8, paddingHorizontal: 8, marginTop: 2 },
  gearTxt: { fontSize: 18, fontWeight: '700', color: SUB },
  title: { fontSize: 22, fontWeight: '800', color: WHITE, textAlign: 'center' },
  subtitle: { marginTop: 4, fontSize: 12, fontWeight: '500', color: SUB, textAlign: 'center' },
  addOutline: {
    borderWidth: 1,
    borderColor: OUTLINE,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  addOutlineTxt: { fontSize: 12, fontWeight: '700', color: ACCENT },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 28 },
  statsCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  statsRow: { flexDirection: 'row', alignItems: 'stretch' },
  statCol: { flex: 1, alignItems: 'center' },
  statColLast: { flexDirection: 'column' },
  streakWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  statNumRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 2 },
  statNum: { fontSize: 24, fontWeight: '800', color: ACCENT },
  statUnit: { fontSize: 12, fontWeight: '700', color: ACCENT, marginBottom: 2 },
  statLab: { marginTop: 6, fontSize: 10, fontWeight: '600', color: MUTED },
  tabBarWrap: {
    height: 44,
    borderBottomWidth: 1,
    borderBottomColor: TAB_BORDER,
    marginBottom: 12,
  },
  tabScroll: { paddingHorizontal: 4, alignItems: 'center', minHeight: 44 },
  tabItem: {
    position: 'relative',
    minWidth: 56,
    height: 44,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabItemTxt: { fontSize: 14, fontWeight: '600', color: SUB },
  tabItemTxtSelected: { fontWeight: '700', color: ACCENT },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 10,
    right: 10,
    height: 2,
    borderRadius: 1,
    backgroundColor: ACCENT,
  },
  emptyWrap: { paddingVertical: 48, paddingHorizontal: 24 },
  emptyTxt: { textAlign: 'center', fontSize: 14, fontWeight: '600', color: MUTED, lineHeight: 22 },
  modalMask: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(181,255,58,0.15)',
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: WHITE, marginBottom: 12 },
  modalLab: { fontSize: 12, fontWeight: '600', color: SUB, marginBottom: 8 },
  modalInput: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: INPUT_BORDER,
    borderRadius: 12,
    padding: 12,
    backgroundColor: INPUT_BG,
    color: WHITE,
    fontSize: 14,
    marginBottom: 14,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  chip: {
    borderWidth: 1,
    borderColor: INPUT_BORDER,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: 'transparent',
  },
  chipOn: { borderColor: ACCENT, backgroundColor: 'rgba(181,255,58,0.10)' },
  chipTxt: { fontSize: 12, fontWeight: '600', color: SUB },
  chipTxtOn: { fontWeight: '700', color: ACCENT },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  modalCancel: { paddingVertical: 10, paddingHorizontal: 14 },
  modalCancelTxt: { fontSize: 14, fontWeight: '600', color: MUTED },
  modalOk: {
    backgroundColor: ACCENT,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  modalOkTxt: { fontSize: 14, fontWeight: '800', color: '#0d1b11' },
  settingsMask: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  settingsSheet: {
    backgroundColor: CARD,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 28,
  },
  settingsTitle: { fontSize: 17, fontWeight: '800', color: WHITE, marginBottom: 16 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  switchTitle: { fontSize: 14, fontWeight: '600', color: WHITE },
  settingsLab: { fontSize: 13, fontWeight: '600', color: SUB, marginBottom: 10 },
  switchTrack: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    padding: 2,
    justifyContent: 'center',
  },
  switchTrackOn: { backgroundColor: 'rgba(181,255,58,0.35)' },
  switchKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  wheelRowOuter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  wheel: { height: 140, width: '38%' },
  wheelContent: { paddingVertical: 36 },
  wheelCell: { height: 36, alignItems: 'center', justifyContent: 'center' },
  wheelTxt: { fontSize: 16, fontWeight: '600', color: MUTED },
  wheelTxtOn: { fontSize: 18, fontWeight: '800', color: ACCENT },
  wheelColon: { fontSize: 20, fontWeight: '800', color: WHITE, marginBottom: 8 },
  settingsActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
});
