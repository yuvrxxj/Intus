import { supabase } from './client.ts';
import { fetchAll } from './paging.ts';
import type { Insert, Row } from './types.ts';

export type Habit = Row<'habits'>;
/** What a person fills in. The id, owner, creation time and order are set by the database or by the caller. */
export type HabitInput = Pick<Insert<'habits'>, 'name' | 'kind' | 'unit' | 'goal' | 'better'>;

/** Every habit the signed-in person has made, archived ones included, in the order they were added. */
export function fetchHabits(): Promise<Habit[]> {
  return fetchAll<Habit>(
    (from, to) => supabase.from('habits').select('*').order('sort_order').order('created_at').order('id').range(from, to),
    'habits',
  );
}

export async function createHabit(input: HabitInput, sortOrder: number): Promise<void> {
  const { error } = await supabase.from('habits').insert({ ...input, sort_order: sortOrder });
  if (error) throw new Error(error.message);
}

export async function updateHabit(id: string, input: HabitInput): Promise<void> {
  const { error } = await supabase.from('habits').update(input).eq('id', id);
  if (error) throw new Error(error.message);
}

/** Archiving hides a habit from Today and keeps every value it ever logged. */
export async function setHabitArchived(id: string, archived: boolean): Promise<void> {
  const { error } = await supabase.from('habits').update({ archived_at: archived ? new Date().toISOString() : null }).eq('id', id);
  if (error) throw new Error(error.message);
}
