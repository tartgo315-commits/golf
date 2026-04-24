import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { DETAIL_PREFIX } from '@/utils/courseDatabase';

const FRIEND_CACHE = '@gca_friends_cache_v1';

/** 退出登录时清除的键（不含成绩、训练、档案、语言） */
const LOGOUT_SESSION_KEYS = [
  '@gca_session_v1',
  '@gca_device_uid_v1',
  '@gca_social_user_id_v1',
  '@gca_social_invite_code_v1',
  '@gca_social_display_name_v1',
  FRIEND_CACHE,
] as const;

/**
 * 清除缓存型数据，不删除成绩、训练计划、账号、语言等。
 */
export async function clearAppCache(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const toRemove: string[] = [];
  for (const k of keys) {
    if (k.startsWith(DETAIL_PREFIX) || k === FRIEND_CACHE) {
      toRemove.push(k);
    }
  }
  if (toRemove.length) await AsyncStorage.multiRemove(toRemove);
}

/**
 * 退出登录：清除会话、设备标识与本地社交缓存；成绩与训练等保留。
 */
export async function clearLogoutSessionKeys(): Promise<void> {
  await AsyncStorage.multiRemove([...LOGOUT_SESSION_KEYS]);
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    for (const k of LOGOUT_SESSION_KEYS) {
      window.localStorage.removeItem(k);
    }
  }
}

/**
 * 删除账号与全部本地数据（Apple 审核要求的「删除账号」入口）。
 */
export async function wipeAllLocalUserData(): Promise<void> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.localStorage.clear();
    return;
  }
  await AsyncStorage.clear();
}
