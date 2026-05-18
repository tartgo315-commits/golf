import {
  loadHandicapRecords,
  normalizeHandicapRecords,
  type HandicapRecord,
} from '@/lib/handicap';
import { loadSupabaseHandicapRecords } from '@/lib/supabaseToHandicap';

/** Strip `supabase_` prefix from cloud-sourced record ids. */
export function stripSupabaseHandicapId(id: string): string {
  return id.replace(/^supabase_/, '');
}

/** Merge local AsyncStorage records with Supabase rounds (deduped). */
export function mergeLocalAndSupabaseHandicapRecords(
  local: HandicapRecord[],
  supabaseRecords: HandicapRecord[],
): HandicapRecord[] {
  const localIds = new Set(local.map((r) => r.id));
  const cloudIds = new Set(
    local
      .map((r) => r.cloudRoundId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0),
  );
  const newRecords = supabaseRecords.filter((r) => {
    const rid = stripSupabaseHandicapId(r.id);
    if (cloudIds.has(rid)) return false;
    return !localIds.has(rid);
  });
  return normalizeHandicapRecords([...local, ...newRecords]);
}

/** Local + cloud handicap list (same merge as home / history). */
export async function loadMergedHandicapRecords(): Promise<HandicapRecord[]> {
  const normalized = await loadHandicapRecords();
  try {
    const supabaseRecords = await loadSupabaseHandicapRecords();
    return mergeLocalAndSupabaseHandicapRecords(normalized, supabaseRecords);
  } catch {
    return normalized;
  }
}

/** Resolve a route `:id` against merged records (supports `supabase_*` and `cloudRoundId`). */
export function findHandicapRecordByRouteId(
  records: HandicapRecord[],
  routeId: string,
): HandicapRecord | null {
  const direct = records.find((item) => item.id === routeId);
  if (direct) return direct;

  const bare = stripSupabaseHandicapId(routeId);
  return (
    records.find((item) => item.id === bare) ??
    records.find((item) => stripSupabaseHandicapId(item.id) === bare) ??
    records.find((item) => item.cloudRoundId === bare) ??
    records.find((item) => item.cloudRoundId === routeId) ??
    null
  );
}
