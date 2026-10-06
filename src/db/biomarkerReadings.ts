import { supabase } from './client.ts';
import type { Insert } from './types.ts';

/** What a person types in. The id, owner and creation time are set by the database. */
export type ReadingInput = Required<Pick<Insert<'biomarker_readings'>, 'biomarker_id' | 'measured_at' | 'value' | 'source'>> &
  Pick<Insert<'biomarker_readings'>, 'notes'>;

export async function addReading(input: ReadingInput): Promise<void> {
  const { error } = await supabase.from('biomarker_readings').insert(input);
  if (error) throw new Error(error.message);
}

export async function deleteReading(id: string): Promise<void> {
  const { error } = await supabase.from('biomarker_readings').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
