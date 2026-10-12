import { PERSONAL_TABLES, type PersonalTable } from '../features/export/model.ts';
import { supabase } from './client.ts';
import { REPORTS_BUCKET } from './labReports.ts';
import { fetchAll } from './paging.ts';

/** Every personal table, all rows (row-level security returns only the signed-in person's), paged past the 1000-row cap. */
export async function fetchEverything(): Promise<{
  tables: Record<PersonalTable, Record<string, unknown>[]>;
  biomarkers: { id: string; code: string; name: string; unit: string }[];
  files: { photos: string[]; reports: string[] };
}> {
  const { data: session } = await supabase.auth.getSession();
  const folder = session.session?.user.id;
  if (!folder) throw new Error('You are signed out. Sign in again to download your data');
  const entries = await Promise.all(
    PERSONAL_TABLES.map(async (table) => {
      // the table name is a fixed list, but the generated client types each table separately
      const rows = await fetchAll<Record<string, unknown>>(
        (from, to) => (supabase.from(table as 'profile').select('*') as unknown as { range: (a: number, b: number) => PromiseLike<{ data: Record<string, unknown>[] | null; error: { message: string } | null }> }).range(from, to),
        table,
      );
      return [table, rows] as const;
    }),
  );
  const { data: biomarkers, error } = await supabase.from('biomarkers').select('id,code,name,unit');
  if (error) throw new Error(`Could not load the markers list: ${error.message}`);
  const list = async (bucket: string) => {
    const { data, error: e } = await supabase.storage.from(bucket).list(folder, { limit: 1000 });
    if (e && /bucket not found/i.test(e.message)) return [];
    if (e) throw new Error(e.message);
    return (data ?? []).map((f) => f.name);
  };
  const [photos, reports] = await Promise.all([list('check-in-photos'), list(REPORTS_BUCKET)]);
  return { tables: Object.fromEntries(entries) as Record<PersonalTable, Record<string, unknown>[]>, biomarkers: biomarkers ?? [], files: { photos, reports } };
}
