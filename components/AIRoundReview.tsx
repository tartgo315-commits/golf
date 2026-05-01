import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

import { fetchRoundReviewChat } from '@/lib/round-review-ai';
import type { HandicapAiReview, HandicapHoleData, HandicapRecord } from '@/lib/handicap';
import { buildAIPrompt, parseStructuredAiReview } from '@/utils/holeAnalysis';
import { saveAiReviewDrillsToPlan } from '@/utils/trainingPlan';
import { THEME } from '@/constants/theme';

const CARD_BG = THEME.card;
const BORDER = THEME.accentBorder;
const ACCENT = THEME.accent;
const ON_ACCENT = THEME.textOnAccent;
const LABEL = THEME.text3;
const BODY = THEME.text2;
const TITLE = THEME.text1;
const MUTED_BTN = THEME.text3;
const WARN = '#e89b3a';
const PROBLEM_BORDER = '#d94848';
const STRAT_BORDER = THEME.accent;

const FAIL_MSG = '生成失败，请检查网络后重试';

function LampIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 18 18" fill="none">
      <Path
        d="M9 2.5 C 6.5 2.5 5 4.5 5 6.5 C 5 7.8 5.7 8.8 6.3 9.6 L 6.3 11 L 11.7 11 L 11.7 9.6 C 12.3 8.8 13 7.8 13 6.5 C 13 4.5 11.5 2.5 9 2.5 Z"
        stroke={ACCENT}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      <Line
        x1={6.5}
        y1={12.5}
        x2={11.5}
        y2={12.5}
        stroke={ACCENT}
        strokeWidth={1.4}
        strokeLinecap="round"
      />
      <Line
        x1={7.5}
        y1={14.5}
        x2={10.5}
        y2={14.5}
        stroke={ACCENT}
        strokeWidth={1.4}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function SkeletonLines() {
  return (
    <View style={styles.skelWrap}>
      <View style={[styles.skelLine, { width: '100%' }]} />
      <View style={[styles.skelLine, { width: '80%' }]} />
      <View style={[styles.skelLine, { width: '60%' }]} />
    </View>
  );
}

function toPersistedReview(
  raw: string,
  parsed: ReturnType<typeof parseStructuredAiReview>,
): HandicapAiReview {
  const generatedAt = Date.now();
  if (parsed) {
    return {
      problem: parsed.problem,
      drills: parsed.drills.slice(0, 3),
      strategy: parsed.strategy,
      generatedAt,
    };
  }
  return {
    problem: raw.trim().slice(0, 200) || '未能解析模型输出',
    drills: ['', '', ''],
    strategy: '',
    generatedAt,
    rawText: raw,
  };
}

export type AIRoundReviewProps = {
  round: HandicapRecord;
  holeData: HandicapHoleData[];
  initialReview: HandicapAiReview | undefined;
  onPersist: (review: HandicapAiReview) => void;
};

export function AIRoundReview({ round, holeData, initialReview, onPersist }: AIRoundReviewProps) {
  const [review, setReview] = useState<HandicapAiReview | undefined>(initialReview);
  const [loading, setLoading] = useState(false);
  const [showError, setShowError] = useState(false);

  useEffect(() => {
    setReview(initialReview);
  }, [initialReview]);

  const hasResult = Boolean(
    review &&
    (review.problem.trim() || review.strategy.trim() || review.drills.some((d) => d.trim())),
  );

  const runGenerate = useCallback(async () => {
    setShowError(false);
    setLoading(true);
    try {
      const prompt = buildAIPrompt(round, holeData);
      const raw = await fetchRoundReviewChat(prompt);
      const parsed = parseStructuredAiReview(raw);
      const next = toPersistedReview(raw, parsed);
      setReview(next);
      onPersist(next);
    } catch {
      setShowError(true);
    } finally {
      setLoading(false);
    }
  }, [round, holeData, onPersist]);

  const onSavePlan = useCallback(async () => {
    if (!review) return;
    const res = await saveAiReviewDrillsToPlan(round, holeData, review.drills);
    const msg = res.ok ? `已添加 ${res.added} 条训练计划` : res.message;
    if (Platform.OS === 'web' && typeof globalThis.alert === 'function') {
      globalThis.alert(msg);
      return;
    }
    Alert.alert('提示', msg);
  }, [round, holeData, review]);

  const canUse = holeData.length > 0;

  return (
    <View style={styles.card}>
      <View style={styles.heroRow}>
        <View style={styles.iconWrap}>
          <LampIcon />
        </View>
        <View style={styles.heroText}>
          <Text style={styles.heroTitle}>AI 复盘建议</Text>
          <Text style={styles.heroSub}>根据本场数据生成</Text>
        </View>
      </View>

      {loading ? (
        <>
          <View style={[styles.genBtn, styles.genBtnDisabled]}>
            <ActivityIndicator color={ON_ACCENT} size="small" />
            <Text style={[styles.genBtnTxtDisabled, { marginLeft: 10 }]}>分析中...</Text>
          </View>
          <SkeletonLines />
        </>
      ) : hasResult ? (
        <>
          <View style={[styles.block, styles.problemBlock]}>
            <Text style={styles.tag}>本场核心问题</Text>
            <Text style={styles.problemBody}>{review!.problem}</Text>
          </View>
          <View style={styles.block}>
            <Text style={styles.tag}>训练建议</Text>
            {review!.drills.map((line, i) => (
              <View key={i}>
                {i > 0 ? <View style={styles.divider} /> : null}
                <View style={styles.drillRow}>
                  <Text style={styles.drillIdx}>{i + 1}</Text>
                  <Text style={styles.drillTxt}>{line.trim() || '—'}</Text>
                </View>
              </View>
            ))}
          </View>
          <View style={[styles.block, styles.stratBlock]}>
            <Text style={styles.tag}>下场策略</Text>
            <Text style={styles.stratBody}>{review!.strategy.trim() || '—'}</Text>
          </View>
          <View style={styles.footerRow}>
            <Pressable onPress={() => void runGenerate()} hitSlop={8}>
              <Text style={styles.footerLeft}>重新生成</Text>
            </Pressable>
            <Pressable onPress={() => void onSavePlan()} hitSlop={8}>
              <Text style={styles.footerRight}>保存到训练计划</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <>
          {showError ? <Text style={styles.errTxt}>{FAIL_MSG}</Text> : null}
          <Pressable
            style={[styles.genBtn, (!canUse || loading) && styles.genBtnDisabled]}
            onPress={() => void runGenerate()}
            disabled={!canUse || loading}
          >
            <Text style={[styles.genBtnTxt, !canUse && styles.genBtnTxtDisabled]}>
              生成复盘建议 →
            </Text>
          </Pressable>
          {!canUse ? <Text style={styles.hintBelow}>请先录入逐洞数据</Text> : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    marginBottom: 10,
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(181,255,58,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: { flex: 1, minWidth: 0 },
  heroTitle: { fontSize: 16, fontWeight: '800', color: TITLE },
  heroSub: { fontSize: 12, fontWeight: '500', color: BODY, marginTop: 4 },
  genBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 8,
  },
  genBtnDisabled: { backgroundColor: 'rgba(181,255,58,0.25)' },
  genBtnTxt: { fontSize: 15, fontWeight: '800', color: ON_ACCENT },
  genBtnTxtDisabled: { color: 'rgba(13,27,17,0.45)' },
  hintBelow: {
    fontSize: 12,
    fontWeight: '500',
    color: MUTED_BTN,
    textAlign: 'center',
    marginBottom: 4,
  },
  errTxt: { fontSize: 12, fontWeight: '600', color: WARN, marginBottom: 10, textAlign: 'center' },
  skelWrap: { gap: 8, marginTop: 8, marginBottom: 4 },
  skelLine: {
    height: 12,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignSelf: 'flex-start',
  },
  block: { marginTop: 12 },
  problemBlock: {
    borderLeftWidth: 3,
    borderLeftColor: PROBLEM_BORDER,
    paddingLeft: 12,
  },
  stratBlock: {
    borderLeftWidth: 3,
    borderLeftColor: STRAT_BORDER,
    paddingLeft: 12,
  },
  tag: { fontSize: 11, fontWeight: '700', color: LABEL, marginBottom: 8 },
  problemBody: { fontSize: 15, fontWeight: '800', color: TITLE, lineHeight: 22 },
  drillRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 8 },
  drillIdx: { fontSize: 13, fontWeight: '800', color: ACCENT, width: 20 },
  drillTxt: { flex: 1, fontSize: 13, fontWeight: '500', color: BODY, lineHeight: 20 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  stratBody: { fontSize: 13, fontWeight: '500', color: BODY, lineHeight: 20 },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 4,
  },
  footerLeft: { fontSize: 11, fontWeight: '600', color: MUTED_BTN },
  footerRight: { fontSize: 11, fontWeight: '700', color: ACCENT },
});
