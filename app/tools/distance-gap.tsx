import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

const GREEN = '#166534';
const BG = '#f3f4f6';
const WHITE = '#ffffff';
const BORDER = '#e5e7eb';
const TEXT_PRIMARY = '#111827';
const TEXT_SECONDARY = '#6b7280';
const ORANGE = '#d97706';
const RED = '#dc2626';
const LIGHT_GREEN = '#dcfce7';

const STORAGE_KEY = 'distanceGapClubs';
const DEFAULT_CLUBS = ['一号木', '3木', '5木', '4铁', '5铁', '6铁', '7铁', '8铁', '9铁', 'PW', 'GW', 'SW'];

type GapStatus = 'normal' | 'large' | 'small';
type GapResult = {
  fromClub: string;
  fromDistance: number;
  toClub: string;
  toDistance: number;
  diff: number;
  status: GapStatus;
};

export default function DistanceGapScreen() {
  const router = useRouter();
  const [clubs, setClubs] = useState<string[]>(DEFAULT_CLUBS);
  const [distances, setDistances] = useState<Record<string, string>>({});
  const [results, setResults] = useState<GapResult[]>([]);
  const [checked, setChecked] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newClubName, setNewClubName] = useState('');
  const [addClubError, setAddClubError] = useState('');

  useEffect(() => {
    if (typeof globalThis.localStorage === 'undefined') return;
    const raw = globalThis.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const sanitized = parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
        if (sanitized.length) setClubs(sanitized);
      }
    } catch {
      // Ignore broken localStorage data and keep defaults.
    }
  }, []);

  useEffect(() => {
    if (typeof globalThis.localStorage === 'undefined') return;
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(clubs));
  }, [clubs]);

  useEffect(() => {
    setChecked(false);
    setResults([]);
  }, [clubs]);

  function updateDistance(club: string, value: string) {
    setDistances((prev) => ({ ...prev, [club]: value }));
  }

  function onCheckGaps() {
    const filled = clubs.map((club) => {
      const raw = distances[club]?.trim() ?? '';
      const value = Number(raw);
      return Number.isFinite(value) && value > 0 ? { club, value } : null;
    }).filter((item): item is { club: string; value: number } => Boolean(item));

    const next: GapResult[] = [];
    for (let i = 0; i < filled.length - 1; i += 1) {
      const from = filled[i];
      const to = filled[i + 1];
      const diff = Math.abs(from.value - to.value);
      let status: GapStatus = 'normal';
      if (diff > 20) status = 'large';
      else if (diff < 8) status = 'small';
      next.push({
        fromClub: from.club,
        fromDistance: from.value,
        toClub: to.club,
        toDistance: to.value,
        diff,
        status,
      });
    }

    setResults(next);
    setChecked(true);
  }

  function moveClub(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= clubs.length) return;
    setClubs((prev) => {
      const next = [...prev];
      const current = next[index];
      next[index] = next[nextIndex];
      next[nextIndex] = current;
      return next;
    });
  }

  function removeClub(index: number) {
    const club = clubs[index];
    if (!club) return;

    const doRemove = () => setClubs((prev) => prev.filter((_, i) => i !== index));
    if (Platform.OS === 'web' && typeof globalThis.confirm === 'function') {
      if (globalThis.confirm(`确认删除球杆「${club}」吗？`)) doRemove();
      return;
    }

    Alert.alert('删除球杆', `确认删除球杆「${club}」吗？`, [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: doRemove },
    ]);
  }

  function addClub() {
    const name = newClubName.trim();
    if (!name) {
      setAddClubError('请先输入球杆名称');
      return;
    }
    const exists = clubs.some((club) => club.trim().toLowerCase() === name.toLowerCase());
    if (exists) {
      setAddClubError('该球杆名称已存在，请换一个');
      return;
    }
    setClubs((prev) => [...prev, name]);
    setNewClubName('');
    setAddClubError('');
    setShowAddModal(false);
  }

  const summary = useMemo(() => {
    const total = results.length;
    const normal = results.filter((item) => item.status === 'normal').length;
    const warn = total - normal;
    return { total, normal, warn };
  }, [results]);

  function statusText(status: GapStatus) {
    if (status === 'normal') return '✓ 正常';
    if (status === 'large') return '⚠️ 偏大，考虑增加球杆';
    return '⚠️ 太近，可能重复';
  }

  function statusColor(status: GapStatus) {
    if (status === 'normal') return GREEN;
    if (status === 'large') return ORANGE;
    return RED;
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} bounces={false}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backTxt}>← 返回</Text>
        </Pressable>
        <View style={styles.headerRow}>
          <Text style={styles.title}>距离间距检查</Text>
          <Pressable style={styles.editBtn} onPress={() => setIsEditing((prev) => !prev)}>
            <Text style={styles.editBtnText}>{isEditing ? '完成' : '编辑'}</Text>
          </Pressable>
        </View>
        <Text style={styles.desc}>输入你每支球杆的平均落点距离（码），理想间距为每支相差 10-15 码</Text>

        <View style={styles.card}>
          {clubs.map((club, index) => (
            <View key={`${club}-${index}`} style={styles.row}>
              <Text style={styles.clubName}>{club}</Text>
              {isEditing ? (
                <View style={styles.actions}>
                  <Pressable style={styles.orderBtn} onPress={() => moveClub(index, -1)}>
                    <Text style={styles.orderBtnText}>↑</Text>
                  </Pressable>
                  <Pressable style={styles.orderBtn} onPress={() => moveClub(index, 1)}>
                    <Text style={styles.orderBtnText}>↓</Text>
                  </Pressable>
                  <Pressable style={styles.deleteBtn} onPress={() => removeClub(index)}>
                    <Text style={styles.deleteBtnText}>❌</Text>
                  </Pressable>
                </View>
              ) : (
                <TextInput
                  value={distances[club] ?? ''}
                  onChangeText={(value) => updateDistance(club, value)}
                  style={styles.input}
                  keyboardType="number-pad"
                  placeholder="—"
                  placeholderTextColor={TEXT_SECONDARY}
                />
              )}
            </View>
          ))}
          {isEditing ? (
            <Pressable
              style={styles.addBtn}
              onPress={() => {
                setAddClubError('');
                setNewClubName('');
                setShowAddModal(true);
              }}
            >
              <Text style={styles.addBtnText}>＋ 添加球杆</Text>
            </Pressable>
          ) : null}
        </View>

        {checked ? (
          <View style={styles.card}>
            <Text style={styles.resultTitle}>检查结果</Text>
            {results.length ? (
              <>
                {results.map((item, idx) => (
                  <Text key={`${item.fromClub}-${item.toClub}-${idx}`} style={[styles.resultLine, { color: statusColor(item.status) }]}>
                    {item.fromClub}({item.fromDistance}) → {item.toClub}({item.toDistance}) 差距：{item.diff}码 {statusText(item.status)}
                  </Text>
                ))}
                <Text style={styles.summary}>
                  共检查 {summary.total} 个间距，{summary.normal} 个正常，{summary.warn} 个需注意
                </Text>
              </>
            ) : (
              <Text style={styles.empty}>请至少输入两支球杆的距离再检查。</Text>
            )}
          </View>
        ) : null}
      </ScrollView>

      {!isEditing ? (
        <View style={styles.footer}>
          <Pressable style={styles.checkBtn} onPress={onCheckGaps}>
            <Text style={styles.checkBtnText}>检查间距</Text>
          </Pressable>
        </View>
      ) : null}

      <Modal transparent visible={showAddModal} animationType="fade" onRequestClose={() => setShowAddModal(false)}>
        <View style={styles.modalMask}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>添加球杆</Text>
            <TextInput
              value={newClubName}
              onChangeText={setNewClubName}
              style={styles.modalInput}
              placeholder="例如 4W / LW / 52°"
              placeholderTextColor={TEXT_SECONDARY}
              autoFocus
            />
            {addClubError ? <Text style={styles.modalError}>{addClubError}</Text> : null}
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => {
                  setShowAddModal(false);
                  setAddClubError('');
                }}
              >
                <Text style={styles.modalCancelText}>取消</Text>
              </Pressable>
              <Pressable style={styles.modalConfirmBtn} onPress={addClub}>
                <Text style={styles.modalConfirmText}>确认</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  flex: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'web' ? 44 : 16,
    paddingBottom: 96,
  },
  backBtn: { marginBottom: 8, alignSelf: 'flex-start' },
  backTxt: { color: GREEN, fontWeight: '600' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '700', color: TEXT_PRIMARY, marginBottom: 8 },
  editBtn: {
    borderWidth: 0.5,
    borderColor: GREEN,
    backgroundColor: LIGHT_GREEN,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  editBtnText: { color: GREEN, fontSize: 13, fontWeight: '700' },
  desc: { fontSize: 13, color: TEXT_SECONDARY, lineHeight: 20, marginBottom: 12 },
  card: {
    backgroundColor: WHITE,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: BORDER,
    padding: 12,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  clubName: { fontSize: 14, color: TEXT_PRIMARY, fontWeight: '600' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  orderBtn: {
    borderWidth: 0.5,
    borderColor: BORDER,
    borderRadius: 8,
    backgroundColor: WHITE,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderBtnText: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '700' },
  deleteBtn: {
    borderWidth: 0.5,
    borderColor: BORDER,
    borderRadius: 8,
    backgroundColor: WHITE,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: { color: RED, fontSize: 13 },
  input: {
    width: 96,
    borderWidth: 0.5,
    borderColor: BORDER,
    borderRadius: 10,
    backgroundColor: WHITE,
    color: TEXT_PRIMARY,
    fontSize: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    textAlign: 'center',
  },
  addBtn: {
    marginTop: 2,
    borderWidth: 0.5,
    borderColor: GREEN,
    borderRadius: 10,
    backgroundColor: LIGHT_GREEN,
    alignItems: 'center',
    paddingVertical: 10,
  },
  addBtnText: { color: GREEN, fontSize: 14, fontWeight: '700' },
  resultTitle: { fontSize: 16, color: TEXT_PRIMARY, fontWeight: '700', marginBottom: 8 },
  resultLine: { fontSize: 13, lineHeight: 20, marginBottom: 6 },
  summary: { marginTop: 8, fontSize: 13, color: TEXT_PRIMARY, fontWeight: '700' },
  empty: { fontSize: 13, color: TEXT_SECONDARY },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: WHITE,
    borderTopWidth: 0.5,
    borderTopColor: BORDER,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  checkBtn: {
    backgroundColor: GREEN,
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 13,
  },
  checkBtnText: { color: WHITE, fontSize: 16, fontWeight: '700' },
  modalMask: {
    flex: 1,
    backgroundColor: 'rgba(17,24,39,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: WHITE,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: BORDER,
    padding: 14,
  },
  modalTitle: { fontSize: 16, color: TEXT_PRIMARY, fontWeight: '700', marginBottom: 10 },
  modalInput: {
    borderWidth: 0.5,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    color: TEXT_PRIMARY,
    fontSize: 14,
    marginBottom: 12,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  modalError: { color: RED, fontSize: 12, marginTop: -4, marginBottom: 10 },
  modalCancelBtn: {
    borderWidth: 0.5,
    borderColor: BORDER,
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: WHITE,
  },
  modalCancelText: { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '600' },
  modalConfirmBtn: {
    borderWidth: 0.5,
    borderColor: GREEN,
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: LIGHT_GREEN,
  },
  modalConfirmText: { color: GREEN, fontSize: 13, fontWeight: '700' },
});
