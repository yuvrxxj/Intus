import { runDeletion } from '../../../src/features/account/deletion.ts';
import { PERSONAL_TABLES, buildExport, exportFileName, type PersonalTable } from '../../../src/features/export/model.ts';
import { removeAll } from '../../../src/features/photos/removeAll.ts';
import { supabase } from '../supabase';
import { fetchAll } from './paging';

// The private buckets, as on the web (src/db/photos.ts and src/db/labReports.ts).
const PHOTOS_BUCKET = 'check-in-photos';
const REPORTS_BUCKET = 'lab-reports';

async function userId(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (error || !id) throw new Error('You are signed out. Sign in again and try once more.');
  return id;
}

/** Empties the person's folder in one bucket through the Storage API and proves it, listing again after each round. */
async function removeFolder(bucket: string, noBucketIsEmpty: boolean): Promise<void> {
  const folder = await userId();
  await removeAll({
    list: async () => {
      const { data, error } = await supabase.storage.from(bucket).list(folder, { limit: 1000, offset: 0 });
      // before a bucket exists there is nothing to remove, and that must not block deleting an account
      if (error && noBucketIsEmpty && /bucket not found/i.test(error.message)) return [];
      if (error) throw new Error(error.message);
      return (data ?? []).map((f) => f.name);
    },
    remove: async (names) => {
      const { error } = await supabase.storage.from(bucket).remove(names.map((n) => `${folder}/${n}`));
      if (error) throw new Error(error.message);
    },
  });
}

/**
 * Deletes the signed-in person's account and everything under it, in the web's order: photos, then uploaded reports,
 * then the database function, which only ever removes the caller's own account (read from their token).
 */
export async function deleteMyAccount(): Promise<void> {
  await runDeletion({
    removePhotos: () => removeFolder(PHOTOS_BUCKET, false),
    removeReports: () => removeFolder(REPORTS_BUCKET, true),
    deleteAccount: async () => {
      const { error } = await supabase.rpc('delete_my_account');
      if (error) throw new Error(error.message);
    },
  });
}

/** Every personal table, all rows (row-level security returns only the signed-in person's), paged past the 1000-row cap. */
async function fetchEverything() {
  const folder = await userId();
  const entries = await Promise.all(
    PERSONAL_TABLES.map(async (table) => {
      const rows = await fetchAll<Record<string, unknown>>(
        (from, to) =>
          (supabase.from(table as 'profile').select('*') as unknown as {
            range: (a: number, b: number) => PromiseLike<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>;
          }).range(from, to),
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
  const [photos, reports] = await Promise.all([list(PHOTOS_BUCKET), list(REPORTS_BUCKET)]);
  return {
    tables: Object.fromEntries(entries) as Record<PersonalTable, Record<string, unknown>[]>,
    biomarkers: biomarkers ?? [],
    files: { photos, reports },
  };
}

/** The export as one JSON file's name and text, ready to be saved or shared. */
export async function buildMyExport(email: string | null): Promise<{ name: string; json: string }> {
  const data = await fetchEverything();
  const at = new Date();
  return { name: exportFileName(at), json: JSON.stringify(buildExport({ email, exportedAt: at, ...data }), null, 2) };
}
