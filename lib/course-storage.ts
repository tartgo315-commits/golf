import AsyncStorage from '@react-native-async-storage/async-storage';

import { readJson, writeJson } from '@/lib/local-storage';

export const COURSE_STROKE_INDEXES_KEY = 'courseStrokeIndexes';

/** 球场名 → 该球场上次保存的 Stroke Index 序列（9 或 18 个数） */
export type CourseStrokeIndexesStore = Record<string, number[]>;

export async function loadCourseStrokeIndexes(): Promise<CourseStrokeIndexesStore> {
  if (typeof window !== 'undefined') {
    return readJson<CourseStrokeIndexesStore>(COURSE_STROKE_INDEXES_KEY, {});
  }
  try {
    const raw = await AsyncStorage.getItem(COURSE_STROKE_INDEXES_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as unknown;
    if (p && typeof p === 'object' && !Array.isArray(p)) return p as CourseStrokeIndexesStore;
  } catch {
    /* ignore */
  }
  return {};
}

export async function saveCourseStrokeIndexesForCourse(
  courseName: string,
  map: number[],
): Promise<void> {
  const key = courseName.trim();
  if (!key || map.length === 0) return;
  const prev = await loadCourseStrokeIndexes();
  const next: CourseStrokeIndexesStore = { ...prev, [key]: [...map] };
  if (typeof window !== 'undefined') {
    writeJson(COURSE_STROKE_INDEXES_KEY, next);
    return;
  }
  try {
    await AsyncStorage.setItem(COURSE_STROKE_INDEXES_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export async function getCourseStrokeIndexMap(courseName: string): Promise<number[] | undefined> {
  const key = courseName.trim();
  if (!key) return undefined;
  const all = await loadCourseStrokeIndexes();
  return all[key];
}
