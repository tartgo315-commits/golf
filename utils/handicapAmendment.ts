import type { HandicapRecord } from '@/lib/handicap';

/** 申请人 id（与详情页 amendRequesterId 一致） */
export function handicapAmendmentRequesterId(
  record: HandicapRecord,
  appUserId: string,
): string {
  if (record.sourceMatchId != null && typeof record.requesterPlayerIndex === 'number') {
    return `peer:${record.id}:${record.requesterPlayerIndex}`;
  }
  return appUserId;
}

/** 需投票的同组球友（不含申请人） */
export function handicapAmendmentVoters(
  record: HandicapRecord,
  requesterId: string,
): { userId: string; name: string }[] {
  return (record.playingPartners ?? []).filter((p) => p.userId !== requesterId);
}

/**
 * 锁定后是否允许走「申请修改」：须为 App 内同场开局，且至少一名同组球友可投票。
 * 手填同组姓名、单人记分等不满足条件。
 */
export function canRequestHandicapAmendment(record: HandicapRecord, requesterId: string): boolean {
  if (record.sourceMatchId == null) return false;
  if (typeof record.requesterPlayerIndex !== 'number') return false;
  return handicapAmendmentVoters(record, requesterId).length > 0;
}
