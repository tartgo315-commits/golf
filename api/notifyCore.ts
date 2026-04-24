/**
 * Expo Push 发送 / 离线入队 / 上线 flush（供 api/notify、user PATCH、friend、amendment 调用）
 */

import { drainQueueForUser, enqueueOffline } from './_notificationQueue';
import { readSocialState } from './_socialPersistence';

export type NotificationType =
  | 'friend_request'
  | 'friend_accepted'
  | 'amendment_request'
  | 'amendment_result'
  | 'training_reminder'
  | 'handicap_updated';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export async function expoPushSend(
  to: string,
  title: string,
  body: string,
  type: string,
  data: Record<string, string>,
): Promise<string | null> {
  const dataOut: Record<string, string> = { ...data, type };
  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to,
      title,
      body,
      sound: 'default',
      data: Object.fromEntries(Object.entries(dataOut).map(([k, v]) => [k, String(v)])),
    }),
  });
  const j = (await res.json()) as {
    data?: { status?: string; id?: string } | { status?: string; id?: string }[];
  };
  const d = j.data;
  const one = Array.isArray(d) ? d[0] : d;
  if (one?.status === 'ok' && one.id) return one.id;
  return null;
}

export async function sendOrEnqueueNotification(input: {
  toUserId: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, string>;
}): Promise<{ success: boolean; ticketId?: string; queued?: boolean }> {
  const s = await readSocialState();
  const token = s.users[input.toUserId]?.pushToken?.trim() ?? '';
  const looksExpo = token.includes('ExponentPushToken') || token.includes('ExpoPushToken');
  if (token && looksExpo) {
    const id = await expoPushSend(token, input.title, input.body, input.type, input.data);
    if (id) return { success: true, ticketId: id };
  }
  await enqueueOffline(input.toUserId, {
    type: input.type,
    title: input.title,
    body: input.body,
    data: input.data,
  });
  return { success: true, ticketId: 'queued', queued: true };
}

export async function flushQueuedNotificationsForUser(userId: string): Promise<number> {
  const list = await drainQueueForUser(userId);
  if (list.length === 0) return 0;
  const s = await readSocialState();
  const token = s.users[userId]?.pushToken?.trim() ?? '';
  if (!token.includes('ExponentPushToken') && !token.includes('ExpoPushToken')) return 0;
  let n = 0;
  for (const item of list) {
    const id = await expoPushSend(token, item.title, item.body, item.type, item.data);
    if (id) n += 1;
  }
  return n;
}

export async function flushQueuedByDeviceId(deviceId: string): Promise<number> {
  const s = await readSocialState();
  const uid = s.deviceToUserId[deviceId];
  if (!uid) return 0;
  return flushQueuedNotificationsForUser(uid);
}

export function isRegisteredPushUserId(userId: string): boolean {
  return userId.startsWith('usr_');
}

export async function notifyFriendRequest(toUserId: string, fromName: string, fromUserId: string): Promise<void> {
  if (!isRegisteredPushUserId(toUserId)) return;
  await sendOrEnqueueNotification({
    toUserId,
    type: 'friend_request',
    title: '新好友申请',
    body: `${fromName} 想和你成为球友`,
    data: { fromUserId },
  });
}

export async function notifyFriendAccepted(fromUserId: string, accepterName: string, accepterUserId: string): Promise<void> {
  if (!isRegisteredPushUserId(fromUserId)) return;
  await sendOrEnqueueNotification({
    toUserId: fromUserId,
    type: 'friend_accepted',
    title: '好友申请已接受',
    body: `${accepterName} 接受了你的申请，快去看看对比差点`,
    data: { friendId: accepterUserId },
  });
}

export async function notifyAmendmentRequest(
  voterUserId: string,
  requesterName: string,
  roundDate: string,
  requestId: string,
): Promise<void> {
  if (!isRegisteredPushUserId(voterUserId)) return;
  await sendOrEnqueueNotification({
    toUserId: voterUserId,
    type: 'amendment_request',
    title: '成绩修改待确认',
    body: `${requesterName} 申请修改 ${roundDate} 的成绩，请投票`,
    data: { requestId },
  });
}

export async function notifyAmendmentResult(
  requesterId: string,
  approved: boolean,
  rejectedByName: string | undefined,
  roundId: string,
  requestId: string,
): Promise<void> {
  if (!isRegisteredPushUserId(requesterId)) return;
  if (approved) {
    await sendOrEnqueueNotification({
      toUserId: requesterId,
      type: 'amendment_result',
      title: '修改申请已批准',
      body: '你的成绩修改申请已获全部同意',
      data: { roundId, requestId, result: 'approved' },
    });
  } else {
    await sendOrEnqueueNotification({
      toUserId: requesterId,
      type: 'amendment_result',
      title: '修改申请被拒绝',
      body: `${rejectedByName ?? '对方'} 拒绝了你的成绩修改申请`,
      data: { roundId, requestId, result: 'rejected', rejectedBy: rejectedByName ?? '' },
    });
  }
}
