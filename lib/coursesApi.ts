import { supabase } from '@/lib/supabase';

export type Course = {
  id: string;
  name: string;
  name_en: string | null;
  country: string | null;
  province: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  holes: number;
  total_par: number;
  course_rating: number | null;
  slope_rating: number | null;
  address: string | null;
  verified: boolean;
};

/** 搜索球场（按名称） */
export async function searchCourses(query: string, limit = 10): Promise<Course[]> {
  if (!query.trim()) return [];
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .ilike('name', `%${query.trim()}%`)
    .order('verified', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/** 附近球场（按坐标） */
export async function getNearbyCourses(lat: number, lng: number, radiusKm = 30): Promise<Course[]> {
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .gte('lat', lat - latDelta)
    .lte('lat', lat + latDelta)
    .gte('lng', lng - lngDelta)
    .lte('lng', lng + lngDelta)
    .limit(10);
  if (error) throw error;
  return (data ?? []).sort((a, b) => {
    const da = Math.hypot((a.lat ?? 0) - lat, (a.lng ?? 0) - lng);
    const db = Math.hypot((b.lat ?? 0) - lat, (b.lng ?? 0) - lng);
    return da - db;
  });
}

/** 根据 ID 获取球场 */
export async function getCourseById(id: string): Promise<Course | null> {
  const { data } = await supabase.from('courses').select('*').eq('id', id).maybeSingle();
  return data ?? null;
}
