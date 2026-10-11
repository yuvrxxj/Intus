import { runDeletion } from '../features/account/deletion.ts';
import { supabase } from './client.ts';
import { removeAllCheckInPhotos } from './photos.ts';

/**
 * Deletes the signed-in person's account and everything stored under it. Their photos are removed from Storage
 * first (see features/account/deletion.ts); then the database function
 * (supabase/migrations/20261009000100_delete_my_account.sql, guarded by 20261009000200_photo_check_ins.sql) removes the
 * account. It only ever removes the caller's own account, read from their login token, and the cascading foreign
 * keys take their rows with it.
 */
export async function deleteMyAccount(): Promise<void> {
  await runDeletion({
    removePhotos: removeAllCheckInPhotos,
    deleteAccount: async () => {
      const { error } = await supabase.rpc('delete_my_account');
      if (error) throw new Error(error.message);
    },
  });
}
