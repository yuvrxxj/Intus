import { runDeletion } from '../features/account/deletion.ts';
import { supabase } from './client.ts';
import { removeAllReports } from './labReports.ts';
import { removeAllCheckInPhotos } from './photos.ts';

/**
 * Deletes the signed-in person's account and everything stored under it. Their photos and uploaded reports are removed
 * from Storage first (see features/account/deletion.ts); then the database function
 * (supabase/migrations/20261009000100_delete_my_account.sql, guarded by 20261009000200_photo_check_ins.sql and 20261012000300_lab_reports.sql) removes the
 * account. It only ever removes the caller's own account, read from their login token, and the cascading foreign
 * keys take their rows with it.
 */
export async function deleteMyAccount(): Promise<void> {
  await runDeletion({
    removePhotos: removeAllCheckInPhotos,
    removeReports: removeAllReports,
    deleteAccount: async () => {
      const { error } = await supabase.rpc('delete_my_account');
      if (error) throw new Error(error.message);
    },
  });
}
