import { CONTACT_EMAIL } from '../../../src/lib/contact.ts';

export const SIGN_OUT_PROMPT = 'Sign out of Intus?';
export const SIGN_OUT_ERROR = 'You are still signed in. Try again.';
export const DOWNLOAD_ERROR = 'Your data file could not be made. Try again.';
export const LINK_ERROR = 'The page could not open.';
export const DELETE_ERROR = `Your account was not deleted. Try again, and email ${CONTACT_EMAIL} if it keeps failing. Nothing was deleted.`;

/** What the action sheet says is about to be removed. */
export const DELETE_SHEET_MESSAGE =
  'This removes your sign-in and everything you have saved in Intus: your daily logs, habits, goals, bloodwork, uploaded reports, supplements, sleep, screening history, profile and photo check-ins. Your photos and reports are deleted first. It happens straight away and cannot be undone. What this phone has kept for the account is removed too.';

/** A share sheet that the person closed is not a failure. iOS resolves that case; this covers a thrown cancel. */
export function isShareDismissal(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /cancel|dismiss/i.test(message);
}

/** What Account says under the email. Apple stays Apple. A password sign-in reads as email. */
export function providerLabel(provider: string | null | undefined): string {
  if (provider === 'apple') return 'Apple';
  if (provider === 'google') return 'Google';
  return 'email';
}
