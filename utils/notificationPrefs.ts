import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@gca_notif_prefs_v1';

export type NotificationPrefs = {
  friendEnabled: boolean;
  handicapUpdateEnabled: boolean;
};

const DEFAULT: NotificationPrefs = {
  friendEnabled: true,
  handicapUpdateEnabled: true,
};

export async function loadNotificationPrefs(): Promise<NotificationPrefs> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT };
    const o = JSON.parse(raw) as Partial<NotificationPrefs>;
    return {
      friendEnabled: o.friendEnabled !== false,
      handicapUpdateEnabled: o.handicapUpdateEnabled !== false,
    };
  } catch {
    return { ...DEFAULT };
  }
}

export async function saveNotificationPrefs(p: NotificationPrefs): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(p));
}
