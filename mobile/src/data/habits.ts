import type { Habit } from '../../../src/db/rows.ts';
import { supabase } from '../supabase';
import { fetchAll } from './paging';

/** Every habit the signed-in person has made, archived ones included, in the order they were added. */
export function fetchHabits(): Promise<Habit[]> {
  return fetchAll<Habit>(
    (from, to) => supabase.from('habits').select('*').order('sort_order').order('created_at').order('id').range(from, to),
    'habits',
  );
}
