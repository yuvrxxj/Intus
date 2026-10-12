/**
 * The order an account is deleted in. Stored files go first, through the Storage API, because deleting the account's
 * database rows cannot delete them (and the database function refuses while any remain): the photos, then the uploaded
 * lab reports. If either cannot all be removed, the account itself is not touched, so the person can simply try again.
 */
export async function runDeletion(deps: {
  removePhotos: () => Promise<void>;
  removeReports: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}): Promise<void> {
  try {
    await deps.removePhotos();
  } catch (e) {
    throw new Error(`Your photos could not be removed, so nothing was deleted. ${e instanceof Error ? e.message : String(e)}`);
  }
  try {
    await deps.removeReports();
  } catch (e) {
    throw new Error(`Your photos were removed, but your uploaded reports could not be, so your account and results were kept. Try again. ${e instanceof Error ? e.message : String(e)}`);
  }
  await deps.deleteAccount();
}
