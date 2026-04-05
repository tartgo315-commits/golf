import AsyncStorage from '@react-native-async-storage/async-storage';

export const APP_LANGUAGE_KEY = '@gca_language_v1';

export type StoredAppLanguage = 'en' | 'zh';

export async function loadStoredAppLanguage(): Promise<StoredAppLanguage | null> {
  const raw = await AsyncStorage.getItem(APP_LANGUAGE_KEY);
  if (raw === 'en' || raw === 'zh') return raw;
  return null;
}

export async function saveStoredAppLanguage(lng: StoredAppLanguage) {
  await AsyncStorage.setItem(APP_LANGUAGE_KEY, lng);
}
