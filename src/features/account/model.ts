/** What has to be typed back before the delete button works: the account's email, or DELETE when there is none. */
export function confirmationPhrase(email: string | null | undefined): string {
  return email?.trim() || 'DELETE';
}

/** A stray click cannot erase an account: the phrase has to be typed in full (case and surrounding spaces do not matter). */
export function confirmationMatches(typed: string, email: string | null | undefined): boolean {
  return typed.trim().toLowerCase() === confirmationPhrase(email).toLowerCase();
}

/** The sign-in method as a person would say it. */
export function providerLabel(provider: string | null | undefined): string {
  if (provider === 'google') return 'Google';
  if (provider === 'apple') return 'Apple';
  return 'email and password';
}
