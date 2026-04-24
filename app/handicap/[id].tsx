import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AIRoundReview } from '@/components/AIRoundReview';
import { HoleReviewGrid } from '@/components/HoleReviewGrid';
import { RoundLockIndicator } from '@/components/RoundLockIndicator';
import { DARK_PAGE } from '@/constants/theme';
import {
  calcRoundScoreDifferential,
  createEmptyHandicapHoleData,
  loadHandicapRecords,
  recordHasPendingRoundStats,
  saveHandicapRecords,
  seedHandicapHoleDataFromHoleDetails,
  type HandicapAiReview,
  type HandicapHoleData,
  type HandicapRecord,
} from '@/lib/handicap';
import { useAuth } from '@/contexts/auth-context';
import { consistencyLabel, consistencyScore, lossBreakdown, worstHoles } from '@/utils/holeAnalysis';
import { createAmendmentRequest, getAmendmentRequests, consumeAmendmentForRound } from '@/utils/amendmentRequest';
import { isRoundLocked, isRoundLockedSync, markHandicapProcessingComplete } from '@/utils/roundLock';
import { refreshServerTime } from '@/utils/serverTime';
import { getAppUserId } from '@/utils/userIdentity';

const GREEN = DARK_PAGE.accent;
const BG = DARK_PAGE.bg;
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

type Draft = {
  date: string;
  courseName: string;
  courseRating: string;
  slopeRating: string;
  adjustedGrossScore: string;
  holes: 18 | 9;
  notes: string;
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
        {b.putting > 0 ? <View style={[styles.lossSeg, { flex: flexP, backgroundColor: LOSS_PUTT }]} /> : null}
        {b.shortGame > 0 ? <View style={[styles.lossSeg, { flex: flexS, backgroundColor: LOSS_SHORT }]} /> : null}
        {b.longGame > 0 ? <View style={[styles.lossSeg, { flex: flexL, backgroundColor: LOSS_LONG }]} /> : null}
        {b.penalty > 0 ? <View style={[styles.lossSeg, { flex: flexF, backgroundColor: LOSS_PEN }]} /> : null}
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
              {w.over > 0 ? (
                <Text style={styles.worstOver}>
                  {' '}
                  +{w.over}
                </Text>
              ) : null}
            </Text>
            <View style={styles.worstBarTrack}>
              <View
                style={[
                  styles.worstBarFill,
                  { width: `${Math.min(100, Math.max(0, maxOver > 0 ? (w.over / maxOver) * 100 : 0))}%` },
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

export default function HandicapDetailScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { id } = useLocalSearchParams<{ id?: string }>();
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
  const statsPending = useMemo(() => (record ? recordHasPendingRoundStats(record) : false), [record]);
  const hasSavedHoleData = useMemo(
    () =>
      Boolean(record?.holeData && record.holeData.length === record.holes),
    [record],
  );
  const analysisHoleData = useMemo(() => {
    if (!record) return null;
    if (holeReviewEditing && holeDataDraft && holeDataDraft.length === record.holes) return holeDataDraft;
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

  function backToList() {
    router.replace('/handicap');
  }

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
        voters.length > 0 ? '请等待同组球友在 App 内投票确认。' : '本场无同组玩家；申请满 48 小时且服务端校验通过后将自动批准（请保持可访问部署的修改 API）。',
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
    const crsrSave = !pickedAuthSave && !explicitCrSave ? null : { courseRating: cr, slopeRating: sr };
    const diffRes = calcRoundScoreDifferential(gross, draft.holes, crsrSave, parTotalFromRecord);

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
      },
      true,
    );

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
    if (!record) return;
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
    const updated: HandicapRecord = {
      ...record,
      totalPutts: tp,
      fairwaysHit: fh,
      fairwaysTotal: ft,
      greensInRegulation: gir,
    };
    const next = records.map((item) => (item.id === updated.id ? updated : item));
    saveHandicapRecords(next);
    const reloaded = loadHandicapRecords();
    setRecords(reloaded);
    const nextRec = reloaded.find((x) => x.id === record.id) ?? updated;
    setRecord(nextRec);
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
          : seedHandicapHoleDataFromHoleDetails(record.holeDetails, record.holes) ??
            createEmptyHandicapHoleData(record.holes);
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
      router.replace('/handicap');
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
        <View style={styles.content}>
          <Pressable onPress={backToList} style={styles.backBtn}>
            <Text style={styles.backTxt}>← 返回</Text>
          </Pressable>
          <Text style={styles.title}>成绩详情</Text>
          <View style={styles.card}>
            <Text style={styles.empty}>未找到这场成绩。</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} bounces={false}>
        <View style={styles.headerRow}>
          <Pressable onPress={onBackPress} style={styles.backBtn}>
            <Text style={styles.backTxt}>← 返回</Text>
          </Pressable>
          <Text style={styles.title}>成绩详情</Text>
          <View style={styles.headerRight}>
            <RoundLockIndicator round={record} />
            {locked ? (
              <Pressable style={styles.amendBtn} onPress={openAmendModal} hitSlop={6}>
                <Text style={styles.amendBtnTxt}>申请修改</Text>
              </Pressable>
            ) : (
              <Pressable
                style={styles.editBtn}
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
                }}>
                <Text style={styles.editBtnText}>{isEditing ? '保存' : '编辑'}</Text>
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>日期</Text>
          {isEditing && !locked ? (
            <TextInput value={draft.date} onChangeText={(v) => setDraft((prev) => (prev ? { ...prev, date: v } : prev))} style={styles.input} />
          ) : (
            <Text style={styles.value}>{record.date}</Text>
          )}

          <Text style={styles.label}>球场名称</Text>
          {isEditing && !locked ? (
            <TextInput
              value={draft.courseName}
              onChangeText={(v) => setDraft((prev) => (prev ? { ...prev, courseName: v } : prev))}
              style={styles.input}
            />
          ) : (
            <Text style={styles.value}>{record.courseName}</Text>
          )}

          <Text style={styles.label}>球场难度系数</Text>
          {isEditing && !locked ? (
            <TextInput
              value={draft.courseRating}
              onChangeText={(v) => setDraft((prev) => (prev ? { ...prev, courseRating: v } : prev))}
              style={styles.input}
              keyboardType="decimal-pad"
            />
          ) : (
            <Text style={styles.value}>{record.courseRating}</Text>
          )}

          <Text style={styles.label}>坡度系数</Text>
          {isEditing && !locked ? (
            <TextInput
              value={draft.slopeRating}
              onChangeText={(v) => setDraft((prev) => (prev ? { ...prev, slopeRating: v } : prev))}
              style={styles.input}
              keyboardType="number-pad"
            />
          ) : (
            <Text style={styles.value}>{record.slopeRating}</Text>
          )}

          <Text style={styles.label}>洞数</Text>
          {isEditing && !locked ? (
            <View style={styles.chipRow}>
              <Pressable style={[styles.chip, draft.holes === 18 && styles.chipOn]} onPress={() => setDraft((prev) => (prev ? { ...prev, holes: 18 } : prev))}>
                <Text style={[styles.chipTxt, draft.holes === 18 && styles.chipTxtOn]}>18洞</Text>
              </Pressable>
              <Pressable style={[styles.chip, draft.holes === 9 && styles.chipOn]} onPress={() => setDraft((prev) => (prev ? { ...prev, holes: 9 } : prev))}>
                <Text style={[styles.chipTxt, draft.holes === 9 && styles.chipTxtOn]}>9洞</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={styles.value}>{record.holes}洞</Text>
          )}

          <Text style={styles.label}>调整后总杆</Text>
          {isEditing && !locked ? (
            <TextInput
              value={draft.adjustedGrossScore}
              onChangeText={(v) => setDraft((prev) => (prev ? { ...prev, adjustedGrossScore: v } : prev))}
              style={styles.input}
              keyboardType="number-pad"
            />
          ) : (
            <Text style={styles.value}>{record.adjustedGrossScore}</Text>
          )}

          <Text style={styles.label}>微差</Text>
          <View style={styles.diffRow} accessible accessibilityLabel="微差">
            <Text style={styles.value}>
              {typeof previewDiff === 'number' ? previewDiff.toFixed(1) : record.scoreDifferential.toFixed(1)}
            </Text>
            {!isEditing && record.differentialSource === 'estimated' ? (
              <Text
                style={styles.diffTilde}
                accessibilityHint="球场数据未录入，微差为估算值"
                accessibilityRole="text">
                ~
              </Text>
            ) : null}
          </View>

          <Text style={styles.label}>备注</Text>
          {isEditing && !locked ? (
            <TextInput value={draft.notes} onChangeText={(v) => setDraft((prev) => (prev ? { ...prev, notes: v } : prev))} style={styles.notesInput} multiline textAlignVertical="top" />
          ) : (
            <Text style={styles.value}>{record.notes || '—'}</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.statsIntro}>
            {locked
              ? `成绩已锁定 · 总杆数不可修改\n推杆、球道、GIR 等统计数据不影响差点，仍可修正`
              : '推杆、球道、GIR 等统计不影响差点，可随时补全或修正。'}
          </Text>
          <View style={styles.statsTitleRow}>
            <Text style={styles.statsSectionTitle}>统计修正</Text>
            {statsPending ? <Text style={styles.statsPendingBadge}>待补填</Text> : null}
          </View>
          <Text style={styles.label}>推杆总数</Text>
          <View style={styles.statInputRow}>
            {record.totalPutts == null ? <View style={styles.statPendingDot} /> : <View style={styles.statDotSpacer} />}
            <TextInput value={statsPutts} onChangeText={setStatsPutts} style={styles.inputFlex} keyboardType="number-pad" />
          </View>
          <Text style={styles.label}>球道上球道数</Text>
          <View style={styles.statInputRow}>
            {record.fairwaysTotal == null ? <View style={styles.statPendingDot} /> : <View style={styles.statDotSpacer} />}
            <TextInput value={statsFwTotal} onChangeText={setStatsFwTotal} style={styles.inputFlex} keyboardType="number-pad" />
          </View>
          <Text style={styles.label}>球道命中</Text>
          <View style={styles.statInputRow}>
            {record.fairwaysHit == null ? <View style={styles.statPendingDot} /> : <View style={styles.statDotSpacer} />}
            <TextInput value={statsFwHit} onChangeText={setStatsFwHit} style={styles.inputFlex} keyboardType="number-pad" />
          </View>
          <Text style={styles.label}>上果岭数（GIR）</Text>
          <View style={styles.statInputRow}>
            {record.greensInRegulation == null ? <View style={styles.statPendingDot} /> : <View style={styles.statDotSpacer} />}
            <TextInput value={statsGir} onChangeText={setStatsGir} style={styles.inputFlex} keyboardType="number-pad" />
          </View>
          <Pressable style={styles.statsSaveBtn} onPress={() => void onSaveStatsOnly()}>
            <Text style={styles.statsSaveBtnTxt}>保存统计</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
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
            ) : hasSavedHoleData ? (
              <Pressable onPress={startHoleReviewEdit} hitSlop={8}>
                <Text style={styles.holeEditLink}>编辑</Text>
              </Pressable>
            ) : null}
          </View>
          {!hasSavedHoleData && !holeReviewEditing ? (
            <View style={styles.holeEmptyWrap}>
              <Text style={styles.holeEmptyTxt}>暂无逐洞数据</Text>
              <Pressable style={styles.holeEntryBtn} onPress={startHoleReviewEdit}>
                <Text style={styles.holeEntryBtnTxt}>录入</Text>
              </Pressable>
            </View>
          ) : (
            <HoleReviewGrid
              holeCount={record.holes}
              data={holeReviewEditing && holeDataDraft ? holeDataDraft : record.holeData ?? holeDataDraft ?? []}
              mode={holeReviewEditing ? 'edit' : 'view'}
              onChange={holeReviewEditing ? (next) => setHoleDataDraft(next) : undefined}
            />
          )}
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

      <Modal visible={amendOpen} transparent animationType="fade" onRequestClose={() => !amendBusy && setAmendOpen(false)}>
        <View style={styles.amendMask}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => !amendBusy && setAmendOpen(false)} />
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
              <Pressable style={[styles.chip, amendHoles === 18 && styles.chipOn]} onPress={() => setAmendHoles(18)}>
                <Text style={[styles.chipTxt, amendHoles === 18 && styles.chipTxtOn]}>18 洞</Text>
              </Pressable>
              <Pressable style={[styles.chip, amendHoles === 9 && styles.chipOn]} onPress={() => setAmendHoles(9)}>
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
            {record.sourceMatchId != null && typeof record.requesterPlayerIndex === 'number' && (record.playingPartners?.length ?? 0) > 0 ? (
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
              onPress={() => void submitAmendment()}>
              <Text style={styles.amendSubmitTxt}>{amendBusy ? '提交中…' : '确认提交'}</Text>
            </Pressable>
            <Pressable style={styles.amendCancel} disabled={amendBusy} onPress={() => setAmendOpen(false)}>
              <Text style={styles.amendCancelTxt}>取消</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: Platform.OS === 'web' ? 44 : 16, paddingBottom: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8 },
  backBtn: { width: 56 },
  backTxt: { color: TEXT_SECONDARY, fontWeight: '600' },
  title: { flex: 1, textAlign: 'center', fontSize: 20, fontWeight: '700', color: TEXT_PRIMARY },
  headerRight: { minWidth: 88, alignItems: 'flex-end', gap: 6 },
  editBtn: {
    borderWidth: 0.5,
    borderColor: GREEN,
    borderRadius: 10,
    backgroundColor: LIGHT_GREEN,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  editBtnText: { color: GREEN, fontSize: 13, fontWeight: '700' },
  card: { backgroundColor: CARD_FILL, borderRadius: 14, borderWidth: 1, borderColor: BORDER, padding: 14, marginBottom: 10 },
  statsIntro: {
    fontSize: 11,
    fontWeight: '500',
    color: '#8a9a8e',
    lineHeight: 16,
    marginBottom: 10,
  },
  statsTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  statsSectionTitle: { fontSize: 15, fontWeight: '700', color: TEXT_PRIMARY },
  statsPendingBadge: { fontSize: 11, fontWeight: '700', color: ORANGE },
  statInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  statPendingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ORANGE,
  },
  statDotSpacer: { width: 8, height: 8 },
  inputFlex: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: DARK_PAGE.inputBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: DARK_PAGE.inputBg,
    fontSize: 14,
    color: TEXT_PRIMARY,
  },
  statsSaveBtn: {
    marginTop: 14,
    backgroundColor: ORANGE,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  statsSaveBtnTxt: { fontSize: 14, fontWeight: '700', color: '#0d1b11' },
  label: { fontSize: 12, color: TEXT_SECONDARY, marginBottom: 6, marginTop: 6 },
  value: { fontSize: 14, color: TEXT_PRIMARY, fontWeight: '600' },
  diffRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'nowrap', gap: 2 },
  diffTilde: { fontSize: 14, fontWeight: '700', color: ORANGE, marginLeft: 2 },
  input: {
    borderWidth: 1,
    borderColor: DARK_PAGE.inputBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: DARK_PAGE.inputBg,
    fontSize: 14,
    color: TEXT_PRIMARY,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: DARK_PAGE.inputBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 86,
    backgroundColor: DARK_PAGE.inputBg,
    fontSize: 14,
    color: TEXT_PRIMARY,
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
  consistencyHint: { fontSize: 12, fontWeight: '500', color: TEXT_SECONDARY, marginTop: 6, lineHeight: 18 },

  amendBtn: {
    borderWidth: 1,
    borderColor: ORANGE,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'transparent',
  },
  amendBtnTxt: { color: ORANGE, fontSize: 13, fontWeight: '700' },
  amendMask: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 16 },
  amendSheet: {
    backgroundColor: CARD_FILL,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    maxHeight: '88%',
  },
  amendTitle: { fontSize: 17, fontWeight: '800', color: TEXT_PRIMARY, marginBottom: 14, textAlign: 'center' },
  amendSub: { fontSize: 11, fontWeight: '700', color: SECTION_MUTED, marginBottom: 6, marginTop: 8 },
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
