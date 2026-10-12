import { removeAll } from '../features/photos/removeAll.ts';
import { supabase } from './client.ts';

/** The private bucket for the original PDFs (supabase/migrations/20261012000300_lab_reports.sql). */
export const REPORTS_BUCKET = 'lab-reports';

async function userId(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (error || !id) throw new Error('You are signed out. Sign in again to keep the report');
  return id;
}

/** Keeps a private copy of the PDF in the person's own folder, as <user id>/<uuid>.pdf. Returns where it went. */
export async function keepReport(file: File): Promise<string> {
  const path = `${await userId()}/${crypto.randomUUID()}.pdf`;
  const { error } = await supabase.storage.from(REPORTS_BUCKET).upload(path, file, { contentType: 'application/pdf', upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

/** Every report the signed-in person has kept, gone from Storage. Throws if any cannot be removed. */
export async function removeAllReports(): Promise<void> {
  const folder = await userId();
  await removeAll({
    list: async () => {
      const { data, error } = await supabase.storage.from(REPORTS_BUCKET).list(folder, { limit: 1000, offset: 0 });
      // before the bucket exists there is nothing to remove, and that must not block deleting an account
      if (error && /bucket not found/i.test(error.message)) return [];
      if (error) throw new Error(error.message);
      return (data ?? []).map((f) => f.name);
    },
    remove: async (names) => {
      const { error } = await supabase.storage.from(REPORTS_BUCKET).remove(names.map((n) => `${folder}/${n}`));
      if (error) throw new Error(error.message);
    },
  });
}
