import { useFocusEffect } from '@react-navigation/native';
import { type Href, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  type AppStateStatus,
  Clipboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

import {
  addFriendByCode,
  ensureRegisteredOnServer,
  getFriendList,
  getFriendRequests,
  getMyInviteCode,
  invalidateFriendsCache,
  previewUserByInviteCode,
  respondFriendRequest,
  syncPublicHandicapToServer,
  type FriendListItem,
  type FriendRequestIncoming,
  type PublicUserProfile,
} from '@/utils/friendSystem';

const BG = '#0d1b11';
const CARD = '#16261c';
const ACCENT = '#b5ff3a';
const ON = '#0d1b11';
const MAIN = '#e8f0e5';
const SUB = '#8a9a8e';
const MUTED = '#5a6b5f';
const ORANGE = '#e89b3a';
const RED = '#d94848';
const LAB = '#a8b5ac';

function FriendMiniSparkline({ values }: { values: readonly number[] }) {
  const w = 60;
  const h = 20;
  const pad = 2;
  const v = values.slice(-8);
  if (v.length < 2) return <View style={{ width: w, height: h }} />;
  const vmin = Math.min(...v);
  const vmax = Math.max(...v);
  const span = vmax - vmin || 1;
  const n = v.length;
  const pts = v.map((val, i) => {
    const x = pad + (n === 1 ? (w - pad * 2) / 2 : (i / (n - 1)) * (w - pad * 2));
    const y = pad + (1 - (val - vmin) / span) * (h - pad * 2);
    return { x, y };
  });
  const linePts = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1]!;
  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <Polyline
        points={linePts}
        fill="none"
        stroke={ACCENT}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={last.x} cy={last.y} r={2} fill={ACCENT} />
    </Svg>
  );
}

function formatInviteDisplay(raw: string): string {
  const c = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  const parts = c.match(/.{1,2}/g) ?? [];
  return parts.join(' ');
}

export default function FriendsIndexScreen() {
  const router = useRouter();
  const [invite, setInvite] = useState('');
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState<FriendListItem[]>([]);
  const [incoming, setIncoming] = useState<FriendRequestIncoming[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [addRaw, setAddRaw] = useState('');
  const [preview, setPreview] = useState<PublicUserProfile | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copyToast, setCopyToast] = useState(false);
  const focused = useRef(false);

  const refresh = useCallback(async () => {
    await ensureRegisteredOnServer();
    await syncPublicHandicapToServer();
    const inv = await getMyInviteCode();
    setInvite(inv);
    const [f, r] = await Promise.all([getFriendList(true), getFriendRequests()]);
    setFriends(f);
    setIncoming(r);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      void refresh();
      return () => {
        focused.current = false;
      };
    }, [refresh]),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'active' && focused.current) void refresh();
    });
    const t = setInterval(() => {
      if (focused.current) void refresh();
    }, 60_000);
    return () => {
      sub.remove();
      clearInterval(t);
    };
  }, [refresh]);

  useEffect(() => {
    const code = addRaw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    if (code.length !== 6) {
      setPreview(null);
      return;
    }
    let alive = true;
    setPreviewLoading(true);
    const h = setTimeout(() => {
      void (async () => {
        const p = await previewUserByInviteCode(code);
        if (alive) {
          setPreview(p);
          setPreviewLoading(false);
        }
      })();
    }, 350);
    return () => {
      alive = false;
      clearTimeout(h);
    };
  }, [addRaw]);

  useEffect(() => {
    if (!copyToast) return;
    const t = setTimeout(() => setCopyToast(false), 2000);
    return () => clearTimeout(t);
  }, [copyToast]);

  const onCopyInvite = async () => {
    const code = invite.replace(/\s/g, '');
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        Clipboard.setString(code);
      }
      setCopyToast(true);
    } catch {
      Alert.alert('提示', '复制失败');
    }
  };

  const onSubmitAdd = async () => {
    const code = addRaw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    if (code.length !== 6) {
      Alert.alert('提示', '请输入 6 位邀请码');
      return;
    }
    setSubmitting(true);
    const out = await addFriendByCode(code);
    setSubmitting(false);
    if (!out.ok) {
      Alert.alert('添加失败', out.message);
      return;
    }
    setModalOpen(false);
    setAddRaw('');
    setPreview(null);
    invalidateFriendsCache();
    void refresh();
    Alert.alert('已发送', '好友申请已发送，等待对方同意');
  };

  const onRespond = async (id: string, action: 'accept' | 'reject') => {
    const ok = await respondFriendRequest(id, action);
    if (!ok) Alert.alert('提示', '操作失败');
    void refresh();
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>好友</Text>
            <Text style={styles.subtitle}>差点对比</Text>
          </View>
          <Pressable style={styles.addOutline} onPress={() => setModalOpen(true)} accessibilityRole="button">
            <Text style={styles.addOutlineTxt}>+ 添加</Text>
          </Pressable>
        </View>

        {copyToast ? (
          <View style={styles.toast}>
            <Text style={styles.toastTxt}>已复制</Text>
          </View>
        ) : null}

        <View style={styles.inviteCard}>
          <Text style={styles.inviteLab}>我的邀请码</Text>
          <View style={styles.inviteRow}>
            <Text style={styles.inviteBig}>{invite.length === 6 ? invite : '······'}</Text>
            <Pressable style={styles.copyBtn} onPress={() => void onCopyInvite()}>
              <Text style={styles.copyBtnTxt}>复制</Text>
            </Pressable>
          </View>
          <Text style={styles.inviteHint}>将邀请码发给好友，让对方在 App 内输入</Text>
        </View>

        {incoming.length > 0 ? (
          <View style={styles.reqSection}>
            {incoming.map((r) => (
              <View key={r.id} style={styles.reqBar}>
                <Text style={styles.reqTxt} numberOfLines={2}>
                  {r.fromName} 申请添加你为好友
                </Text>
                <View style={styles.reqBtns}>
                  <Pressable style={styles.rejectSm} onPress={() => void onRespond(r.id, 'reject')}>
                    <Text style={styles.rejectSmTxt}>拒绝</Text>
                  </Pressable>
                  <Pressable style={styles.acceptSm} onPress={() => void onRespond(r.id, 'accept')}>
                    <Text style={styles.acceptSmTxt}>同意</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        <Text style={styles.listHead}>
          好友 ({friends.length})
        </Text>

        {loading ? (
          <ActivityIndicator color={ACCENT} style={{ marginTop: 24 }} />
        ) : friends.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTxt}>
              {'还没有好友\n分享邀请码，和球友一起追踪差点'}
            </Text>
            <Pressable style={styles.emptyBtn} onPress={() => void onCopyInvite()}>
              <Text style={styles.emptyBtnTxt}>复制邀请码</Text>
            </Pressable>
          </View>
        ) : (
          friends.map((f) => (
            <Pressable
              key={f.userId}
              style={styles.friendCard}
              onPress={() => router.push(`/friends/${f.userId}` as Href)}>
              <View style={styles.avatar}>
                <Text style={styles.avatarTxt}>{f.name.slice(0, 1).toUpperCase()}</Text>
              </View>
              <View style={styles.friendMid}>
                <Text style={styles.friendName} numberOfLines={1}>
                  {f.name}
                </Text>
                <Text style={styles.friendHcp}>
                  差点 {f.handicap != null && Number.isFinite(f.handicap) ? f.handicap.toFixed(1) : '—'}
                </Text>
                <Text style={styles.friendMeta}>{f.roundsCount} 场记录</Text>
              </View>
              <FriendMiniSparkline values={f.trendHi ?? []} />
              <Text style={styles.chev}>›</Text>
            </Pressable>
          ))
        )}
      </ScrollView>

      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={() => setModalOpen(false)}>
        <Pressable style={styles.modalMask} onPress={() => setModalOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>添加好友</Text>
            <Text style={styles.modalLab}>输入好友邀请码</Text>
            <TextInput
              style={styles.modalInput}
              value={formatInviteDisplay(addRaw)}
              onChangeText={(t) => {
                const raw = t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
                setAddRaw(raw);
              }}
              placeholder="A3 F7 K2"
              placeholderTextColor={MUTED}
              autoCapitalize="characters"
              maxLength={8}
              keyboardType="default"
            />
            {previewLoading && addRaw.replace(/\W/g, '').length === 6 ? (
              <ActivityIndicator color={ACCENT} style={{ marginVertical: 12 }} />
            ) : null}
            {preview && addRaw.replace(/\W/g, '').length === 6 ? (
              <View style={styles.previewCard}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarTxt}>{preview.name.slice(0, 1).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.friendName}>{preview.name}</Text>
                  <Text style={styles.friendHcp}>
                    差点 {preview.handicap != null ? preview.handicap.toFixed(1) : '—'}
                  </Text>
                </View>
              </View>
            ) : null}
            <Pressable
              style={[styles.confirmBtn, submitting && { opacity: 0.6 }]}
              disabled={submitting}
              onPress={() => void onSubmitAdd()}>
              <Text style={styles.confirmBtnTxt}>确认添加</Text>
            </Pressable>
            <Pressable style={styles.cancelBtn} onPress={() => setModalOpen(false)}>
              <Text style={styles.cancelTxt}>取消</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  scroll: { padding: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '800', color: '#fff' },
  subtitle: { fontSize: 12, fontWeight: '500', color: SUB, marginTop: 4 },
  addOutline: {
    borderWidth: 1,
    borderColor: ACCENT,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  addOutlineTxt: { fontSize: 13, fontWeight: '700', color: ACCENT },
  toast: {
    alignSelf: 'center',
    backgroundColor: 'rgba(181,255,58,0.15)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 10,
  },
  toastTxt: { color: ACCENT, fontWeight: '700', fontSize: 12 },
  inviteCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  inviteLab: { fontSize: 11, fontWeight: '700', color: SUB, marginBottom: 10 },
  inviteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  inviteBig: {
    fontSize: 30,
    fontWeight: '800',
    color: ACCENT,
    letterSpacing: 6,
  },
  copyBtn: {
    borderWidth: 1,
    borderColor: SUB,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  copyBtnTxt: { fontSize: 12, fontWeight: '700', color: MAIN },
  inviteHint: { fontSize: 11, fontWeight: '500', color: MUTED, marginTop: 12 },
  reqSection: { gap: 10, marginBottom: 16 },
  reqBar: {
    backgroundColor: 'rgba(232,155,58,0.08)',
    borderLeftWidth: 3,
    borderLeftColor: ORANGE,
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reqTxt: { flex: 1, fontSize: 13, fontWeight: '600', color: ORANGE },
  reqBtns: { flexDirection: 'row', gap: 8 },
  rejectSm: { borderWidth: 1, borderColor: RED, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  rejectSmTxt: { fontSize: 12, fontWeight: '700', color: RED },
  acceptSm: { backgroundColor: ACCENT, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  acceptSmTxt: { fontSize: 12, fontWeight: '800', color: ON },
  listHead: { fontSize: 13, fontWeight: '700', color: LAB, marginBottom: 10 },
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    gap: 10,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: 'rgba(181,255,58,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTxt: { fontSize: 15, fontWeight: '800', color: ACCENT },
  friendMid: { flex: 1, minWidth: 0 },
  friendName: { fontSize: 14, fontWeight: '700', color: MAIN },
  friendHcp: { fontSize: 11, fontWeight: '600', color: ACCENT, marginTop: 2 },
  friendMeta: { fontSize: 11, fontWeight: '500', color: MUTED, marginTop: 2 },
  chev: { fontSize: 20, fontWeight: '600', color: SUB },
  empty: { alignItems: 'center', paddingVertical: 32 },
  emptyTxt: { fontSize: 14, fontWeight: '600', color: MUTED, textAlign: 'center', lineHeight: 22 },
  emptyBtn: {
    marginTop: 20,
    backgroundColor: ACCENT,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyBtnTxt: { fontSize: 14, fontWeight: '800', color: ON },
  modalMask: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 20,
  },
  modalSheet: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: MAIN, marginBottom: 16 },
  modalLab: { fontSize: 12, fontWeight: '600', color: SUB, marginBottom: 8 },
  modalInput: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
    padding: 12,
    fontSize: 18,
    fontWeight: '800',
    color: MAIN,
    letterSpacing: 4,
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
  },
  confirmBtn: {
    marginTop: 20,
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmBtnTxt: { fontSize: 15, fontWeight: '800', color: ON },
  cancelBtn: { marginTop: 12, alignItems: 'center', padding: 8 },
  cancelTxt: { fontSize: 14, fontWeight: '600', color: SUB },
});
