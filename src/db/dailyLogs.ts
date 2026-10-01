import { supabase } from './client.ts';
import type { Insert, Row } from './types.ts';

export type DailyLog = Row<'daily_logs'>;
export type DailyLogInsert = Insert<'daily_logs'>;

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
  const { error } = await supabase.from('daily_logs').upsert(record, { onConflict: 'log_date' });
  if (error) throw new Error(error.message);
}
