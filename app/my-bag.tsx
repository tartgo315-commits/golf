import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { buildEmptySpecs, loadMyClubBag, makeClubId, saveMyClubBag, type MyClubItem } from '@/lib/my-club-bag';

const GREEN = '#166534';
const BG = '#f3f4f6';
const WHITE = '#ffffff';
const BORDER = '#e5e7eb';
const TEXT_PRIMARY = '#111827';
const TEXT_SECONDARY = '#6b7280';
const RED = '#dc2626';
const LIGHT_GREEN = '#dcfce7';
const DASH_HINT = '#9ca3af';
const DOT_READY = '#16a34a';
const DOT_EMPTY = '#9ca3af';

export default function MyBagScreen() {
  const router = useRouter();
  const [clubs, setClubs] = useState<MyClubItem[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingClubId, setEditingClubId] = useState<string | null>(null);
  const [editingClubName, setEditingClubName] = useState('');
  const [renameError, setRenameError] = useState('');
  const [newClubName, setNewClubName] = useState('');
  const [addError, setAddError] = useState('');

  useEffect(() => {
    setClubs(loadMyClubBag());
  }, []);

  useEffect(() => {
    if (clubs.length) saveMyClubBag(clubs);
  }, [clubs]);

  const orderedClubs = useMemo(() => [...clubs].sort((a, b) => a.order - b.order), [clubs]);

  function reindex(items: MyClubItem[]) {
    return items.map((item, index) => ({ ...item, order: index }));
  }

  function moveClub(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= orderedClubs.length) return;
    const next = [...orderedClubs];
    const temp = next[index];
    next[index] = next[nextIndex];
    next[nextIndex] = temp;
    setClubs(reindex(next));
  }

  function removeClub(index: number) {
    setClubs(reindex(orderedClubs.filter((_, i) => i !== index)));
  }

  function startRenameClub(club: MyClubItem) {
    setRenameError('');
    setEditingClubId(club.id);
    setEditingClubName(club.name);
  }

  function commitRenameClub(club: MyClubItem) {
    const nextName = editingClubName.trim();
    if (!nextName) {
      setRenameError('球杆名称不能为空，已保留原名称');
      setEditingClubId(null);
      setEditingClubName('');
      return;
    }
    const exists = orderedClubs.some((item) => item.id !== club.id && item.name.trim().toLowerCase() === nextName.toLowerCase());
    if (exists) {
      setRenameError('球杆名称重复，已保留原名称');
      setEditingClubId(null);
      setEditingClubName('');
      return;
    }
    setClubs((prev) => prev.map((item) => (item.id === club.id ? { ...item, name: nextName } : item)));
    setRenameError('');
    setEditingClubId(null);
    setEditingClubName('');
  }

  function addClub() {
    const name = newClubName.trim();
    if (!name) {
      setAddError('请先输入球杆名称');
      return;
    }
    const exists = orderedClubs.some((item) => item.name.trim().toLowerCase() === name.toLowerCase());
    if (exists) {
      setAddError('该球杆名称已存在');
      return;
    }
    const nextItem: MyClubItem = {
      id: makeClubId(),
      name,
      order: orderedClubs.length,
      distance: null,
      specs: buildEmptySpecs(),
    };
    setClubs(reindex([...orderedClubs, nextItem]));
    setNewClubName('');
    setAddError('');
  }

  function distanceText(distance: number | null) {
    return typeof distance === 'number' ? `${distance}码` : '—';
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} bounces={false}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backTxt}>← 返回</Text>
        </Pressable>

        <View style={styles.headerRow}>
          <Text style={styles.title}>我的球杆库</Text>
          <Pressable
            style={styles.editBtn}
            onPress={() => {
              setIsEditing((prev) => !prev);
              setEditingClubId(null);
              setEditingClubName('');
              setRenameError('');
              setAddError('');
            }}
          >
            <Text style={styles.editBtnText}>{isEditing ? '完成' : '编辑'}</Text>
          </Pressable>
        </View>

        <View style={styles.topActions}>
          <Pressable style={styles.gapBtn} onPress={() => router.push('/tools/distance-gap')}>
            <Text style={styles.gapBtnText}>检查间距</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          {orderedClubs.map((club, index) => (
            <Pressable
              key={club.id}
              style={styles.row}
              onPress={() => {
                if (isEditing) return;
                router.push(`/my-bag/${club.id}`);
              }}
            >
              <View style={styles.left}>
                {isEditing ? (
                  editingClubId === club.id ? (
                    <TextInput
                      value={editingClubName}
                      onChangeText={setEditingClubName}
                      onBlur={() => commitRenameClub(club)}
                      onSubmitEditing={() => commitRenameClub(club)}
                      style={styles.clubNameInput}
                      returnKeyType="done"
                      autoFocus
                    />
                  ) : (
                    <Pressable style={styles.editableNameBtn} onPress={() => startRenameClub(club)}>
                      <Text style={styles.clubName}>{club.name}</Text>
                    </Pressable>
                  )
                ) : (
                  <Text style={styles.clubName}>{club.name}</Text>
                )}
              </View>

              <View style={styles.right}>
                <View style={styles.distanceWrap}>
                  <View style={[styles.distanceDot, typeof club.distance === 'number' ? styles.distanceDotReady : styles.distanceDotEmpty]} />
                  <Text style={[styles.distance, typeof club.distance !== 'number' && styles.distanceEmpty]}>{distanceText(club.distance)}</Text>
                </View>
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
                  <Text style={styles.arrow}>&gt;</Text>
                )}
              </View>
            </Pressable>
          ))}

          {isEditing ? (
            <>
              <View style={styles.addRow}>
                <TextInput
                  value={newClubName}
                  onChangeText={setNewClubName}
                  style={styles.addInput}
                  placeholder="输入新球杆名称，如 4W / LW / 52°"
                  placeholderTextColor={TEXT_SECONDARY}
                  onSubmitEditing={addClub}
                  returnKeyType="done"
                />
                <Pressable style={styles.addBtn} onPress={addClub}>
                  <Text style={styles.addBtnText}>+ 添加球杆</Text>
                </Pressable>
              </View>
              {addError ? <Text style={styles.errorText}>{addError}</Text> : null}
            </>
          ) : null}

          {isEditing && renameError ? <Text style={styles.errorText}>{renameError}</Text> : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  flex: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'web' ? 44 : 16,
    paddingBottom: 20,
  },
  backBtn: { marginBottom: 8, alignSelf: 'flex-start' },
  backTxt: { color: GREEN, fontWeight: '600' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8 },
  title: { fontSize: 22, fontWeight: '700', color: TEXT_PRIMARY },
  editBtn: {
    borderWidth: 0.5,
    borderColor: GREEN,
    backgroundColor: LIGHT_GREEN,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  editBtnText: { color: GREEN, fontSize: 13, fontWeight: '700' },
  topActions: { marginBottom: 10 },
  gapBtn: {
    alignSelf: 'flex-start',
    borderWidth: 0.5,
    borderColor: GREEN,
    borderRadius: 10,
    backgroundColor: WHITE,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  gapBtnText: { color: GREEN, fontSize: 13, fontWeight: '700' },
  card: {
    backgroundColor: WHITE,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: BORDER,
    padding: 12,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 0.5,
    borderBottomColor: BG,
    paddingVertical: 10,
    gap: 8,
  },
  left: { flex: 1, minWidth: 0 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  distanceWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  distanceDot: { width: 8, height: 8, borderRadius: 999 },
  distanceDotReady: { backgroundColor: DOT_READY },
  distanceDotEmpty: { backgroundColor: DOT_EMPTY },
  clubName: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '600' },
  editableNameBtn: {
    alignSelf: 'flex-start',
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    borderBottomColor: DASH_HINT,
    paddingBottom: 1,
  },
  clubNameInput: {
    alignSelf: 'flex-start',
    minWidth: 92,
    maxWidth: 170,
    borderWidth: 0.5,
    borderColor: BORDER,
    borderRadius: 8,
    backgroundColor: WHITE,
    color: TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  distance: { color: TEXT_PRIMARY, fontSize: 13, fontWeight: '600' },
  distanceEmpty: { color: TEXT_SECONDARY, fontWeight: '500' },
  arrow: { color: TEXT_SECONDARY, fontSize: 14, fontWeight: '700' },
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
  addRow: { marginTop: 12, gap: 8 },
  addInput: {
    borderWidth: 0.5,
    borderColor: BORDER,
    borderRadius: 10,
    backgroundColor: WHITE,
    color: TEXT_PRIMARY,
    fontSize: 14,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  addBtn: {
    borderWidth: 0.5,
    borderColor: GREEN,
    borderRadius: 10,
    backgroundColor: LIGHT_GREEN,
    alignItems: 'center',
    paddingVertical: 10,
  },
  addBtnText: { color: GREEN, fontSize: 14, fontWeight: '700' },
  errorText: { color: RED, fontSize: 12, marginTop: 8 },
});
