import { BUCKET } from '../features/photos/model.ts';
import { loadExport, type ExportLoad } from '../features/export/load.ts';
import { supabase } from './client.ts';
import { REPORTS_BUCKET } from './labReports.ts';

/** Every personal table, all rows (row-level security returns only the signed-in person's), paged past the 1000-row cap. */
export async function fetchEverything(): Promise<ExportLoad> {
  const { data: session } = await supabase.auth.getSession();
  return loadExport({
    userId: session.session?.user.id ?? null,
    photosBucket: BUCKET,
    reportsBucket: REPORTS_BUCKET,
    pageTable: (table, from, to) =>
      // the table name is a fixed list, but the generated client types each table separately
      (
        supabase.from(table as 'profile').select('*') as unknown as {
          range: (a: number, b: number) => PromiseLike<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>;
        }
      ).range(from, to),
    biomarkers: () => supabase.from('biomarkers').select('id,code,name,unit'),
    list: async (bucket, folder) => {
      const { data, error } = await supabase.storage.from(bucket).list(folder, { limit: 1000 });
      return { names: (data ?? []).map((file) => file.name), error: error?.message ?? null };
    },
  });
}
