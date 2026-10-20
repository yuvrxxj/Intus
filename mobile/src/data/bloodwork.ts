import type { Biomarker, BiomarkerReading, BloodworkData, ReadingInput } from '../../../src/db/rows.ts';
import { supabase } from '../supabase';
import { fetchAll } from './paging';
import type { Queued } from './outbox';

/** The shared marker list and the signed-in person's results, all of them, paged past the API's silent 1000-row cap. */
export async function fetchBloodwork(): Promise<BloodworkData> {
  const [biomarkers, readings] = await Promise.all([
    fetchAll<Biomarker>((from, to) => supabase.from('biomarkers').select('*').order('sort_order').order('name').order('id').range(from, to), 'biomarkers'),
    fetchAll<BiomarkerReading>(
      (from, to) => supabase.from('biomarker_readings').select('*').order('measured_at').order('created_at').order('id').range(from, to),
      'biomarker readings',
    ),
  ]);
  return { biomarkers, readings };
}

/** What the range rules need to know about the person: their sex, and whether they are pregnant (then only printed ranges are used). */
export async function fetchWho(): Promise<{ sex: string | null; pregnant: boolean }> {
  const [profile, conditions] = await Promise.all([
    supabase.from('profile').select('sex').limit(1).maybeSingle(),
    supabase.from('profile_conditions').select('condition'),
  ]);
  if (profile.error) throw new Error(`Could not load your profile: ${profile.error.message}`);
  // a failure to load conditions reads as none, as on the web, so the screen still works
  const pregnant = (conditions.data ?? []).some((c) => c.condition === 'pregnant');
  return { sex: profile.data?.sex ?? null, pregnant };
}

/** A result typed on the phone, waiting to be sent. The id is made on the phone, so sending twice cannot make two rows. */
export interface PendingReading extends Queued {
  id: string;
  input: ReadingInput;
}

export async function sendReading(entry: PendingReading): Promise<void> {
  const { error } = await supabase.from('biomarker_readings').upsert({ id: entry.id, ...entry.input }, { onConflict: 'id' });
  if (error) throw new Error(error.message);
}

export async function deleteReading(id: string): Promise<void> {
  const { error } = await supabase.from('biomarker_readings').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
