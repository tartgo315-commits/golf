import AsyncStorage from '@react-native-async-storage/async-storage';

import { getLibraryCourseById } from '@/lib/golf-courses';
import type { LibraryCourse } from '@/lib/golf-courses';

const STORAGE_KEY = '@gca_favorite_courses_v1';
const MAX_FAVORITES = 10;

export type FavoriteCourseStored = {
  courseId: string;
  lastUsedAt: number;
};

function isStoredEntry(x: unknown): x is FavoriteCourseStored {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return typeof o.courseId === 'string' && typeof o.lastUsedAt === 'number' && Number.isFinite(o.lastUsedAt);
}

async function readEntries(): Promise<FavoriteCourseStored[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isStoredEntry);
  } catch {
    return [];
  }
}

async function writeEntries(entries: FavoriteCourseStored[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

/** 收藏球场（按最近使用时间新→旧），仅包含仍在球场库中的 18 洞模板 */
export async function getFavoriteCourses(): Promise<LibraryCourse[]> {
  const entries = await readEntries();
  entries.sort((a, b) => b.lastUsedAt - a.lastUsedAt);
  const out: LibraryCourse[] = [];
  for (const e of entries) {
    const c = getLibraryCourseById(e.courseId);
    if (c && Array.isArray(c.scorecard) && c.scorecard.length === 18) {
      out.push(c);
    }
  }
  return out;
}

/**
 * 添加收藏；已满 10 个时移除「最近使用时间」最早的一条再写入。
 * 已存在则只刷新 lastUsedAt。
 */
export async function addFavoriteCourse(course: Pick<LibraryCourse, 'id'>): Promise<void> {
  const now = Date.now();
  let entries = await readEntries();
  const idx = entries.findIndex((x) => x.courseId === course.id);
  if (idx >= 0) {
    entries[idx] = { courseId: course.id, lastUsedAt: now };
    await writeEntries(entries);
    return;
  }
  if (entries.length >= MAX_FAVORITES) {
    entries.sort((a, b) => a.lastUsedAt - b.lastUsedAt);
    entries = entries.slice(1);
  }
  entries.push({ courseId: course.id, lastUsedAt: now });
  await writeEntries(entries);
}

export async function removeFavoriteCourse(courseId: string): Promise<void> {
  const entries = (await readEntries()).filter((x) => x.courseId !== courseId);
  await writeEntries(entries);
}

/** 仅更新已收藏条目的最近使用时间；未收藏则忽略（不自动加入收藏） */
export async function recordCourseUsed(courseId: string): Promise<void> {
  const entries = await readEntries();
  const idx = entries.findIndex((x) => x.courseId === courseId);
  if (idx < 0) return;
  entries[idx] = { courseId, lastUsedAt: Date.now() };
  await writeEntries(entries);
}
