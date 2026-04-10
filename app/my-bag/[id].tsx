import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { loadMyClubBag, saveMyClubBag, type MyClubItem } from '@/lib/my-club-bag';

const GREEN = '#166534';
const BG = '#f3f4f6';
const WHITE = '#ffffff';
const BORDER = '#e5e7eb';
const TEXT_PRIMARY = '#111827';
const TEXT_SECONDARY = '#6b7280';
const LIGHT_GREEN = '#dcfce7';

const FLEX_OPTIONS = ['R', 'SR', 'S', 'X'] as const;

type ClubDraft = {
  name: string;
  distance: string;
  specs: MyClubItem['specs'];
};

export default function MyBagClubDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [bag, setBag] = useState<MyClubItem[]>([]);
  const [currentClub, setCurrentClub] = useState<MyClubItem | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<ClubDraft | null>(null);

  useEffect(() => {
    const loaded = loadMyClubBag();
    setBag(loaded);
    const matched = loaded.find((club) => club.id === id) || null;
    setCurrentClub(matched);
    if (matched) {
      setDraft({
        name: matched.name,
        distance: typeof matched.distance === 'number' ? String(matched.distance) : '',
        specs: { ...matched.specs },
      });
    }
  }, [id]);

  const pageTitle = useMemo(() => {
    if (isEditing) return draft?.name?.trim() || currentClub?.name || '球杆详情';
    return currentClub?.name || '球杆详情';
  }, [currentClub?.name, draft?.name, isEditing]);

  function goBackToBag() {
    router.replace('/my-bag');
  }

  function resetDraftFromCurrent() {
    if (!currentClub) return;
    setDraft({
      name: currentClub.name,
      distance: typeof currentClub.distance === 'number' ? String(currentClub.distance) : '',
      specs: { ...currentClub.specs },
    });
  }

  function onBackPress() {
    if (!isEditing) {
      goBackToBag();
      return;
    }

    const leave = () => {
      setIsEditing(false);
      resetDraftFromCurrent();
      goBackToBag();
    };

    if (Platform.OS === 'web' && typeof globalThis.confirm === 'function') {
      if (globalThis.confirm('放弃修改？')) leave();
      return;
    }

    Alert.alert('提示', '放弃修改？', [
      { text: '继续编辑', style: 'cancel' },
      { text: '放弃', style: 'destructive', onPress: leave },
    ]);
  }

  function onSave() {
    if (!currentClub || !draft) return;
    const distanceValue = draft.distance.trim();
    const parsed = Number(distanceValue);
    const normalizedDistance = distanceValue && Number.isFinite(parsed) ? parsed : null;
    const normalizedName = draft.name.trim() || currentClub.name;

    const updatedClub: MyClubItem = {
      ...currentClub,
      name: normalizedName,
      distance: normalizedDistance,
      specs: {
        headModel: draft.specs.headModel.trim(),
        shaftBrand: draft.specs.shaftBrand.trim(),
        shaftModel: draft.specs.shaftModel.trim(),
        shaftWeight: draft.specs.shaftWeight.trim(),
        flex: draft.specs.flex.trim(),
        length: draft.specs.length.trim(),
        swingWeight: draft.specs.swingWeight.trim(),
        gripModel: draft.specs.gripModel.trim(),
        notes: draft.specs.notes.trim(),
      },
    };

    const nextBag = bag.map((club) => (club.id === updatedClub.id ? updatedClub : club));
    saveMyClubBag(nextBag);
    setBag(nextBag);
    setCurrentClub(updatedClub);
    setDraft({
      name: updatedClub.name,
      distance: typeof updatedClub.distance === 'number' ? String(updatedClub.distance) : '',
      specs: { ...updatedClub.specs },
    });
    setIsEditing(false);
  }

  function renderValue(value: string) {
    return value.trim() ? value : '—';
  }

  if (!currentClub || !draft) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <Pressable onPress={goBackToBag} style={styles.backBtn}>
            <Text style={styles.backTxt}>← 返回</Text>
          </Pressable>
          <Text style={styles.title}>球杆详情</Text>
          <View style={styles.card}>
            <Text style={styles.empty}>未找到该球杆，可能已被删除。</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} bounces={false}>
        <View style={styles.header}>
          <Pressable onPress={onBackPress} style={styles.backBtn}>
            <Text style={styles.backTxt}>← 返回</Text>
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>
            {pageTitle}
          </Text>
          <Pressable style={styles.editBtn} onPress={() => (isEditing ? onSave() : setIsEditing(true))}>
            <Text style={styles.editBtnText}>{isEditing ? '保存' : '编辑'}</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>距离</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>平均距离（码）</Text>
            {isEditing ? (
              <TextInput
                value={draft.distance}
                onChangeText={(value) => setDraft((prev) => (prev ? { ...prev, distance: value } : prev))}
                keyboardType="decimal-pad"
                placeholder="例如 230"
                placeholderTextColor={TEXT_SECONDARY}
                style={styles.input}
              />
            ) : (
              <Text style={styles.value}>{typeof currentClub.distance === 'number' ? `${currentClub.distance}码` : '—'}</Text>
            )}
          </View>
        </View>

        <Text style={styles.sectionTitle}>球杆规格</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>杆头型号</Text>
            {isEditing ? (
              <TextInput
                value={draft.specs.headModel}
                onChangeText={(value) =>
                  setDraft((prev) => (prev ? { ...prev, specs: { ...prev.specs, headModel: value } } : prev))
                }
                style={styles.input}
                placeholder="例如 Qi10 LS"
                placeholderTextColor={TEXT_SECONDARY}
              />
            ) : (
              <Text style={styles.value}>{renderValue(currentClub.specs.headModel)}</Text>
            )}
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>杆身品牌</Text>
            {isEditing ? (
              <TextInput
                value={draft.specs.shaftBrand}
                onChangeText={(value) =>
                  setDraft((prev) => (prev ? { ...prev, specs: { ...prev.specs, shaftBrand: value } } : prev))
                }
                style={styles.input}
                placeholder="例如 Fujikura"
                placeholderTextColor={TEXT_SECONDARY}
              />
            ) : (
              <Text style={styles.value}>{renderValue(currentClub.specs.shaftBrand)}</Text>
            )}
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>杆身型号</Text>
            {isEditing ? (
              <TextInput
                value={draft.specs.shaftModel}
                onChangeText={(value) =>
                  setDraft((prev) => (prev ? { ...prev, specs: { ...prev.specs, shaftModel: value } } : prev))
                }
                style={styles.input}
                placeholder="例如 Ventus TR"
                placeholderTextColor={TEXT_SECONDARY}
              />
            ) : (
              <Text style={styles.value}>{renderValue(currentClub.specs.shaftModel)}</Text>
            )}
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>杆身重量</Text>
            {isEditing ? (
              <TextInput
                value={draft.specs.shaftWeight}
                onChangeText={(value) =>
                  setDraft((prev) => (prev ? { ...prev, specs: { ...prev.specs, shaftWeight: value } } : prev))
                }
                style={styles.input}
                placeholder="例如 60g"
                placeholderTextColor={TEXT_SECONDARY}
              />
            ) : (
              <Text style={styles.value}>{renderValue(currentClub.specs.shaftWeight)}</Text>
            )}
          </View>

          <View style={styles.rowColumn}>
            <Text style={styles.label}>硬度</Text>
            {isEditing ? (
              <View style={styles.flexRow}>
                {FLEX_OPTIONS.map((option) => {
                  const active = draft.specs.flex === option;
                  return (
                    <Pressable
                      key={option}
                      style={[styles.flexBtn, active && styles.flexBtnActive]}
                      onPress={() =>
                        setDraft((prev) => (prev ? { ...prev, specs: { ...prev.specs, flex: option } } : prev))
                      }
                    >
                      <Text style={[styles.flexBtnText, active && styles.flexBtnTextActive]}>{option}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.value}>{renderValue(currentClub.specs.flex)}</Text>
            )}
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>杆长</Text>
            {isEditing ? (
              <TextInput
                value={draft.specs.length}
                onChangeText={(value) =>
                  setDraft((prev) => (prev ? { ...prev, specs: { ...prev.specs, length: value } } : prev))
                }
                style={styles.input}
                placeholder="例如 45.5inch"
                placeholderTextColor={TEXT_SECONDARY}
              />
            ) : (
              <Text style={styles.value}>{renderValue(currentClub.specs.length)}</Text>
            )}
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>挥重</Text>
            {isEditing ? (
              <TextInput
                value={draft.specs.swingWeight}
                onChangeText={(value) =>
                  setDraft((prev) => (prev ? { ...prev, specs: { ...prev.specs, swingWeight: value } } : prev))
                }
                style={styles.input}
                placeholder="例如 D3"
                placeholderTextColor={TEXT_SECONDARY}
              />
            ) : (
              <Text style={styles.value}>{renderValue(currentClub.specs.swingWeight)}</Text>
            )}
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>握把型号</Text>
            {isEditing ? (
              <TextInput
                value={draft.specs.gripModel}
                onChangeText={(value) =>
                  setDraft((prev) => (prev ? { ...prev, specs: { ...prev.specs, gripModel: value } } : prev))
                }
                style={styles.input}
                placeholder="例如 MCC Plus4"
                placeholderTextColor={TEXT_SECONDARY}
              />
            ) : (
              <Text style={styles.value}>{renderValue(currentClub.specs.gripModel)}</Text>
            )}
          </View>

          <View style={styles.rowColumnNoBorder}>
            <Text style={styles.label}>备注</Text>
            {isEditing ? (
              <TextInput
                value={draft.specs.notes}
                onChangeText={(value) =>
                  setDraft((prev) => (prev ? { ...prev, specs: { ...prev.specs, notes: value } } : prev))
                }
                style={styles.notesInput}
                placeholder="补充说明..."
                placeholderTextColor={TEXT_SECONDARY}
                multiline
                textAlignVertical="top"
              />
            ) : (
              <Text style={styles.notesValue}>{renderValue(currentClub.specs.notes)}</Text>
            )}
          </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 10,
  },
  backBtn: { alignSelf: 'flex-start' },
  backTxt: { color: GREEN, fontWeight: '600' },
  title: { flex: 1, textAlign: 'center', fontSize: 20, fontWeight: '700', color: TEXT_PRIMARY },
  editBtn: {
    borderWidth: 0.5,
    borderColor: GREEN,
    backgroundColor: LIGHT_GREEN,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  editBtnText: { color: GREEN, fontSize: 13, fontWeight: '700' },
  sectionTitle: { fontSize: 13, color: TEXT_SECONDARY, marginBottom: 6 },
  card: {
    backgroundColor: WHITE,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: BORDER,
    padding: 14,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: BG,
    paddingVertical: 9,
  },
  rowColumn: {
    gap: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: BG,
    paddingVertical: 9,
  },
  rowColumnNoBorder: {
    gap: 8,
    paddingTop: 9,
  },
  label: { fontSize: 13, color: TEXT_SECONDARY, width: 92 },
  value: { flex: 1, textAlign: 'right', fontSize: 14, color: TEXT_PRIMARY, fontWeight: '600' },
  notesValue: { fontSize: 14, lineHeight: 20, color: TEXT_PRIMARY, fontWeight: '500' },
  input: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: BORDER,
    borderRadius: 10,
    backgroundColor: WHITE,
    color: TEXT_PRIMARY,
    fontSize: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    textAlign: 'right',
  },
  notesInput: {
    borderWidth: 0.5,
    borderColor: BORDER,
    borderRadius: 10,
    backgroundColor: WHITE,
    color: TEXT_PRIMARY,
    fontSize: 14,
    paddingHorizontal: 10,
    paddingVertical: 10,
    minHeight: 92,
  },
  flexRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  flexBtn: {
    borderWidth: 0.5,
    borderColor: BORDER,
    borderRadius: 9,
    backgroundColor: WHITE,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  flexBtnActive: {
    borderColor: GREEN,
    backgroundColor: LIGHT_GREEN,
  },
  flexBtnText: { color: TEXT_PRIMARY, fontSize: 13, fontWeight: '600' },
  flexBtnTextActive: { color: GREEN, fontWeight: '700' },
  empty: { fontSize: 13, color: TEXT_SECONDARY, lineHeight: 20 },
});
