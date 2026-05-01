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
  followUser,
  getFollowers,
  getFollowing,
  searchUsers,
  unfollowUser,
  type FollowUser,
} from '@/lib/followsApi';
import { TAB_BAR_SCROLL_EXTRA } from '@/constants/theme';
import { THEME } from '@/constants/theme';

const BG = THEME.bg;
const CARD = THEME.card;
const ACCENT = THEME.accent;
const ON = THEME.textOnAccent;
const MAIN = THEME.text2;
const SUB = THEME.text3;
const MUTED = THEME.text3;

type Tab = 'following' | 'followers' | 'search';

export default function FriendsScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('following');
  const [following, setFollowing] = useState<FollowUser[]>([]);
  const [followers, setFollowers] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FollowUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [f, r] = await Promise.all([getFollowing(), getFollowers()]);
      setFollowing(f);
      setFollowers(r);
      setFollowingIds(new Set(f.map((u) => u.userId)));
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

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>球友</Text>
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        {(['following', 'followers', 'search'] as Tab[]).map((t) => (
          <Pressable key={t} style={[s.tabBtn, tab === t && s.tabBtnOn]} onPress={() => setTab(t)}>
            <Text style={[s.tabTxt, tab === t && s.tabTxtOn]}>{tabLabel(t)}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {tab === 'search' ? (
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
              searchResults.map((u) => renderUser(u, true))
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
        ) : (
          followers.length === 0 ? (
            <Text style={s.emptyTxt}>还没有人关注你</Text>
          ) : (
            followers.map((u) => renderUser(u, true))
          )
        )}
      </ScrollView>
    </View>
  );
}

function tabLabel(t: Tab) {
  if (t === 'following') return '关注';
  if (t === 'followers') return '粉丝';
  return '搜索';
}

function skillLabel(s: string) {
  if (s === 'beginner') return '初学';
  if (s === 'intermediate') return '中级';
  if (s === 'advanced') return '高级';
  return s;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '800', color: '#fff' },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  tabBtnOn: { backgroundColor: 'rgba(181,255,58,0.15)' },
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
});
