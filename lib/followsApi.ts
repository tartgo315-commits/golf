import { supabase } from '@/lib/supabase';

/** 关注某人 */
export async function followUser(followingId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');
  const { error } = await supabase.from('follows').insert({
    follower_id: user.id,
    following_id: followingId,
  });
  if (error && error.code !== '23505') throw error; // 23505 = already follows
}

/** 取消关注 */
export async function unfollowUser(followingId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');
  const { error } = await supabase.from('follows')
    .delete()
    .eq('follower_id', user.id)
    .eq('following_id', followingId);
  if (error) throw error;
}

/** 我关注的人列表（含 profile 信息） */
export async function getFollowing(): Promise<FollowUser[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('follows')
    .select('following_id, profiles!follows_following_id_fkey(id, username, handicap, skill_level)')
    .eq('follower_id', user.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    userId: row.following_id,
    username: row.profiles?.username ?? '球友',
    handicap: row.profiles?.handicap ?? null,
    skillLevel: row.profiles?.skill_level ?? null,
  }));
}

/** 关注我的人列表 */
export async function getFollowers(): Promise<FollowUser[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('follows')
    .select('follower_id, profiles!follows_follower_id_fkey(id, username, handicap, skill_level)')
    .eq('following_id', user.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    userId: row.follower_id,
    username: row.profiles?.username ?? '球友',
    handicap: row.profiles?.handicap ?? null,
    skillLevel: row.profiles?.skill_level ?? null,
  }));
}

/** 检查是否已关注某人 */
export async function isFollowing(followingId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from('follows')
    .select('id')
    .eq('follower_id', user.id)
    .eq('following_id', followingId)
    .maybeSingle();
  return !!data;
}

/** 搜索用户（按用户名） */
export async function searchUsers(query: string): Promise<FollowUser[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!query.trim()) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, handicap, skill_level')
    .ilike('username', `%${query.trim()}%`)
    .neq('id', user?.id ?? '')
    .limit(10);
  if (error) throw error;
  return (data ?? []).map((p: any) => ({
    userId: p.id,
    username: p.username ?? '球友',
    handicap: p.handicap ?? null,
    skillLevel: p.skill_level ?? null,
  }));
}

function playedSinceIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const ROUND_FEED_SELECT =
  'id, course_name, played_at, holes, status, created_at, created_by, profiles!rounds_created_by_fkey(username), scores(hole_number, strokes, user_id)';

/** 关注用户的近期球局（7 天内，无则 30 天） */
export async function getFollowingFeed(): Promise<any[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data: followData } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', user.id);
  if (!followData?.length) return [];
  const ids = followData.map((f: any) => f.following_id);

  const fetchSince = async (since: string) => {
    const { data, error } = await supabase
      .from('rounds')
      .select(ROUND_FEED_SELECT)
      .in('visibility', ['public', 'friends'])
      .in('created_by', ids)
      .gte('played_at', since)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) throw error;
    return data ?? [];
  };

  const data7 = await fetchSince(playedSinceIso(7));
  if (data7.length) return data7;
  return fetchSince(playedSinceIso(30));
}

export type FollowUser = {
  userId: string;
  username: string;
  handicap: number | null;
  skillLevel: string | null;
};

const ROUND_NEARBY_SELECT =
  'id, course_name, played_at, holes, status, created_at, created_by, latitude, longitude, profiles!rounds_created_by_fkey(username), scores(hole_number, strokes, user_id)';

function filterNearbyByDistance(data: any[], lat: number, lng: number, radiusKm: number) {
  return data
    .map((r: any) => ({
      ...r,
      distanceKm: haversine(lat, lng, r.latitude, r.longitude),
    }))
    .filter((r: any) => r.distanceKm <= radiusKm)
    .sort((a: any, b: any) => a.distanceKm - b.distanceKm);
}

/** 附近球局（按距离过滤；7 天内，无则 30 天） */
export async function getNearbyFeed(lat: number, lng: number, radiusKm = 50): Promise<any[]> {
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));

  const fetchSince = async (since: string) => {
    const { data, error } = await supabase
      .from('rounds')
      .select(ROUND_NEARBY_SELECT)
      .eq('visibility', 'public')
      .gte('played_at', since)
      .gte('latitude', lat - latDelta)
      .lte('latitude', lat + latDelta)
      .gte('longitude', lng - lngDelta)
      .lte('longitude', lng + lngDelta)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) throw error;
    return filterNearbyByDistance(data ?? [], lat, lng, radiusKm);
  };

  const data7 = await fetchSince(playedSinceIso(7));
  if (data7.length) return data7;
  return fetchSince(playedSinceIso(30));
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export type FriendRequest = {
  id: string;
  senderId: string;
  receiverId: string;
  senderName: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
};

/** 发送好友申请（幂等，重复发送忽略） */
export async function sendFriendRequest(receiverId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');
  const { error } = await supabase.from('friend_requests').insert({
    sender_id: user.id,
    receiver_id: receiverId,
  });
  if (error && error.code !== '23505') throw error;
}

/** 接受好友申请 → 双向写入 follows */
export async function acceptFriendRequest(requestId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');
  // 1. 查出申请信息
  const { data: req, error: fetchErr } = await supabase
    .from('friend_requests')
    .select('sender_id, receiver_id')
    .eq('id', requestId)
    .single();
  if (fetchErr || !req) throw fetchErr ?? new Error('申请不存在');
  if (req.receiver_id !== user.id) throw new Error('无权操作');
  // 2. 双向写 follows（忽略重复）
  const { error: upsertErr } = await supabase.from('follows').upsert(
    [
      { follower_id: req.sender_id, following_id: req.receiver_id },
      { follower_id: req.receiver_id, following_id: req.sender_id },
    ],
    { onConflict: 'follower_id,following_id', ignoreDuplicates: true },
  );
  if (upsertErr) throw upsertErr;
  // 3. 更新申请状态
  const { error } = await supabase
    .from('friend_requests')
    .update({ status: 'accepted', updated_at: new Date().toISOString() })
    .eq('id', requestId);
  if (error) throw error;
}

/** 拒绝好友申请 */
export async function rejectFriendRequest(requestId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');
  const { error } = await supabase
    .from('friend_requests')
    .update({ status: 'rejected', updated_at: new Date().toISOString() })
    .eq('id', requestId)
    .eq('receiver_id', user.id);
  if (error) throw error;
}

/** 我收到的待处理好友申请 */
export async function getPendingRequests(): Promise<FriendRequest[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('friend_requests')
    .select('id, sender_id, receiver_id, status, created_at')
    .eq('receiver_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  const rows = data ?? [];
  const senderIds = [...new Set(rows.map((r: { sender_id: string }) => r.sender_id))];
  if (senderIds.length === 0) return [];
  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('id, username')
    .in('id', senderIds);
  if (pErr) throw pErr;
  const nameById = new Map(
    (profiles ?? []).map((p: { id: string; username: string | null }) => [p.id, p.username ?? '球友']),
  );
  return rows.map(
    (row: { id: string; sender_id: string; receiver_id: string; status: string; created_at: string }) => ({
      id: row.id,
      senderId: row.sender_id,
      receiverId: row.receiver_id,
      senderName: nameById.get(row.sender_id) ?? '球友',
      status: row.status as FriendRequest['status'],
      createdAt: row.created_at,
    }),
  );
}

/** 与某用户的好友/申请关系（预留，避免列表页 N+1） */
export async function getFriendStatus(_otherUserId: string): Promise<'none' | 'friend' | 'pending_in' | 'pending_out'> {
  void _otherUserId;
  return 'none';
}
