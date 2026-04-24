import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Session } from '@/contexts/auth-context';

const DEVICE_KEY = '@gca_device_uid_v1';

/** 设备级稳定 ID（好友/社交注册用 deviceId） */
export async function getOrCreateDeviceUserId(): Promise<string> {
  const existing = await AsyncStorage.getItem(DEVICE_KEY);
  if (existing && existing.trim()) return existing.trim();
  const id = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  await AsyncStorage.setItem(DEVICE_KEY, id);
  return id;
}

/** 登录邮箱优先，否则稳定设备 ID */
export async function getAppUserId(session: Session | null): Promise<string> {
  const email = session?.email?.trim().toLowerCase();
  if (email) return `u:${email}`;
  return getOrCreateDeviceUserId();
}
