import { useCallback } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import type { TrainingCategory, TrainingItem } from '@/utils/trainingPlan';
import { itemCheckedInToday, weekCheckInCountForItem, weekDotsState } from '@/utils/trainingPlan';

const CARD = '#16261c';
const ACCENT = '#b5ff3a';
const TEXT_MAIN = '#e8f0e5';
const MUTED = '#5a6b5f';
const BTN_BG = '#2d5436';

const CAT_STYLES: Record<
  TrainingCategory,
  { label: string; color: string; bg: string }
> = {
  putt: { label: '推杆', color: '#3ac5a8', bg: 'rgba(58,197,168,0.12)' },
  short: { label: '短杆', color: '#e89b3a', bg: 'rgba(232,155,58,0.12)' },
  long: { label: '长杆', color: '#e5c53a', bg: 'rgba(229,197,58,0.12)' },
  strategy: { label: '策略', color: '#b5ff3a', bg: 'rgba(181,255,58,0.12)' },
};

export type TrainingPlanCardProps = {
  item: TrainingItem;
  roundMeta?: { dateLabel: string; courseName: string } | null;
  onCheckIn: (id: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
};

export function TrainingPlanCard({ item, roundMeta, onCheckIn, onArchive, onDelete }: TrainingPlanCardProps) {
  const cat = CAT_STYLES[item.category];
  const weekCount = weekCheckInCountForItem(item);
  const dots = weekDotsState(item);
  const doneToday = itemCheckedInToday(item);

  const showMenu = useCallback(() => {
    const archive = () => onArchive(item.id);
    const del = () => {
      if (Platform.OS === 'web' && typeof globalThis.confirm === 'function') {
        if (globalThis.confirm('确定删除该训练项？')) onDelete(item.id);
        return;
      }
      Alert.alert('删除训练', '确定删除该训练项？', [
        { text: '取消', style: 'cancel' },
        { text: '删除', style: 'destructive', onPress: () => onDelete(item.id) },
      ]);
    };
    Alert.alert('操作', undefined, [
      { text: '归档', onPress: archive },
      { text: '删除', style: 'destructive', onPress: del },
      { text: '取消', style: 'cancel' },
    ]);
  }, [item.id, onArchive, onDelete]);

  const sourceLabel = item.source === 'ai' ? 'AI 复盘' : '手动添加';

  return (
    <Pressable style={styles.card} onLongPress={showMenu} delayLongPress={450}>
      <View style={styles.topRow}>
        <View style={[styles.catChip, { backgroundColor: cat.bg }]}>
          <Text style={[styles.catChipTxt, { color: cat.color }]}>{cat.label}</Text>
        </View>
        <Text style={styles.sourceLab}>{sourceLabel}</Text>
      </View>
      <Text style={styles.content} numberOfLines={2}>
        {item.content}
      </Text>
      {roundMeta ? (
        <Text style={styles.roundLine} numberOfLines={1}>
          来自 {roundMeta.dateLabel} {roundMeta.courseName}
        </Text>
      ) : null}
      <View style={styles.bottomRow}>
        <View style={styles.weekCol}>
          <Text style={styles.weekLab}>
            本周 {weekCount} / 7 天
          </Text>
          <View style={styles.dotsRow}>
            {dots.map((on, i) => (
              <View key={i} style={[styles.dot, on ? styles.dotOn : styles.dotOff]} />
            ))}
          </View>
        </View>
        {doneToday ? (
          <Text style={styles.doneTxt}>已打卡</Text>
        ) : (
          <Pressable style={styles.checkBtn} onPress={() => onCheckIn(item.id)} hitSlop={6}>
            <Text style={styles.checkBtnTxt}>✓ 今日打卡</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  catChip: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  catChipTxt: { fontSize: 11, fontWeight: '700' },
  sourceLab: { fontSize: 11, fontWeight: '600', color: MUTED },
  content: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_MAIN,
    lineHeight: 20,
  },
  roundLine: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '500',
    color: MUTED,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 10,
  },
  weekCol: { flex: 1, minWidth: 0 },
  weekLab: { fontSize: 11, fontWeight: '600', color: MUTED, marginBottom: 6 },
  dotsRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotOn: { backgroundColor: ACCENT },
  dotOff: { backgroundColor: 'rgba(255,255,255,0.1)' },
  checkBtn: {
    backgroundColor: BTN_BG,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  checkBtnTxt: { fontSize: 13, fontWeight: '700', color: ACCENT },
  doneTxt: { fontSize: 13, fontWeight: '600', color: MUTED },
});
