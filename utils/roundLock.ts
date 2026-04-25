/** 成绩 24h 锁定与打标；供 UI 与 `normalizeRecord` 使用，勿从 `lib/handicap` 反向引用以避免循环依赖 */

import { getAmendmentRequests } from '@/utils/amendmentRequest';
import {
  isRoundAmendmentUnlockedSync,
  markRoundAmendmentUnlocked,
} from '@/utils/amendmentUnlockStorage';
import { getCachedServerNowMs, getServerTime } from '@/utils/serverTime';

export type RoundLockInput = {
  handicapProcessed?: boolean;
  submittedAt?: number;
  date: string;
  /** 可选，仅用于 submittedAt 无效时的日志；Phase 2 修改申请依赖 round id */
  id?: string;
};

const LOCK_MS = 24 * 60 * 60 * 1000;

function nowMsSync(): number {
  return getCachedServerNowMs() ?? Date.now();
}

export function submittedAtMs(round: RoundLockInput): number {
  if (typeof round.submittedAt === 'number') {
    const v = round.submittedAt;
    if (Number.isFinite(v) && v > 0) {
      return v;
    }
    const rid = round.id ?? '—';
    console.warn(`[roundLock] submittedAt 无效，使用 date 字段代替，roundId: ${rid}`);
  }
  const t = Date.parse(round.date);
  return Number.isFinite(t) ? t : 0;
}

/**
 * handicapProcessed === true 且自提交时间起已超过 24 小时 → 锁定（使用服务端时间）。
 * 无 handicapProcessed 或非 true 时不锁定。
 */
export async function isRoundLocked(round: RoundLockInput): Promise<boolean> {
  if (round.handicapProcessed !== true) return false;
  const now = await getServerTime();
  if (now - submittedAtMs(round) <= LOCK_MS) return false;
  if (!round.id) return true;
  if (isRoundAmendmentUnlockedSync(round.id)) return false;
  const list = await getAmendmentRequests(round.id);
  const approved = list.find((r) => r.status === 'approved' && !r.consumed);
  if (approved) {
    await markRoundAmendmentUnlocked(round.id);
    return false;
  }
  return true;
}

/**
 * 同步版：列表角标、详情首屏、normalize 等；有缓存的服务端时间则用，否则本地 Date.now()。
 */
export function isRoundLockedSync(round: RoundLockInput): boolean {
  if (round.handicapProcessed !== true) return false;
  if (nowMsSync() - submittedAtMs(round) <= LOCK_MS) return false;
  if (round.id && isRoundAmendmentUnlockedSync(round.id)) return false;
  return true;
}

function roundEditableWindowRemainingMs(round: RoundLockInput): number | null {
  if (round.handicapProcessed !== true) return null;
  if (isRoundLockedSync(round)) return null;
  const end = submittedAtMs(round) + LOCK_MS;
  return Math.max(0, end - nowMsSync());
}

/** 处理完成且仍在 24h 内时返回文案；否则 null */
export function roundLockCountdownLabel(round: RoundLockInput): string | null {
  const rem = roundEditableWindowRemainingMs(round);
  if (rem == null || rem <= 0) return null;
  const h = Math.ceil(rem / (60 * 60 * 1000));
  return `还可修改 ${h}小时`;
}

/**
 * 唯一打标入口：设置 handicapProcessed = true。
 * - submittedAt：已有有效数字且 `preserveSubmittedAt === true` 时保留；否则无 submittedAt 时写入 Date.now()；`preserveSubmittedAt === false` 时强制写入 Date.now()。
 */
export function markHandicapProcessingComplete<T extends { submittedAt?: number }>(
  record: T,
  preserveSubmittedAt?: boolean,
): T & { handicapProcessed: true; submittedAt: number } {
  const has = typeof record.submittedAt === 'number' && Number.isFinite(record.submittedAt);
  let submittedAt: number;
  if (preserveSubmittedAt === false) {
    submittedAt = Date.now();
  } else if (preserveSubmittedAt === true && has) {
    submittedAt = record.submittedAt!;
  } else if (has) {
    submittedAt = record.submittedAt!;
  } else {
    submittedAt = Date.now();
  }
  return { ...record, handicapProcessed: true, submittedAt };
}
