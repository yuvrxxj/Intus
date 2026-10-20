import type { SleepSession, SleepValues } from '../../../src/features/sleep/model.ts';
import { sessionFromRow } from '../../../src/features/sleep/rows.ts';
import type { Row } from '../../../src/db/types.ts';
import { supabase } from '../supabase';
import { fetchAll } from './paging';
import type { Queued } from './outbox';

/** Every stored session that ended on or after the instant, oldest first. Paged past the API's silent 1000-row cap. */
export async function fetchSleepSince(sinceMs: number): Promise<SleepSession[]> {
  const rows = await fetchAll<Row<'sleep_sessions'>>(
    (from, to) => supabase.from('sleep_sessions').select('*').gte('end_at', new Date(sinceMs).toISOString()).order('end_at').order('id').range(from, to),
    'sleep',
  );
  return rows.map(sessionFromRow);
}

/** The person's date of birth and stored age, for the age band. Null before the profile is filled in. */
export async function fetchBirth(): Promise<{ date_of_birth: string | null; age: number | null } | null> {
  const { data, error } = await supabase.from('profile').select('date_of_birth,age').limit(1).maybeSingle();
  if (error) throw new Error(`Could not load your profile: ${error.message}`);
  return data;
}

/** A night typed on the phone, waiting to be sent. The id is made on the phone, so sending twice cannot make two rows. */
export interface PendingSleep extends Queued {
  id: string;
  values: SleepValues;
}

export async function sendSleep(entry: PendingSleep): Promise<void> {
  const { error } = await supabase.from('sleep_sessions').upsert({ id: entry.id, ...entry.values }, { onConflict: 'id' });
  if (error) throw new Error(error.message);
}

export async function deleteSleep(id: string): Promise<void> {
  const { error } = await supabase.from('sleep_sessions').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
