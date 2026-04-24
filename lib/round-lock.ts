/** 成绩锁定（24h 窗口）；与 `HandicapRecord` 字段配合，勿从 `handicap.ts` 反向引用以避免循环依赖 */

export type RoundLockInput = {
  handicapProcessed?: boolean;
  submittedAt?: number;
  date: string;
};

const LOCK_MS = 24 * 60 * 60 * 1000;

export function submittedAtMs(round: RoundLockInput): number {
  if (typeof round.submittedAt === 'number' && Number.isFinite(round.submittedAt)) {
    return round.submittedAt;
  }
  const t = Date.parse(round.date);
  return Number.isFinite(t) ? t : 0;
}

/**
 * 已标记差点处理完成，且自提交时间起已超过 24 小时 → 锁定。
 * 无 `handicapProcessed` 或不为 true 时视为未处理完成，不锁定。
 */
export function isRoundLocked(round: RoundLockInput): boolean {
  // TODO Phase 2: 加入同组玩家投票验证逻辑
  if (round.handicapProcessed !== true) return false;
  return Date.now() - submittedAtMs(round) > LOCK_MS;
}

export function roundEditableWindowRemainingMs(round: RoundLockInput): number | null {
  if (round.handicapProcessed !== true) return null;
  if (isRoundLocked(round)) return null;
  const end = submittedAtMs(round) + LOCK_MS;
  return Math.max(0, end - Date.now());
}

/** 处理完成且仍在 24h 内时返回文案；否则 null */
export function roundLockCountdownLabel(round: RoundLockInput): string | null {
  const rem = roundEditableWindowRemainingMs(round);
  if (rem == null || rem <= 0) return null;
  const h = Math.ceil(rem / (60 * 60 * 1000));
  return `还可修改 ${h}小时`;
}

/** 差点计算与写入完成后调用：标记已处理并写入提交时间（无则补当前时间） */
export function markHandicapProcessingComplete<T extends { submittedAt?: number }>(
  round: T,
): T & { handicapProcessed: true; submittedAt: number } {
  return {
    ...round,
    handicapProcessed: true,
    submittedAt:
      typeof round.submittedAt === 'number' && Number.isFinite(round.submittedAt)
        ? round.submittedAt
        : Date.now(),
  };
}
