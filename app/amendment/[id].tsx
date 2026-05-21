import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '@/contexts/auth-context';
import type { AmendmentRequest } from '@/utils/amendmentTypes';
import { getAmendmentRequestById, submitVote } from '@/utils/amendmentRequest';
import { getServerTime } from '@/utils/serverTime';
import { getAppUserId } from '@/utils/userIdentity';
import { ScreenHeader } from '@/components/ScreenHeader';
import { THEME } from '@/constants/theme';

const BG = THEME.bg;
const CARD = THEME.card;
const ACCENT = THEME.accent;
const ON = THEME.textOnAccent;
const MAIN = THEME.text2;
const SUB = THEME.text3;
const MUTED = THEME.text3;
const ORANGE = '#e89b3a';
const RED = '#d94848';
const GREEN = THEME.accent;

function formatMd(dateStr: string): string {
  const d = new Date(dateStr);
  if (!Number.isFinite(d.getTime())) return dateStr;
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export default function AmendmentVoteScreen() {
  const router = useRouter();
  const { id, voterId } = useLocalSearchParams<{ id?: string; voterId?: string }>();
  const { session } = useAuth();
  const [req, setReq] = useState<AmendmentRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [serverNow, setServerNow] = useState<number | null>(null);

  const effectiveVoterId =
    typeof voterId === 'string' && voterId.trim().length > 0 ? voterId.trim() : null;

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [r, now] = await Promise.all([getAmendmentRequestById(id), getServerTime()]);
      setReq(r);
      setServerNow(now);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {};
    }, [load]),
  );

  useEffect(() => {
    if (!id) return;
    const t = setInterval(() => void load(), 30_000);
    return () => clearInterval(t);
  }, [id, load]);

  const [voteUid, setVoteUid] = useState<string | null>(null);
  useEffect(() => {
    void (async () => {
      const uid = effectiveVoterId ?? (await getAppUserId(session));
      setVoteUid(uid);
    })();
  }, [session, effectiveVoterId]);

  const hoursLeft = useMemo(() => {
    if (!req || serverNow == null) return null;
    const ms = req.expiresAt - serverNow;
    return Math.max(0, Math.floor(ms / (60 * 60 * 1000)));
  }, [req, serverNow]);

  const myVoter = req?.voters.find((v) => v.userId === voteUid);
  const canVote = req?.status === 'pending' && myVoter?.vote === 'pending';

  const onVote = (vote: 'approved' | 'rejected') => {
    if (!req || !voteUid) return;
    void (async () => {
      const out = await submitVote(req.id, voteUid, vote);
      if (!out) {
        Alert.alert('提示', '投票失败，请稍后重试');
        return;
      }
      await load();
    })();
  };

  if (!id) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>无效链接</Text>
      </View>
    );
  }

  if (loading && !req) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={ACCENT} />
      </View>
    );
  }

  if (!req) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>未找到该申请</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 12 }}>
          <Text style={styles.link}>返回</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenHeader
        variant="stack"
        layout="toolbar"
        title="成绩修改申请"
        onBack={() => router.back()}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.meta}>
            申请人 {req.requesterName} · {formatMd(req.roundDate)}
          </Text>
          <Text style={styles.course}>{req.originalValues.course || '—'}</Text>

          <Text style={styles.sectionLab}>修改对比</Text>
          <View style={styles.diffRow}>
            <Text style={styles.oldVal}>
              {req.originalValues.totalScore} 杆 · {req.originalValues.holes} 洞
            </Text>
            <Text style={styles.arrow}> → </Text>
            <Text style={styles.newVal}>
              {req.proposedValues.totalScore} 杆 · {req.proposedValues.holes} 洞
            </Text>
          </View>
          <Text style={styles.diffRow2}>
            <Text style={styles.oldSm}>{req.originalValues.course}</Text>
            <Text style={styles.newSm}> {req.proposedValues.course}</Text>
          </Text>

          <Text style={styles.sectionLab}>申请理由</Text>
          <View style={styles.quote}>
            <Text style={styles.quoteTxt}>{req.reason}</Text>
          </View>

          {hoursLeft != null ? (
            <Text style={styles.deadline}>还有 {hoursLeft} 小时截止</Text>
          ) : null}
        </View>

        <Text style={styles.listTitle}>投票情况</Text>
        {req.voters.length === 0 ? (
          <Text style={styles.muted}>无有效投票人（旧版单人申请，已不再支持自动通过）</Text>
        ) : (
          req.voters.map((v) => (
            <View key={v.userId} style={styles.voterRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarTxt}>{v.name.slice(0, 1)}</Text>
              </View>
              <Text style={styles.voterName}>{v.name}</Text>
              <Text
                style={
                  v.vote === 'approved'
                    ? styles.voterStateOk
                    : v.vote === 'rejected'
                      ? styles.voterStateBad
                      : styles.voterStatePending
                }
              >
                {v.vote === 'approved'
                  ? '✓ 已同意'
                  : v.vote === 'rejected'
                    ? '✗ 已拒绝'
                    : '· 待投票'}
              </Text>
            </View>
          ))
        )}

        {canVote ? (
          <View style={styles.actions}>
            <Pressable style={styles.rejectBtn} onPress={() => onVote('rejected')}>
              <Text style={styles.rejectTxt}>拒绝</Text>
            </Pressable>
            <Pressable style={styles.approveBtn} onPress={() => onVote('approved')}>
              <Text style={styles.approveTxt}>同意</Text>
            </Pressable>
          </View>
        ) : myVoter && myVoter.vote !== 'pending' ? (
          <Text style={styles.doneSelf}>你已{myVoter.vote === 'approved' ? '同意' : '拒绝'}</Text>
        ) : null}

        {req.status === 'approved' ? (
          <View style={styles.resultOk}>
            <Text style={styles.resultOkTxt}>申请已批准，成绩已解锁修改</Text>
          </View>
        ) : null}
        {req.status === 'rejected' ? (
          <View style={styles.resultBad}>
            <Text style={styles.resultBadTxt}>
              申请已被拒绝{req.rejectedByName ? `（${req.rejectedByName}）` : ''}
            </Text>
          </View>
        ) : null}
        {req.status === 'expired' ? (
          <View style={styles.resultNeu}>
            <Text style={styles.resultNeuTxt}>申请已过期</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  muted: { color: MUTED, fontSize: 14, fontWeight: '600' },
  link: { color: ACCENT, fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  meta: { fontSize: 12, fontWeight: '600', color: SUB, marginBottom: 6 },
  course: { fontSize: 16, fontWeight: '700', color: MAIN, marginBottom: 14 },
  sectionLab: { fontSize: 11, fontWeight: '700', color: MUTED, marginBottom: 8, marginTop: 4 },
  diffRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 },
  oldVal: { fontSize: 14, fontWeight: '600', color: MUTED, textDecorationLine: 'line-through' },
  arrow: { color: SUB, fontWeight: '700' },
  newVal: { fontSize: 15, fontWeight: '700', color: MAIN },
  diffRow2: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  oldSm: { fontSize: 12, color: MUTED, textDecorationLine: 'line-through' },
  newSm: { fontSize: 13, fontWeight: '700', color: MAIN },
  quote: {
    borderLeftWidth: 3,
    borderLeftColor: SUB,
    paddingLeft: 12,
    marginBottom: 12,
  },
  quoteTxt: { fontSize: 13, fontWeight: '500', color: MAIN, lineHeight: 20 },
  deadline: { fontSize: 12, fontWeight: '600', color: ORANGE, marginTop: 4 },
  listTitle: { fontSize: 13, fontWeight: '700', color: SUB, marginBottom: 10 },
  voterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTxt: { fontSize: 14, fontWeight: '800', color: MAIN },
  voterName: { flex: 1, fontSize: 14, fontWeight: '600', color: MAIN },
  voterStateOk: { fontSize: 12, fontWeight: '600', color: GREEN },
  voterStateBad: { fontSize: 12, fontWeight: '600', color: RED },
  voterStatePending: { fontSize: 12, fontWeight: '600', color: ORANGE },
  actions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  rejectBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: RED,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  rejectTxt: { fontSize: 14, fontWeight: '800', color: RED },
  approveBtn: {
    flex: 1,
    backgroundColor: GREEN,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  approveTxt: { fontSize: 14, fontWeight: '800', color: ON },
  doneSelf: { marginTop: 16, textAlign: 'center', fontSize: 13, fontWeight: '600', color: SUB },
  resultOk: {
    marginTop: 20,
    backgroundColor: 'rgba(181,255,58,0.08)',
    borderRadius: 12,
    padding: 14,
  },
  resultOkTxt: { fontSize: 13, fontWeight: '700', color: GREEN, textAlign: 'center' },
  resultBad: {
    marginTop: 20,
    backgroundColor: 'rgba(217,72,72,0.08)',
    borderRadius: 12,
    padding: 14,
  },
  resultBadTxt: { fontSize: 13, fontWeight: '700', color: RED, textAlign: 'center' },
  resultNeu: {
    marginTop: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 14,
  },
  resultNeuTxt: { fontSize: 13, fontWeight: '700', color: MUTED, textAlign: 'center' },
});
