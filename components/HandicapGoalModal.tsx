import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const WIN = Dimensions.get('window');
const SHEET_MAX_H = Math.min(WIN.height * 0.55, 420);
const OFF_TRANSLATE = WIN.height;

const OVERLAY = 'rgba(0,0,0,0.6)';
const SHEET_BG = '#0d1b11';
const TEXT_CANCEL = '#8a9a8e';
const TEXT_TITLE = '#ffffff';
const TEXT_HINT = '#8a9a8e';
const ACCENT = '#b5ff3a';
const ON_ACCENT = '#0d1b11';
const WARN = '#e89b3a';

export type HandicapGoalModalProps = {
  visible: boolean;
  onRequestClose: () => void;
  currentHi: number | null;
  initialGoal: number | null;
  onSave: (value: number) => void;
};

function sanitizeOneDecimal(raw: string): string {
  const s = raw.replace(/[^\d.]/g, '');
  if (!s) return '';
  const firstDot = s.indexOf('.');
  const intRaw = (firstDot === -1 ? s : s.slice(0, firstDot)).replace(/\D/g, '').slice(0, 2);
  let intPart = intRaw;
  if (intPart !== '' && Number(intPart) > 54) intPart = '54';
  if (firstDot === -1) return intPart;
  const decRaw = s.slice(firstDot + 1).replace(/\D/g, '');
  const decPart = decRaw.slice(0, 1);
  const trailingDotOnly = decRaw === '' && s.endsWith('.');
  if (trailingDotOnly) return `${intPart || '0'}.`;
  const full = Number(`${intPart || '0'}.${decPart}`);
  if (Number.isFinite(full) && full > 54) return '54.0';
  if (decPart === '') return intPart || '0';
  return `${intPart || '0'}.${decPart}`;
}

function parseGoalNumber(s: string): number | null {
  const t = s.trim();
  if (t === '' || t === '.') return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return Math.round(Math.min(54, Math.max(0, n)) * 10) / 10;
}

export function HandicapGoalModal({
  visible,
  onRequestClose,
  currentHi,
  initialGoal,
  onSave,
}: HandicapGoalModalProps) {
  const [displayed, setDisplayed] = useState(false);
  const translateY = useRef(new Animated.Value(OFF_TRANSLATE)).current;
  const prevVisible = useRef(false);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (visible) setDisplayed(true);
  }, [visible]);

  useEffect(() => {
    if (visible && !prevVisible.current) {
      setDraft(initialGoal != null ? initialGoal.toFixed(1) : '');
    }
    prevVisible.current = visible;
  }, [visible, initialGoal]);

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

  const closeAfterAnim = useCallback(() => {
    onRequestClose();
  }, [onRequestClose]);

  const parsed = parseGoalNumber(draft);
  const needCurrent = typeof currentHi === 'number' && Number.isFinite(currentHi);
  const invalidGoal =
    parsed == null || !needCurrent || !(parsed < currentHi) || !(parsed >= 0 && parsed <= 54);
  const hintCurrent = needCurrent ? currentHi.toFixed(1) : '—';

  const onConfirm = useCallback(() => {
    if (invalidGoal || parsed == null) return;
    onSave(parsed);
    closeAfterAnim();
  }, [invalidGoal, parsed, onSave, closeAfterAnim]);

  return (
    <Modal
      visible={displayed}
      transparent
      animationType="none"
      onRequestClose={closeAfterAnim}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={closeAfterAnim} accessibilityLabel="关闭" />
        <Animated.View
          style={[styles.sheet, { maxHeight: SHEET_MAX_H, transform: [{ translateY }] }]}
        >
          <View style={styles.handleBar} />
          <View style={styles.header}>
            <Pressable
              onPress={closeAfterAnim}
              hitSlop={12}
              accessibilityRole="button"
              style={styles.headerSide}
            >
              <Text style={styles.headerCancel}>取消</Text>
            </Pressable>
            <Text style={styles.headerTitle}>设定目标差点</Text>
            <View style={styles.headerSide} />
          </View>

          <TextInput
            value={draft}
            onChangeText={(t) => setDraft(sanitizeOneDecimal(t))}
            keyboardType="decimal-pad"
            placeholder="0.0"
            placeholderTextColor="#5a6b5f"
            style={styles.bigInput}
            textAlign="center"
            selectTextOnFocus
            accessibilityLabel="目标差点"
          />

          <Text style={styles.hint}>当前差点 {hintCurrent}，目标需低于当前值</Text>
          {needCurrent && parsed != null && !(parsed < currentHi) ? (
            <Text style={styles.warnInline}>目标差点需低于当前差点</Text>
          ) : null}
          {!needCurrent ? (
            <Text style={styles.warnInline}>请至少录入 3 场成绩以生成当前差点后再设定目标</Text>
          ) : null}

          <Pressable
            style={[styles.confirmBtn, invalidGoal && styles.confirmBtnDisabled]}
            onPress={onConfirm}
            disabled={invalidGoal}
            accessibilityRole="button"
            accessibilityState={{ disabled: invalidGoal }}
          >
            <Text style={[styles.confirmBtnTxt, invalidGoal && styles.confirmBtnTxtDisabled]}>
              确认
            </Text>
          </Pressable>
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
    paddingBottom: 24,
    paddingHorizontal: 20,
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
    paddingVertical: 10,
    marginBottom: 8,
  },
  headerSide: { width: 52, justifyContent: 'center' },
  headerCancel: { fontSize: 15, fontWeight: '600', color: TEXT_CANCEL },
  headerTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_TITLE,
    textAlign: 'center',
  },
  bigInput: {
    fontSize: 38,
    fontWeight: '800',
    color: ACCENT,
    paddingVertical: 12,
    marginBottom: 8,
  },
  hint: {
    fontSize: 12,
    fontWeight: '500',
    color: TEXT_HINT,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 8,
  },
  warnInline: {
    fontSize: 12,
    fontWeight: '600',
    color: WARN,
    textAlign: 'center',
    marginBottom: 16,
  },
  confirmBtn: {
    width: '100%',
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmBtnDisabled: {
    backgroundColor: 'rgba(181,255,58,0.25)',
  },
  confirmBtnTxt: { fontSize: 15, fontWeight: '800', color: ON_ACCENT },
  confirmBtnTxtDisabled: { color: 'rgba(13,27,17,0.45)' },
});
