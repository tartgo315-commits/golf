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

/** 关注用户的今日公开球局 */
export async function getFollowingFeed(): Promise<any[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data: followData } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', user.id);
  if (!followData?.length) return [];
  const ids = followData.map((f: any) => f.following_id);
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('rounds')
    .select('id, course_name, played_at, holes, status, created_at, created_by, profiles!rounds_created_by_fkey(username), scores(hole_number, strokes, user_id)')
    .eq('visibility', 'public')
    .in('created_by', ids)
    .gte('played_at', today)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data ?? [];
}

export type FollowUser = {
  userId: string;
  username: string;
  handicap: number | null;
  skillLevel: string | null;
};

/** 附近球局（按距离过滤） */
export async function getNearbyFeed(lat: number, lng: number, radiusKm = 50): Promise<any[]> {
  // 用经纬度边界框过滤（1度纬度≈111km）
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('rounds')
    .select('id, course_name, played_at, holes, status, created_at, created_by, latitude, longitude, profiles!rounds_created_by_fkey(username), scores(hole_number, strokes, user_id)')
    .eq('visibility', 'public')
    .gte('played_at', today)
    .gte('latitude', lat - latDelta)
    .lte('latitude', lat + latDelta)
    .gte('longitude', lng - lngDelta)
    .lte('longitude', lng + lngDelta)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) throw error;

  // 精确 Haversine 距离排序
  return (data ?? [])
    .map((r: any) => ({
      ...r,
      distanceKm: haversine(lat, lng, r.latitude, r.longitude),
    }))
    .filter((r: any) => r.distanceKm <= radiusKm)
    .sort((a: any, b: any) => a.distanceKm - b.distanceKm);
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
