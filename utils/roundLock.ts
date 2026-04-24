/** 成绩 24h 锁定与打标；供 UI 与 `normalizeRecord` 使用，勿从 `lib/handicap` 反向引用以避免循环依赖 */

export type RoundLockInput = {
  handicapProcessed?: boolean;
  submittedAt?: number;
  date: string;
  /** 可选，仅用于 submittedAt 无效时的日志 */
  id?: string;
};

const LOCK_MS = 24 * 60 * 60 * 1000;

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
 * handicapProcessed === true 且自提交时间起已超过 24 小时 → 锁定。
 * 无 handicapProcessed 或非 true 时不锁定。
 */
export function isRoundLocked(round: RoundLockInput): boolean {
  // TODO Phase 2: 加入同组玩家投票验证逻辑
  if (round.handicapProcessed !== true) return false;
  return Date.now() - submittedAtMs(round) > LOCK_MS;
}

function roundEditableWindowRemainingMs(round: RoundLockInput): number | null {
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
