import { readJson, writeJson } from '@/lib/local-storage';

export const COURSE_STROKE_INDEXES_KEY = 'courseStrokeIndexes';

/** 球场名 → 该球场上次保存的 Stroke Index 序列（9 或 18 个数） */
export type CourseStrokeIndexesStore = Record<string, number[]>;

export async function loadCourseStrokeIndexes(): Promise<CourseStrokeIndexesStore> {
  return readJson<CourseStrokeIndexesStore>(COURSE_STROKE_INDEXES_KEY, {});
}

export async function saveCourseStrokeIndexesForCourse(
  courseName: string,
  map: number[],
): Promise<void> {
  const key = courseName.trim();
  if (!key || map.length === 0) return;
  const prev = await loadCourseStrokeIndexes();
  const next: CourseStrokeIndexesStore = { ...prev, [key]: [...map] };
  await writeJson(COURSE_STROKE_INDEXES_KEY, next);
}

export async function getCourseStrokeIndexMap(courseName: string): Promise<number[] | undefined> {
  const key = courseName.trim();
  if (!key) return undefined;
  const all = await loadCourseStrokeIndexes();
  return all[key];
}
