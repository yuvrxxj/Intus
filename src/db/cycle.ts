import { supabase } from './client.ts';
import { fetchAll } from './paging.ts';
import type { Row } from './types.ts';

export type CycleDay = Row<'cycle_days'>;
export type Condition = Row<'profile_conditions'>;

/** A table that does not exist yet (the app deployed before its migration ran) reads as empty rather than failing. */
function missingTable(message: string): boolean {
  return /does not exist|schema cache|not find the table/i.test(message);
}

export async function fetchCycleDays(): Promise<CycleDay[]> {
  try {
    return await fetchAll<CycleDay>((from, to) => supabase.from('cycle_days').select('*').order('day').order('source').range(from, to), 'cycle days');
  } catch (e) {
    if (e instanceof Error && missingTable(e.message)) return [];
    throw e;
  }
}

/** One manual entry per day: saving a day replaces what was typed for it. */
export async function saveCycleDay(day: string, flow: string, symptoms: string[]): Promise<void> {
  const { error } = await supabase.from('cycle_days').upsert({ day, flow, symptoms, source: 'manual' }, { onConflict: 'user_id,day,source' });
  if (error) throw new Error(error.message);
}

export async function deleteCycleDay(day: string): Promise<void> {
  const { error } = await supabase.from('cycle_days').delete().eq('day', day).eq('source', 'manual');
  if (error) throw new Error(error.message);
}

export async function fetchConditions(): Promise<Condition[]> {
  const { data, error } = await supabase.from('profile_conditions').select('*').order('condition');
  if (error) {
    if (missingTable(error.message)) return [];
    throw new Error(`Could not load your conditions: ${error.message}`);
  }
  return data ?? [];
}

export async function saveCondition(condition: string, label: string | null, since: string | null): Promise<void> {
  const { error } = await supabase.from('profile_conditions').upsert({ condition, label, since }, { onConflict: 'user_id,condition' });
  if (error) throw new Error(error.message);
}

export async function deleteCondition(condition: string): Promise<void> {
  const { error } = await supabase.from('profile_conditions').delete().eq('condition', condition);
  if (error) throw new Error(error.message);
}
