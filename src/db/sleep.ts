import type { SleepSession, SleepValues } from '../features/sleep/model.ts';
import { sessionFromRow } from '../features/sleep/rows.ts';
import { supabase } from './client.ts';
import { fetchAll } from './paging.ts';
import type { Row } from './types.ts';

/** Every stored session that ended on or after the given instant, oldest first. Paged, because a long history can pass the API's silent 1000-row cap. */
export async function fetchSleepSince(sinceMs: number): Promise<SleepSession[]> {
  const rows = await fetchAll<Row<'sleep_sessions'>>(
    (from, to) => supabase.from('sleep_sessions').select('*').gte('end_at', new Date(sinceMs).toISOString()).order('end_at').order('id').range(from, to),
    'sleep',
  );
  return rows.map(sessionFromRow);
}

export async function addSleep(values: SleepValues): Promise<void> {
  const { error } = await supabase.from('sleep_sessions').insert(values);
  if (error) throw new Error(error.message);
}

export async function updateSleep(id: string, values: SleepValues): Promise<void> {
  const { error } = await supabase.from('sleep_sessions').update({ ...values, recorded_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteSleep(id: string): Promise<void> {
  const { error } = await supabase.from('sleep_sessions').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
