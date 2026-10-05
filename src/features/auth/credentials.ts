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
  if (code === 'weak_password' || text.includes('password should')) return `That password is too weak. Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (error.status === 429 || code.includes('rate_limit') || text.includes('rate limit')) return 'Too many attempts. Wait a minute and try again.';
  if (mode === 'sign-up') {
    if (code === 'user_already_exists' || text.includes('already registered')) return 'Could not create the account. If you already have one, sign in instead.';
    return 'Could not create the account. Check the details and try again.';
  }
  if (code === 'email_not_confirmed' || text.includes('not confirmed')) return 'Confirm your email first. Check your inbox for the link.';
  return 'Sign-in failed. Check your email and password.';
}
