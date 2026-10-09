import { supabase } from './client.ts';

/**
 * Deletes the signed-in person's account and everything stored under it. The database function behind this
 * (supabase/migrations/20261009000100_delete_my_account.sql) only ever removes the caller's own account, read from
 * their login token, and the cascading foreign keys take their rows with it.
 */
export async function deleteMyAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw new Error(error.message);
}
