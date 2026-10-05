import { supabase } from './client.ts';
import { fetchAll } from './paging.ts';
import type { Insert, Row } from './types.ts';

export type DailyLog = Row<'daily_logs'>;
export type DailyLogInsert = Insert<'daily_logs'>;

/** The columns the supplement before/after comparison reads, so it does not pull whole rows. */
export type EffectLog = Pick<DailyLog, 'log_date' | 'weight' | 'mood' | 'steps' | 'total_cals' | 'protein' | 'water_ml' | 'active_kcal'>;

const EFFECT_COLUMNS = 'log_date,weight,mood,steps,total_cals,protein,water_ml,active_kcal';

/** Oldest first, from a date up to now. Paged, because a long comparison can pass the API's silent 1000-row cap. */
export function fetchLogsSince(fromDate: string): Promise<EffectLog[]> {
  return fetchAll<EffectLog>(
    (from, to) => supabase.from('daily_logs').select(EFFECT_COLUMNS).gte('log_date', fromDate).order('log_date').range(from, to),
    'daily logs',
  );
}

/** Newest first. */
export async function fetchRecentLogs(limit: number): Promise<DailyLog[]> {
  const { data, error } = await supabase
    .from('daily_logs')
    .select('*')
    .order('log_date', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Could not load daily logs: ${error.message}`);
  return data ?? [];
}

export async function fetchLog(date: string): Promise<DailyLog | null> {
  const { data, error } = await supabase.from('daily_logs').select('*').eq('log_date', date).maybeSingle();
  if (error) throw new Error(`Could not load today's log: ${error.message}`);
  return data;
}

export async function saveLog(record: DailyLogInsert): Promise<void> {
  const { error } = await supabase.from('daily_logs').upsert(record, { onConflict: 'user_id,log_date' });
  if (error) throw new Error(error.message);
}
