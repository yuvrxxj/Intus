import { supabase } from './client.ts';
import { fetchAll } from './paging.ts';
import type { Row } from './types.ts';

export type ScreeningRuleRow = Row<'screening_rules'>;
export type ScreeningHistoryRow = Row<'screening_history'>;

export async function fetchScreening(): Promise<{ rules: ScreeningRuleRow[]; history: ScreeningHistoryRow[] }> {
  const [rules, history] = await Promise.all([
    fetchAll<ScreeningRuleRow>(
      (from, to) => supabase.from('screening_rules').select('*').order('sort_order').order('code').range(from, to),
      'screening rules',
    ),
    fetchAll<ScreeningHistoryRow>(
      (from, to) => supabase.from('screening_history').select('*').order('done_date', { ascending: false }).order('id').range(from, to),
      'screening history',
    ),
  ]);
  return { rules, history };
}

export async function addScreeningRecord(code: string, doneDate: string, notes: string | null): Promise<void> {
  const { error } = await supabase.from('screening_history').insert({ screening_code: code, done_date: doneDate, notes });
  if (error) throw new Error(error.message);
}

export async function deleteScreeningRecord(id: string): Promise<void> {
  const { error } = await supabase.from('screening_history').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
