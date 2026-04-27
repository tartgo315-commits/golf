import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { fetchBriefingChat } from '@/lib/round-review-ai';
import { loadHandicapRecords } from '@/lib/handicap';
import {
  buildBriefingPrompt,
  parseBriefingResponse,
  type BriefingMatchContext,
  type ParsedBriefing,
} from '@/utils/buildBriefingPrompt';
import {
  getMatchDayRecord,
  saveMatchDayBriefing,
  upsertMatchDayDraft,
  type MatchBriefingStored,
} from '@/utils/matchDayRecord';

const BG = '#0d1b11';
const ACCENT = '#b5ff3a';
const ON_ACCENT = '#0d1b11';
const WHITE = '#ffffff';
const LABEL = '#8a9a8e';
const BODY = '#a8b5ac';
const WARN = '#e89b3a';
const QUOTE = '#2d5436';
const ORANGE_BORDER = '#e89b3a';
const ORANGE_BG = 'rgba(232,155,58,0.06)';
const GREEN_BG = 'rgba(181,255,58,0.06)';

export type AIBriefingProps = {
  visible: boolean;
  onClose: () => void;
  match: BriefingMatchContext;
  /** Footer 主按钮：创建实时记分或跳转记分页后由外层 onClose 关 Modal */
  onStartMatch?: () => void | Promise<void>;
  /** 底部主按钮文案，默认「开始比赛」 */
  primaryActionLabel?: string;
};

function storedToParsed(s: MatchBriefingStored): ParsedBriefing {
  const f = [...s.focus, '', '', ''].slice(0, 3);
  return {
    strategy: s.strategy,
    focus: f,
    leverage: s.leverage,
    mindset: s.mindset,
  };
}

export function AIBriefing({
  visible,
  onClose,
  match,
  onStartMatch,
  primaryActionLabel = '开始比赛',
}: AIBriefingProps) {
  const sheetH = useMemo(() => Math.round(Dimensions.get('window').height * 0.85), []);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedBriefing | null>(null);
  const [raw, setRaw] = useState('');
  const [historyThin, setHistoryThin] = useState(false);
  const [regenToken, setRegenToken] = useState(0);
  const anim = useRef(new Animated.Value(0)).current;
  const animLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (!loading) {
      animLoop.current?.stop();
      anim.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    animLoop.current = loop;
    loop.start();
    return () => {
      loop.stop();
    };
  }, [loading, anim]);

  const barTx = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [-120, Dimensions.get('window').width],
  });

  const runFetch = useCallback(async () => {
    setErr(null);
    const records = loadHandicapRecords();
    const { prompt, historyThin: thin } = buildBriefingPrompt(records, match);
    setHistoryThin(thin);
    setLoading(true);
    setParsed(null);
    setRaw('');
    try {
      const text = await fetchBriefingChat(prompt);
      setRaw(text);
      const p = parseBriefingResponse(text);
      if (p) {
        setParsed(p);
      } else {
        setParsed({
          strategy: text.slice(0, 200),
          focus: ['', '', ''],
          leverage: '',
          mindset: '',
        });
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : '生成失败');
      setParsed(null);
    } finally {
      setLoading(false);
    }
  }, [match]);

  useEffect(() => {
    if (!visible) return;
    void upsertMatchDayDraft({
      courseName: match.courseName,
      holes: match.holes,
      mode: match.gameModeLabel,
      players: match.players,
    });
  }, [visible, match.courseName, match.holes, match.gameModeLabel, match.players]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      if (regenToken === 0) {
        const rec = await getMatchDayRecord();
        const b = rec?.briefing;
        if (b && b.strategy.trim()) {
          if (!cancelled) {
            setParsed(storedToParsed(b));
            setRaw(b.rawText ?? '');
            setLoading(false);
            setErr(null);
          }
          return;
        }
      }
      if (!cancelled) void runFetch();
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, regenToken, runFetch]);

  useEffect(() => {
    if (!visible) {
      setErr(null);
      setParsed(null);
      setRaw('');
      setLoading(false);
      setRegenToken(0);
    }
  }, [visible]);

  const onSave = useCallback(async () => {
    if (!parsed) return;
    const stored: MatchBriefingStored = {
      strategy: parsed.strategy,
      focus: parsed.focus.filter(Boolean).slice(0, 3),
      leverage: parsed.leverage,
      mindset: parsed.mindset,
      rawText: raw || undefined,
      generatedAt: Date.now(),
    };
    await saveMatchDayBriefing(stored);
    const msg = '已保存';
    if (Platform.OS === 'web' && typeof globalThis.alert === 'function') {
      globalThis.alert(msg);
      return;
    }
    Alert.alert('提示', msg);
  }, [parsed, raw]);

  const onRegenerate = useCallback(() => {
    setRegenToken((t) => t + 1);
  }, []);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.mask}>
        <Pressable style={styles.maskFill} onPress={onClose} accessibilityLabel="关闭背景" />
        <View style={[styles.sheet, { height: sheetH }]}>
          <View style={styles.topBar}>
            <Pressable onPress={onClose} hitSlop={10}>
              <Text style={styles.topClose}>关闭</Text>
            </Pressable>
            <Text style={styles.topTitle}>今日战术简报</Text>
            <Pressable onPress={() => void onSave()} hitSlop={10} disabled={!parsed}>
              <Text style={[styles.topSave, !parsed && styles.topSaveOff]}>保存</Text>
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.progressTrack} pointerEvents="none">
              <Animated.View style={[styles.progressBar, { transform: [{ translateX: barTx }] }]} />
            </View>
          ) : (
            <View style={styles.progressPlaceholder} />
          )}

          {historyThin ? (
            <View style={styles.warnBanner}>
              <Text style={styles.warnBannerTxt}>历史数据较少，建议仅供参考</Text>
            </View>
          ) : null}

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {loading ? (
              <View style={styles.skelWrap}>
                {[1, 2, 3, 4].map((k) => (
                  <View
                    key={k}
                    style={[
                      styles.skelLine,
                      { width: k === 1 ? '100%' : k === 2 ? '88%' : k === 3 ? '72%' : '56%' },
                    ]}
                  />
                ))}
              </View>
            ) : err ? (
              <Text style={styles.errTxt}>{err}</Text>
            ) : parsed ? (
              <>
                <View style={styles.coreBox}>
                  <Text style={styles.tag}>核心策略</Text>
                  <Text style={styles.coreBody}>{parsed.strategy}</Text>
                </View>
                <Text style={styles.focusTitle}>重点关注</Text>
                {parsed.focus.map((line, i) => (
                  <View key={i}>
                    {i > 0 ? <View style={styles.divider} /> : null}
                    <View style={styles.focusRow}>
                      <View style={styles.idxCircle}>
                        <Text style={styles.idxTxt}>{i + 1}</Text>
                      </View>
                      <Text style={styles.focusTxt}>{line.trim() || '—'}</Text>
                    </View>
                  </View>
                ))}
                <View style={styles.leverageBox}>
                  <Text style={styles.tag}>扬长避短</Text>
                  <Text style={styles.leverageBody}>{parsed.leverage.trim() || '—'}</Text>
                </View>
                <View style={styles.mindWrap}>
                  <Text style={styles.quoteDeco}>“</Text>
                  <Text style={styles.mindTxt}>{parsed.mindset.trim() || '—'}</Text>
                </View>
                <Pressable style={styles.regenBtn} onPress={onRegenerate} hitSlop={8}>
                  <Text style={styles.regenTxt}>重新生成</Text>
                </Pressable>
              </>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              style={styles.startBtn}
              onPress={() => {
                void (async () => {
                  try {
                    if (onStartMatch) await onStartMatch();
                  } catch (e) {
                    const msg = e instanceof Error ? e.message : '无法开始比赛';
                    if (Platform.OS === 'web' && typeof globalThis.alert === 'function') {
                      globalThis.alert(msg);
                    } else {
                      Alert.alert('提示', msg);
                    }
                    return;
                  }
                  onClose();
                })();
              }}
            >
              <Text style={styles.startBtnTxt}>{primaryActionLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  mask: { flex: 1, justifyContent: 'flex-end' },
  maskFill: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: BG,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  topClose: { fontSize: 14, fontWeight: '600', color: LABEL, minWidth: 44 },
  topTitle: { fontSize: 13, fontWeight: '700', color: WHITE, flex: 1, textAlign: 'center' },
  topSave: { fontSize: 14, fontWeight: '700', color: ACCENT, minWidth: 44, textAlign: 'right' },
  topSaveOff: { opacity: 0.35 },
  progressTrack: {
    height: 2,
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  progressBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 120,
    height: 2,
    backgroundColor: ACCENT,
  },
  progressPlaceholder: { height: 2 },
  warnBanner: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(232,155,58,0.08)',
  },
  warnBannerTxt: { fontSize: 11, fontWeight: '600', color: WARN, textAlign: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 },
  skelWrap: { gap: 10, paddingTop: 8 },
  skelLine: {
    height: 12,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignSelf: 'flex-start',
  },
  errTxt: { color: WARN, fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 16 },
  coreBox: {
    backgroundColor: GREEN_BG,
    borderLeftWidth: 3,
    borderLeftColor: ACCENT,
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
  },
  tag: { fontSize: 11, fontWeight: '700', color: LABEL, marginBottom: 8 },
  coreBody: { fontSize: 15, fontWeight: '800', color: WHITE, lineHeight: 22 },
  focusTitle: { fontSize: 13, fontWeight: '700', color: BODY, marginBottom: 8 },
  focusRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10 },
  idxCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  idxTxt: { fontSize: 12, fontWeight: '800', color: ACCENT },
  focusTxt: { flex: 1, fontSize: 13, fontWeight: '500', color: BODY, lineHeight: 20 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  leverageBox: {
    marginTop: 14,
    backgroundColor: ORANGE_BG,
    borderLeftWidth: 3,
    borderLeftColor: ORANGE_BORDER,
    borderRadius: 10,
    padding: 14,
  },
  leverageBody: { fontSize: 13, fontWeight: '500', color: BODY, lineHeight: 20 },
  mindWrap: { marginTop: 20, alignItems: 'center', paddingHorizontal: 8 },
  quoteDeco: { fontSize: 48, fontWeight: '800', color: QUOTE, lineHeight: 52, marginBottom: -8 },
  mindTxt: {
    fontSize: 14,
    fontWeight: '600',
    fontStyle: 'italic',
    color: LABEL,
    textAlign: 'center',
    lineHeight: 22,
  },
  regenBtn: { alignSelf: 'center', marginTop: 16, paddingVertical: 8 },
  regenTxt: { fontSize: 12, fontWeight: '700', color: LABEL },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 22 : 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  startBtn: {
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  startBtnTxt: { fontSize: 15, fontWeight: '800', color: ON_ACCENT },
});
