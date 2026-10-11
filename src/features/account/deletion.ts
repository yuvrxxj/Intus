/**
 * The order an account is deleted in. The photos go first, through the Storage API, because deleting the account's
 * database rows cannot delete the files (and the database function refuses while any remain). If they cannot all be
 * removed, nothing else is touched and the account stays whole, so the person can simply try again.
 */
export async function runDeletion(deps: { removePhotos: () => Promise<void>; deleteAccount: () => Promise<void> }): Promise<void> {
  try {
    await deps.removePhotos();
  } catch (e) {
    throw new Error(`Your photos could not be removed, so nothing was deleted. ${e instanceof Error ? e.message : String(e)}`);
  }
  await deps.deleteAccount();
}
