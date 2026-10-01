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

/** There is one person in this database, so the profile is the first row, or null before it has been filled in. */
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
