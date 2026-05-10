import AsyncStorage from '@react-native-async-storage/async-storage';

import { HANDICAP_RECORDS_KEY } from '@/lib/handicap';
import { supabase } from '@/lib/supabase';

export type MigrateResult = {
  total: number;
  success: number;
  skipped: number;
  errors: string[];
};

export async function migrateLocalRecordsToSupabase(
  onProgress?: (done: number, total: number) => void,
): Promise<MigrateResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('请先登录');

  const raw = await AsyncStorage.getItem(HANDICAP_RECORDS_KEY);
  if (!raw) return { total: 0, success: 0, skipped: 0, errors: [] };
  const records: any[] = JSON.parse(raw);

  const result: MigrateResult = { total: records.length, success: 0, skipped: 0, errors: [] };

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    onProgress?.(i, records.length);

    try {
      if (r.cloudRoundId) {
        result.skipped++;
        continue;
      }

      const holes = Array.isArray(r.holeDetails) ? r.holeDetails : [];
      const holesCount =
        holes.length > 0 ? holes.length : r.holes === 9 ? 9 : r.holes === 18 ? 18 : 18;
      const parSum = holes.reduce((s: number, h: any) => s + (h.par ?? 4), 0);
      const parSetting =
        holes.length > 0
          ? Math.round(parSum / (holesCount / 18))
          : holesCount === 9
            ? 36
            : 72;

      const { data: round, error: rErr } = await supabase
        .from('rounds')
        .insert({
          created_by: user.id,
          course_name: r.courseName ?? '未知球场',
          played_at: r.date ?? new Date().toISOString().split('T')[0],
          holes: holesCount,
          starting_hole: 1,
          par_setting: parSetting,
          status: 'completed',
          visibility: 'private',
          tee_color: 'blue',
        })
        .select('id')
        .single();

      if (rErr || !round) throw new Error(rErr?.message ?? 'round insert failed');

      const { error: rpErr } = await supabase.from('round_players').insert({
        round_id: round.id,
        user_id: user.id,
        handicap: null,
      });
      if (rpErr) throw new Error(rpErr.message);

      if (holes.length > 0) {
        const scoreRows = holes.map((h: any) => ({
          round_id: round.id,
          user_id: user.id,
          hole_number: h.holeNumber,
          strokes: h.strokes ?? 0,
          par: h.par ?? 4,
          putts: h.putts ?? null,
          gir: typeof h.greenInRegulation === 'boolean' ? h.greenInRegulation : null,
          fir: h.fairwayHit === true ? 'hit' : null,
        }));
        const { error: sErr } = await supabase.from('scores').insert(scoreRows);
        if (sErr) throw new Error(sErr.message);
      }

      r.cloudRoundId = round.id;
      result.success++;
    } catch (e: any) {
      result.errors.push(`${r.courseName ?? '?'} (${r.date ?? '?'}): ${e.message}`);
    }
  }

  await AsyncStorage.setItem(HANDICAP_RECORDS_KEY, JSON.stringify(records));
  onProgress?.(records.length, records.length);
  return result;
}
