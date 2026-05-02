import AsyncStorage from '@react-native-async-storage/async-storage';

/** 从存储读出的字符串安全解析为 JSON 数组；解析失败或非数组时为 [] */
export function parseJsonArray<T = unknown>(raw: string | null | undefined): T[] {
  if (raw == null || raw === '') return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw == null || raw === '') return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** AsyncStorage：仅接受 JSON 数组，否则视为 [] */
export async function readJsonArray<T = unknown>(key: string): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return parseJsonArray<T>(raw);
  } catch {
    return [];
  }
}

export async function writeJson<T>(key: string, value: T): Promise<boolean> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
