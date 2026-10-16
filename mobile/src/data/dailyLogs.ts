import type { DailyLog, DailyLogInsert } from '../../../src/db/rows.ts';
import { supabase } from '../supabase';

/** One day's log, or null when nothing was saved for it. */
export async function fetchLog(date: string): Promise<DailyLog | null> {
  const { data, error } = await supabase.from('daily_logs').select('*').eq('log_date', date).maybeSingle();
  if (error) throw new Error(`Could not load the log for ${date}: ${error.message}`);
  return data;
}

/** Newest first. The habit streaks read this. */
export async function fetchRecentLogs(limit: number): Promise<DailyLog[]> {
  const { data, error } = await supabase.from('daily_logs').select('*').order('log_date', { ascending: false }).limit(limit);
  if (error) throw new Error(`Could not load daily logs: ${error.message}`);
  return data ?? [];
}

// user_id is filled by the database from the login, as on the web
export async function saveLog(record: DailyLogInsert): Promise<void> {
  const { error } = await supabase.from('daily_logs').upsert(record, { onConflict: 'user_id,log_date' });
  if (error) throw new Error(error.message);
}
