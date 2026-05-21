import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  acceptFriendRequest,
  followUser,
  getFollowers,
  getFollowing,
  getFollowingFeed,
  getFriendStatus,
  getPendingRequests,
  rejectFriendRequest,
  searchUsers,
  sendFriendRequest,
  unfollowUser,
  type FollowUser,
  type FriendRequest,
} from '@/lib/followsApi';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TAB_BAR_SCROLL_EXTRA, THEME } from '@/constants/theme';

const BG = THEME.bg;
const CARD = THEME.card;
const ACCENT = THEME.accent;
const ON = THEME.textOnAccent;
const MAIN = THEME.text2;
const SUB = THEME.text3;
const MUTED = THEME.text3;

type Tab = 'feed' | 'following' | 'followers' | 'requests' | 'search';

export default function FriendsScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('feed');
  const [following, setFollowing] = useState<FollowUser[]>([]);
  const [followers, setFollowers] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FollowUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feed, setFeed] = useState<any[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [f, r] = await Promise.all([getFollowing(), getFollowers()]);
      setFollowing(f);
      setFollowers(r);
      setFollowingIds(new Set(f.map((u) => u.userId)));
      const reqs = await getPendingRequests().catch(() => []);
      setPendingRequests(reqs);
      setFeedLoading(true);
      getFollowingFeed()
        .then((items) => setFeed(items))
        .catch(() => setFeed([]))
        .finally(() => setFeedLoading(false));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const onSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await searchUsers(searchQuery);
      setSearchResults(results);
    } catch {
      Alert.alert('搜索失败', '请稍后重试');
    } finally {
      setSearching(false);
    }
  };

  const onToggleFollow = async (userId: string, username: string) => {
    const already = followingIds.has(userId);
    try {
      if (already) {
        await unfollowUser(userId);
        setFollowingIds((prev) => { const s = new Set(prev); s.delete(userId); return s; });
      } else {
        await followUser(userId);
        setFollowingIds((prev) => new Set([...prev, userId]));
      }
      void refresh();
    } catch {
      Alert.alert('操作失败', '请稍后重试');
    }
  };

  const onAddFriend = async (userId: string, username: string) => {
    try {
      setActionLoading(userId);
      await sendFriendRequest(userId);
      Alert.alert('已发送', `好友申请已发送给 ${username}`);
    } catch {
      Alert.alert('发送失败', '请稍后重试');
    } finally {
      setActionLoading(null);
    }
  };

  const tabLabelFor = (t: Tab) => {
    if (t === 'feed') return '动态';
    if (t === 'following') return '关注';
    if (t === 'followers') return '粉丝';
    if (t === 'requests') return pendingRequests.length > 0 ? `申请 (${pendingRequests.length})` : '申请';
    return '搜索';
  };

  const renderUser = (u: FollowUser, showFollowBtn = true) => (
    <View key={u.userId} style={s.userCard}>
      <View style={s.avatar}>
        <Text style={s.avatarTxt}>{(u.username || '?').charAt(0).toUpperCase()}</Text>
      </View>
      <View style={s.userMid}>
        <Text style={s.userName}>{u.username}</Text>
        <Text style={s.userSub}>
          差点 {u.handicap != null ? Number(u.handicap).toFixed(1) : '—'}
          {u.skillLevel ? `  ·  ${skillLabel(u.skillLevel)}` : ''}
        </Text>
      </View>
      {showFollowBtn ? (
        <Pressable
          style={[s.followBtn, followingIds.has(u.userId) && s.followingBtn]}
          onPress={() => void onToggleFollow(u.userId, u.username)}
        >
          <Text style={[s.followBtnTxt, followingIds.has(u.userId) && s.followingBtnTxt]}>
            {followingIds.has(u.userId) ? '已关注' : '关注'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );

  function scoreSummary(round: any): string {
    const scores: any[] = round.scores ?? [];
    if (!scores.length) return '';
    const byUser = new Map<string, number>();
    for (const s of scores) {
      byUser.set(s.user_id, (byUser.get(s.user_id) ?? 0) + (s.strokes ?? 0));
    }
    const vals = Array.from(byUser.values()).filter((v) => v > 0);
    if (!vals.length) return '';
    const min = Math.min(...vals);
    return `最低 ${min} 杆`;
  }

  function renderFeedCard(item: any) {
    const username = item.profiles?.username ?? '球友';
    const initial = username.charAt(0).toUpperCase();
    const isLive = item.status === 'in_progress';
    const summary = scoreSummary(item);
    return (
      <Pressable
        key={item.id}
        style={s.feedCard}
        onPress={() => router.push(`/rounds/${item.id}/summary` as any)}
      >
        <View style={s.feedTop}>
          <View style={s.avatar}>
            <Text style={s.avatarTxt}>{initial}</Text>
          </View>
          <View style={s.feedMeta}>
            <Text style={s.feedUser}>{username}</Text>
            <Text style={s.feedSub}>
              {item.course_name ?? '球场'} · {item.holes}洞
            </Text>
          </View>
          <View style={[s.feedBadge, isLive ? s.feedBadgeLive : s.feedBadgeDone]}>
            <Text style={[s.feedBadgeTxt, isLive ? s.feedBadgeTxtLive : s.feedBadgeTxtDone]}>
              {isLive ? '⛳ 进行中' : '✓ 已完成'}
            </Text>
          </View>
        </View>
        {summary ? <Text style={s.feedScore}>{summary}</Text> : null}
      </Pressable>
    );
  }

  return (
    <View style={s.root}>
      <ScreenHeader variant="stack" title="球友" />

      {/* Tabs */}
      <View style={s.tabs}>
        {(['feed', 'following', 'followers', 'requests', 'search'] as Tab[]).map((t) => (
          <Pressable
            key={t}
            style={[
              s.tabBtn,
              tab === t && s.tabBtnOn,
              t === 'requests' && pendingRequests.length > 0 && s.tabBtnAlert,
            ]}
            onPress={() => setTab(t)}
          >
            <Text style={[s.tabTxt, tab === t && s.tabTxtOn]}>{tabLabelFor(t)}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {tab === 'feed' ? (
          feedLoading ? (
            <ActivityIndicator color={ACCENT} style={{ marginTop: 40 }} />
          ) : feed.length === 0 ? (
            <View style={s.emptyWrap}>
              <Text style={s.emptyTxt}>关注的球友今天还没有球局</Text>
              <Text style={[s.emptyTxt, { fontSize: 12, marginTop: 4 }]}>
                去「搜索」添加球友，在他们下场时收到动态
              </Text>
              <TouchableOpacity style={s.emptyBtn} onPress={() => setTab('search')}>
                <Text style={s.emptyBtnTxt}>搜索球友</Text>
              </TouchableOpacity>
            </View>
          ) : (
            feed.map((item) => renderFeedCard(item))
          )
        ) : tab === 'search' ? (
          <>
            <View style={s.searchRow}>
              <TextInput
                style={s.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="搜索用户名"
                placeholderTextColor={MUTED}
                returnKeyType="search"
                onSubmitEditing={onSearch}
              />
              <Pressable style={s.searchBtn} onPress={onSearch}>
                <Text style={s.searchBtnTxt}>搜索</Text>
              </Pressable>
            </View>
            {searching ? (
              <ActivityIndicator color={ACCENT} style={{ marginTop: 24 }} />
            ) : searchResults.length === 0 ? (
              <Text style={s.emptyTxt}>输入用户名搜索球友</Text>
            ) : (
              searchResults.map((u) => (
                <View key={u.userId} style={s.userCard}>
                  <View style={s.avatar}>
                    <Text style={s.avatarTxt}>{(u.username || '?').charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={s.userMid}>
                    <Text style={s.userName}>{u.username}</Text>
                    <Text style={s.userSub}>
                      差点 {u.handicap != null ? Number(u.handicap).toFixed(1) : '—'}
                    </Text>
                  </View>
                  <Pressable
                    style={[s.followBtn, followingIds.has(u.userId) && s.followingBtn]}
                    disabled={actionLoading === u.userId || followingIds.has(u.userId)}
                    onPress={() => {
                      if (!followingIds.has(u.userId)) void onAddFriend(u.userId, u.username);
                    }}
                  >
                    <Text style={[s.followBtnTxt, followingIds.has(u.userId) && s.followingBtnTxt]}>
                      {actionLoading === u.userId
                        ? '…'
                        : followingIds.has(u.userId)
                          ? '已是好友'
                          : '+ 加好友'}
                    </Text>
                  </Pressable>
                </View>
              ))
            )}
          </>
        ) : loading ? (
          <ActivityIndicator color={ACCENT} style={{ marginTop: 40 }} />
        ) : tab === 'following' ? (
          following.length === 0 ? (
            <View style={s.emptyWrap}>
              <Text style={s.emptyTxt}>还没有关注任何人</Text>
              <TouchableOpacity style={s.emptyBtn} onPress={() => setTab('search')}>
                <Text style={s.emptyBtnTxt}>去搜索球友</Text>
              </TouchableOpacity>
            </View>
          ) : (
            following.map((u) => renderUser(u, true))
          )
        ) : tab === 'requests' ? (
          pendingRequests.length === 0 ? (
            <Text style={s.emptyTxt}>暂无待确认的好友申请</Text>
          ) : (
            <>
              {pendingRequests.map((req) => (
                <View key={req.id} style={s.userCard}>
                  <View style={s.avatar}>
                    <Text style={s.avatarTxt}>{req.senderName.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={s.userMid}>
                    <Text style={s.userName}>{req.senderName}</Text>
                    <Text style={s.userSub}>申请加你为球友</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pressable
                      style={[s.followBtn, { opacity: actionLoading === req.id ? 0.5 : 1 }]}
                      disabled={actionLoading === req.id}
                      onPress={async () => {
                        setActionLoading(req.id);
                        try {
                          await acceptFriendRequest(req.id);
                          void refresh();
                        } catch {
                          Alert.alert('操作失败', '请稍后重试');
                        } finally {
                          setActionLoading(null);
                        }
                      }}
                    >
                      <Text style={s.followBtnTxt}>接受</Text>
                    </Pressable>
                    <Pressable
                      style={[
                        s.followBtn,
                        { borderColor: '#f87171', opacity: actionLoading === req.id ? 0.5 : 1 },
                      ]}
                      disabled={actionLoading === req.id}
                      onPress={async () => {
                        setActionLoading(req.id);
                        try {
                          await rejectFriendRequest(req.id);
                          void refresh();
                        } catch {
                          Alert.alert('操作失败', '请稍后重试');
                        } finally {
                          setActionLoading(null);
                        }
                      }}
                    >
                      <Text style={[s.followBtnTxt, { color: '#f87171' }]}>拒绝</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </>
          )
        ) : followers.length === 0 ? (
          <Text style={s.emptyTxt}>还没有人关注你</Text>
        ) : (
          followers.map((u) => renderUser(u, true))
        )}
      </ScrollView>
    </View>
  );
}

function skillLabel(s: string) {
  if (s === 'beginner') return '初学';
  if (s === 'intermediate') return '中级';
  if (s === 'advanced') return '高级';
  return s;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
  },
  tabBtn: {
    flex: 0,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  tabBtnOn: { backgroundColor: 'rgba(181,255,58,0.15)' },
  tabBtnAlert: { backgroundColor: 'rgba(248,113,113,0.12)' },
  tabTxt: { fontSize: 13, fontWeight: '600', color: MUTED },
  tabTxtOn: { color: ACCENT, fontWeight: '800' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 24 + TAB_BAR_SCROLL_EXTRA },
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  searchInput: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: MAIN,
  },
  searchBtn: {
    backgroundColor: ACCENT,
    borderRadius: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtnTxt: { fontSize: 13, fontWeight: '800', color: ON },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(181,255,58,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTxt: { fontSize: 16, fontWeight: '800', color: ACCENT },
  userMid: { flex: 1, minWidth: 0 },
  userName: { fontSize: 14, fontWeight: '700', color: MAIN },
  userSub: { fontSize: 12, color: SUB, marginTop: 3 },
  followBtn: {
    borderWidth: 1,
    borderColor: ACCENT,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  followingBtn: { backgroundColor: 'rgba(181,255,58,0.12)', borderColor: 'transparent' },
  followBtnTxt: { fontSize: 12, fontWeight: '700', color: ACCENT },
  followingBtnTxt: { color: ACCENT },
  emptyWrap: { alignItems: 'center', paddingVertical: 40 },
  emptyTxt: { fontSize: 14, color: MUTED, textAlign: 'center', paddingVertical: 40 },
  emptyBtn: {
    marginTop: 12,
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  emptyBtnTxt: { fontSize: 14, fontWeight: '800', color: ON },
  feedCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    gap: 8,
  },
  feedTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  feedMeta: { flex: 1, minWidth: 0 },
  feedUser: { fontSize: 14, fontWeight: '700', color: MAIN },
  feedSub: { fontSize: 12, color: MUTED, marginTop: 2 },
  feedScore: { fontSize: 13, fontWeight: '800', color: ACCENT, paddingLeft: 50 },
  feedBadge: {
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 1,
  },
  feedBadgeLive: { borderColor: ACCENT, backgroundColor: 'rgba(181,255,58,0.10)' },
  feedBadgeDone: { borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'transparent' },
  feedBadgeTxt: { fontSize: 11, fontWeight: '700' },
  feedBadgeTxtLive: { color: ACCENT },
  feedBadgeTxtDone: { color: MUTED },
});
