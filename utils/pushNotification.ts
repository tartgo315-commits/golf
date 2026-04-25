import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { type Href, router } from 'expo-router';
import { AppState, type AppStateStatus, Platform } from 'react-native';

import { ensureRegisteredOnServer } from '@/utils/friendSystem';
import { requestNotificationFlush, socialApiOrigin } from '@/utils/notificationQueue';
import { getOrCreateDeviceUserId } from '@/utils/userIdentity';
import { getTrainingStats } from '@/utils/trainingPlan';

export type NotificationType =
  | 'friend_request'
  | 'friend_accepted'
  | 'amendment_request'
  | 'amendment_result'
  | 'training_reminder'
  | 'handicap_updated';

const TRAINING_REMINDER_ID = 'gca-daily-training-reminder';
const TRAINING_REMINDER_STORAGE = '@gca_training_reminder_v1';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: false,
      shouldShowList: false,
    }),
  });
}

export type InAppPayload = {
  title: string;
  body: string;
  type: NotificationType;
  data: Record<string, string>;
};

let presentInApp: ((p: InAppPayload) => void) | undefined;

export function setInAppNotificationPresenter(fn: typeof presentInApp) {
  presentInApp = fn;
}

function strData(raw: Record<string, unknown> | undefined): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {};
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, String(v ?? '')]));
}

async function uploadPushToken(token: string): Promise<void> {
  const o = socialApiOrigin();
  if (!o) return;
  const deviceId = await getOrCreateDeviceUserId();
  await ensureRegisteredOnServer();
  try {
    await fetch(`${o}/api/user`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, pushToken: token }),
    });
    await requestNotificationFlush(deviceId);
  } catch {
    /* ignore */
  }
}

/** 请求权限、取 Expo Push Token 并上报；拒绝或 Web 返回 null */
export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let final = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      final = status;
    }
    if (final !== 'granted') return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: '默认',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const projectId = (
      Constants.expoConfig as { extra?: { eas?: { projectId?: string } } } | null | undefined
    )?.extra?.eas?.projectId;
    const tokenRes = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenRes.data;
    if (token) await uploadPushToken(token);
    return token;
  } catch {
    return null;
  }
}

export function handleNotificationReceived(notification: Notifications.Notification): void {
  const { title, body, data } = notification.request.content;
  const raw =
    data && typeof data === 'object' && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {};
  const type = (String(raw.type ?? 'handicap_updated') || 'handicap_updated') as NotificationType;
  if (presentInApp && (title || body)) {
    presentInApp({
      title: title || '通知',
      body: body ?? '',
      type,
      data: strData(raw),
    });
  }
}

export function handleNotificationResponse(response: Notifications.NotificationResponse): void {
  const { data } = response.notification.request.content;
  const raw =
    data && typeof data === 'object' && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {};
  const type = (String(raw.type ?? '') || 'handicap_updated') as NotificationType;
  navigateFromNotificationData(type, strData(raw));
}

export function navigateFromNotificationData(
  type: NotificationType,
  data: Record<string, string>,
): void {
  try {
    switch (type) {
      case 'friend_request':
        router.push('/friends?highlight=requests' as Href);
        break;
      case 'friend_accepted': {
        const id = data.friendId?.trim();
        if (id) router.push(`/friends/${id}` as Href);
        else router.push('/friends' as Href);
        break;
      }
      case 'amendment_request': {
        const rid = data.requestId?.trim();
        if (rid) router.push(`/amendment/${rid}` as Href);
        break;
      }
      case 'amendment_result': {
        const roundId = data.roundId?.trim();
        if (roundId) router.push(`/handicap/${roundId}` as Href);
        else router.push('/handicap' as Href);
        break;
      }
      case 'training_reminder':
        router.push('/training' as Href);
        break;
      case 'handicap_updated':
      default:
        router.push('/handicap' as Href);
        break;
    }
  } catch {
    /* ignore navigation errors */
  }
}

export function setupPushNotificationListeners(): { remove: () => void }[] {
  if (Platform.OS === 'web') return [];
  const a = Notifications.addNotificationReceivedListener(handleNotificationReceived);
  const b = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);
  return [a, b];
}

export async function cancelDailyTrainingReminder(): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.cancelScheduledNotificationAsync(TRAINING_REMINDER_ID).catch(() => {});
}

export async function scheduleDailyTrainingReminder(hour = 20, minute = 0): Promise<void> {
  if (Platform.OS === 'web') return;
  await cancelDailyTrainingReminder();
  const stats = await getTrainingStats();
  const pending = Math.max(0, stats.totalItems - stats.checkedInToday);
  const body = `你有 ${pending} 个训练项目待打卡，保持连续 ${stats.streakDays} 天`;
  await Notifications.scheduleNotificationAsync({
    identifier: TRAINING_REMINDER_ID,
    content: {
      title: '💪 今日训练打卡',
      body,
      data: { type: 'training_reminder' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

export type TrainingReminderSettings = { enabled: boolean; hour: number; minute: number };

export async function loadTrainingReminderSettings(): Promise<TrainingReminderSettings> {
  const raw = await AsyncStorage.getItem(TRAINING_REMINDER_STORAGE);
  if (!raw) return { enabled: false, hour: 20, minute: 0 };
  try {
    const o = JSON.parse(raw) as Partial<TrainingReminderSettings>;
    return {
      enabled: Boolean(o.enabled),
      hour: typeof o.hour === 'number' && o.hour >= 0 && o.hour <= 23 ? o.hour : 20,
      minute: typeof o.minute === 'number' && o.minute >= 0 && o.minute <= 59 ? o.minute : 0,
    };
  } catch {
    return { enabled: false, hour: 20, minute: 0 };
  }
}

export async function saveTrainingReminderSettings(s: TrainingReminderSettings): Promise<void> {
  await AsyncStorage.setItem(TRAINING_REMINDER_STORAGE, JSON.stringify(s));
  if (s.enabled) await scheduleDailyTrainingReminder(s.hour, s.minute);
  else await cancelDailyTrainingReminder();
}

export async function applyTrainingReminderFromStorage(): Promise<void> {
  const s = await loadTrainingReminderSettings();
  if (s.enabled) await scheduleDailyTrainingReminder(s.hour, s.minute);
  else await cancelDailyTrainingReminder();
}
