import { supabase } from './client.ts';
import type { HabitInput } from './habits.ts';
import type { OnboardingProfile } from '../features/onboarding/model.ts';

/**
 * Saves the first-run answers onto the person's profile, creating the row if they have none. One row per person, so
 * this updates it when it exists and inserts it when it does not, in one request.
 */
export async function saveOnboardingProfile(values: OnboardingProfile): Promise<void> {
  const { error } = await supabase.from('profile').upsert({ ...values, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw new Error(error.message);
}

/** Creates the starting habits in one request, so either all of them exist afterwards or none do. */
export async function createStarterHabits(habits: readonly HabitInput[], firstSortOrder: number): Promise<void> {
  if (habits.length === 0) return;
  const { error } = await supabase.from('habits').insert(habits.map((h, i) => ({ ...h, sort_order: firstSortOrder + i })));
  if (error) throw new Error(error.message);
}
