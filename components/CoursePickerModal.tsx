import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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

import type { CatalogCourse, CatalogCourseSearchHit } from '@/lib/course-catalog-types';
import type { LibraryCourse } from '@/lib/golf-courses';
import {
  addFavoriteCourse,
  getFavoriteCourses,
  removeFavoriteCourse,
} from '@/utils/favoriteCourses';
import { getCourseDetail, searchCourses, suggestCourse } from '@/utils/courseDatabase';
import { THEME } from '@/constants/theme';

const WIN = Dimensions.get('window');
const SHEET_MAX_H = Math.min(WIN.height * 0.88, 680);
const OFF_TRANSLATE = WIN.height;

const OVERLAY = 'rgba(0,0,0,0.6)';
const SHEET_BG = THEME.bg;
const ROW_BG = THEME.card;
const SEARCH_BG = THEME.card;
const DIVIDER = 'rgba(255,255,255,0.06)';

const TEXT_CANCEL = THEME.text3;
const TEXT_TITLE = THEME.text1;
const TEXT_CONFIRM = THEME.accent;
const TEXT_SECTION = THEME.text3;
const TEXT_NAME = THEME.text2;
const TEXT_PLACEHOLDER = THEME.text3;
const STAR_FILL = THEME.accent;
const STAR_STROKE = THEME.text3;
const VERIFIED_LABEL = THEME.accent;
const UNVERIFIED_LABEL = THEME.text3;
const VERIFIED_DOT = THEME.accent;
const UNVERIFIED_DOT = THEME.text3;

export type CoursePickerApplyPayload =
  | { mode: 'library'; course: LibraryCourse }
  | { mode: 'manual'; name: string }
  | { mode: 'catalog'; course: CatalogCourse; layoutKey: string };

export type CoursePickerModalProps = {
  visible: boolean;
  onRequestClose: () => void;
  courses: LibraryCourse[];
  selectedLibraryId?: string;
  manualCourseName?: string;
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
      <Polygon
        points={STAR_POINTS}
        fill="none"
        stroke={STAR_STROKE}
        strokeWidth={1.35}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function VerifiedBadge({ verified }: { verified: boolean }) {
  return (
    <View style={styles.verifyRow}>
      <View
        style={[styles.verifyDot, { backgroundColor: verified ? VERIFIED_DOT : UNVERIFIED_DOT }]}
      />
      <Text style={[styles.verifyTxt, { color: verified ? VERIFIED_LABEL : UNVERIFIED_LABEL }]}>
        {verified ? '已核实' : '数据待核实'}
      </Text>
    </View>
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
  const [remoteHits, setRemoteHits] = useState<CatalogCourseSearchHit[]>([]);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [step, setStep] = useState<'main' | 'layout'>('main');
  const [pendingCatalog, setPendingCatalog] = useState<CatalogCourse | null>(null);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestName, setSuggestName] = useState('');
  const [suggestCr, setSuggestCr] = useState('');
  const [suggestSr, setSuggestSr] = useState('');
  const [suggestPar, setSuggestPar] = useState('72');
  const [suggestSource, setSuggestSource] = useState('');
  const [suggestBusy, setSuggestBusy] = useState(false);

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
      setRemoteHits([]);
      setStep('main');
      setPendingCatalog(null);
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

  useEffect(() => {
    const q = search.trim();
    if (!q) {
      setRemoteHits([]);
      setRemoteLoading(false);
      return;
    }
    setRemoteLoading(true);
    const tid = setTimeout(() => {
      void (async () => {
        try {
          const hits = await searchCourses(q, undefined, 15);
          setRemoteHits(hits);
        } catch {
          setRemoteHits([]);
        } finally {
          setRemoteLoading(false);
        }
      })();
    }, 300);
    return () => clearTimeout(tid);
  }, [search]);

  const closeAfterAnim = useCallback(() => {
    setStep('main');
    setPendingCatalog(null);
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

  const applyCatalogLayout = useCallback(
    (course: CatalogCourse, layoutKey: string) => {
      onApply({ mode: 'catalog', course, layoutKey });
      closeAfterAnim();
    },
    [onApply, closeAfterAnim],
  );

  const openCatalogFromHit = useCallback(
    async (hit: CatalogCourseSearchHit) => {
      const full = await getCourseDetail(hit.id);
      if (!full || !full.holes?.length) {
        Alert.alert('提示', '无法加载球场详情，请稍后重试。');
        return;
      }
      if (full.holes.length === 1) {
        applyCatalogLayout(full, full.holes[0]!.layout);
        return;
      }
      setPendingCatalog(full);
      setStep('layout');
    },
    [applyCatalogLayout],
  );

  const handleConfirm = useCallback(() => {
    if (step === 'layout') return;
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
  }, [manualDraft, disableManualEntry, draftLibraryId, courses, onApply, closeAfterAnim, step]);

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

  const onHeaderLeft = useCallback(() => {
    if (step === 'layout') {
      setStep('main');
      setPendingCatalog(null);
      return;
    }
    closeAfterAnim();
  }, [step, closeAfterAnim]);

  const submitSuggest = useCallback(async () => {
    const name = suggestName.trim();
    if (!name) {
      Alert.alert('提示', '请填写球场名称');
      return;
    }
    setSuggestBusy(true);
    try {
      const cr = suggestCr.trim() ? Number(suggestCr) : undefined;
      const sr = suggestSr.trim() ? Number(suggestSr) : undefined;
      const par = suggestPar.trim() ? Number(suggestPar) : 72;
      const res = await suggestCourse({
        name,
        courseRating: Number.isFinite(cr) ? cr : undefined,
        slopeRating: Number.isFinite(sr) ? sr : undefined,
        par: Number.isFinite(par) ? par : 72,
        source: suggestSource.trim() || undefined,
      });
      if (!res.ok) {
        Alert.alert('提交失败', '请检查是否已配置 EXPO_PUBLIC_COURSE_API_URL 并部署球场 API。');
        return;
      }
      setSuggestOpen(false);
      if (Platform.OS === 'web' && typeof globalThis.alert === 'function') {
        globalThis.alert('感谢提交，审核后将上线');
      } else {
        Alert.alert('', '感谢提交，审核后将上线');
      }
    } finally {
      setSuggestBusy(false);
    }
  }, [suggestName, suggestCr, suggestSr, suggestPar, suggestSource]);

  const filteredAll = useMemo(
    () => courses.filter((c) => matchesSearch(c, search)),
    [courses, search],
  );
  const filteredFav = useMemo(
    () => favorites.filter((c) => matchesSearch(c, search)).slice(0, 5),
    [favorites, search],
  );

  return (
    <Modal
      visible={displayed}
      transparent
      animationType="none"
      onRequestClose={closeAfterAnim}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={handleBackdrop} accessibilityLabel="关闭" />
        <Animated.View
          style={[styles.sheet, { maxHeight: SHEET_MAX_H, transform: [{ translateY }] }]}
        >
          <View style={styles.handleBar} />
          <View style={styles.header}>
            <Pressable onPress={onHeaderLeft} hitSlop={12} accessibilityRole="button">
              <Text style={styles.headerCancel}>{step === 'layout' ? '返回' : '取消'}</Text>
            </Pressable>
            <Text style={styles.headerTitle}>{step === 'layout' ? '选择布局' : '选择球场'}</Text>
            {step === 'layout' ? (
              <View style={styles.headerSpacer} />
            ) : (
              <Pressable onPress={handleConfirm} hitSlop={12} accessibilityRole="button">
                <Text style={styles.headerConfirm}>确认</Text>
              </Pressable>
            )}
          </View>

          {step === 'layout' && pendingCatalog ? (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.layoutCourseTitle} numberOfLines={2}>
                {pendingCatalog.name}
              </Text>
              {pendingCatalog.holes.map((lo, i) => (
                <Pressable
                  key={`${lo.layout}-${i}`}
                  style={[styles.row, i > 0 && styles.rowBorder]}
                  onPress={() => applyCatalogLayout(pendingCatalog, lo.layout)}
                  accessibilityRole="button"
                >
                  <View style={styles.rowMain}>
                    <Text style={styles.rowName} numberOfLines={2}>
                      {lo.layout}
                    </Text>
                    <Text style={styles.layoutMeta} numberOfLines={1}>
                      CR {lo.courseRating ?? '—'} / SR {lo.slopeRating ?? '—'} · Par {lo.par}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <>
              <View style={styles.searchWrap}>
                <SearchIcon />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  style={styles.searchInput}
                  placeholder="搜索球场（目录 + 国内模板）"
                  placeholderTextColor={TEXT_PLACEHOLDER}
                  {...(Platform.OS === 'ios' ? { clearButtonMode: 'while-editing' as const } : {})}
                />
              </View>

              {!disableManualEntry ? (
                <Pressable
                  style={styles.manualToggle}
                  onPress={() => setManualExpanded((v) => !v)}
                  accessibilityRole="button"
                >
                  <Text style={styles.manualToggleTxt}>
                    {manualExpanded ? '▼' : '▶'} 手动输入其他名称
                  </Text>
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
                showsVerticalScrollIndicator={false}
              >
                {search.trim().length > 0 ? (
                  <View style={styles.block}>
                    <Text style={styles.sectionTitle}>目录与在线</Text>
                    {remoteLoading ? (
                      <View style={styles.remoteLoadingRow}>
                        <ActivityIndicator color={TEXT_CONFIRM} />
                        <Text style={styles.remoteLoadingTxt}>搜索中…</Text>
                      </View>
                    ) : null}
                    <View style={styles.listCard}>
                      {remoteHits.map((hit, i) => (
                        <Pressable
                          key={hit.id}
                          style={[styles.row, i > 0 && styles.rowBorder]}
                          onPress={() => void openCatalogFromHit(hit)}
                          accessibilityRole="button"
                        >
                          <View style={styles.rowMain}>
                            <View style={styles.nameVerifyRow}>
                              <Text style={styles.rowName} numberOfLines={2}>
                                {hit.name}
                              </Text>
                              <VerifiedBadge verified={hit.verified} />
                            </View>
                            <Text style={styles.rowMeta} numberOfLines={1}>
                              {[hit.prefecture, hit.city].filter(Boolean).join(' · ') ||
                                hit.country}
                            </Text>
                          </View>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ) : null}

                {filteredFav.length > 0 ? (
                  <View style={styles.block}>
                    <Text style={styles.sectionTitle}>常用球场</Text>
                    <View style={styles.listCard}>
                      {filteredFav.map((c, i) => (
                        <Pressable
                          key={c.id}
                          style={[styles.row, i > 0 && styles.rowBorder]}
                          onPress={() => applyLibrary(c)}
                          accessibilityRole="button"
                        >
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
                  <Text style={styles.sectionTitle}>国内 18 洞模板</Text>
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
                            accessibilityRole="button"
                          >
                            <Text
                              style={[styles.rowName, selected && styles.rowNameSelected]}
                              numberOfLines={2}
                            >
                              {c.nameCn}
                            </Text>
                            <Text style={styles.rowMeta} numberOfLines={1}>
                              Par {c.totalPar} · {c.totalYards} yds
                              {c.province ? ` · ${c.province}` : ''}
                            </Text>
                          </Pressable>
                          <Pressable
                            style={styles.starBtn}
                            onPress={() => void toggleStar(c)}
                            hitSlop={10}
                            accessibilityLabel={fav ? '取消收藏' : '加入收藏'}
                          >
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

                <Pressable
                  style={styles.suggestLink}
                  onPress={() => setSuggestOpen(true)}
                  accessibilityRole="button"
                >
                  <Text style={styles.suggestLinkTxt}>找不到？提交球场数据 ›</Text>
                </Pressable>
              </ScrollView>
            </>
          )}
        </Animated.View>
      </View>

      <Modal
        visible={suggestOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSuggestOpen(false)}
      >
        <Pressable style={styles.suggestOverlay} onPress={() => setSuggestOpen(false)}>
          <Pressable style={styles.suggestCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.suggestTitle}>提交球场数据</Text>
            <Text style={styles.suggestLabel}>球场名（必填）</Text>
            <TextInput
              value={suggestName}
              onChangeText={setSuggestName}
              style={styles.suggestInput}
              placeholder="例如 〇〇ゴルフ倶楽部"
              placeholderTextColor={TEXT_PLACEHOLDER}
            />
            <Text style={styles.suggestLabel}>Course Rating</Text>
            <TextInput
              value={suggestCr}
              onChangeText={(t) => setSuggestCr(t.replace(/[^\d.]/g, ''))}
              style={styles.suggestInput}
              placeholder="如 71.4"
              placeholderTextColor={TEXT_PLACEHOLDER}
              keyboardType="decimal-pad"
            />
            <Text style={styles.suggestLabel}>Slope Rating</Text>
            <TextInput
              value={suggestSr}
              onChangeText={(t) => setSuggestSr(t.replace(/\D/g, ''))}
              style={styles.suggestInput}
              placeholder="如 128"
              placeholderTextColor={TEXT_PLACEHOLDER}
              keyboardType="number-pad"
            />
            <Text style={styles.suggestLabel}>Par</Text>
            <TextInput
              value={suggestPar}
              onChangeText={(t) => setSuggestPar(t.replace(/\D/g, ''))}
              style={styles.suggestInput}
              placeholder="72"
              placeholderTextColor={TEXT_PLACEHOLDER}
              keyboardType="number-pad"
            />
            <Text style={styles.suggestLabel}>数据来源</Text>
            <TextInput
              value={suggestSource}
              onChangeText={setSuggestSource}
              style={styles.suggestInput}
              placeholder="如 JGA 官网"
              placeholderTextColor={TEXT_PLACEHOLDER}
            />
            <View style={styles.suggestActions}>
              <Pressable
                style={styles.suggestCancelBtn}
                onPress={() => setSuggestOpen(false)}
                accessibilityRole="button"
              >
                <Text style={styles.suggestCancelTxt}>取消</Text>
              </Pressable>
              <Pressable
                style={[styles.suggestOkBtn, suggestBusy && styles.suggestOkDisabled]}
                disabled={suggestBusy}
                onPress={() => void submitSuggest()}
                accessibilityRole="button"
              >
                <Text style={styles.suggestOkTxt}>{suggestBusy ? '提交中…' : '提交'}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  headerSpacer: { width: 40 },
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
  layoutMeta: { fontSize: 12, color: TEXT_PLACEHOLDER, marginTop: 4 },
  layoutCourseTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT_NAME,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  starBtn: { padding: 4 },
  pendingBlock: { marginTop: 4, marginBottom: 8 },
  pendingLine: { fontSize: 12, color: TEXT_SECTION, marginBottom: 4 },
  nameVerifyRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  verifyRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  verifyDot: { width: 6, height: 6, borderRadius: 3 },
  verifyTxt: { fontSize: 10, fontWeight: '600' },
  remoteLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  remoteLoadingTxt: { fontSize: 12, color: TEXT_SECTION },
  suggestLink: { paddingVertical: 14, alignItems: 'center' },
  suggestLinkTxt: { fontSize: 13, fontWeight: '600', color: TEXT_CONFIRM },
  suggestOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  suggestCard: {
    backgroundColor: SHEET_BG,
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DIVIDER,
  },
  suggestTitle: { fontSize: 16, fontWeight: '700', color: TEXT_TITLE, marginBottom: 12 },
  suggestLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: TEXT_SECTION,
    marginBottom: 4,
    marginTop: 8,
  },
  suggestInput: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DIVIDER,
    backgroundColor: ROW_BG,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: TEXT_NAME,
  },
  suggestActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 16 },
  suggestCancelBtn: { paddingVertical: 10, paddingHorizontal: 14 },
  suggestCancelTxt: { fontSize: 14, fontWeight: '600', color: TEXT_CANCEL },
  suggestOkBtn: {
    backgroundColor: ROW_BG,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: TEXT_CONFIRM,
  },
  suggestOkDisabled: { opacity: 0.5 },
  suggestOkTxt: { fontSize: 14, fontWeight: '700', color: TEXT_CONFIRM },
});
