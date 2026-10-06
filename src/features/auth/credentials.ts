export type AuthMode = 'sign-in' | 'sign-up';

export const MIN_PASSWORD_LENGTH = 8;

export interface CredentialInput {
  email: string;
  password: string;
  confirm: string;
}

export interface CredentialErrors {
  email?: string;
  password?: string;
  confirm?: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Checks the form before anything is sent. Signing in only needs the two fields filled in, because an
 * existing password may predate today's rules. Creating an account holds the password to a minimum length
 * and asks for it twice.
 */
export function validateCredentials(mode: AuthMode, input: CredentialInput): CredentialErrors {
  const errors: CredentialErrors = {};
  const email = input.email.trim();
  if (email === '') errors.email = 'Enter your email';
  else if (!EMAIL.test(email)) errors.email = 'That does not look like an email address';

  if (input.password === '') errors.password = 'Enter a password';
  else if (mode === 'sign-up') {
    if (input.password.length < MIN_PASSWORD_LENGTH) errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters`;
    else if (input.password.toLowerCase() === email.toLowerCase()) errors.password = 'Your password cannot be your email';
    else if (input.confirm !== input.password) errors.confirm = 'The two passwords do not match';
  }
  return errors;
}

export interface AuthFailure {
  message: string;
  code?: string;
  status?: number;
}

/**
 * Turns an error from Supabase Auth into one plain sentence. Signing in never says whether the email or the
 * password was wrong, and creating an account never confirms that an email is already registered, so neither
 * screen can be used to find out who has an account.
 */
export function describeAuthError(mode: AuthMode, error: AuthFailure): string {
  const code = error.code ?? '';
  const text = error.message.toLowerCase();
  if (code === 'signup_disabled' || text.includes('signups not allowed')) return 'New accounts are not open yet.';
  if (code === 'email_address_invalid' || text.includes('is invalid')) return 'That email address cannot be used. Try a different one.';
  if (code === 'over_email_send_rate_limit' || text.includes('email rate limit')) return 'Too many emails sent. Wait a few minutes and try again.';
  if (code === 'same_password') return 'Use a password different from your old one.';
  if (code === 'weak_password' || text.includes('password should')) return `That password is too weak. Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (error.status === 429 || code.includes('rate_limit') || text.includes('rate limit')) return 'Too many attempts. Wait a minute and try again.';
  if (mode === 'sign-up') {
    if (code === 'user_already_exists' || text.includes('already registered')) return 'Could not create the account. If you already have one, sign in instead.';
    return 'Could not create the account. Check the details and try again.';
  }
  if (code === 'email_not_confirmed' || text.includes('not confirmed')) return 'Confirm your email first. Check your inbox for the link.';
  return 'Sign-in failed. Check your email and password.';
}

/** A new password, as set after following a reset link: the same rules as creating an account. */
export function validateNewPassword(password: string, confirm: string): Pick<CredentialErrors, 'password' | 'confirm'> {
  if (password === '') return { password: 'Enter a password' };
  if (password.length < MIN_PASSWORD_LENGTH) return { password: `Use at least ${MIN_PASSWORD_LENGTH} characters` };
  if (confirm !== password) return { confirm: 'The two passwords do not match' };
  return {};
}

/**
 * When Google or a reset link sends someone back with an error, Supabase puts it in the address, in the query
 * or the fragment. Returns that description as a sentence, or null when the address carries no error.
 */
export function redirectError(href: string): string | null {
  const url = new URL(href);
  const params = [url.searchParams, new URLSearchParams(url.hash.replace(/^#/, ''))];
  for (const p of params) {
    const description = p.get('error_description');
    const code = p.get('error_code') ?? p.get('error');
    if (!description && !code) continue;
    if (code === 'access_denied' && !description?.toLowerCase().includes('expired')) return 'Sign-in was cancelled.';
    if (code === 'otp_expired' || description?.toLowerCase().includes('expired')) return 'That link has expired. Ask for a new one.';
    return description ? description.replace(/\+/g, ' ') : 'Sign-in did not finish. Try again.';
  }
  return null;
}

/** The first name a sign-in provider such as Google shares, used to prefill onboarding. */
export function firstNameFrom(metadata: Record<string, unknown> | null | undefined): string {
  const pick = (key: string) => (typeof metadata?.[key] === 'string' ? (metadata[key] as string).trim() : '');
  const given = pick('given_name');
  if (given) return given;
  const full = pick('full_name') || pick('name');
  return full.split(/\s+/)[0] ?? '';
}
