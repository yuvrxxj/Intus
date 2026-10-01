import { supabase } from './client.ts';
import { fetchAll } from './paging.ts';
import type { Row } from './types.ts';

export type Biomarker = Row<'biomarkers'>;
export type BiomarkerReading = Row<'biomarker_readings'>;
export type Medication = Row<'medications'>;
export type DailyLog = Row<'daily_logs'>;

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
