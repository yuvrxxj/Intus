import { runDeletion } from '../../../src/features/account/deletion.ts';

/**
 * The website's order, on the phone. Photos, then uploaded reports, then `delete_my_account()`. Only after that
 * succeeds does the phone clear what it kept and drop the local session. A sign-out that fails is ignored: the
 * account is already gone, and the keychain sweep still runs.
 */
export async function finishDeletion(deps: {
  removePhotos: () => Promise<void>;
  removeReports: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  clearDevice: () => Promise<void>;
  signOutLocal: () => Promise<void>;
  clearSessionKeys: () => Promise<void>;
}): Promise<void> {
  await runDeletion({
    removePhotos: deps.removePhotos,
    removeReports: deps.removeReports,
    deleteAccount: deps.deleteAccount,
  });
  await deps.clearDevice();
  try {
    await deps.signOutLocal();
  } catch {
    // the account no longer exists, so there is nothing for the server to sign out
  }
  try {
    await deps.clearSessionKeys();
  } catch {
    // the sweep is a backstop for keychain entries sign-out did not remove
  }
}
