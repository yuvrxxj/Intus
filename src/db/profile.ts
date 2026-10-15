import { supabase } from './client.ts';
import type { DetailsValues, GoalValues, Profile } from './rows.ts';

export type { DetailsValues, GoalValues, Profile };

/** The signed-in person's own profile (the database only returns their rows), or null before it has been filled in. */
export async function fetchProfile(): Promise<Profile | null> {
  const { data, error } = await supabase.from('profile').select('*').limit(1).maybeSingle();
  if (error) throw new Error(`Could not load your profile: ${error.message}`);
  return data;
}

export async function saveDetails(existingId: string | null, values: DetailsValues): Promise<void> {
  const row = { ...values, updated_at: new Date().toISOString() };
  const { error } = existingId === null
    ? await supabase.from('profile').insert(row)
    : await supabase.from('profile').update(row).eq('id', existingId);
  if (error) throw new Error(error.message);
}

/** Saves the goal onto the person's profile row, creating the row if they have none yet. Other columns are left alone. */
export async function saveGoals(existingId: string | null, values: GoalValues): Promise<void> {
  const row = { ...values, updated_at: new Date().toISOString() };
  const { error } = existingId === null
    ? await supabase.from('profile').insert(row)
    : await supabase.from('profile').update(row).eq('id', existingId);
  if (error) throw new Error(error.message);
}
