import { supabase } from './client.ts';
import type { Row } from './types.ts';

export type Biomarker = Row<'biomarkers'>;
export type BiomarkerReading = Row<'biomarker_readings'>;
export type Medication = Row<'medications'>;
export type DailyLog = Row<'daily_logs'>;

const PAGE_SIZE = 1000;

/**
 * PostgREST caps a response at 1000 rows without saying so. For anything a safety check reads, a silent cut would
 * mean a critical reading could go unseen, so this pages until a short page comes back.
 */
async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  label: string,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Could not load ${label}: ${error.message}`);
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return rows;
  }
}

export interface BloodworkData {
  biomarkers: Biomarker[];
  readings: BiomarkerReading[];
  medications: Medication[];
}

export async function fetchBloodwork(): Promise<BloodworkData> {
  const [biomarkers, readings, medications] = await Promise.all([
    fetchAll<Biomarker>(
      (from, to) =>
        supabase.from('biomarkers').select('*').order('sort_order').order('name').order('id').range(from, to),
      'biomarkers',
    ),
    fetchAll<BiomarkerReading>(
      (from, to) =>
        supabase
          .from('biomarker_readings')
          .select('*')
          .order('measured_at')
          .order('created_at')
          .order('id')
          .range(from, to),
      'biomarker readings',
    ),
    fetchAll<Medication>(
      (from, to) => supabase.from('medications').select('*').order('created_at').order('id').range(from, to),
      'medications',
    ),
  ]);
  return { biomarkers, readings, medications };
}
