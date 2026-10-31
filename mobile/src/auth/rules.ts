import {
  MIN_PASSWORD_LENGTH,
  describeAuthError,
  validateCredentials,
  type AuthFailure,
  type AuthMode,
  type CredentialErrors,
} from '../../../src/features/auth/credentials.ts';
import { SITE_ORIGIN } from '../account/urls.ts';

/**
 * Sign in and account creation on the phone. Plain TypeScript, no React Native, so the tests run it with mocks.
 * The field rules and Supabase error wording are the website's (src/features/auth/credentials.ts), imported, not
 * copied. What is phone-only: one sentence per failure, the network case, and never saying an address is taken.
 */

export { MIN_PASSWORD_LENGTH };
export type { AuthMode };

/**
 * Where the confirmation link lands after Supabase has confirmed the address. The site origin is already the
 * Site URL and on the redirect allow list (supabase/README.md, Sign-in). The app's `intus://` scheme is not on
 * that list, and Supabase falls back to the Site URL for an address it does not allow, so a deep link would need
 * a change in the Supabase dashboard first.
 */
export const EMAIL_REDIRECT = SITE_ORIGIN;

export const COPY = {
  signInTitle: 'Sign in',
  signUpTitle: 'Create account',
  signInIntro: 'Use your Intus email and password.',
  signUpIntro: `Use your email and a password of at least ${MIN_PASSWORD_LENGTH} characters. We will email you a link to confirm the address.`,
  toSignUp: 'New to Intus? Create an account',
  toSignIn: 'Already have an account? Sign in',
  sentTitle: 'Check your email',
  backToSignIn: 'Back to sign in',
  consent:
    'I have read and agree to the privacy policy and terms, I am 18 or over, and I consent to Intus storing the health information I enter, to provide the service to me. Intus is a tracker, not medical advice.',
  needsConsent: 'Read and agree to the privacy policy and terms to create an account.',
  network: 'Could not reach Intus. Check your connection and try again.',
} as const;

/** The neutral screen after a sign-up. The same words whether or not the address already had an account. */
export function checkEmailMessage(email: string): string {
  return `We sent a link to ${email.trim()}. Open it to confirm, then come back and sign in.`;
}

/** The website's field messages are short labels. On the phone they stand alone in a notice, so end them. */
function sentence(text: string): string {
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

export interface FormInput {
  email: string;
  password: string;
  confirm: string;
  agreed: boolean;
}

export interface FormCheck {
  /** The first problem as one sentence, or null when the form can be sent. */
  message: string | null;
  /** Which fields to outline. */
  fields: CredentialErrors;
}

/** Checks the form before anything is sent, with the website's rules. Signing in ignores confirm and consent. */
export function checkForm(mode: AuthMode, input: FormInput): FormCheck {
  const fields = validateCredentials(mode, { email: input.email, password: input.password, confirm: input.confirm });
  const first = fields.email ?? fields.password ?? fields.confirm;
  if (first) return { message: sentence(first), fields };
  if (mode === 'sign-up' && !input.agreed) return { message: COPY.needsConsent, fields: {} };
  return { message: null, fields: {} };
}

export interface AuthErrorLike extends AuthFailure {
  name?: string;
}

/**
 * True when Supabase was not reached or did not answer. supabase-js reports a failed fetch as
 * AuthRetryableFetchError (status 0 when there was no response at all, or a 502/503/504 from a gateway).
 */
export function isNetworkFailure(error: AuthErrorLike): boolean {
  if (error.name === 'AuthRetryableFetchError') return true;
  if (error.status === 0) return true;
  return /network request failed|failed to fetch|load failed/i.test(error.message);
}

/** Supabase saying the address already has an account. Only happens when confirmation is off. */
function alreadyRegistered(error: AuthErrorLike): boolean {
  return error.code === 'user_already_exists' || error.code === 'email_exists' || /already registered/i.test(error.message);
}

/** The one sentence shown when signing in fails. Never says which of the two fields was wrong. */
export function signInFailure(error: AuthErrorLike): string {
  if (isNetworkFailure(error)) return COPY.network;
  return describeAuthError('sign-in', error);
}

export type SignUpOutcome =
  | { kind: 'signed-in' }
  | { kind: 'check-email'; email: string }
  | { kind: 'failed'; message: string };

export interface SignUpResult {
  data: { session: unknown | null; user: { identities?: unknown[] | null } | null } | null;
  error: AuthErrorLike | null;
}

/**
 * What the screen does after supabase.auth.signUp. With confirmation on (the live setting) there is no session,
 * so the person is asked to open the link. An address that is already registered comes back as a user with no
 * identities, or as user_already_exists when confirmation is off; both get the same "check your email" screen,
 * so the form cannot be used to find out who has an account.
 */
export function signUpOutcome(email: string, result: SignUpResult): SignUpOutcome {
  const { data, error } = result;
  if (error) {
    if (isNetworkFailure(error)) return { kind: 'failed', message: COPY.network };
    if (alreadyRegistered(error)) return { kind: 'check-email', email: email.trim() };
    return { kind: 'failed', message: describeAuthError('sign-up', error) };
  }
  const identities = data?.user?.identities;
  if (data?.session && !(Array.isArray(identities) && identities.length === 0)) return { kind: 'signed-in' };
  return { kind: 'check-email', email: email.trim() };
}

/** The slice of supabase.auth the screen uses, so tests pass a mock and never reach a real project. */
export interface AuthClient {
  signUp(credentials: { email: string; password: string; options?: { emailRedirectTo?: string } }): Promise<SignUpResult>;
  signInWithPassword(credentials: { email: string; password: string }): Promise<{ error: AuthErrorLike | null }>;
}

/** Creates the account. A thrown error (no connection) is the network message, not a crash. */
export async function createAccount(auth: AuthClient, email: string, password: string): Promise<SignUpOutcome> {
  try {
    const result = await auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: EMAIL_REDIRECT } });
    return signUpOutcome(email, result);
  } catch {
    return { kind: 'failed', message: COPY.network };
  }
}

/** Signs in. Returns null on success (the auth listener in App.tsx takes over), or the sentence to show. */
export async function signIn(auth: AuthClient, email: string, password: string): Promise<string | null> {
  try {
    const { error } = await auth.signInWithPassword({ email: email.trim(), password });
    return error ? signInFailure(error) : null;
  } catch {
    return COPY.network;
  }
}
