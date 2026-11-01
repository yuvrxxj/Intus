// Steps and active calories for the phone: the app's own client against activity_days. Row-level security keeps each
// call to the signed-in person.
import { fetchAll } from '../../../src/db/paging.ts';
import type { Row } from '../../../src/db/types.ts';
import { supabase } from '../supabase';
import type { ActivityDayRow } from '../activity/rules';

/** Days on or after `fromDay` ('YYYY-MM-DD'), oldest first. Paged, because a long history can pass the 1000-row cap. */
export async function fetchActivitySince(fromDay: string): Promise<ActivityDayRow[]> {
  const rows = await fetchAll<Row<'activity_days'>>(
    (from, to) => supabase.from('activity_days').select('*').gte('day', fromDay).order('day').order('id').range(from, to),
    'activity',
  );
  return rows.map((r) => ({ day: r.day, steps: r.steps, active_kcal: r.active_kcal, source: r.source }));
}
