import { HFM_STORAGE_KEY } from '../today/hfmImage.ts';

/** Removes what the app keeps on this device (the screenshots added on the Today screen). Storage may be blocked, so it never throws. */
export function clearLocalData(): void {
  try {
    localStorage.removeItem(HFM_STORAGE_KEY);
  } catch {
    // blocked storage has nothing to clear
  }
}

// carried across the sign-out so the homepage can say what happened, then forgotten
const DELETED_KEY = 'intus_account_deleted';

export function rememberDeletion(): void {
  try {
    sessionStorage.setItem(DELETED_KEY, '1');
  } catch {
    // the notice is a courtesy; the deletion itself does not depend on it
  }
}

/** True once after an account was deleted in this tab. */
export function takeDeletionNotice(): boolean {
  try {
    const was = sessionStorage.getItem(DELETED_KEY) === '1';
    sessionStorage.removeItem(DELETED_KEY);
    return was;
  } catch {
    return false;
  }
}
