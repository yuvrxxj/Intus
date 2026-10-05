import { supabase } from './client.ts';
import type { Row } from './types.ts';

export type Profile = Row<'profile'>;

export interface ProfileValues {
  age: number;
  sex: 'male' | 'female';
  family_colorectal_cancer: boolean;
  family_prostate_cancer: boolean;
  noise_or_blast_exposure: boolean;
}

/** What the Goals screen saves into the profile row. The weights and dates are required, the daily targets are not. */
export interface GoalValues {
  start_weight: number;
  goal_weight: number;
  start_date: string;
  goal_date: string;
  calorie_target: number | null;
  protein_target: number | null;
  step_target: number | null;
}

/** The signed-in person's own profile (the database only returns their rows), or null before it has been filled in. */
export async function fetchProfile(): Promise<Profile | null> {
  const { data, error } = await supabase.from('profile').select('*').limit(1).maybeSingle();
  if (error) throw new Error(`Could not load your profile: ${error.message}`);
  return data;
}

export async function saveProfile(existingId: string | null, values: ProfileValues): Promise<void> {
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
