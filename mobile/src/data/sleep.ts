// Sleep rows for the phone. The website's src/db/sleep.ts uses the browser client, so this uses the app's own
// client against the same table. Row-level security keeps each call to the signed-in person. user_id is filled
// by the database from the login.
import { fetchAll } from '../../../src/db/paging.ts';
import type { Row } from '../../../src/db/types.ts';
import type { SleepSession, SleepValues } from '../../../src/features/sleep/model.ts';
import { sessionFromRow } from '../../../src/features/sleep/rows.ts';
import { currentAge } from '../../../src/lib/age.ts';
import { toNumberOrNull } from '../../../src/lib/numbers.ts';
import { supabase } from '../supabase';

/** Sessions that ended on or after `sinceMs`, oldest first. Paged, because a long history can pass the 1000-row cap. */
export async function fetchSleepSince(sinceMs: number): Promise<SleepSession[]> {
  const rows = await fetchAll<Row<'sleep_sessions'>>(
    (from, to) => supabase.from('sleep_sessions').select('*').gte('end_at', new Date(sinceMs).toISOString()).order('end_at').order('id').range(from, to),
    'sleep',
  );
  return rows.map((row) => sessionFromRow(row));
}

export async function addSleep(values: SleepValues): Promise<void> {
  const { error } = await supabase.from('sleep_sessions').insert(values);
  if (error) throw new Error(error.message);
}

export async function deleteSleep(id: string): Promise<void> {
  const { error } = await supabase.from('sleep_sessions').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/**
 * Age for the recommended-hours band, from the same profile the website uses. Null when there is no profile, or
 * when the stored age cannot be read as a number. The band is never guessed.
 */
export async function fetchProfileAge(today: string): Promise<number | null> {
  const { data, error } = await supabase.from('profile').select('date_of_birth, age').limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  let age: number | null;
  try {
    age = toNumberOrNull(data.age, 'age');
  } catch {
    age = null;
  }
  return currentAge({ date_of_birth: data.date_of_birth, age }, today);
}
