import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Circle, Path, Polygon } from 'react-native-svg';

import type { LibraryCourse } from '@/lib/golf-courses';
import { addFavoriteCourse, getFavoriteCourses, removeFavoriteCourse } from '@/utils/favoriteCourses';

const WIN = Dimensions.get('window');
const SHEET_MAX_H = Math.min(WIN.height * 0.88, 680);
const OFF_TRANSLATE = WIN.height;

const OVERLAY = 'rgba(0,0,0,0.6)';
const SHEET_BG = '#0d1b11';
const ROW_BG = '#16261c';
const SEARCH_BG = '#16261c';
const DIVIDER = 'rgba(255,255,255,0.06)';

const TEXT_CANCEL = '#8a9a8e';
const TEXT_TITLE = '#ffffff';
const TEXT_CONFIRM = '#b5ff3a';
const TEXT_SECTION = '#8a9a8e';
const TEXT_NAME = '#e8f0e5';
const TEXT_PLACEHOLDER = '#5a6b5f';
const STAR_FILL = '#b5ff3a';
const STAR_STROKE = '#8a9a8e';

export type CoursePickerApplyPayload =
  | { mode: 'library'; course: LibraryCourse }
  | { mode: 'manual'; name: string };

export type CoursePickerModalProps = {
  visible: boolean;
  onRequestClose: () => void;
  courses: LibraryCourse[];
  selectedLibraryId?: string;
  manualCourseName?: string;
  /** 路由带入的球场 id 存在时，不允许改为「仅手动名称」 */
  disableManualEntry?: boolean;
  pendingCourseNames?: string[];
  onApply: (payload: CoursePickerApplyPayload) => void;
  onFavoritesChanged?: () => Promise<void> | void;
};

function matchesSearch(course: LibraryCourse, q: string) {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  return (
    course.nameCn.toLowerCase().includes(t) ||
    course.nameEn.toLowerCase().includes(t) ||
    (course.province?.toLowerCase().includes(t) ?? false)
  );
}

function SearchIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <Circle cx="10" cy="10" r="6.5" stroke={TEXT_PLACEHOLDER} strokeWidth={2} fill="none" />
      <Path d="M14.5 14.5 L21 21" stroke={TEXT_PLACEHOLDER} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

const STAR_POINTS = '12,2 15.4,9 23,9.8 17.3,14.6 19.1,22 12,18.1 4.9,22 6.7,14.6 1,9.8 8.6,9';

function StarIcon({ filled }: { filled: boolean }) {
  if (filled) {
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24">
        <Polygon points={STAR_POINTS} fill={STAR_FILL} />
      </Svg>
    );
  }
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Polygon points={STAR_POINTS} fill="none" stroke={STAR_STROKE} strokeWidth={1.35} strokeLinejoin="round" />
    </Svg>
  );
}

export function CoursePickerModal({
  visible,
  onRequestClose,
  courses,
  selectedLibraryId,
  manualCourseName,
  disableManualEntry,
  pendingCourseNames = [],
  onApply,
  onFavoritesChanged,
}: CoursePickerModalProps) {
  const [displayed, setDisplayed] = useState(false);
  const translateY = useRef(new Animated.Value(OFF_TRANSLATE)).current;
  const prevVisible = useRef(false);
  const [search, setSearch] = useState('');
  const [favorites, setFavorites] = useState<LibraryCourse[]>([]);
  const [draftLibraryId, setDraftLibraryId] = useState<string | undefined>(selectedLibraryId);
  const [manualDraft, setManualDraft] = useState(manualCourseName ?? '');
  const [manualExpanded, setManualExpanded] = useState(false);

  const favIdSet = useMemo(() => new Set(favorites.map((c) => c.id)), [favorites]);

  useEffect(() => {
    if (visible) {
      setDisplayed(true);
    }
  }, [visible]);

  useEffect(() => {
    if (visible && !prevVisible.current) {
      setSearch('');
      setDraftLibraryId(selectedLibraryId);
      setManualDraft(manualCourseName ?? '');
      setManualExpanded(Boolean(manualCourseName?.trim()) && !selectedLibraryId);
      void getFavoriteCourses().then(setFavorites);
    }
    prevVisible.current = visible;
  }, [visible, selectedLibraryId, manualCourseName]);

  useEffect(() => {
    if (!displayed) return;
    if (visible) {
      translateY.setValue(OFF_TRANSLATE);
      Animated.timing(translateY, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: OFF_TRANSLATE,
        duration: 240,
        useNativeDriver: true,
      }).start(() => setDisplayed(false));
    }
  }, [visible, displayed, translateY]);

  const filteredAll = useMemo(() => courses.filter((c) => matchesSearch(c, search)), [courses, search]);
  const filteredFav = useMemo(
    () => favorites.filter((c) => matchesSearch(c, search)).slice(0, 5),
    [favorites, search],
  );

  const closeAfterAnim = useCallback(() => {
    onRequestClose();
  }, [onRequestClose]);

  const handleBackdrop = useCallback(() => {
    closeAfterAnim();
  }, [closeAfterAnim]);

  const applyLibrary = useCallback(
    (course: LibraryCourse) => {
      onApply({ mode: 'library', course });
      closeAfterAnim();
    },
    [onApply, closeAfterAnim],
  );

  const handleConfirm = useCallback(() => {
    const m = manualDraft.trim();
    if (m && !disableManualEntry) {
      onApply({ mode: 'manual', name: m });
      closeAfterAnim();
      return;
    }
    if (draftLibraryId) {
      const c = courses.find((x) => x.id === draftLibraryId);
      if (c) {
        onApply({ mode: 'library', course: c });
        closeAfterAnim();
        return;
      }
    }
    Alert.alert('提示', '请选择球场或输入名称');
  }, [manualDraft, disableManualEntry, draftLibraryId, courses, onApply, closeAfterAnim]);

  const toggleStar = useCallback(
    async (course: LibraryCourse) => {
      try {
        if (favIdSet.has(course.id)) {
          await removeFavoriteCourse(course.id);
        } else {
          await addFavoriteCourse(course);
        }
        const list = await getFavoriteCourses();
        setFavorites(list);
        await onFavoritesChanged?.();
      } catch {
        /* ignore */
      }
    },
    [favIdSet, onFavoritesChanged],
  );

  return (
    <Modal visible={displayed} transparent animationType="none" onRequestClose={closeAfterAnim} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={handleBackdrop} accessibilityLabel="关闭" />
        <Animated.View style={[styles.sheet, { maxHeight: SHEET_MAX_H, transform: [{ translateY }] }]}>
          <View style={styles.handleBar} />
          <View style={styles.header}>
            <Pressable onPress={closeAfterAnim} hitSlop={12} accessibilityRole="button">
              <Text style={styles.headerCancel}>取消</Text>
            </Pressable>
            <Text style={styles.headerTitle}>选择球场</Text>
            <Pressable onPress={handleConfirm} hitSlop={12} accessibilityRole="button">
              <Text style={styles.headerConfirm}>确认</Text>
            </Pressable>
          </View>

          <View style={styles.searchWrap}>
            <SearchIcon />
            <TextInput
              value={search}
              onChangeText={setSearch}
              style={styles.searchInput}
              placeholder="搜索球场"
              placeholderTextColor={TEXT_PLACEHOLDER}
              {...(Platform.OS === 'ios' ? { clearButtonMode: 'while-editing' as const } : {})}
            />
          </View>

          {!disableManualEntry ? (
            <Pressable
              style={styles.manualToggle}
              onPress={() => setManualExpanded((v) => !v)}
              accessibilityRole="button">
              <Text style={styles.manualToggleTxt}>{manualExpanded ? '▼' : '▶'} 手动输入其他名称</Text>
            </Pressable>
          ) : null}
          {!disableManualEntry && manualExpanded ? (
            <TextInput
              value={manualDraft}
              onChangeText={(t) => {
                setManualDraft(t);
                if (t.trim()) setDraftLibraryId(undefined);
              }}
              style={styles.manualInput}
              placeholder="输入球场名称"
              placeholderTextColor={TEXT_PLACEHOLDER}
            />
          ) : null}

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {filteredFav.length > 0 ? (
              <View style={styles.block}>
                <Text style={styles.sectionTitle}>常用球场</Text>
                <View style={styles.listCard}>
                  {filteredFav.map((c, i) => (
                    <Pressable
                      key={c.id}
                      style={[styles.row, i > 0 && styles.rowBorder]}
                      onPress={() => applyLibrary(c)}
                      accessibilityRole="button">
                      <Text style={styles.rowName} numberOfLines={2}>
                        {c.nameCn}
                      </Text>
                      <StarIcon filled />
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            <View style={styles.block}>
              <Text style={styles.sectionTitle}>全部球场</Text>
              <View style={styles.listCard}>
                {filteredAll.map((c, i) => {
                  const selected = draftLibraryId === c.id;
                  const fav = favIdSet.has(c.id);
                  return (
                    <View key={c.id} style={[styles.row, i > 0 && styles.rowBorder]}>
                      <Pressable
                        style={styles.rowMain}
                        onPress={() => {
                          setDraftLibraryId(c.id);
                          setManualDraft('');
                          setManualExpanded(false);
                        }}
                        accessibilityRole="button">
                        <Text style={[styles.rowName, selected && styles.rowNameSelected]} numberOfLines={2}>
                          {c.nameCn}
                        </Text>
                        <Text style={styles.rowMeta} numberOfLines={1}>
                          Par {c.totalPar} · {c.totalYards} yds{c.province ? ` · ${c.province}` : ''}
                        </Text>
                      </Pressable>
                      <Pressable
                        style={styles.starBtn}
                        onPress={() => void toggleStar(c)}
                        hitSlop={10}
                        accessibilityLabel={fav ? '取消收藏' : '加入收藏'}>
                        <StarIcon filled={fav} />
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </View>

            {pendingCourseNames.length > 0 ? (
              <View style={styles.pendingBlock}>
                <Text style={styles.sectionTitle}>以下球场数据待补全，暂不可选</Text>
                {pendingCourseNames.map((name) => (
                  <Text key={name} style={styles.pendingLine}>
                    · {name}
                  </Text>
                ))}
              </View>
            ) : null}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: OVERLAY,
  },
  sheet: {
    backgroundColor: SHEET_BG,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
    flexShrink: 1,
  },
  handleBar: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginTop: 8,
    marginBottom: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerCancel: { fontSize: 15, fontWeight: '600', color: TEXT_CANCEL },
  headerTitle: { fontSize: 13, fontWeight: '700', color: TEXT_TITLE },
  headerConfirm: { fontSize: 15, fontWeight: '700', color: TEXT_CONFIRM },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SEARCH_BG,
    borderRadius: 10,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    color: TEXT_NAME,
    paddingVertical: 0,
  },
  manualToggle: { paddingHorizontal: 16, paddingVertical: 6 },
  manualToggleTxt: { fontSize: 12, fontWeight: '600', color: TEXT_SECTION },
  manualInput: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DIVIDER,
    backgroundColor: ROW_BG,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: TEXT_NAME,
  },
  scroll: { flexGrow: 1, maxHeight: SHEET_MAX_H - 220, minHeight: 120 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 16 },
  block: { marginBottom: 14 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: TEXT_SECTION, marginBottom: 8 },
  listCard: {
    backgroundColor: ROW_BG,
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    minHeight: 48,
  },
  rowBorder: { borderTopWidth: 1, borderTopColor: DIVIDER },
  rowMain: { flex: 1, minWidth: 0, paddingRight: 8 },
  rowName: { fontSize: 14, fontWeight: '700', color: TEXT_NAME },
  rowNameSelected: { color: TEXT_CONFIRM },
  rowMeta: { fontSize: 11, color: TEXT_SECTION, marginTop: 4 },
  starBtn: { padding: 4 },
  pendingBlock: { marginTop: 4, marginBottom: 8 },
  pendingLine: { fontSize: 12, color: TEXT_SECTION, marginBottom: 4 },
});
