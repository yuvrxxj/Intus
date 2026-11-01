import { fetchAll } from '../../db/paging.ts';
import { PERSONAL_TABLES, type PersonalTable } from './model.ts';

/** What `buildExport` needs, apart from the email and the time. The same shape the website downloads. */
export interface ExportLoad {
  tables: Record<PersonalTable, Record<string, unknown>[]>;
  biomarkers: { id: string; code: string; name: string; unit: string }[];
  files: { photos: string[]; reports: string[] };
}

/**
 * Reads every personal table, the marker names, and the stored file names. The website and the iPhone app both call
 * this, so a download from either one is the same document once `buildExport` formats it. Row-level security is what
 * limits the rows to the signed-in person; this function only pages and lists.
 */
export async function loadExport(deps: {
  userId: string | null;
  photosBucket: string;
  reportsBucket: string;
  pageTable: (
    table: PersonalTable,
    from: number,
    to: number,
  ) => PromiseLike<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>;
  biomarkers: () => PromiseLike<{
    data: { id: string; code: string; name: string; unit: string }[] | null;
    error: { message: string } | null;
  }>;
  list: (bucket: string, folder: string) => Promise<{ names: string[]; error: string | null }>;
}): Promise<ExportLoad> {
  const folder = deps.userId;
  if (!folder) throw new Error('You are signed out. Sign in again to download your data');
  const entries = await Promise.all(
    PERSONAL_TABLES.map(async (table) => {
      const rows = await fetchAll<Record<string, unknown>>((from, to) => deps.pageTable(table, from, to), table);
      return [table, rows] as const;
    }),
  );
  const { data: biomarkers, error } = await deps.biomarkers();
  if (error) throw new Error(`Could not load the markers list: ${error.message}`);
  const names = async (bucket: string) => {
    const listed = await deps.list(bucket, folder);
    if (listed.error && /bucket not found/i.test(listed.error)) return [];
    if (listed.error) throw new Error(listed.error);
    return listed.names;
  };
  const [photos, reports] = await Promise.all([names(deps.photosBucket), names(deps.reportsBucket)]);
  return {
    tables: Object.fromEntries(entries) as Record<PersonalTable, Record<string, unknown>[]>,
    biomarkers: biomarkers ?? [],
    files: { photos, reports },
  };
}
