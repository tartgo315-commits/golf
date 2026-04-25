import { useFocusEffect } from '@react-navigation/native';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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

import { AIRoundReview } from '@/components/AIRoundReview';
import { HoleReviewGrid } from '@/components/HoleReviewGrid';
import { DARK_PAGE, TAB_BAR_SCROLL_EXTRA } from '@/constants/theme';
import {
  calcRoundScoreDifferential,
  createEmptyHandicapHoleData,
  loadHandicapRecords,
  parseDurationMinutesInput,
  playingPartnersFromManualNames,
  recordHasPendingRoundStats,
  saveHandicapRecords,
  seedHandicapHoleDataFromHoleDetails,
  equivalent18FromGrossAndHoles,
  roundPuttsDisplayCount,
  type HandicapAiReview,
  type HandicapHoleData,
  type HandicapRecord,
} from '@/lib/handicap';
import { computeRoundDeepStats, fmtVsPar } from '@/lib/roundDeepStats';
import { useAuth } from '@/contexts/auth-context';
import {
  consistencyLabel,
  consistencyScore,
  lossBreakdown,
  worstHoles,
} from '@/utils/holeAnalysis';
import {
  createAmendmentRequest,
  getAmendmentRequests,
  consumeAmendmentForRound,
} from '@/utils/amendmentRequest';
import {
  isRoundLocked,
  isRoundLockedSync,
  markHandicapProcessingComplete,
} from '@/utils/roundLock';
import { refreshServerTime } from '@/utils/serverTime';
import { getAppUserId } from '@/utils/userIdentity';
import {
  handicapHistoryHref,
  handicapIndexHref,
  pickFromParam,
  returnHrefForFrom,
} from '@/utils/tabReturnFrom';

const GREEN = DARK_PAGE.accent;
const CARD_FILL = DARK_PAGE.card;
const BORDER = DARK_PAGE.cardBorder;
const TEXT_PRIMARY = DARK_PAGE.text;
const TEXT_SECONDARY = DARK_PAGE.textSecondary;
const RED = '#dc2626';
const LIGHT_GREEN = DARK_PAGE.chipBg;
const ORANGE = '#e89b3a';
const SECTION_MUTED = '#a8b5ac';
const SECTION_EDIT = '#b5ff3a';
const EMPTY_HINT = '#5a6b5f';
const LOSS_PUTT = '#3ac5a8';
const LOSS_SHORT = '#e89b3a';
const LOSS_LONG = '#e5c53a';
const LOSS_PEN = '#d94848';

const PAGE_BG = '#0d1b11';
const CARD_BG = '#16261c';
const ACCENT = '#b5ff3a';
const ORANGE_WARN = '#e89b3a';
const MUTED = '#5a6b5f';
const SUBTITLE = '#8a9a8e';
const VALUE_MAIN = '#e8f0e5';
const SECTION_TITLE = '#a8b5ac';
const OUTLINE_BTN_BG = '#1e3a26';
const OUTLINE_BTN_BORDER = '#2d5436';
const INPUT_BG = '#0d1b11';
const DIVIDER = 'rgba(255,255,255,0.06)';
const LOCK_TINT = 'rgba(181,255,58,0.06)';

function strokeColorForCell(strokes: number, par: number): string {
  const d = strokes - par;
  if (d <= -2) return '#e5c53a';
  if (d === -1) return '#3ac5a8';
  if (d === 0) return '#e8f0e5';
  if (d === 1) return '#e89b3a';
  return '#d94848';
}

function fmtDurationDetail(mins: number | null | undefined): string {
  if (mins == null || !Number.isFinite(mins) || mins <= 0) return '未填写';
  const m = Math.round(mins);
  const h = Math.floor(m / 60);
  return h > 0 ? `${m} 分钟（${h} 小时）` : `${m} 分钟`;
}

function fmtAvg9(strokes: number, holes: number): string {
  if (!Number.isFinite(strokes) || strokes <= 0 || holes <= 0) return '—';
  return (strokes / holes).toFixed(1);
}

type Draft = {
  date: string;
  courseName: string;
  courseRating: string;
  slopeRating: string;
  adjustedGrossScore: string;
  holes: 18 | 9;
  notes: string;
  weather: string;
  /** 手填同组姓名串，保存时解析并与系统已写入的 playingPartners 字段对应 */
  partnersLine: string;
  teeTime: string;
  durationTotalMinutes: string;
  durationFront9Minutes: string;
  durationBack9Minutes: string;
};

function LossAnalysisBlock({ data }: { data: HandicapHoleData[] }) {
  const worst = useMemo(() => worstHoles(data, 3), [data]);
  const maxOver = Math.max(...worst.map((w) => w.over), 1);
  const b = useMemo(() => lossBreakdown(data), [data]);
  const cScore = useMemo(() => consistencyScore(data), [data]);
  const sumB = b.putting + b.shortGame + b.longGame + b.penalty;
  const flexP = Math.max(0.01, b.putting);
  const flexS = Math.max(0.01, b.shortGame);
  const flexL = Math.max(0.01, b.longGame);
  const flexF = Math.max(0.01, b.penalty);
  const legend: { key: string; label: string; color: string; pct: number }[] = [
    { key: 'p', label: '推杆', color: LOSS_PUTT, pct: b.putting },
    { key: 's', label: '短杆', color: LOSS_SHORT, pct: b.shortGame },
    { key: 'l', label: '长杆', color: LOSS_LONG, pct: b.longGame },
    { key: 'f', label: '罚杆', color: LOSS_PEN, pct: b.penalty },
  ];

  let lossStrip: ReactNode;
  if (sumB <= 0) {
    lossStrip = <View style={styles.lossStripEmpty} />;
  } else {
    lossStrip = (
      <View style={styles.lossStrip}>
        {b.putting > 0 ? (
          <View style={[styles.lossSeg, { flex: flexP, backgroundColor: LOSS_PUTT }]} />
        ) : null}
        {b.shortGame > 0 ? (
          <View style={[styles.lossSeg, { flex: flexS, backgroundColor: LOSS_SHORT }]} />
        ) : null}
        {b.longGame > 0 ? (
          <View style={[styles.lossSeg, { flex: flexL, backgroundColor: LOSS_LONG }]} />
        ) : null}
        {b.penalty > 0 ? (
          <View style={[styles.lossSeg, { flex: flexF, backgroundColor: LOSS_PEN }]} />
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.analysisTitle}>失分分析</Text>
      <Text style={styles.analysisSub}>最差 3 洞</Text>
      {worst.map((w) => (
        <View key={w.hole} style={styles.worstRow}>
          <View style={styles.worstLeft}>
            <Text style={styles.worstMain}>
              第{w.hole}洞 · Par{w.par} · {w.score}杆
              {w.over > 0 ? <Text style={styles.worstOver}> +{w.over}</Text> : null}
            </Text>
            <View style={styles.worstBarTrack}>
              <View
                style={[
                  styles.worstBarFill,
                  {
                    width: `${Math.min(100, Math.max(0, maxOver > 0 ? (w.over / maxOver) * 100 : 0))}%`,
                  },
                ]}
              />
            </View>
          </View>
        </View>
      ))}
      <Text style={[styles.analysisSub, styles.analysisSubSpaced]}>失分构成</Text>
      {lossStrip}
      <View style={styles.lossLegendRow}>
        {legend.map((it) => (
          <View key={it.key} style={styles.lossLegendCell}>
            <View style={[styles.lossDot, { backgroundColor: it.color }]} />
            <Text style={styles.lossLegendLab}>{it.label}</Text>
            <Text style={styles.lossLegendVal}>{it.pct}%</Text>
          </View>
        ))}
      </View>
      <Text style={[styles.analysisSub, styles.analysisSubSpaced]}>稳定性评分</Text>
      <Text style={styles.consistencyBig}>
        {cScore}
        <Text style={styles.consistencySlash}> / 100</Text>
      </Text>
      <Text style={styles.consistencyHint}>{consistencyLabel(cScore)}</Text>
    </View>
  );
}

function amendRequesterId(record: HandicapRecord, appUid: string): string {
  if (record.sourceMatchId != null && typeof record.requesterPlayerIndex === 'number') {
    return `peer:${record.id}:${record.requesterPlayerIndex}`;
  }
  return appUid;
}

function paramOne(v: string | string[] | undefined): string | undefined {
  if (v == null) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

export default function HandicapDetailScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const params = useLocalSearchParams<{
    id?: string;
    cmpB?: string;
    cmpW?: string;
    from?: string | string[];
    hf?: string | string[];
  }>();
  const { id } = params;
  const cmpB = paramOne(params.cmpB);
  const cmpW = paramOne(params.cmpW);
  const fromTab = pickFromParam(params.from);
  const historyOriginTab = pickFromParam(params.hf);
  const [records, setRecords] = useState<HandicapRecord[]>([]);
  const [record, setRecord] = useState<HandicapRecord | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [statsPutts, setStatsPutts] = useState('');
  const [statsFwHit, setStatsFwHit] = useState('');
  const [statsFwTotal, setStatsFwTotal] = useState('');
  const [statsGir, setStatsGir] = useState('');
  const [holeReviewEditing, setHoleReviewEditing] = useState(false);
  const [holeDataDraft, setHoleDataDraft] = useState<HandicapHoleData[] | null>(null);
  const [lockSeq, setLockSeq] = useState(0);
  const [amendOpen, setAmendOpen] = useState(false);
  const [amendReason, setAmendReason] = useState('');
  const [amendGross, setAmendGross] = useState('');
  const [amendCourse, setAmendCourse] = useState('');
  const [amendHoles, setAmendHoles] = useState<9 | 18>(18);
  const [amendBusy, setAmendBusy] = useState(false);
  const weatherStatsRef = useRef<TextInput>(null);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        await refreshServerTime();
        if (id) await getAmendmentRequests(id);
        setLockSeq((n) => n + 1);
      })();
      return () => {};
    }, [id]),
  );

  useEffect(() => {
    const loaded = loadHandicapRecords();
    setRecords(loaded);
    const matched = loaded.find((item) => item.id === id) ?? null;
    setRecord(matched);
    if (matched) {
      setDraft({
        date: matched.date,
        courseName: matched.courseName,
        courseRating: String(matched.courseRating),
        slopeRating: String(matched.slopeRating),
        adjustedGrossScore: String(matched.adjustedGrossScore),
        holes: matched.holes,
        notes: matched.notes,
        weather: typeof matched.weather === 'string' ? matched.weather : '',
        partnersLine: (matched.playingPartners ?? []).map((p) => p.name).join('、'),
        teeTime: typeof matched.teeTime === 'string' ? matched.teeTime : '',
        durationTotalMinutes:
          typeof matched.durationTotalMinutes === 'number' &&
          Number.isFinite(matched.durationTotalMinutes)
            ? String(matched.durationTotalMinutes)
            : '',
        durationFront9Minutes:
          typeof matched.durationFront9Minutes === 'number' &&
          Number.isFinite(matched.durationFront9Minutes)
            ? String(matched.durationFront9Minutes)
            : '',
        durationBack9Minutes:
          typeof matched.durationBack9Minutes === 'number' &&
          Number.isFinite(matched.durationBack9Minutes)
            ? String(matched.durationBack9Minutes)
            : '',
      });
      setStatsPutts(matched.totalPutts == null ? '' : String(matched.totalPutts));
      setStatsFwHit(matched.fairwaysHit == null ? '' : String(matched.fairwaysHit));
      setStatsFwTotal(matched.fairwaysTotal == null ? '' : String(matched.fairwaysTotal));
      setStatsGir(matched.greensInRegulation == null ? '' : String(matched.greensInRegulation));
    }
    setHoleReviewEditing(false);
    setHoleDataDraft(null);
  }, [id]);

  const locked = useMemo(() => {
    void lockSeq;
    return record ? isRoundLockedSync(record) : false;
  }, [record, lockSeq]);
  const statsPending = useMemo(
    () => (record ? recordHasPendingRoundStats(record) : false),
    [record],
  );
  const hasSavedHoleData = useMemo(
    () => Boolean(record?.holeData && record.holeData.length === record.holes),
    [record],
  );
  const analysisHoleData = useMemo(() => {
    if (!record) return null;
    if (holeReviewEditing && holeDataDraft && holeDataDraft.length === record.holes)
      return holeDataDraft;
    if (hasSavedHoleData && record.holeData) return record.holeData;
    return null;
  }, [record, holeReviewEditing, holeDataDraft, hasSavedHoleData]);

  useEffect(() => {
    if (locked) setIsEditing(false);
  }, [locked]);

  const parTotalFromRecord = useMemo(() => {
    if (!record?.holeDetails?.length || record.holeDetails.length !== record.holes) return 72;
    return record.holeDetails.reduce((s, h) => s + h.par, 0);
  }, [record]);

  const deepM = useMemo(() => (record ? computeRoundDeepStats(record) : null), [record]);

  const holeDetailsSorted = useMemo(
    () => [...(record?.holeDetails ?? [])].sort((a, b) => a.holeNumber - b.holeNumber),
    [record],
  );

  const previewDiff = useMemo(() => {
    if (!draft || !record) return null;
    const gross = Number(draft.adjustedGrossScore);
    if (!Number.isFinite(gross)) return null;
    const cr = Number(draft.courseRating);
    const sr = Number(draft.slopeRating);
    const pickedAuth = Boolean(record.courseCatalogId);
    const explicitCr = draft.courseRating.trim() !== '';
    const crsr = !pickedAuth && !explicitCr ? null : { courseRating: cr, slopeRating: sr };
    const r = calcRoundScoreDifferential(gross, draft.holes, crsr, parTotalFromRecord);
    return r.scoreDifferential;
  }, [draft, record, parTotalFromRecord]);

  /** 从「最好 vs 最差」点进场次详情时 URL 带 cmpB/cmpW；可后退时用 back 回到对比页，否则用此 href replace */
  const extremesCompareHref = useMemo((): Href | null => {
    if (cmpB && cmpW) {
      return `/handicap/extremes?bestId=${encodeURIComponent(cmpB)}&worstId=${encodeURIComponent(cmpW)}` as Href;
    }
    return null;
  }, [cmpB, cmpW]);

  const backToList = useCallback(() => {
    // 从「最好 vs 最差」push 进来时，优先用栈退回上一页（对比页）；Web 栈异常时再 replace 拼回对比 URL
    if (extremesCompareHref && router.canGoBack()) {
      router.back();
      return;
    }
    if (extremesCompareHref) {
      router.replace(extremesCompareHref);
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    if (fromTab === 'history') {
      router.replace(handicapHistoryHref(historyOriginTab));
      return;
    }
    const tabRet = returnHrefForFrom(fromTab);
    if (tabRet) {
      router.replace(tabRet);
      return;
    }
    router.replace(handicapIndexHref('score'));
  }, [router, extremesCompareHref, fromTab, historyOriginTab]);

  const openAmendModal = useCallback(() => {
    if (!record) return;
    setAmendReason('');
    setAmendGross(String(record.adjustedGrossScore));
    setAmendCourse(record.courseName);
    setAmendHoles(record.holes);
    setAmendOpen(true);
  }, [record]);

  async function submitAmendment() {
    if (!record) return;
    const reason = amendReason.trim();
    if (!reason) {
      Alert.alert('提示', '请填写申请理由');
      return;
    }
    const gross = Number(amendGross.trim());
    if (!Number.isFinite(gross) || gross < 1 || gross > 199) {
      Alert.alert('提示', '请输入合理的总杆数');
      return;
    }
    const course = amendCourse.trim();
    if (!course) {
      Alert.alert('提示', '请填写球场名称');
      return;
    }
    setAmendBusy(true);
    try {
      const appUid = await getAppUserId(session);
      const rid = amendRequesterId(record, appUid);
      const voters = (record.playingPartners ?? []).filter((p) => p.userId !== rid);
      const nm = session?.email?.split('@')[0]?.trim() || '我';
      const res = await createAmendmentRequest({
        roundId: record.id,
        roundDate: record.date,
        requesterId: rid,
        requesterName: nm,
        originalValues: {
          totalScore: record.adjustedGrossScore,
          holes: record.holes,
          course: record.courseName,
        },
        proposedValues: { totalScore: gross, holes: amendHoles, course },
        reason,
        voters,
      });
      if (!res.ok) {
        Alert.alert('提交失败', res.message);
        return;
      }
      setAmendOpen(false);
      Alert.alert(
        '已提交',
        voters.length > 0
          ? '请等待同组球友在 App 内投票确认。'
          : '本场无同组玩家；申请满 48 小时且服务端校验通过后将自动批准（请保持可访问部署的修改 API）。',
      );
      void getAmendmentRequests(record.id).then(() => setLockSeq((n) => n + 1));
    } finally {
      setAmendBusy(false);
    }
  }

  function onBackPress() {
    if (!isEditing) {
      backToList();
      return;
    }
    const leave = () => {
      setIsEditing(false);
      backToList();
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

  async function onSave() {
    if (!record || !draft) return;
    await refreshServerTime();
    if (await isRoundLocked(record)) {
      Alert.alert('提示', '成绩已锁定，无法保存。');
      setLockSeq((n) => n + 1);
      return;
    }
    const gross = Number(draft.adjustedGrossScore);
    const cr = Number(draft.courseRating);
    const sr = Number(draft.slopeRating);
    if (!Number.isFinite(gross) || !Number.isFinite(cr) || !Number.isFinite(sr) || sr <= 0) return;

    const pickedAuthSave = Boolean(record.courseCatalogId);
    const explicitCrSave = draft.courseRating.trim() !== '';
    const crsrSave =
      !pickedAuthSave && !explicitCrSave ? null : { courseRating: cr, slopeRating: sr };
    const diffRes = calcRoundScoreDifferential(gross, draft.holes, crsrSave, parTotalFromRecord);

    const wTrim = draft.weather.trim();
    const ppParsed = playingPartnersFromManualNames(draft.partnersLine);
    const teeT = draft.teeTime.trim().slice(0, 40);
    const dTot = parseDurationMinutesInput(draft.durationTotalMinutes);
    const dF =
      draft.holes === 18 ? parseDurationMinutesInput(draft.durationFront9Minutes) : undefined;
    const dB =
      draft.holes === 18 ? parseDurationMinutesInput(draft.durationBack9Minutes) : undefined;
    const updated = markHandicapProcessingComplete(
      {
        ...record,
        date: draft.date.trim(),
        courseName: draft.courseName.trim(),
        courseRating: cr,
        slopeRating: sr,
        adjustedGrossScore: gross,
        holes: draft.holes,
        scoreDifferential: diffRes.scoreDifferential,
        differentialSource: diffRes.source,
        notes: draft.notes.trim(),
        ...(wTrim ? { weather: wTrim } : {}),
        ...(ppParsed?.length ? { playingPartners: ppParsed } : {}),
        ...(teeT ? { teeTime: teeT } : {}),
        ...(dTot != null ? { durationTotalMinutes: dTot } : {}),
        ...(dF != null ? { durationFront9Minutes: dF } : {}),
        ...(dB != null ? { durationBack9Minutes: dB } : {}),
      },
      true,
    );
    if (!wTrim) {
      delete (updated as { weather?: string }).weather;
    }
    if (!ppParsed?.length) {
      delete (updated as { playingPartners?: HandicapRecord['playingPartners'] }).playingPartners;
    }
    if (!teeT) {
      delete (updated as { teeTime?: string }).teeTime;
    }
    if (dTot == null) {
      delete (updated as { durationTotalMinutes?: number }).durationTotalMinutes;
    }
    if (draft.holes !== 18 || dF == null) {
      delete (updated as { durationFront9Minutes?: number }).durationFront9Minutes;
    }
    if (draft.holes !== 18 || dB == null) {
      delete (updated as { durationBack9Minutes?: number }).durationBack9Minutes;
    }

    const next = records.map((item) => (item.id === updated.id ? updated : item));
    saveHandicapRecords(next);
    const reloaded = loadHandicapRecords();
    setRecords(reloaded);
    setRecord(reloaded.find((x) => x.id === updated.id) ?? updated);
    setIsEditing(false);
    await consumeAmendmentForRound(updated.id);
    setLockSeq((n) => n + 1);
  }

  function parseOptionalNonNegInt(s: string): number | null | 'invalid' {
    const t = s.trim();
    if (!t) return null;
    if (!/^\d+$/.test(t)) return 'invalid';
    const n = Number(t);
    if (!Number.isFinite(n) || n < 0) return 'invalid';
    return Math.round(n);
  }

  async function onSaveStatsOnly() {
    if (!record || !draft) return;
    await refreshServerTime();
    const tp = parseOptionalNonNegInt(statsPutts);
    const fh = parseOptionalNonNegInt(statsFwHit);
    const ft = parseOptionalNonNegInt(statsFwTotal);
    const gir = parseOptionalNonNegInt(statsGir);
    if (tp === 'invalid' || fh === 'invalid' || ft === 'invalid' || gir === 'invalid') {
      Alert.alert('提示', '请输入有效的非负整数，或留空表示暂不填写。');
      return;
    }
    if (ft != null && ft > 0 && fh == null) {
      Alert.alert('提示', '已填写球道总数时请同时填写球道命中数。');
      return;
    }
    if (fh != null && ft == null) {
      Alert.alert('提示', '已填写球道命中时请同时填写球道总数。');
      return;
    }
    if (ft != null && ft > 0 && fh != null && fh > ft) {
      Alert.alert('提示', '球道命中数不能大于球道总数。');
      return;
    }
    const wTrim = (draft?.weather ?? '').trim();
    const updated: HandicapRecord = {
      ...record,
      totalPutts: tp,
      fairwaysHit: fh,
      fairwaysTotal: ft,
      greensInRegulation: gir,
      ...(wTrim ? { weather: wTrim } : {}),
    };
    if (!wTrim) {
      delete (updated as { weather?: string }).weather;
    }
    const next = records.map((item) => (item.id === updated.id ? updated : item));
    saveHandicapRecords(next);
    const reloaded = loadHandicapRecords();
    setRecords(reloaded);
    const nextRec = reloaded.find((x) => x.id === record.id) ?? updated;
    setRecord(nextRec);
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            weather: typeof nextRec.weather === 'string' ? nextRec.weather : '',
          }
        : prev,
    );
    setStatsPutts(nextRec.totalPutts == null ? '' : String(nextRec.totalPutts));
    setStatsFwHit(nextRec.fairwaysHit == null ? '' : String(nextRec.fairwaysHit));
    setStatsFwTotal(nextRec.fairwaysTotal == null ? '' : String(nextRec.fairwaysTotal));
    setStatsGir(nextRec.greensInRegulation == null ? '' : String(nextRec.greensInRegulation));
    Alert.alert('已保存', '统计字段已更新。');
  }

  const persistHoleData = useCallback(
    (rows: HandicapHoleData[]) => {
      if (!record) return;
      const updated: HandicapRecord = { ...record, holeData: rows };
      const next = records.map((item) => (item.id === updated.id ? updated : item));
      saveHandicapRecords(next);
      const reloaded = loadHandicapRecords();
      setRecords(reloaded);
      const nextRec = reloaded.find((x) => x.id === record.id) ?? updated;
      setRecord(nextRec);
      Alert.alert('已保存', '逐洞数据已保存。');
    },
    [record, records],
  );

  const startHoleReviewEdit = useCallback(() => {
    if (!record) return;
    void (async () => {
      await refreshServerTime();
      if (await isRoundLocked(record)) {
        Alert.alert('提示', '成绩已锁定，无法编辑逐洞数据。');
        setLockSeq((n) => n + 1);
        return;
      }
      const seed =
        record.holeData?.length === record.holes
          ? [...record.holeData]
          : (seedHandicapHoleDataFromHoleDetails(record.holeDetails, record.holes) ??
            createEmptyHandicapHoleData(record.holes));
      setHoleDataDraft(seed);
      setHoleReviewEditing(true);
    })();
  }, [record]);

  const cancelHoleReviewEdit = useCallback(() => {
    setHoleReviewEditing(false);
    setHoleDataDraft(null);
  }, []);

  const commitHoleReviewEdit = useCallback(() => {
    if (!holeDataDraft || !record) return;
    void (async () => {
      await refreshServerTime();
      if (await isRoundLocked(record)) {
        Alert.alert('提示', '成绩已锁定，无法保存逐洞数据。');
        setLockSeq((n) => n + 1);
        return;
      }
      persistHoleData(holeDataDraft);
      setHoleReviewEditing(false);
      setHoleDataDraft(null);
    })();
  }, [holeDataDraft, record, persistHoleData]);

  const persistAiReview = useCallback(
    (review: HandicapAiReview) => {
      if (!record) return;
      void (async () => {
        await refreshServerTime();
        if (await isRoundLocked(record)) {
          Alert.alert('提示', '成绩已锁定，无法更新复盘内容。');
          setLockSeq((n) => n + 1);
          return;
        }
        const updated: HandicapRecord = { ...record, aiReview: review };
        const next = records.map((item) => (item.id === updated.id ? updated : item));
        saveHandicapRecords(next);
        const reloaded = loadHandicapRecords();
        setRecords(reloaded);
        setRecord(reloaded.find((x) => x.id === record.id) ?? updated);
      })();
    },
    [record, records],
  );

  async function onDelete() {
    if (!record) return;
    await refreshServerTime();
    if (await isRoundLocked(record)) {
      Alert.alert('提示', '成绩已锁定，无法删除。');
      setLockSeq((n) => n + 1);
      return;
    }
    const remove = () => {
      const next = records.filter((item) => item.id !== record.id);
      saveHandicapRecords(next);
      if (fromTab === 'history') {
        router.replace(handicapHistoryHref(historyOriginTab));
        return;
      }
      const tabRet = returnHrefForFrom(fromTab);
      if (tabRet) {
        router.replace(tabRet);
        return;
      }
      router.replace(handicapIndexHref('score'));
    };
    if (Platform.OS === 'web' && typeof globalThis.confirm === 'function') {
      if (globalThis.confirm('删除后差点将重新计算，确认删除？')) remove();
      return;
    }
    Alert.alert('删除成绩', '删除后差点将重新计算，确认删除？', [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: remove },
    ]);
  }

  if (!record || !draft) {
    return (
      <View style={styles.container}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.contentEmpty}
          showsVerticalScrollIndicator={false}
        >
          <Pressable onPress={backToList} style={styles.backBtnEmpty}>
            <Text style={styles.backTxtEmpty}>‹ 返回</Text>
          </Pressable>
          <Text style={styles.pageTitleEmpty}>成绩详情</Text>
          <View style={styles.cardEmpty}>
            <Text style={styles.emptyTxt}>未找到这场成绩。</Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  const puttsMetric = roundPuttsDisplayCount(record);
  const girPctMetric =
    deepM?.girPct != null
      ? deepM.girPct
      : typeof record.greensInRegulation === 'number' &&
          Number.isFinite(record.greensInRegulation) &&
          record.holes > 0
        ? Math.round((record.greensInRegulation / record.holes) * 1000) / 10
        : null;
  const firPctMetric = deepM?.firPct;
  const vsParVal = deepM?.vsParTotal;
  const vsParTxt = vsParVal != null && Number.isFinite(vsParVal) ? fmtVsPar(vsParVal) : '—';
  const vsParOrange = vsParVal != null && vsParVal > 0;
  const eq18Num = equivalent18FromGrossAndHoles(record.adjustedGrossScore, record.holes);
  const eq18Line =
    record.holes === 9 && Number.isFinite(eq18Num)
      ? `等效 18 洞 · ${eq18Num % 1 === 0 ? eq18Num : eq18Num.toFixed(1)} 杆`
      : '18 洞标准计分';
  const grossHero =
    isEditing && !locked ? draft.adjustedGrossScore : String(record.adjustedGrossScore);
  const microHero =
    typeof previewDiff === 'number' ? previewDiff.toFixed(1) : record.scoreDifferential.toFixed(1);
  const crShow =
    Number.isFinite(record.courseRating) && record.courseRating > 0
      ? String(record.courseRating)
      : '—';
  const srShow =
    Number.isFinite(record.slopeRating) && record.slopeRating > 0
      ? String(record.slopeRating)
      : '—';
  const parShow = String(parTotalFromRecord);
  const frontAvg =
    record.holes === 18 && record.front9Strokes > 0
      ? fmtAvg9(record.front9Strokes, 9)
      : record.holes === 9 && record.front9Strokes > 0
        ? fmtAvg9(record.front9Strokes, 9)
        : '—';
  const backAvg =
    record.holes === 18 && record.back9Strokes > 0 ? fmtAvg9(record.back9Strokes, 9) : '—';
  const total18Line = `${record.adjustedGrossScore} 杆`;
  const partnersLine =
    (record.playingPartners ?? []).length > 0
      ? (record.playingPartners ?? []).map((p) => p.name).join('、')
      : '未填写';
  const hasHoleDetailsView = holeDetailsSorted.length === record.holes && record.holes > 0;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerBar}>
          <View style={styles.headerLeft}>
            <Pressable onPress={onBackPress} hitSlop={10} accessibilityRole="button">
              <Text style={styles.backChevron}>‹ 返回</Text>
            </Pressable>
            <Text style={styles.headerTitle}>成绩详情</Text>
            <Text style={styles.headerSub} numberOfLines={2}>
              {record.date} · {record.courseName}
            </Text>
          </View>
          <View style={styles.headerActions}>
            {locked ? (
              <Pressable style={styles.amendBtn} onPress={openAmendModal} hitSlop={6}>
                <Text style={styles.amendBtnTxt}>申请修改</Text>
              </Pressable>
            ) : null}
            {!locked ? (
              <Pressable
                style={styles.headerEditOutline}
                onPress={() => {
                  if (isEditing) {
                    void onSave();
                    return;
                  }
                  void (async () => {
                    if (!record) return;
                    await refreshServerTime();
                    if (await isRoundLocked(record)) {
                      Alert.alert('提示', '成绩已锁定，无法编辑。');
                      setLockSeq((n) => n + 1);
                      return;
                    }
                    setIsEditing(true);
                  })();
                }}
              >
                <Text style={styles.headerEditOutlineTxt}>{isEditing ? '保存' : '编辑'}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroColLeft}>
              <Text style={styles.heroMiniLab}>总杆数</Text>
              <Text style={styles.heroBigNum}>{grossHero}</Text>
              <Text style={styles.heroFootLab}>{eq18Line}</Text>
            </View>
            <View style={styles.heroColMid}>
              <Text
                style={[styles.heroMidNum, vsParOrange ? styles.heroMidNumOrange : null]}
                numberOfLines={1}
              >
                {vsParTxt}
              </Text>
              <Text style={styles.heroFootLab}>vs Par</Text>
            </View>
            <View style={styles.heroColRight}>
              <Text style={styles.heroMiniLab}>微差</Text>
              <View style={styles.heroMicroRow}>
                <Text style={styles.heroBigNum}>{microHero}</Text>
                {!isEditing &&
                (record.differentialSource === 'estimated' ||
                  (Boolean(record.courseCatalogId) && record.courseCatalogVerified === false)) ? (
                  <Text
                    style={styles.microTilde}
                    accessibilityHint={
                      record.differentialSource === 'estimated'
                        ? '球场数据未录入，微差为估算值'
                        : '球场目录数据待核实，微差按当前 CR/SR 以 WHS 计算，请以官方记分卡为准'
                    }
                    accessibilityRole="text"
                  >
                    ~
                  </Text>
                ) : null}
              </View>
              <Text style={styles.heroFootLab}>Score Diff</Text>
            </View>
          </View>
          <View style={styles.heroRule} />
          <View style={styles.heroBottomRow}>
            <View style={styles.heroGridCol}>
              <Text style={styles.heroGridLab}>前九均杆</Text>
              <Text style={[styles.heroGridNum, frontAvg === '—' && styles.heroGridNumMuted]}>
                {frontAvg}
              </Text>
            </View>
            <View style={styles.heroGridCol}>
              <Text style={styles.heroGridLab}>后九均杆</Text>
              <Text style={[styles.heroGridNum, backAvg === '—' && styles.heroGridNumMuted]}>
                {backAvg}
              </Text>
            </View>
            <View style={styles.heroGridCol}>
              <Text style={styles.heroGridLab}>18 洞总杆</Text>
              <Text style={styles.heroGridNum}>{total18Line}</Text>
            </View>
          </View>
        </View>

        <View style={styles.holeSection}>
          <View style={styles.holeSectionHead}>
            <Text style={styles.holeSectionTitle}>逐洞数据</Text>
            {holeReviewEditing ? (
              <View style={styles.holeEditActions}>
                <Pressable onPress={cancelHoleReviewEdit} hitSlop={8}>
                  <Text style={styles.holeCancelLink}>取消</Text>
                </Pressable>
                <Pressable onPress={commitHoleReviewEdit} hitSlop={8}>
                  <Text style={styles.holeEditLink}>保存</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={startHoleReviewEdit} hitSlop={8}>
                <Text style={styles.holeEntryLink}>录入 ›</Text>
              </Pressable>
            )}
          </View>
          {holeReviewEditing ? (
            <View style={styles.holeGridWrap}>
              <HoleReviewGrid
                holeCount={record.holes}
                data={
                  holeDataDraft && holeDataDraft.length === record.holes
                    ? holeDataDraft
                    : (record.holeData ?? holeDataDraft ?? [])
                }
                mode="edit"
                onChange={(next) => setHoleDataDraft(next)}
              />
            </View>
          ) : hasHoleDetailsView ? (
            <View style={styles.holeGridWrap}>
              <View style={styles.holeNineRow}>
                {holeDetailsSorted
                  .filter((h) => h.holeNumber <= 9)
                  .map((h) => (
                    <View key={h.holeNumber} style={styles.holeCell}>
                      <Text style={styles.holeCellNum}>{h.holeNumber}</Text>
                      <Text
                        style={[
                          styles.holeCellScore,
                          { color: strokeColorForCell(h.strokes, h.par) },
                        ]}
                      >
                        {h.strokes}
                      </Text>
                    </View>
                  ))}
              </View>
              {record.holes === 18 ? <View style={styles.holeRowRule} /> : null}
              {record.holes === 18 ? (
                <View style={styles.holeNineRow}>
                  {holeDetailsSorted
                    .filter((h) => h.holeNumber > 9)
                    .map((h) => (
                      <View key={h.holeNumber} style={styles.holeCell}>
                        <Text style={styles.holeCellNum}>{h.holeNumber}</Text>
                        <Text
                          style={[
                            styles.holeCellScore,
                            { color: strokeColorForCell(h.strokes, h.par) },
                          ]}
                        >
                          {h.strokes}
                        </Text>
                      </View>
                    ))}
                </View>
              ) : null}
            </View>
          ) : hasSavedHoleData ? (
            <View style={styles.holeGridWrap}>
              <HoleReviewGrid
                holeCount={record.holes}
                data={record.holeData ?? []}
                mode="view"
              />
            </View>
          ) : (
            <View style={styles.holeEmptyWrap}>
              <Text style={styles.holeEmptyTxt}>暂无逐洞数据</Text>
              <Pressable style={styles.holeEntryOutline} onPress={startHoleReviewEdit}>
                <Text style={styles.holeEntryOutlineTxt}>录入 ›</Text>
              </Pressable>
            </View>
          )}
        </View>

        <Text style={styles.sectionHeading}>球场信息</Text>
        <View style={styles.listCard}>
          <View style={styles.listRow}>
            <Text style={styles.listLab}>球场名称</Text>
            <Text style={styles.listVal} numberOfLines={3}>
              {record.courseName}
            </Text>
          </View>
          <View style={styles.listRule} />
          <View style={styles.listRow}>
            <Text style={styles.listLab}>台位</Text>
            <Text style={styles.listVal}>
              {record.courseLayoutKey?.trim() ? record.courseLayoutKey.trim() : '标准场'}
            </Text>
          </View>
          <View style={styles.listRule} />
          <View style={styles.crRow}>
            <View style={styles.crCell}>
              <Text style={styles.crLab}>CR</Text>
              <Text style={styles.crNum}>{crShow}</Text>
            </View>
            <View style={styles.crCell}>
              <Text style={styles.crLab}>SR</Text>
              <Text style={styles.crNum}>{srShow}</Text>
            </View>
            <View style={styles.crCell}>
              <Text style={styles.crLab}>Par</Text>
              <Text style={styles.crNum}>{parShow}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionHeading}>关键指标</Text>
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLab}>推杆</Text>
            <Text style={styles.kpiNum}>{puttsMetric != null ? String(puttsMetric) : '—'}</Text>
            <Text style={styles.kpiSub}>
              {puttsMetric != null && record.holes > 0
                ? `每洞 ${(puttsMetric / record.holes).toFixed(2)}`
                : '每洞 —'}
            </Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLab}>GIR</Text>
            <Text style={styles.kpiNum}>
              {girPctMetric != null ? `${girPctMetric.toFixed(0)}%` : '—'}
            </Text>
            <Text style={styles.kpiSub}>
              {typeof record.greensInRegulation === 'number' && Number.isFinite(record.greensInRegulation)
                ? `${Math.round(record.greensInRegulation)}/${record.holes} 洞`
                : '—'}
            </Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLab}>FIR · Par4/5</Text>
            <Text style={styles.kpiNum}>
              {firPctMetric != null ? `${firPctMetric.toFixed(0)}%` : '—'}
            </Text>
            <Text style={styles.kpiSub}>
              {typeof record.fairwaysHit === 'number' &&
              typeof record.fairwaysTotal === 'number' &&
              record.fairwaysTotal > 0
                ? `${record.fairwaysHit}/${record.fairwaysTotal} 洞`
                : '—'}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionHeading}>场地条件</Text>
        <View style={styles.listCard}>
          <View style={styles.listRow}>
            <Text style={styles.listLab}>天气</Text>
            <View style={styles.listRowRight}>
              {draft.weather.trim() ? (
                <Text style={styles.listValSm}>{draft.weather.trim()}</Text>
              ) : (
                <>
                  <Text style={styles.listPlaceholder}>未填写</Text>
                  <Pressable onPress={() => weatherStatsRef.current?.focus()} hitSlop={8}>
                    <Text style={styles.addLink}>+ 添加</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
          <View style={styles.listRule} />
          <View style={styles.listRow}>
            <Text style={styles.listLab}>开球时间</Text>
            <Text style={record.teeTime?.trim() ? styles.listValSm : styles.listPlaceholder}>
              {record.teeTime?.trim() ? record.teeTime.trim() : '未填写'}
            </Text>
          </View>
          <View style={styles.listRule} />
          <View style={styles.listRow}>
            <Text style={styles.listLab}>整场用时</Text>
            <Text
              style={
                record.durationTotalMinutes != null &&
                Number.isFinite(record.durationTotalMinutes) &&
                record.durationTotalMinutes > 0
                  ? styles.listValSm
                  : styles.listPlaceholder
              }
            >
              {fmtDurationDetail(record.durationTotalMinutes)}
            </Text>
          </View>
          <View style={styles.listRule} />
          <View style={styles.listRow}>
            <Text style={styles.listLab}>同组</Text>
            <Text style={partnersLine === '未填写' ? styles.listPlaceholder : styles.listValSm}>
              {partnersLine}
            </Text>
          </View>
        </View>

        {isEditing && !locked ? (
          <View style={styles.editCard}>
            <Text style={styles.editCardTitle}>编辑本场信息</Text>
            <Text style={styles.editLab}>日期</Text>
            <TextInput
              value={draft.date}
              onChangeText={(v) => setDraft((prev) => (prev ? { ...prev, date: v } : prev))}
              style={styles.editInput}
            />
            <Text style={styles.editLab}>球场名称</Text>
            <TextInput
              value={draft.courseName}
              onChangeText={(v) => setDraft((prev) => (prev ? { ...prev, courseName: v } : prev))}
              style={styles.editInput}
            />
            <Text style={styles.editLab}>球场难度系数（CR）</Text>
            <TextInput
              value={draft.courseRating}
              onChangeText={(v) => setDraft((prev) => (prev ? { ...prev, courseRating: v } : prev))}
              style={styles.editInput}
              keyboardType="decimal-pad"
            />
            <Text style={styles.editLab}>坡度系数（SR）</Text>
            <TextInput
              value={draft.slopeRating}
              onChangeText={(v) => setDraft((prev) => (prev ? { ...prev, slopeRating: v } : prev))}
              style={styles.editInput}
              keyboardType="number-pad"
            />
            <Text style={styles.editLab}>洞数</Text>
            <View style={styles.chipRow}>
              <Pressable
                style={[styles.chip, draft.holes === 18 && styles.chipOn]}
                onPress={() => setDraft((prev) => (prev ? { ...prev, holes: 18 } : prev))}
              >
                <Text style={[styles.chipTxt, draft.holes === 18 && styles.chipTxtOn]}>18 洞</Text>
              </Pressable>
              <Pressable
                style={[styles.chip, draft.holes === 9 && styles.chipOn]}
                onPress={() => setDraft((prev) => (prev ? { ...prev, holes: 9 } : prev))}
              >
                <Text style={[styles.chipTxt, draft.holes === 9 && styles.chipTxtOn]}>9 洞</Text>
              </Pressable>
            </View>
            <Text style={styles.editLab}>调整后总杆</Text>
            <TextInput
              value={draft.adjustedGrossScore}
              onChangeText={(v) =>
                setDraft((prev) => (prev ? { ...prev, adjustedGrossScore: v } : prev))
              }
              style={styles.editInput}
              keyboardType="number-pad"
            />
            <Text style={styles.editLab}>备注</Text>
            <TextInput
              value={draft.notes}
              onChangeText={(v) => setDraft((prev) => (prev ? { ...prev, notes: v } : prev))}
              style={styles.editInputMultiline}
              multiline
              textAlignVertical="top"
            />
            <Text style={styles.editLab}>同组（手填）</Text>
            <TextInput
              value={draft.partnersLine}
              onChangeText={(v) => setDraft((prev) => (prev ? { ...prev, partnersLine: v } : prev))}
              style={styles.editInput}
              placeholder="逗号或顿号分隔"
              placeholderTextColor={EMPTY_HINT}
            />
            <Text style={styles.editLab}>开球时间</Text>
            <TextInput
              value={draft.teeTime}
              onChangeText={(v) => setDraft((prev) => (prev ? { ...prev, teeTime: v } : prev))}
              style={styles.editInput}
              placeholder="如 07:32"
              placeholderTextColor={EMPTY_HINT}
            />
            <Text style={styles.editLab}>整场用时（分钟）</Text>
            <TextInput
              value={draft.durationTotalMinutes}
              onChangeText={(v) =>
                setDraft((prev) => (prev ? { ...prev, durationTotalMinutes: v } : prev))
              }
              style={styles.editInput}
              placeholder="如 240"
              placeholderTextColor={EMPTY_HINT}
              keyboardType="number-pad"
            />
            {draft.holes === 18 ? (
              <>
                <Text style={styles.editLab}>前 9 用时（分钟）</Text>
                <TextInput
                  value={draft.durationFront9Minutes}
                  onChangeText={(v) =>
                    setDraft((prev) => (prev ? { ...prev, durationFront9Minutes: v } : prev))
                  }
                  style={styles.editInput}
                  keyboardType="number-pad"
                />
                <Text style={styles.editLab}>后 9 用时（分钟）</Text>
                <TextInput
                  value={draft.durationBack9Minutes}
                  onChangeText={(v) =>
                    setDraft((prev) => (prev ? { ...prev, durationBack9Minutes: v } : prev))
                  }
                  style={styles.editInput}
                  keyboardType="number-pad"
                />
              </>
            ) : null}
          </View>
        ) : null}

        {locked ? (
          <View style={styles.lockBanner}>
            <Ionicons name="lock-closed" size={14} color={ACCENT} style={styles.lockIcon} />
            <View style={styles.lockTextCol}>
              <Text style={styles.lockTitle}>成绩已锁定</Text>
              <Text style={styles.lockDesc}>超过 24 小时，仅可修改推杆 / FIR / GIR 统计</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.statsBlock}>
          <View style={styles.statsHeadRow}>
            <Text style={styles.sectionHeadingFlat}>统计修正</Text>
            <Text style={styles.statsHeadHint}>不影响差点</Text>
          </View>
          {statsPending ? <Text style={styles.statsPendingInline}>待补填</Text> : null}
          <View style={styles.statsCard}>
            <View style={styles.statsGrid2}>
              <View style={styles.statCell}>
                <Text style={styles.statCellLab}>推杆总数</Text>
                <TextInput
                  value={statsPutts}
                  onChangeText={setStatsPutts}
                  style={styles.statCellInput}
                  keyboardType="number-pad"
                  placeholder="—"
                  placeholderTextColor={MUTED}
                />
              </View>
              <View style={styles.statCell}>
                <Text style={styles.statCellLab}>球道命中</Text>
                <TextInput
                  value={statsFwHit}
                  onChangeText={setStatsFwHit}
                  style={styles.statCellInput}
                  keyboardType="number-pad"
                  placeholder="—"
                  placeholderTextColor={MUTED}
                />
              </View>
              <View style={styles.statCell}>
                <Text style={styles.statCellLab}>球道总数</Text>
                <TextInput
                  value={statsFwTotal}
                  onChangeText={setStatsFwTotal}
                  style={styles.statCellInput}
                  keyboardType="number-pad"
                  placeholder="—"
                  placeholderTextColor={MUTED}
                />
              </View>
              <View style={styles.statCell}>
                <Text style={styles.statCellLab}>GIR 洞数</Text>
                <TextInput
                  value={statsGir}
                  onChangeText={setStatsGir}
                  style={styles.statCellInput}
                  keyboardType="number-pad"
                  placeholder="—"
                  placeholderTextColor={MUTED}
                />
              </View>
            </View>
            <Text style={styles.weatherStatLab}>上场天气</Text>
            <TextInput
              ref={weatherStatsRef}
              value={draft.weather}
              onChangeText={(v) => setDraft((prev) => (prev ? { ...prev, weather: v } : prev))}
              style={styles.weatherStatInput}
              placeholder="晴 · 22° · 微风"
              placeholderTextColor={MUTED}
            />
            <Pressable style={styles.statsSaveBtn} onPress={() => void onSaveStatsOnly()}>
              <Text style={styles.statsSaveBtnTxt}>保存统计</Text>
            </Pressable>
          </View>
        </View>

        {analysisHoleData ? (
          <>
            <LossAnalysisBlock data={analysisHoleData} />
            <AIRoundReview
              round={record}
              holeData={analysisHoleData}
              initialReview={record.aiReview}
              onPersist={persistAiReview}
            />
          </>
        ) : null}

        {!locked ? (
          <Pressable style={styles.deleteBtn} onPress={() => void onDelete()}>
            <Text style={styles.deleteBtnText}>删除这场成绩</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <Modal
        visible={amendOpen}
        transparent
        animationType="fade"
        onRequestClose={() => !amendBusy && setAmendOpen(false)}
      >
        <View style={styles.amendMask}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => !amendBusy && setAmendOpen(false)}
          />
          <View style={styles.amendSheet}>
            <Text style={styles.amendTitle}>申请修改成绩</Text>
            <Text style={styles.amendSub}>原始（只读）</Text>
            <Text style={styles.amendReadonly}>
              {record.adjustedGrossScore} 杆 · {record.holes} 洞 · {record.courseName}
            </Text>
            <Text style={styles.amendSub}>修改后</Text>
            <TextInput
              value={amendGross}
              onChangeText={setAmendGross}
              keyboardType="number-pad"
              placeholder="总杆"
              placeholderTextColor={EMPTY_HINT}
              style={styles.amendInput}
            />
            <View style={styles.chipRow}>
              <Pressable
                style={[styles.chip, amendHoles === 18 && styles.chipOn]}
                onPress={() => setAmendHoles(18)}
              >
                <Text style={[styles.chipTxt, amendHoles === 18 && styles.chipTxtOn]}>18 洞</Text>
              </Pressable>
              <Pressable
                style={[styles.chip, amendHoles === 9 && styles.chipOn]}
                onPress={() => setAmendHoles(9)}
              >
                <Text style={[styles.chipTxt, amendHoles === 9 && styles.chipTxtOn]}>9 洞</Text>
              </Pressable>
            </View>
            <TextInput
              value={amendCourse}
              onChangeText={setAmendCourse}
              placeholder="球场名称"
              placeholderTextColor={EMPTY_HINT}
              style={styles.amendInput}
            />
            <Text style={styles.amendSub}>申请理由（必填）</Text>
            <TextInput
              value={amendReason}
              onChangeText={setAmendReason}
              placeholder="说明修改原因，如：记错了推杆数"
              placeholderTextColor={EMPTY_HINT}
              style={styles.amendReason}
              multiline
              textAlignVertical="top"
            />
            <Text style={styles.amendSub}>同组玩家</Text>
            {record.sourceMatchId != null &&
            typeof record.requesterPlayerIndex === 'number' &&
            (record.playingPartners?.length ?? 0) > 0 ? (
              (record.playingPartners ?? []).map((p) => {
                const rid = `peer:${record.id}:${record.requesterPlayerIndex}`;
                const isReq = p.userId === rid;
                return (
                  <View key={p.userId} style={styles.amendPeerRow}>
                    <View style={styles.amendAvatar}>
                      <Text style={styles.amendAvatarTxt}>{p.name.slice(0, 1)}</Text>
                    </View>
                    <Text style={styles.amendPeerName}>{p.name}</Text>
                    <Text style={styles.amendPeerState}>{isReq ? '申请人' : '待投票'}</Text>
                  </View>
                );
              })
            ) : (
              <Text style={styles.amendHint}>本场无同组玩家，修改申请将在 48 小时后自动生效</Text>
            )}
            <Pressable
              style={[styles.amendSubmit, amendBusy && { opacity: 0.5 }]}
              disabled={amendBusy}
              onPress={() => void submitAmendment()}
            >
              <Text style={styles.amendSubmitTxt}>{amendBusy ? '提交中…' : '确认提交'}</Text>
            </Pressable>
            <Pressable
              style={styles.amendCancel}
              disabled={amendBusy}
              onPress={() => setAmendOpen(false)}
            >
              <Text style={styles.amendCancelTxt}>取消</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  flex: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'web' ? 40 : 12,
    paddingBottom: 24 + TAB_BAR_SCROLL_EXTRA,
    ...Platform.select({
      web: {
        flexGrow: 1,
        justifyContent: 'flex-start',
        alignItems: 'stretch',
      },
      default: { flexGrow: 0 },
    }),
  },
  contentEmpty: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'web' ? 40 : 16,
    paddingBottom: 32,
  },
  backBtnEmpty: { alignSelf: 'flex-start', marginBottom: 12 },
  backTxtEmpty: { fontSize: 22, fontWeight: '600', color: SUBTITLE },
  pageTitleEmpty: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 12 },
  cardEmpty: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 18,
  },
  emptyTxt: { fontSize: 13, fontWeight: '600', color: MUTED },

  headerBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  headerLeft: { flex: 1, minWidth: 0 },
  backChevron: { fontSize: 22, fontWeight: '600', color: SUBTITLE, marginBottom: 4 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  headerSub: { fontSize: 11, fontWeight: '500', color: SUBTITLE, marginTop: 4, lineHeight: 15 },
  headerActions: { alignItems: 'flex-end', gap: 8, flexShrink: 0 },
  headerEditOutline: {
    backgroundColor: OUTLINE_BTN_BG,
    borderWidth: 1,
    borderColor: OUTLINE_BTN_BORDER,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  headerEditOutlineTxt: { fontSize: 13, fontWeight: '700', color: ACCENT },

  heroCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
  },
  heroTopRow: { flexDirection: 'row', alignItems: 'flex-start' },
  heroColLeft: { flex: 1, minWidth: 0 },
  heroColMid: { width: 88, alignItems: 'center', paddingTop: 4 },
  heroColRight: { flex: 1, minWidth: 0, alignItems: 'flex-end' },
  heroMiniLab: { fontSize: 11, fontWeight: '700', color: SUBTITLE, marginBottom: 4 },
  heroBigNum: {
    fontSize: 44,
    fontWeight: '800',
    color: ACCENT,
    letterSpacing: -1.5,
    lineHeight: 48,
  },
  heroMidNum: { fontSize: 18, fontWeight: '800', color: ACCENT, letterSpacing: -0.5 },
  heroMidNumOrange: { color: ORANGE_WARN },
  heroFootLab: { fontSize: 11, fontWeight: '600', color: MUTED, marginTop: 4 },
  heroMicroRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  microTilde: { fontSize: 18, fontWeight: '800', color: ORANGE_WARN, marginLeft: 2 },
  heroRule: { height: 1, backgroundColor: DIVIDER, marginVertical: 16 },
  heroBottomRow: { flexDirection: 'row' },
  heroGridCol: { flex: 1, alignItems: 'center' },
  heroGridLab: { fontSize: 10, fontWeight: '700', color: MUTED, marginBottom: 6 },
  heroGridNum: { fontSize: 20, fontWeight: '800', color: VALUE_MAIN, letterSpacing: -0.5 },
  heroGridNumMuted: { color: MUTED },

  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: SECTION_TITLE,
    marginBottom: 8,
    marginTop: 14,
  },
  sectionHeadingFlat: {
    fontSize: 13,
    fontWeight: '700',
    color: SECTION_TITLE,
  },
  listCard: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 14,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  listRowRight: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'flex-end' },
  listLab: { fontSize: 11, fontWeight: '600', color: MUTED, width: 56, flexShrink: 0 },
  listVal: { flex: 1, fontSize: 13, fontWeight: '700', color: VALUE_MAIN, textAlign: 'right' },
  listValSm: { flex: 1, fontSize: 13, fontWeight: '600', color: VALUE_MAIN, textAlign: 'right' },
  listPlaceholder: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: SUBTITLE,
    fontStyle: 'italic',
    textAlign: 'right',
  },
  addLink: { fontSize: 11, fontWeight: '700', color: ACCENT },
  listRule: { height: 1, backgroundColor: DIVIDER, marginLeft: 14 },
  crRow: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 8 },
  crCell: { flex: 1, alignItems: 'center' },
  crLab: { fontSize: 11, fontWeight: '600', color: MUTED, marginBottom: 4 },
  crNum: { fontSize: 14, fontWeight: '800', color: ACCENT },

  kpiRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  kpiCard: {
    flex: 1,
    backgroundColor: CARD_BG,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 13,
    minWidth: 0,
  },
  kpiLab: { fontSize: 11, fontWeight: '700', color: SUBTITLE, marginBottom: 6 },
  kpiNum: { fontSize: 22, fontWeight: '800', color: ACCENT, letterSpacing: -0.5 },
  kpiSub: { fontSize: 10, fontWeight: '600', color: MUTED, marginTop: 4 },

  editCard: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    gap: 6,
  },
  editCardTitle: { fontSize: 13, fontWeight: '800', color: '#fff', marginBottom: 8 },
  editLab: { fontSize: 11, fontWeight: '600', color: MUTED, marginTop: 6 },
  editInput: {
    backgroundColor: INPUT_BG,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  editInputMultiline: {
    backgroundColor: INPUT_BG,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    minHeight: 72,
    textAlignVertical: 'top',
  },

  lockBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: LOCK_TINT,
    borderLeftWidth: 3,
    borderLeftColor: ACCENT,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  lockIcon: { marginTop: 1 },
  lockTextCol: { flex: 1, minWidth: 0 },
  lockTitle: { fontSize: 12, fontWeight: '700', color: ACCENT, marginBottom: 4 },
  lockDesc: { fontSize: 11, fontWeight: '600', color: MUTED, lineHeight: 16 },

  statsBlock: { marginBottom: 14 },
  statsHeadRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 6,
    marginTop: 14,
  },
  statsHeadHint: { fontSize: 10, fontWeight: '500', color: SUBTITLE },
  statsPendingInline: { fontSize: 11, fontWeight: '700', color: ORANGE_WARN, marginBottom: 8 },
  statsCard: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 14,
  },
  statsGrid2: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  statCell: { width: '47%', flexGrow: 1, minWidth: '42%' },
  statCellLab: { fontSize: 11, fontWeight: '600', color: MUTED, marginBottom: 6 },
  statCellInput: {
    backgroundColor: INPUT_BG,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    fontWeight: '800',
    color: ACCENT,
  },
  weatherStatLab: { fontSize: 11, fontWeight: '600', color: MUTED, marginBottom: 6 },
  weatherStatInput: {
    backgroundColor: INPUT_BG,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  statsSaveBtn: {
    marginTop: 2,
    backgroundColor: OUTLINE_BTN_BORDER,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  statsSaveBtnTxt: { fontSize: 14, fontWeight: '800', color: ACCENT },

  holeSection: { marginBottom: 14 },
  holeGridWrap: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  holeNineRow: { flexDirection: 'row', flexWrap: 'nowrap', justifyContent: 'space-between' },
  holeCell: { flex: 1, alignItems: 'center', minWidth: 0, paddingVertical: 4 },
  holeCellNum: { fontSize: 9, fontWeight: '600', color: MUTED, marginBottom: 2 },
  holeCellScore: { fontSize: 13, fontWeight: '800' },
  holeRowRule: { height: 1, backgroundColor: DIVIDER, marginVertical: 8 },
  holeEntryLink: { fontSize: 11, fontWeight: '700', color: ACCENT },
  holeEntryOutline: {
    borderWidth: 1,
    borderColor: OUTLINE_BTN_BORDER,
    backgroundColor: OUTLINE_BTN_BG,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  holeEntryOutlineTxt: { fontSize: 12, fontWeight: '700', color: ACCENT },

  card: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    borderWidth: 0,
    padding: 14,
    marginBottom: 14,
  },
  chipRow: { flexDirection: 'row', gap: 8, marginBottom: 2 },
  chip: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 999,
    backgroundColor: DARK_PAGE.surface,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipOn: { borderColor: GREEN, backgroundColor: LIGHT_GREEN },
  chipTxt: { fontSize: 13, color: TEXT_SECONDARY },
  chipTxtOn: { color: GREEN, fontWeight: '700' },
  deleteBtn: {
    backgroundColor: RED,
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 12,
  },
  deleteBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  empty: { fontSize: 13, color: TEXT_SECONDARY },

  holeSectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  holeSectionTitle: { fontSize: 13, fontWeight: '700', color: SECTION_MUTED },
  holeEditLink: { fontSize: 11, fontWeight: '700', color: SECTION_EDIT },
  holeCancelLink: { fontSize: 11, fontWeight: '700', color: TEXT_SECONDARY },
  holeEditActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  holeEmptyWrap: { alignItems: 'center', paddingVertical: 8, gap: 12 },
  holeEmptyTxt: { fontSize: 12, fontWeight: '500', color: EMPTY_HINT },
  holeEntryBtn: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: DARK_PAGE.cardBorder,
    backgroundColor: 'transparent',
  },
  holeEntryBtnTxt: { fontSize: 13, fontWeight: '700', color: SECTION_EDIT },

  analysisTitle: { fontSize: 13, fontWeight: '700', color: SECTION_MUTED, marginBottom: 8 },
  analysisSub: { fontSize: 12, fontWeight: '700', color: TEXT_SECONDARY, marginBottom: 8 },
  analysisSubSpaced: { marginTop: 14 },
  worstRow: { marginBottom: 10 },
  worstLeft: { gap: 6 },
  worstMain: { fontSize: 13, fontWeight: '600', color: TEXT_PRIMARY },
  worstOver: { fontSize: 13, fontWeight: '700', color: '#d94848' },
  worstBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  worstBarFill: { height: 6, borderRadius: 3, backgroundColor: 'rgba(217,72,72,0.6)' },
  lossStrip: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  lossStripEmpty: {
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  lossSeg: { height: '100%' },
  lossLegendRow: { flexDirection: 'row', marginTop: 10, flexWrap: 'wrap', gap: 8 },
  lossLegendCell: { flex: 1, minWidth: '22%', alignItems: 'center', gap: 4 },
  lossDot: { width: 7, height: 7, borderRadius: 3.5 },
  lossLegendLab: { fontSize: 11, fontWeight: '600', color: TEXT_SECONDARY, textAlign: 'center' },
  lossLegendVal: { fontSize: 12, fontWeight: '800', color: SECTION_EDIT },
  consistencyBig: { fontSize: 22, fontWeight: '800', color: GREEN },
  consistencySlash: { fontSize: 14, fontWeight: '600', color: EMPTY_HINT },
  consistencyHint: {
    fontSize: 12,
    fontWeight: '500',
    color: TEXT_SECONDARY,
    marginTop: 6,
    lineHeight: 18,
  },

  amendBtn: {
    borderWidth: 1,
    borderColor: ORANGE,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'transparent',
  },
  amendBtnTxt: { color: ORANGE, fontSize: 13, fontWeight: '700' },
  amendMask: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 16,
  },
  amendSheet: {
    backgroundColor: CARD_FILL,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    maxHeight: '88%',
  },
  amendTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    marginBottom: 14,
    textAlign: 'center',
  },
  amendSub: {
    fontSize: 11,
    fontWeight: '700',
    color: SECTION_MUTED,
    marginBottom: 6,
    marginTop: 8,
  },
  amendReadonly: { fontSize: 13, fontWeight: '600', color: TEXT_SECONDARY, marginBottom: 4 },
  amendInput: {
    borderWidth: 1,
    borderColor: DARK_PAGE.inputBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: DARK_PAGE.inputBg,
    fontSize: 14,
    color: TEXT_PRIMARY,
    marginBottom: 8,
  },
  amendReason: {
    borderWidth: 1,
    borderColor: DARK_PAGE.inputBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 80,
    backgroundColor: DARK_PAGE.inputBg,
    fontSize: 14,
    color: TEXT_PRIMARY,
    marginBottom: 8,
  },
  amendHint: { fontSize: 12, fontWeight: '600', color: ORANGE, lineHeight: 18, marginBottom: 8 },
  amendPeerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  amendAvatar: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  amendAvatarTxt: { fontSize: 14, fontWeight: '800', color: TEXT_PRIMARY },
  amendPeerName: { flex: 1, fontSize: 14, fontWeight: '600', color: TEXT_PRIMARY },
  amendPeerState: { fontSize: 12, fontWeight: '600', color: ORANGE },
  amendSubmit: {
    marginTop: 16,
    backgroundColor: GREEN,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  amendSubmitTxt: { fontSize: 15, fontWeight: '800', color: '#0d1b11' },
  amendCancel: { marginTop: 10, paddingVertical: 10, alignItems: 'center' },
  amendCancelTxt: { fontSize: 14, fontWeight: '600', color: TEXT_SECONDARY },
});
