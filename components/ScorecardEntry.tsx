import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInput as RNTextInput,
} from 'react-native';
import * as Location from 'expo-location';
import { type Href, useRouter } from 'expo-router';

import { getCourseStrokeIndexMap, saveCourseStrokeIndexesForCourse } from '@/lib/course-storage';
import {
  buildParArray,
  calcAdjustedGrossFromHoles,
  calcDifferential,
  calcGIR,
  calcHandicapIndex,
  loadHandicapRecords,
  makeHandicapRecordId,
  normalizeStrokeIndexMap,
  playingCourseHandicap,
  saveHandicapRecords,
  type HandicapRecord,
  type HoleDetail,
} from '@/lib/handicap';
import { markHandicapProcessingComplete } from '@/utils/roundLock';
import { fetchNearbyCourses, getNearbyCoursesBaseUrl, type NearbyCourse } from '@/lib/nearby-courses-client';
import {
  getLibraryCourseById,
  getLibraryCoursesWithScorecard,
  getLibraryPending,
  type LibraryCourse,
} from '@/lib/golf-courses';
import { DARK_PAGE } from '@/constants/theme';

const GREEN = DARK_PAGE.accent;
const BG = DARK_PAGE.bg;
const CARD_FILL = DARK_PAGE.card;
const BORDER = DARK_PAGE.cardBorder;
const TEXT_PRIMARY = DARK_PAGE.text;
const TEXT_SECONDARY = DARK_PAGE.textSecondary;
const RED = '#f87171';
const LIGHT_GREEN = DARK_PAGE.chipBg;
const BOGEY_BG = DARK_PAGE.worstBg;
const CELL_NEUTRAL = DARK_PAGE.inputBg;
const CELL_BIRD = 'rgba(163,230,53,0.22)';

/** 录入模式切换（与成绩页 segmented 一致） */
const SEGMENT_BG = '#16261c';
const SEGMENT_SELECTED_BG = '#2d5436';
const SEGMENT_SELECTED_TEXT = '#b5ff3a';
const SEGMENT_MUTED_TEXT = '#a8b5ac';

const TOAST_BG = '#16261c';
const TOAST_TEXT = '#a8b5ac';

type ParPreset = '72' | 'custom';
type EntryMode = 'quick' | 'full';

export type ScorecardEntryProps = {
  onBack?: () => void;
  /** 来自 `data/courses.json` 的球场 id，载入该洞 Par、码数、SI、难度等模板 */
  libraryCourseId?: string;
};

function todayStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function filterCourseRating(raw: string) {
  const cleaned = raw.replace(/[^\d.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot === -1) return cleaned;
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
}

function buildSampleStrokeStrings(pars: number[]) {
  return pars.map((p, i) => {
    const delta = i % 3 === 0 ? 0 : i % 3 === 1 ? 1 : -1;
    return String(Math.max(1, p + delta));
  });
}

function initialStateFromLibrary(c: LibraryCourse) {
  const sc = c.scorecard;
  return {
    courseName: c.nameCn,
    courseRating: c.rating != null ? String(c.rating) : '',
    slopeRating: c.slope != null ? String(c.slope) : '113',
    pars: sc.map((h) => h.par),
    parTexts: sc.map((h) => String(h.par)),
    strokeTexts: Array(sc.length).fill('') as string[],
    puttTexts: Array(sc.length).fill('2'),
    siTexts: sc.map((h) => String(h.hcp)),
  };
}

function formatVsPar(diff: number) {
  if (diff === 0) return 'E';
  return diff > 0 ? `+${diff}` : `${diff}`;
}

function parseStrokeField(s: string): { empty: boolean; valid: boolean; value: number } {
  const t = s.trim();
  if (!t) return { empty: true, valid: false, value: NaN };
  if (!/^\d+$/.test(t)) return { empty: false, valid: false, value: NaN };
  const n = Number(t);
  if (!Number.isFinite(n) || n > 15) return { empty: false, valid: false, value: n };
  return { empty: false, valid: true, value: n };
}

function parsePuttField(s: string): { count: number | null } {
  const t = s.trim();
  if (!t) return { count: null };
  if (!/^\d+$/.test(t)) return { count: null };
  const n = Number(t);
  if (!Number.isFinite(n) || n > 15) return { count: null };
  return { count: n };
}

/** 全部留空 → 不传 SI；部分填写 → 错误；全填 → 校验 1..N 且不重复 */
/** Web 端 RN Alert 常不弹出，保存失败时用户会误以为「没反应」 */
function alertCompat(title: string, message?: string, onDismiss?: () => void) {
  if (Platform.OS === 'web' && typeof globalThis.alert === 'function') {
    globalThis.alert(message ? `${title}\n\n${message}` : title);
    onDismiss?.();
    return;
  }
  if (message !== undefined) {
    if (onDismiss) {
      Alert.alert(title, message, [{ text: '好的', onPress: onDismiss }]);
    } else {
      Alert.alert(title, message);
    }
  } else if (onDismiss) {
    Alert.alert(title, '', [{ text: '确定', onPress: onDismiss }]);
  } else {
    Alert.alert(title);
  }
}

function parseStrokeIndexInputTexts(
  texts: string[],
  holeCount: 18 | 9,
): { ok: true; map: number[] | undefined } | { ok: false; message: string } {
  const trimmed = texts.slice(0, holeCount).map((t) => t.trim());
  if (trimmed.every((t) => t === '')) return { ok: true, map: undefined };
  if (trimmed.some((t) => t === '')) {
    return { ok: false, message: '请填完所有洞的 SI 或全部留空' };
  }
  const max = holeCount;
  const nums = trimmed.map((t) => parseInt(t, 10));
  if (nums.some((v) => !Number.isInteger(v) || v < 1 || v > max)) {
    return { ok: false, message: `每洞 SI 须为 1–${max} 的整数` };
  }
  if (new Set(nums).size !== nums.length) {
    return { ok: false, message: 'Stroke Index 不能重复' };
  }
  const norm = normalizeStrokeIndexMap(nums, holeCount);
  if (!norm) return { ok: false, message: 'Stroke Index 验证失败' };
  return { ok: true, map: norm };
}

export function ScorecardEntry({ onBack, libraryCourseId }: ScorecardEntryProps) {
  const router = useRouter();
  const [pickedLibraryId, setPickedLibraryId] = useState<string | undefined>(undefined);
  const [libraryPickerOpen, setLibraryPickerOpen] = useState(false);
  const activeLibraryId = pickedLibraryId ?? libraryCourseId;
  const libCourse = useMemo(
    () => (activeLibraryId ? getLibraryCourseById(activeLibraryId) : undefined),
    [activeLibraryId],
  );
  const fromLib = Boolean(libCourse && libCourse.scorecard.length === 18);
  const libInit = useMemo(() => (fromLib && libCourse ? initialStateFromLibrary(libCourse) : null), [fromLib, libCourse]);

  const [date, setDate] = useState(todayStr);
  const [courseName, setCourseName] = useState(() => libInit?.courseName ?? '');
  const [roundHoles, setRoundHoles] = useState<18 | 9>(18);
  const [courseRating, setCourseRating] = useState(() => libInit?.courseRating ?? '');
  const [slopeRating, setSlopeRating] = useState(() => libInit?.slopeRating ?? '113');
  const [courseMoreOpen, setCourseMoreOpen] = useState(() => Boolean(libInit));
  const [siOpen, setSiOpen] = useState(() => Boolean(libInit));
  const [siTexts, setSiTexts] = useState<string[]>(() => libInit?.siTexts ?? Array(18).fill(''));
  const [parPreset, setParPreset] = useState<ParPreset>(() => (libInit ? 'custom' : '72'));
  const [playerName, setPlayerName] = useState('球员 A');

  const [pars, setPars] = useState<number[]>(() => libInit?.pars ?? buildParArray('72', 18));
  const [parTexts, setParTexts] = useState<string[]>(() => libInit?.parTexts ?? buildParArray('72', 18).map(String));
  const [strokeTexts, setStrokeTexts] = useState<string[]>(
    () => libInit?.strokeTexts ?? buildSampleStrokeStrings(buildParArray('72', 18)),
  );
  const [puttTexts, setPuttTexts] = useState<string[]>(() => libInit?.puttTexts ?? Array(18).fill('2'));

  const strokeRefs = useRef<(RNTextInput | null)[]>([]);
  const puttRefs = useRef<(RNTextInput | null)[]>([]);
  const parsRef = useRef(pars);
  const nearbyAbortRef = useRef<AbortController | null>(null);

  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyErr, setNearbyErr] = useState<string | null>(null);
  const [nearbyList, setNearbyList] = useState<NearbyCourse[]>([]);
  const [dateEditing, setDateEditing] = useState(false);
  /** 保存校验失败时展示在按钮上方（不依赖系统 Alert 是否可见） */
  const [saveHint, setSaveHint] = useState<string | null>(null);
  const [entryMode, setEntryMode] = useState<EntryMode>('quick');
  const [quickGrossText, setQuickGrossText] = useState('');
  const [quickPuttsText, setQuickPuttsText] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const holeCount = roundHoles;

  useEffect(() => {
    parsRef.current = pars;
  }, [pars]);

  useEffect(() => {
    return () => {
      nearbyAbortRef.current?.abort();
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  /** 在记成绩页内选择球场库：写入名称、Par、码数行、难度、SI（与路由传入 libraryCourseId 行为一致） */
  useEffect(() => {
    if (!activeLibraryId) return;
    const c = getLibraryCourseById(activeLibraryId);
    if (!c || c.scorecard.length !== 18) return;
    const init = initialStateFromLibrary(c);
    setCourseName(init.courseName);
    setCourseRating(init.courseRating);
    setSlopeRating(init.slopeRating);
    setParPreset('custom');
    setPars(init.pars);
    setParTexts(init.parTexts);
    setStrokeTexts(init.strokeTexts);
    setPuttTexts(init.puttTexts);
    setSiTexts(init.siTexts);
    setCourseMoreOpen(true);
    setSiOpen(true);
  }, [activeLibraryId]);

  useEffect(() => {
    if (fromLib && libCourse) {
      const n = roundHoles;
      const sc = libCourse.scorecard;
      const part = sc.slice(0, n);
      setPars(part.map((h) => h.par));
      setParTexts(part.map((h) => String(h.par)));
      setSiTexts(part.map((h) => String(h.hcp)));
      setStrokeTexts((prev) => {
        const next = prev.slice(0, n);
        while (next.length < n) next.push('');
        return next;
      });
      setPuttTexts((prev) => {
        const next = prev.slice(0, n);
        while (next.length < n) next.push('2');
        return next;
      });
      return;
    }
    const n = roundHoles;
    if (parPreset !== 'custom') {
      const base = buildParArray(parPreset, n);
      setPars(base);
      setParTexts(base.map(String));
      setStrokeTexts(buildSampleStrokeStrings(base));
      setPuttTexts(Array(n).fill('2'));
      setSiTexts(Array(n).fill(''));
      setSiOpen(false);
      return;
    }
    setPars((prev) => {
      const next = prev.slice(0, n);
      while (next.length < n) next.push(4);
      return next;
    });
    setParTexts((prev) => {
      const next = prev.slice(0, n);
      while (next.length < n) next.push('4');
      return next;
    });
    setStrokeTexts((prev) => {
      const next = prev.slice(0, n);
      while (next.length < n) next.push('');
      return next;
    });
    setPuttTexts((prev) => {
      const next = prev.slice(0, n);
      while (next.length < n) next.push('');
      return next;
    });
    setSiTexts((prev) => {
      const next = prev.slice(0, n);
      while (next.length < n) next.push('');
      return next;
    });
  }, [roundHoles, parPreset, fromLib, libCourse]);

  useEffect(() => {
    const name = courseName.trim();
    if (!name) return;
    const timer = setTimeout(() => {
      void (async () => {
        const arr = await getCourseStrokeIndexMap(name);
        if (!arr || arr.length !== holeCount) return;
        const norm = normalizeStrokeIndexMap(arr, holeCount);
        if (!norm) return;
        setSiTexts((prev) => {
          if (prev.some((x) => x.trim() !== '')) return prev;
          return norm.map(String);
        });
        setSiOpen(true);
      })();
    }, 450);
    return () => clearTimeout(timer);
  }, [courseName, holeCount]);

  const totals = useMemo(() => {
    let strokeSum = 0;
    let puttSum = 0;
    let parForScored = 0;
    let scored = 0;
    for (let i = 0; i < holeCount; i += 1) {
      const st = parseStrokeField(strokeTexts[i] ?? '');
      if (st.valid) {
        strokeSum += st.value;
        parForScored += pars[i] ?? 0;
        scored += 1;
      }
      const pt = parsePuttField(puttTexts[i] ?? '');
      if (pt.count !== null) puttSum += pt.count;
    }
    const vs = scored > 0 ? strokeSum - parForScored : null;
    return { strokeSum, puttSum, vs, scored };
  }, [holeCount, pars, strokeTexts, puttTexts]);

  const strokeInvalid = useCallback(
    (idx: number) => {
      const s = strokeTexts[idx] ?? '';
      if (!s.trim()) return false;
      const p = parseStrokeField(s);
      return !p.valid;
    },
    [strokeTexts],
  );

  const strokeCellBg = useCallback(
    (idx: number) => {
      if (strokeInvalid(idx)) return CELL_NEUTRAL;
      const st = parseStrokeField(strokeTexts[idx] ?? '');
      if (!st.valid) return CELL_NEUTRAL;
      const par = pars[idx] ?? 4;
      if (st.value < par) return CELL_BIRD;
      if (st.value > par) return BOGEY_BG;
      return CELL_NEUTRAL;
    },
    [pars, strokeInvalid, strokeTexts],
  );

  const onSaveRound = useCallback(() => {
    setSaveHint(null);
    const fail = (title: string, message: string) => {
      setSaveHint(message);
      alertCompat(title, message);
    };

    const name = courseName.trim();
    if (!name) {
      fail('提示', '请填写球场名称。');
      return;
    }

    const goHandicap = () => {
      onBack?.();
      router.replace('/(tabs)/handicap' as Href);
    };

    if (entryMode === 'quick') {
      const trimmedCrQ = courseRating.trim();
      const parsQuick =
        fromLib && libCourse
          ? libCourse.scorecard.slice(0, holeCount).map((h) => h.par)
          : buildParArray('72', holeCount);
      const parTotalQ = parsQuick.reduce((s, p) => s + p, 0);
      let crQ: number;
      if (!trimmedCrQ) {
        crQ = parTotalQ;
        if (!Number.isFinite(crQ) || crQ < 27 || crQ > 95) {
          fail('提示', '无法估算球场难度，请从球场库选择球场或切换到「完整」模式填写标准杆。');
          return;
        }
      } else {
        crQ = Number(trimmedCrQ);
        if (!Number.isFinite(crQ) || crQ < 50 || crQ > 90) {
          fail(
            '提示',
            '球场难度系数（Course Rating）请在约 50–90 之间，或留空以使用本局总标准杆近似。',
          );
          return;
        }
      }
      const srQ = Number(slopeRating);
      if (!Number.isFinite(srQ) || srQ < 55 || srQ > 155) {
        fail('提示', '请填写合理的坡度系数（Slope Rating，常见 113 左右）。');
        return;
      }
      const grossStr = quickGrossText.trim();
      const puttsStr = quickPuttsText.trim();
      const gNum = Number(grossStr);
      const pNum = Number(puttsStr);
      if (!/^\d+$/.test(grossStr) || !Number.isFinite(gNum) || gNum < 1 || gNum > 199) {
        fail('提示', '请填写本局总杆数（正整数）。');
        return;
      }
      if (!/^\d+$/.test(puttsStr) || !Number.isFinite(pNum) || pNum > 200) {
        fail('提示', '请填写本局推杆总数（非负整数）。');
        return;
      }
      const siParsedQ = parseStrokeIndexInputTexts(Array(holeCount).fill(''), holeCount);
      if (!siParsedQ.ok) {
        fail('提示', siParsedQ.message);
        return;
      }
      const strokeIndexMapSaveQ = siParsedQ.map;
      const adjustedGrossQ = gNum;
      const diffQ = calcDifferential(adjustedGrossQ, crQ, srQ, holeCount);
      const existingQ = loadHandicapRecords();
      const hiBeforeQ = calcHandicapIndex(existingQ);
      const pchQ =
        typeof hiBeforeQ === 'number' && Number.isFinite(crQ) && Number.isFinite(srQ) && parTotalQ > 0
          ? playingCourseHandicap(hiBeforeQ, srQ, crQ, parTotalQ)
          : undefined;
      const newRecordQ = markHandicapProcessingComplete(
        {
          id: makeHandicapRecordId(),
          date: date.trim() || todayStr(),
          courseName: name,
          courseRating: crQ,
          slopeRating: srQ,
          adjustedGrossScore: adjustedGrossQ,
          holes: holeCount,
          scoreDifferential: diffQ,
          notes: '',
          holeDetails: [],
          totalPutts: pNum,
          fairwaysHit: null,
          fairwaysTotal: null,
          greensInRegulation: null,
          front9Strokes: 0,
          back9Strokes: 0,
          ...(pchQ !== undefined ? { playingCourseHandicap: pchQ } : {}),
          ...(strokeIndexMapSaveQ ? { strokeIndexMap: strokeIndexMapSaveQ } : {}),
        } as HandicapRecord,
      );
      try {
        saveHandicapRecords([newRecordQ, ...existingQ]);
        if (strokeIndexMapSaveQ?.length) {
          void saveCourseStrokeIndexesForCourse(name, strokeIndexMapSaveQ);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : '保存失败';
        fail('保存失败', msg);
        return;
      }
      setSaveHint(null);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      setToastVisible(true);
      toastTimerRef.current = setTimeout(() => {
        setToastVisible(false);
        toastTimerRef.current = null;
        goHandicap();
      }, 2000);
      return;
    }

    const details: HoleDetail[] = [];
    for (let i = 0; i < holeCount; i += 1) {
      const st = parseStrokeField(strokeTexts[i] ?? '');
      if (!st.valid) {
        fail('提示', `请填写第 ${i + 1} 洞的杆数。`);
        return;
      }
      const par = pars[i] ?? 4;
      const pt = parsePuttField(puttTexts[i] ?? '');
      const putts = pt.count !== null ? pt.count : 2;
      const fairwayHit: boolean | null = par === 3 ? null : false;
      details.push({
        holeNumber: i + 1,
        par,
        distanceM: null,
        strokes: st.value,
        putts,
        fairwayHit,
        greenInRegulation: calcGIR(st.value, par, putts),
      });
    }

    const parTotal = pars.slice(0, holeCount).reduce((s, p) => s + (typeof p === 'number' ? p : 4), 0);
    const trimmedCr = courseRating.trim();
    let cr: number;
    if (!trimmedCr) {
      cr = parTotal;
      if (!Number.isFinite(cr) || cr < 27 || cr > 95) {
        fail('提示', '请先确认标准杆预设或逐洞标准杆，以便估算球场难度。');
        return;
      }
    } else {
      cr = Number(trimmedCr);
      if (!Number.isFinite(cr) || cr < 50 || cr > 90) {
        fail(
          '提示',
          '球场难度系数（Course Rating）请在约 50–90 之间，或留空以使用本局总标准杆近似。',
        );
        return;
      }
    }

    const sr = Number(slopeRating);
    if (!Number.isFinite(sr) || sr < 55 || sr > 155) {
      fail('提示', '请填写合理的坡度系数（Slope Rating，常见 113 左右）。');
      return;
    }

    const siParsed = parseStrokeIndexInputTexts(siTexts, holeCount);
    if (!siParsed.ok) {
      fail('提示', siParsed.message);
      return;
    }
    const strokeIndexMapSave = siParsed.map;

    const existing = loadHandicapRecords();
    const hiBefore = calcHandicapIndex(existing);
    const pch =
      typeof hiBefore === 'number' && Number.isFinite(cr) && Number.isFinite(sr) && parTotal > 0
        ? playingCourseHandicap(hiBefore, sr, cr, parTotal)
        : undefined;
    const adjustedGross = calcAdjustedGrossFromHoles(details, holeCount, pch, strokeIndexMapSave);
    /** 先 adjustedGross 再 scoreDifferential（calcDifferential 依赖总杆）；最后 markHandicapProcessingComplete 打标 */
    const diff = calcDifferential(adjustedGross, cr, sr, holeCount);

    const newRecord = markHandicapProcessingComplete({
      id: makeHandicapRecordId(),
      date: date.trim() || todayStr(),
      courseName: name,
      courseRating: cr,
      slopeRating: sr,
      adjustedGrossScore: adjustedGross,
      holes: holeCount,
      scoreDifferential: diff,
      notes: '',
      holeDetails: details,
      totalPutts: 0,
      fairwaysHit: 0,
      fairwaysTotal: 0,
      greensInRegulation: 0,
      front9Strokes: 0,
      back9Strokes: 0,
      ...(pch !== undefined ? { playingCourseHandicap: pch } : {}),
      ...(strokeIndexMapSave ? { strokeIndexMap: strokeIndexMapSave } : {}),
    } as HandicapRecord);

    try {
      saveHandicapRecords([newRecord, ...existing]);
      if (strokeIndexMapSave?.length) {
        void saveCourseStrokeIndexesForCourse(name, strokeIndexMapSave);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : '保存失败';
      fail('保存失败', msg);
      return;
    }

    setSaveHint(null);
    if (Platform.OS === 'web') {
      alertCompat('已保存', '本轮成绩已写入差点记录。', goHandicap);
      return;
    }
    Alert.alert('已保存', '本轮成绩已写入差点记录。', [{ text: '好的', onPress: goHandicap }]);
  }, [
    courseName,
    courseRating,
    date,
    entryMode,
    fromLib,
    holeCount,
    libCourse,
    onBack,
    pars,
    puttTexts,
    quickGrossText,
    quickPuttsText,
    router,
    siTexts,
    slopeRating,
    strokeTexts,
  ]);

  const clearStrokes = useCallback(() => {
    setStrokeTexts(Array(holeCount).fill(''));
    setPuttTexts(Array(holeCount).fill(''));
  }, [holeCount]);

  const showSlopeTip = useCallback(() => {
    Alert.alert('坡度系数', '标准坡度系数为 113，男子通常 55-155');
  }, []);

  const showCourseTip = useCallback(() => {
    Alert.alert('球场难度系数', '由球场官方评定，通常印在记分卡上，代表零差点球手的预期成绩。');
  }, []);

  const onPickNearbyCourse = useCallback((name: string) => {
    setCourseName(name);
    setNearbyList([]);
    setNearbyErr(null);
  }, []);

  const clearPickedLibrary = useCallback(() => {
    setPickedLibraryId(undefined);
    if (libraryCourseId) return;
    const n = roundHoles;
    setParPreset('72');
    const base = buildParArray('72', n);
    setPars(base);
    setParTexts(base.map(String));
    setStrokeTexts(buildSampleStrokeStrings(base));
    setPuttTexts(Array(n).fill('2'));
    setSiTexts(Array(n).fill(''));
    setSiOpen(false);
    setCourseRating('');
    setSlopeRating('113');
    setCourseName('');
    setCourseMoreOpen(false);
  }, [libraryCourseId, roundHoles]);

  const libraryCoursesForPicker = useMemo(() => getLibraryCoursesWithScorecard(), []);
  const libraryPendingNames = useMemo(() => getLibraryPending().map((p) => p.nameCn), []);

  const loadNearbyCourses = useCallback(async (force?: 'osm') => {
    if (!getNearbyCoursesBaseUrl()) {
      Alert.alert(
        '未配置球场搜索接口',
        '请在项目根目录创建 .env，添加：\nEXPO_PUBLIC_NEARBY_COURSES_URL=https://你的域名/api/nearby-courses\n然后重新启动 Expo（需能访问部署好的 api/nearby-courses.js）。',
      );
      return;
    }
    nearbyAbortRef.current?.abort();
    const ac = new AbortController();
    nearbyAbortRef.current = ac;
    setNearbyErr(null);
    setNearbyLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setNearbyErr('需要定位权限才能搜索附近球场，请在系统设置中开启。');
        setNearbyList([]);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = pos.coords;
      const list = await fetchNearbyCourses(latitude, longitude, { force: force, signal: ac.signal });
      setNearbyList(list);
      if (list.length === 0) {
        setNearbyErr('附近未找到球场，可改用手动输入名称。');
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return;
      const msg = e instanceof Error ? e.message : '加载失败';
      setNearbyErr(msg);
      setNearbyList([]);
    } finally {
      setNearbyLoading(false);
    }
  }, []);

  const onParChange = useCallback((idx: number, text: string) => {
    const digit = text.replace(/\D/g, '').slice(0, 1);
    setParTexts((prev) => {
      const next = [...prev];
      next[idx] = digit;
      return next;
    });
    if (digit === '') return;
    const v = Number(digit);
    if (v >= 3 && v <= 6) {
      setPars((prev) => {
        const next = [...prev];
        next[idx] = v;
        return next;
      });
    }
  }, []);

  const onParBlur = useCallback((idx: number) => {
    setParTexts((prevT) => {
      const nextT = [...prevT];
      if ((nextT[idx] ?? '').trim() === '') nextT[idx] = String(parsRef.current[idx] ?? 4);
      return nextT;
    });
  }, []);

  return (
    <View style={styles.screenRoot}>
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="always"
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      {onBack ? (
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backTxt}>← 返回</Text>
        </Pressable>
      ) : null}
      <View style={styles.modeSegment}>
        <Pressable
          style={[styles.modeBtn, entryMode === 'quick' && styles.modeBtnOn]}
          onPress={() => setEntryMode('quick')}
          accessibilityRole="tab"
          accessibilityState={{ selected: entryMode === 'quick' }}>
          <Text style={[styles.modeBtnTxt, entryMode === 'quick' && styles.modeBtnTxtOn]}>快速</Text>
        </Pressable>
        <Pressable
          style={[styles.modeBtn, entryMode === 'full' && styles.modeBtnOn]}
          onPress={() => setEntryMode('full')}
          accessibilityRole="tab"
          accessibilityState={{ selected: entryMode === 'full' }}>
          <Text style={[styles.modeBtnTxt, entryMode === 'full' && styles.modeBtnTxtOn]}>完整</Text>
        </Pressable>
      </View>
      <Text style={styles.title}>成绩记录</Text>
      {fromLib && libCourse ? (
        <View style={styles.libBanner}>
          <Text style={styles.libBannerTxt}>
            球场模板 · Par {libCourse.totalPar} · {libCourse.totalYards} yds
            {libCourse.province ? ` · ${libCourse.province}` : ''}
          </Text>
        </View>
      ) : null}

      <View style={styles.compactCard}>
        <Text style={[styles.compactLabel, styles.compactLabelFirst]}>球场名称</Text>
        <View style={styles.courseDateRow}>
          <TextInput
            value={courseName}
            onChangeText={setCourseName}
            style={styles.courseNameInput}
            placeholder="例如 XX 高尔夫球场"
            placeholderTextColor={TEXT_SECONDARY}
          />
          {dateEditing ? (
            <TextInput
              value={date}
              onChangeText={setDate}
              style={styles.dateInputInline}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={TEXT_SECONDARY}
              autoFocus
              onBlur={() => setDateEditing(false)}
              onSubmitEditing={() => setDateEditing(false)}
              maxLength={10}
            />
          ) : (
            <Pressable
              style={styles.dateChip}
              onPress={() => setDateEditing(true)}
              accessibilityRole="button"
              accessibilityLabel="修改日期">
              <Text style={styles.dateChipText}>{date}</Text>
            </Pressable>
          )}
        </View>
        <View style={styles.libraryPickRow}>
          <Pressable
            style={styles.libraryPickBtn}
            onPress={() => setLibraryPickerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={fromLib ? '更换球场库球场' : '从球场库选择球场'}>
            <Text style={styles.libraryPickBtnTxt}>{fromLib ? '更换球场…' : '从球场库选择球场'}</Text>
          </Pressable>
          {fromLib && !libraryCourseId ? (
            <Pressable
              style={styles.libraryClearBtn}
              onPress={clearPickedLibrary}
              accessibilityRole="button"
              accessibilityLabel="清除球场模板">
              <Text style={styles.libraryClearTxt}>清除模板</Text>
            </Pressable>
          ) : null}
        </View>
        {entryMode === 'full' ? (
          <>
            <View style={styles.nearbyBtnRow}>
              <Pressable
                style={[styles.nearbyBtn, nearbyLoading && styles.nearbyBtnDisabled]}
                onPress={() => void loadNearbyCourses()}
                disabled={nearbyLoading}>
                {nearbyLoading ? (
                  <ActivityIndicator color={GREEN} size="small" />
                ) : (
                  <Text style={styles.nearbyBtnTxt}>定位并搜索附近球场</Text>
                )}
              </Pressable>
              <Pressable
                style={[styles.nearbyBtnGhost, nearbyLoading && styles.nearbyBtnDisabled]}
                onPress={() => void loadNearbyCourses('osm')}
                disabled={nearbyLoading}>
                <Text style={styles.nearbyBtnGhostTxt}>仅 OSM</Text>
              </Pressable>
              {!getNearbyCoursesBaseUrl() ? (
                <Pressable
                  style={styles.nearbySearchHelpBtn}
                  onPress={() =>
                    Alert.alert(
                      '附近球场搜索',
                      `当前无法使用在线搜索，请在上方「球场名称」中直接输入。${__DEV__ ? '\n\n（开发说明）需在环境变量中配置 EXPO_PUBLIC_NEARBY_COURSES_URL 以启用联网搜索。' : ''}`,
                      [{ text: '知道了' }],
                    )
                  }
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="附近搜索说明">
                  <Text style={styles.nearbySearchHelpTxt}>?</Text>
                </Pressable>
              ) : null}
            </View>
            {nearbyErr ? <Text style={styles.nearbyErr}>{nearbyErr}</Text> : null}
            {nearbyList.length > 0 ? (
              <ScrollView style={styles.nearbyScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                {nearbyList.map((c, idx) => (
                  <Pressable
                    key={`${c.name}-${idx}`}
                    style={styles.nearbyRow}
                    onPress={() => onPickNearbyCourse(c.name)}>
                    <View style={styles.nearbyRowText}>
                      <Text style={styles.nearbyName} numberOfLines={2}>
                        {c.name}
                      </Text>
                      <Text style={styles.nearbyMeta} numberOfLines={1}>
                        {typeof c.distance === 'number' ? `约 ${c.distance} km` : ''}
                        {c.address ? ` · ${c.address}` : ''}
                      </Text>
                    </View>
                    <Text style={styles.nearbyPick}>选用</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
          </>
        ) : null}

        {entryMode === 'full' ? (
          <View style={styles.holesParRow}>
            <View style={styles.holesParCol}>
              <Text style={[styles.compactLabel, styles.holesParLabelInRow]}>洞数</Text>
              <View style={styles.chipRow}>
                <Pressable style={[styles.chip, roundHoles === 18 && styles.chipOn]} onPress={() => setRoundHoles(18)}>
                  <Text style={[styles.chipTxt, roundHoles === 18 && styles.chipTxtOn]}>18洞</Text>
                </Pressable>
                <Pressable style={[styles.chip, roundHoles === 9 && styles.chipOn]} onPress={() => setRoundHoles(9)}>
                  <Text style={[styles.chipTxt, roundHoles === 9 && styles.chipTxtOn]}>9洞</Text>
                </Pressable>
              </View>
            </View>
            <View style={styles.holesParCol}>
              <Text style={[styles.compactLabel, styles.holesParLabelInRow]}>标准杆预设</Text>
              {fromLib ? (
                <Text style={styles.libPresetHint}>已按洞载入（自定义）</Text>
              ) : (
                <View style={styles.presetRowInline}>
                  {(['72', 'custom'] as ParPreset[]).map((p) => (
                    <Pressable key={p} style={[styles.presetChip, parPreset === p && styles.chipOn]} onPress={() => setParPreset(p)}>
                      <Text style={[styles.presetTxt, parPreset === p && styles.chipTxtOn]}>{p === 'custom' ? '自定义' : `Par${p}`}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.holesQuickBlock}>
            <Text style={[styles.compactLabel, styles.holesParLabelInRow]}>洞数</Text>
            <View style={styles.chipRow}>
              <Pressable style={[styles.chip, roundHoles === 18 && styles.chipOn]} onPress={() => setRoundHoles(18)}>
                <Text style={[styles.chipTxt, roundHoles === 18 && styles.chipTxtOn]}>18洞</Text>
              </Pressable>
              <Pressable style={[styles.chip, roundHoles === 9 && styles.chipOn]} onPress={() => setRoundHoles(9)}>
                <Text style={[styles.chipTxt, roundHoles === 9 && styles.chipTxtOn]}>9洞</Text>
              </Pressable>
            </View>
          </View>
        )}
        {entryMode === 'full' && parPreset === 'custom' && !fromLib ? (
          <Text style={styles.hint}>自定义默认每洞 Par4，可在表格中逐洞修改。</Text>
        ) : null}
      </View>

      {entryMode === 'quick' ? (
        <View style={styles.quickTotalsCard}>
          <Text style={[styles.compactLabel, styles.compactLabelFirst]}>总杆数（本局）</Text>
          <TextInput
            value={quickGrossText}
            onChangeText={(t) => setQuickGrossText(t.replace(/\D/g, ''))}
            style={styles.quickStatInput}
            placeholder="必填"
            placeholderTextColor={TEXT_SECONDARY}
            keyboardType="number-pad"
          />
          <Text style={styles.compactLabel}>推杆总数</Text>
          <TextInput
            value={quickPuttsText}
            onChangeText={(t) => setQuickPuttsText(t.replace(/\D/g, ''))}
            style={styles.quickStatInput}
            placeholder="必填"
            placeholderTextColor={TEXT_SECONDARY}
            keyboardType="number-pad"
          />
        </View>
      ) : null}

      {entryMode === 'full' ? (
        <>
      <View style={styles.tableCard}>
        <Text style={styles.tableTitle}>记分卡</Text>
        <Text style={styles.playerLabel}>球员名称</Text>
        <TextInput value={playerName} onChangeText={setPlayerName} style={styles.playerInput} placeholder="球员 A" />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tableScroll}>
          <View style={styles.tableInner}>
            <View style={styles.labelCol}>
              <Text style={[styles.cornerCell, styles.headerText]}> </Text>
              <Text style={styles.rowLabel}>标准杆</Text>
              {fromLib ? <Text style={styles.rowLabel}>码数</Text> : null}
              <Text style={styles.rowLabel}>杆数</Text>
              <Text style={styles.rowLabel}>推杆</Text>
            </View>
            {Array.from({ length: holeCount }, (_, idx) => (
              <View key={idx} style={styles.holeCol}>
                <Text style={[styles.holeNum, styles.headerText]}>{idx + 1}</Text>
                <TextInput
                  value={parTexts[idx] ?? ''}
                  onChangeText={(t) => onParChange(idx, t)}
                  onBlur={() => onParBlur(idx)}
                  style={styles.parCell}
                  keyboardType="number-pad"
                  selectTextOnFocus
                />
                {fromLib && libCourse ? (
                  <Text style={styles.yardCell} numberOfLines={1}>
                    {libCourse.scorecard[idx]?.yards ?? '—'}
                  </Text>
                ) : null}
                <TextInput
                  ref={(el) => {
                    strokeRefs.current[idx] = el;
                  }}
                  value={strokeTexts[idx] ?? ''}
                  onChangeText={(t) =>
                    setStrokeTexts((prev) => {
                      const next = [...prev];
                      next[idx] = t.replace(/\D/g, '');
                      return next;
                    })
                  }
                  style={[
                    styles.scoreCell,
                    { backgroundColor: strokeCellBg(idx) },
                    strokeInvalid(idx) && styles.scoreCellError,
                  ]}
                  keyboardType="number-pad"
                  selectTextOnFocus
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => puttRefs.current[idx]?.focus()}
                />
                <TextInput
                  ref={(el) => {
                    puttRefs.current[idx] = el;
                  }}
                  value={puttTexts[idx] ?? ''}
                  onChangeText={(t) =>
                    setPuttTexts((prev) => {
                      const next = [...prev];
                      next[idx] = t.replace(/\D/g, '');
                      return next;
                    })
                  }
                  style={styles.scoreCell}
                  placeholder="选填"
                  placeholderTextColor={TEXT_SECONDARY}
                  keyboardType="number-pad"
                  selectTextOnFocus
                  returnKeyType={idx < holeCount - 1 ? 'next' : 'done'}
                  blurOnSubmit={false}
                  onSubmitEditing={() => {
                    if (idx < holeCount - 1) strokeRefs.current[idx + 1]?.focus();
                  }}
                />
              </View>
            ))}
          </View>
        </ScrollView>

        <View style={styles.totalsRow}>
          <Text style={styles.totalLine}>
            总杆数 <Text style={styles.totalEm}>{totals.strokeSum}</Text>
          </Text>
          <Text style={styles.totalLine}>
            总推杆 <Text style={styles.totalEm}>{totals.puttSum}</Text>
          </Text>
          <Text style={styles.totalLine}>
            较标准杆{' '}
            <Text style={styles.totalEm}>
              {totals.vs === null ? '—' : formatVsPar(totals.vs)}（已录 {totals.scored} 洞）
            </Text>
          </Text>
        </View>

        <View style={styles.actionsRow}>
          <Pressable style={styles.ghostBtn} onPress={clearStrokes}>
            <Text style={styles.ghostBtnTxt}>清空杆数</Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.compactCard, styles.optionalBelowCard]}>
        <Pressable style={styles.optionalToggleFirst} onPress={() => setCourseMoreOpen((v) => !v)} hitSlop={6}>
          <Text style={styles.optionalToggleTxt}>{courseMoreOpen ? '▼' : '▶'} 球场数据（可选）</Text>
        </Pressable>
        {!courseMoreOpen ? (
          <Text style={styles.optionalHint}>
            不展开时：坡度默认 {slopeRating || '113'}；未填官方难度系数则用本局总标准杆之和估算微差（详见设置 › 本应用差点说明）。
          </Text>
        ) : null}
        {courseMoreOpen ? (
          <>
            <View style={styles.labelRow}>
              <Text style={styles.compactLabel}>球场难度系数</Text>
              <Pressable onPress={showCourseTip} hitSlop={8} style={styles.helpMarkWrap}>
                <Text style={styles.helpMarkTxt}>?</Text>
              </Pressable>
            </View>
            <TextInput
              value={courseRating}
              onChangeText={(t) => setCourseRating(filterCourseRating(t))}
              style={styles.compactInput}
              placeholder="留空则用总标准杆近似"
              keyboardType="decimal-pad"
            />

            <View style={styles.labelRow}>
              <Text style={styles.compactLabel}>坡度系数</Text>
              <Pressable onPress={showSlopeTip} hitSlop={8} style={styles.helpMarkWrap}>
                <Text style={styles.helpMarkTxt}>?</Text>
              </Pressable>
            </View>
            <TextInput value={slopeRating} onChangeText={setSlopeRating} style={styles.compactInput} placeholder="113" keyboardType="number-pad" />
          </>
        ) : null}

        <Pressable style={styles.optionalToggle} onPress={() => setSiOpen((v) => !v)} hitSlop={6}>
          <Text style={styles.optionalToggleTxt}>{siOpen ? '▼' : '▶'} Stroke Index（选填）</Text>
        </Pressable>
        {!siOpen ? (
          <Text style={styles.optionalHint}>有记分卡 SI 可展开填写；不填则仍用洞号顺序估算让杆。填须 1–{holeCount} 且不重复。</Text>
        ) : null}
        {siOpen ? (
          <ScrollView
            horizontal
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.siScroll}>
            {Array.from({ length: holeCount }, (_, i) => (
              <View key={i} style={styles.siCol}>
                <Text style={styles.siColLabel}>H{i + 1}</Text>
                <Text style={styles.siColSub}>SI</Text>
                <TextInput
                  value={siTexts[i] ?? ''}
                  onChangeText={(t) =>
                    setSiTexts((prev) => {
                      const next = [...prev];
                      next[i] = t.replace(/\D/g, '').slice(0, 2);
                      return next;
                    })
                  }
                  style={styles.siInput}
                  placeholder="—"
                  placeholderTextColor={TEXT_SECONDARY}
                  keyboardType="number-pad"
                  maxLength={2}
                />
              </View>
            ))}
          </ScrollView>
        ) : null}
      </View>
        </>
      ) : null}

      {saveHint ? (
        <View style={styles.saveHintBox} accessibilityLiveRegion="polite">
          <Text style={styles.saveHintText}>{saveHint}</Text>
          {saveHint.includes('SI') || saveHint.includes('Stroke') ? (
            <Pressable
              style={styles.siClearRetry}
              onPress={() => {
                setSiTexts(Array(holeCount).fill(''));
                setSaveHint(null);
              }}
              accessibilityRole="button"
              accessibilityLabel="清空 Stroke Index">
              <Text style={styles.siClearRetryTxt}>一键清空 Stroke Index（不填则按洞号估算让杆），再点保存</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <Pressable
        style={styles.saveBtn}
        onPress={onSaveRound}
        accessibilityRole="button"
        accessibilityLabel="保存本轮成绩">
        <Text style={styles.saveBtnTxt}>保存轮次</Text>
      </Pressable>
      {Platform.OS === 'web' ? (
        <Text style={styles.webHint}>Web 端可用 Tab 在输入框间切换；手机端用键盘「下一项」跳转。</Text>
      ) : null}
    </ScrollView>

    <Modal
      visible={libraryPickerOpen}
      animationType="fade"
      transparent
      onRequestClose={() => setLibraryPickerOpen(false)}>
      <Pressable style={styles.modalBackdrop} onPress={() => setLibraryPickerOpen(false)}>
        <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
          <Text style={styles.modalTitle}>选择球场</Text>
          <Text style={styles.modalHint}>载入 Par、码数、难度系数与 Stroke Index</Text>
          <ScrollView style={styles.modalList} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {libraryCoursesForPicker.map((c) => (
              <Pressable
                key={c.id}
                style={styles.modalRow}
                onPress={() => {
                  setPickedLibraryId(c.id);
                  setLibraryPickerOpen(false);
                }}>
                <Text style={styles.modalRowTitle} numberOfLines={2}>
                  {c.nameCn}
                </Text>
                <Text style={styles.modalRowMeta} numberOfLines={1}>
                  Par {c.totalPar} · {c.totalYards} yds{c.province ? ` · ${c.province}` : ''}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          {libraryPendingNames.length > 0 ? (
            <View style={styles.modalPending}>
              <Text style={styles.modalPendingLabel}>以下球场数据待补全，暂不可选</Text>
              {libraryPendingNames.map((name) => (
                <Text key={name} style={styles.modalPendingLine}>
                  · {name}
                </Text>
              ))}
            </View>
          ) : null}
          <Pressable style={styles.modalCloseBtn} onPress={() => setLibraryPickerOpen(false)}>
            <Text style={styles.modalCloseBtnTxt}>取消</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
      {toastVisible ? (
        <View style={styles.toastWrap} pointerEvents="none" accessibilityLiveRegion="polite">
          <View style={styles.toastInner}>
            <Text style={styles.toastTxt}>成绩已保存，推杆/球道/GIR 数据可稍后在详情页补填</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screenRoot: { flex: 1, backgroundColor: BG },
  flex: { flex: 1, backgroundColor: BG },
  content: { paddingHorizontal: 16, paddingTop: Platform.OS === 'web' ? 44 : 16, paddingBottom: 32 },
  modeSegment: {
    flexDirection: 'row',
    backgroundColor: SEGMENT_BG,
    borderRadius: 9,
    padding: 3,
    gap: 4,
    marginBottom: 12,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeBtnOn: { backgroundColor: SEGMENT_SELECTED_BG },
  modeBtnTxt: { fontSize: 14, fontWeight: '700', color: SEGMENT_MUTED_TEXT },
  modeBtnTxtOn: { color: SEGMENT_SELECTED_TEXT },
  holesQuickBlock: { marginTop: 6 },
  quickTotalsCard: {
    backgroundColor: CARD_FILL,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: BORDER,
    padding: 12,
    marginBottom: 10,
  },
  quickStatInput: {
    borderWidth: 1,
    borderColor: DARK_PAGE.inputBorder,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    backgroundColor: DARK_PAGE.inputBg,
    marginBottom: 4,
  },
  toastWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 28,
    alignItems: 'center',
  },
  toastInner: {
    maxWidth: 360,
    backgroundColor: TOAST_BG,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  toastTxt: { fontSize: 13, fontWeight: '600', color: TOAST_TEXT, textAlign: 'center', lineHeight: 19 },
  backBtn: { marginBottom: 8, alignSelf: 'flex-start' },
  backTxt: { color: TEXT_SECONDARY, fontWeight: '600' },
  title: { fontSize: 24, fontWeight: '700', color: TEXT_PRIMARY, marginBottom: 10 },
  libBanner: { marginBottom: 10, paddingHorizontal: 2 },
  libBannerTxt: { fontSize: 12, color: TEXT_SECONDARY, lineHeight: 18 },
  libPresetHint: { fontSize: 12, color: TEXT_SECONDARY, marginTop: 2 },
  compactCard: {
    backgroundColor: CARD_FILL,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: BORDER,
    padding: 12,
    marginBottom: 10,
  },
  compactLabel: { fontSize: 11, color: TEXT_SECONDARY, marginBottom: 4, marginTop: 6 },
  compactLabelFirst: { marginTop: 0 },
  courseDateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  libraryPickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
    marginBottom: 4,
  },
  libraryPickBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: GREEN,
    backgroundColor: LIGHT_GREEN,
  },
  libraryPickBtnTxt: { fontSize: 13, fontWeight: '700', color: GREEN },
  libraryClearBtn: { paddingVertical: 8, paddingHorizontal: 8 },
  libraryClearTxt: { fontSize: 13, fontWeight: '600', color: TEXT_SECONDARY },
  modalBackdrop: {
    flex: 1,
    backgroundColor: DARK_PAGE.overlay,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  modalCard: {
    backgroundColor: CARD_FILL,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: BORDER,
    padding: 16,
    maxHeight: 520,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: TEXT_PRIMARY, marginBottom: 4 },
  modalHint: { fontSize: 12, color: TEXT_SECONDARY, marginBottom: 12, lineHeight: 18 },
  modalList: { maxHeight: 320 },
  modalRow: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: DARK_PAGE.inputBg,
    marginBottom: 8,
    borderWidth: 0.5,
    borderColor: BORDER,
  },
  modalRowTitle: { fontSize: 15, fontWeight: '700', color: TEXT_PRIMARY, marginBottom: 4 },
  modalRowMeta: { fontSize: 12, color: TEXT_SECONDARY },
  modalPending: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
  },
  modalPendingLabel: { fontSize: 11, color: TEXT_SECONDARY, marginBottom: 6, fontWeight: '600' },
  modalPendingLine: { fontSize: 12, color: TEXT_SECONDARY, marginBottom: 4 },
  modalCloseBtn: { marginTop: 12, alignItems: 'center', paddingVertical: 10 },
  modalCloseBtnTxt: { fontSize: 15, fontWeight: '700', color: TEXT_SECONDARY },
  courseNameInput: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: DARK_PAGE.inputBorder,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: TEXT_PRIMARY,
    backgroundColor: DARK_PAGE.inputBg,
  },
  dateChip: {
    flexShrink: 0,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: DARK_PAGE.inputBorder,
    backgroundColor: DARK_PAGE.inputBg,
    minWidth: 112,
    alignItems: 'center',
  },
  dateChipText: { fontSize: 14, fontWeight: '600', color: TEXT_PRIMARY },
  dateInputInline: {
    flexShrink: 0,
    width: 118,
    borderWidth: 1,
    borderColor: GREEN,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 14,
    color: TEXT_PRIMARY,
    backgroundColor: DARK_PAGE.inputBg,
  },
  compactInput: {
    borderWidth: 1,
    borderColor: DARK_PAGE.inputBorder,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: TEXT_PRIMARY,
    backgroundColor: DARK_PAGE.inputBg,
  },
  nearbyBtnRow: { flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'nowrap' },
  nearbySearchHelpBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 0.5,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CARD_FILL,
    flexShrink: 0,
  },
  nearbySearchHelpTxt: { fontSize: 14, fontWeight: '700', color: TEXT_SECONDARY },
  nearbyBtn: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: GREEN,
    backgroundColor: LIGHT_GREEN,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  nearbyBtnDisabled: { opacity: 0.6 },
  nearbyBtnTxt: { color: GREEN, fontSize: 13, fontWeight: '700' },
  nearbyBtnGhost: {
    borderWidth: 0.5,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: CARD_FILL,
  },
  nearbyBtnGhostTxt: { fontSize: 12, color: TEXT_SECONDARY, fontWeight: '600' },
  nearbyErr: { fontSize: 12, color: RED, marginTop: 6 },
  nearbyScroll: {
    maxHeight: 200,
    marginTop: 8,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    backgroundColor: CARD_FILL,
  },
  nearbyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  nearbyRowText: { flex: 1, paddingRight: 10 },
  nearbyName: { fontSize: 14, fontWeight: '600', color: TEXT_PRIMARY },
  nearbyMeta: { fontSize: 11, color: TEXT_SECONDARY, marginTop: 2 },
  nearbyPick: { fontSize: 12, fontWeight: '700', color: GREEN },
  /** 左右两列各占一半，标题+按钮各自成组，避免 5 个按钮连成一排 */
  holesParRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 6,
  },
  holesParCol: { flex: 1, minWidth: 0 },
  holesParLabelInRow: { marginTop: 0 },
  presetRowInline: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
    alignItems: 'center',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  chip: {
    borderWidth: 0.5,
    borderColor: BORDER,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: CARD_FILL,
  },
  chipOn: { borderColor: GREEN, backgroundColor: LIGHT_GREEN },
  chipTxt: { fontSize: 12, color: TEXT_SECONDARY },
  chipTxtOn: { color: GREEN, fontWeight: '700' },
  optionalBelowCard: { marginTop: 10 },
  optionalToggleFirst: {
    marginTop: 0,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignSelf: 'flex-start',
  },
  optionalToggle: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignSelf: 'flex-start',
  },
  optionalToggleTxt: { fontSize: 13, fontWeight: '700', color: GREEN },
  optionalHint: { fontSize: 11, color: TEXT_SECONDARY, lineHeight: 16, marginTop: 2, marginBottom: 4 },
  siScroll: { flexDirection: 'row', gap: 8, paddingVertical: 6, paddingRight: 4 },
  siCol: { width: 52, alignItems: 'center' },
  siColLabel: { fontSize: 10, color: TEXT_SECONDARY, fontWeight: '600' },
  siColSub: { fontSize: 9, color: TEXT_SECONDARY, marginBottom: 4 },
  siInput: {
    width: 48,
    borderWidth: 1,
    borderColor: DARK_PAGE.inputBorder,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 8,
    fontSize: 14,
    color: TEXT_PRIMARY,
    backgroundColor: DARK_PAGE.inputBg,
    textAlign: 'center',
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  helpMarkWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 0.5,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CARD_FILL,
  },
  helpMarkTxt: { fontSize: 13, fontWeight: '700', color: TEXT_SECONDARY },
  presetChip: {
    borderWidth: 0.5,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: CARD_FILL,
  },
  presetTxt: { fontSize: 12, color: TEXT_SECONDARY },
  hint: { fontSize: 11, color: TEXT_SECONDARY, marginTop: 6, lineHeight: 16 },
  tableCard: {
    backgroundColor: CARD_FILL,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: BORDER,
    padding: 12,
    marginBottom: 12,
  },
  tableTitle: { fontSize: 15, fontWeight: '700', color: TEXT_PRIMARY, marginBottom: 8 },
  playerLabel: { fontSize: 11, color: TEXT_SECONDARY, marginBottom: 4 },
  playerInput: {
    borderWidth: 1,
    borderColor: DARK_PAGE.inputBorder,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    marginBottom: 10,
    backgroundColor: DARK_PAGE.inputBg,
  },
  tableScroll: { paddingBottom: 4 },
  tableInner: { flexDirection: 'row', alignItems: 'flex-start' },
  labelCol: { width: 52, paddingRight: 4 },
  cornerCell: { height: 28, marginBottom: 4 },
  rowLabel: { fontSize: 11, color: TEXT_SECONDARY, height: 36, lineHeight: 36, marginBottom: 4 },
  headerText: { fontWeight: '700', color: TEXT_PRIMARY, textAlign: 'center' },
  holeCol: { width: 48, marginRight: 4 },
  holeNum: { fontSize: 12, height: 28, lineHeight: 28, marginBottom: 4, textAlign: 'center' },
  parCell: {
    height: 36,
    borderWidth: 0.5,
    borderColor: BORDER,
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 13,
    paddingVertical: 0,
    marginBottom: 4,
    color: TEXT_PRIMARY,
  },
  yardCell: {
    height: 36,
    lineHeight: 36,
    marginBottom: 4,
    textAlign: 'center',
    fontSize: 11,
    color: TEXT_SECONDARY,
  },
  scoreCell: {
    height: 36,
    borderWidth: 0.5,
    borderColor: BORDER,
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 0,
    marginBottom: 4,
    color: TEXT_PRIMARY,
  },
  scoreCellError: { borderColor: RED, borderWidth: 1 },
  totalsRow: { marginTop: 10, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: BORDER, gap: 6 },
  totalLine: { fontSize: 13, color: TEXT_SECONDARY },
  totalEm: { color: TEXT_PRIMARY, fontWeight: '700' },
  actionsRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 },
  ghostBtn: {
    borderWidth: 0.5,
    borderColor: GREEN,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: LIGHT_GREEN,
  },
  ghostBtnTxt: { color: GREEN, fontSize: 13, fontWeight: '700' },
  saveHintBox: {
    marginBottom: 10,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(248,113,113,0.12)',
    borderWidth: 0.5,
    borderColor: 'rgba(248,113,113,0.45)',
  },
  saveHintText: { fontSize: 13, color: RED, lineHeight: 19, fontWeight: '600' },
  siClearRetry: { marginTop: 10, alignSelf: 'flex-start' },
  siClearRetryTxt: { fontSize: 12, color: GREEN, fontWeight: '700', textDecorationLine: 'underline' },
  saveBtn: {
    backgroundColor: GREEN,
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 13,
    marginTop: 4,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as const) : {}),
  },
  saveBtnTxt: { color: DARK_PAGE.onAccent, fontSize: 16, fontWeight: '700' },
  webHint: { fontSize: 11, color: TEXT_SECONDARY, marginTop: 8, lineHeight: 16 },
});
