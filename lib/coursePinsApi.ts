import { supabase } from '@/lib/supabase';

export type CoursePin = {
  holeNumber: number;
  lat: number;
  lng: number;
};

/** 加载某球场所有洞的已存坐标 */
export async function loadCoursePins(courseName: string): Promise<Map<number, CoursePin>> {
  const { data, error } = await supabase
    .from('course_pins')
    .select('hole_number, lat, lng')
    .eq('course_name', courseName);
  if (error) return new Map();
  const map = new Map<number, CoursePin>();
  (data ?? []).forEach((r: any) => {
    map.set(r.hole_number, { holeNumber: r.hole_number, lat: r.lat, lng: r.lng });
  });
  return map;
}

/** 保存/更新某洞的 pin 坐标（upsert） */
export async function saveCoursePin(
  courseName: string,
  holeNumber: number,
  lat: number,
  lng: number,
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from('course_pins').upsert(
    {
      course_name: courseName,
      hole_number: holeNumber,
      lat,
      lng,
      submitted_by: user?.id ?? null,
    },
    { onConflict: 'course_name,hole_number' },
  );
  if (error) throw error;
}
