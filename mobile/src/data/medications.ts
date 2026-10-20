import type { Medication } from '../../../src/db/rows.ts';
import { supabase } from '../supabase';
import { fetchAll } from './paging';

export function fetchMedications(): Promise<Medication[]> {
  return fetchAll<Medication>(
    (from, to) =>
      supabase.from('medications').select('*').order('start_date', { ascending: false, nullsFirst: false }).order('created_at').order('id').range(from, to),
    'medications',
  );
}
