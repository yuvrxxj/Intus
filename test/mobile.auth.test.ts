import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  COPY, EMAIL_REDIRECT, MIN_PASSWORD_LENGTH, checkEmailMessage, checkForm, createAccount, isNetworkFailure, signIn,
  signInFailure, signUpOutcome, type AuthClient, type SignUpResult,
} from '../mobile/src/auth/rules.ts';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const form = (over: Partial<{ email: string; password: string; confirm: string; agreed: boolean }> = {}) => ({
  email: 'a@example.com', password: 'longenough1', confirm: 'longenough1', agreed: true, ...over,
});

/** A stand-in for supabase.auth that records calls and never reaches a real project. */
function mockAuth(signUp: SignUpResult | Error, signInError: { message: string; code?: string; status?: number; name?: string } | null | Error = null) {
  const calls: { method: string; args: unknown }[] = [];
  const auth: AuthClient = {
    async signUp(args) {
      calls.push({ method: 'signUp', args });
      if (signUp instanceof Error) throw signUp;
      return signUp;
    },
    async signInWithPassword(args) {
      calls.push({ method: 'signInWithPassword', args });
      if (signInError instanceof Error) throw signInError;
      return { error: signInError };
    },
  };
  return { auth, calls };
}

const confirmed = { data: { session: null, user: { identities: [{ id: '1' }] } }, error: null };

test('creating an account needs a valid email, a password of at least 8 characters typed twice, and consent', () => {
  assert.equal(MIN_PASSWORD_LENGTH, 8);
  assert.deepEqual(checkForm('sign-up', form()), { message: null, fields: {} });
  assert.equal(checkForm('sign-up', form({ email: '' })).message, 'Enter your email.');
  assert.equal(checkForm('sign-up', form({ email: 'nope' })).message, 'That does not look like an email address.');
  assert.ok(checkForm('sign-up', form({ email: 'nope' })).fields.email);
  const short = 'x'.repeat(MIN_PASSWORD_LENGTH - 1);
  assert.equal(checkForm('sign-up', form({ password: short, confirm: short })).message, 'Use at least 8 characters.');
  assert.ok(checkForm('sign-up', form({ password: short, confirm: short })).fields.password);
  assert.equal(checkForm('sign-up', form({ confirm: 'different1' })).message, 'The two passwords do not match.');
  assert.equal(checkForm('sign-up', form({ agreed: false })).message, COPY.needsConsent);
});

test('signing in only needs the two fields, so an older short password still works', () => {
  assert.deepEqual(checkForm('sign-in', form({ password: 'abc', confirm: '', agreed: false })), { message: null, fields: {} });
  assert.equal(checkForm('sign-in', form({ password: '' })).message, 'Enter a password.');
});

test('a new account with confirmation on shows the neutral check-your-email screen', () => {
  assert.deepEqual(signUpOutcome(' a@example.com ', confirmed), { kind: 'check-email', email: 'a@example.com' });
  assert.equal(checkEmailMessage('a@example.com'), 'We sent a link to a@example.com. Open it to confirm, then come back and sign in.');
});

test('an address that already has an account gets the same screen, so the form cannot reveal who is registered', () => {
  const taken = { data: { session: null, user: { identities: [] } }, error: null };
  const fresh = signUpOutcome('a@example.com', confirmed);
  assert.deepEqual(signUpOutcome('a@example.com', taken), fresh);
  const takenError = { data: { session: null, user: null }, error: { message: 'User already registered', code: 'user_already_exists', status: 422 } };
  assert.deepEqual(signUpOutcome('a@example.com', takenError), fresh);
});

test('with confirmation off a session comes back and the person is simply signed in', () => {
  const live = { data: { session: { access_token: 't' }, user: { identities: [{ id: '1' }] } }, error: null };
  assert.deepEqual(signUpOutcome('a@example.com', live), { kind: 'signed-in' });
});

test('weak password, bad address, rate limit and no connection each get one plain sentence', () => {
  const fail = (error: { message: string; code?: string; status?: number; name?: string }) =>
    signUpOutcome('a@example.com', { data: { session: null, user: null }, error });
  assert.deepEqual(fail({ message: 'Password should be at least 6 characters.', code: 'weak_password', status: 422 }), {
    kind: 'failed', message: 'That password is too weak. Use at least 8 characters.',
  });
  assert.deepEqual(fail({ message: 'Email address "x@y" is invalid', code: 'email_address_invalid', status: 400 }), {
    kind: 'failed', message: 'That email address cannot be used. Try a different one.',
  });
  assert.deepEqual(fail({ message: 'email rate limit exceeded', code: 'over_email_send_rate_limit', status: 429 }), {
    kind: 'failed', message: 'Too many emails sent. Wait a few minutes and try again.',
  });
  assert.deepEqual(fail({ message: 'Request rate limit reached', code: 'over_request_rate_limit', status: 429 }), {
    kind: 'failed', message: 'Too many attempts. Wait a minute and try again.',
  });
  assert.deepEqual(fail({ message: 'Network request failed', name: 'AuthRetryableFetchError', status: 0 }), { kind: 'failed', message: COPY.network });
  assert.ok(isNetworkFailure({ message: 'Failed to fetch' }));
  assert.equal(isNetworkFailure({ message: 'Invalid login credentials', code: 'invalid_credentials', status: 400 }), false);
});

test('sign-in failures never say which field was wrong, and an unconfirmed address is told to confirm', () => {
  assert.equal(signInFailure({ message: 'Invalid login credentials', code: 'invalid_credentials', status: 400 }), 'Sign-in failed. Check your email and password.');
  assert.equal(signInFailure({ message: 'Email not confirmed', code: 'email_not_confirmed', status: 400 }), 'Confirm your email first. Check your inbox for the link.');
  assert.equal(signInFailure({ message: 'Network request failed', name: 'AuthRetryableFetchError', status: 0 }), COPY.network);
});

test('createAccount sends the trimmed email, the password and the site as the redirect, through a mock only', async () => {
  const { auth, calls } = mockAuth(confirmed);
  assert.deepEqual(await createAccount(auth, '  a@example.com ', 'longenough1'), { kind: 'check-email', email: 'a@example.com' });
  assert.deepEqual(calls, [{ method: 'signUp', args: { email: 'a@example.com', password: 'longenough1', options: { emailRedirectTo: 'https://intus.fit' } } }]);
  assert.equal(EMAIL_REDIRECT, 'https://intus.fit');
});

test('a thrown fetch error is the network sentence, not a crash, for both actions', async () => {
  assert.deepEqual(await createAccount(mockAuth(new TypeError('Network request failed')).auth, 'a@example.com', 'longenough1'), { kind: 'failed', message: COPY.network });
  assert.equal(await signIn(mockAuth(confirmed, new TypeError('Network request failed')).auth, 'a@example.com', 'x'), COPY.network);
});

test('signIn returns null on success and trims the email', async () => {
  const { auth, calls } = mockAuth(confirmed, null);
  assert.equal(await signIn(auth, ' a@example.com', 'pw'), null);
  assert.deepEqual(calls, [{ method: 'signInWithPassword', args: { email: 'a@example.com', password: 'pw' } }]);
});

test('the signed-out screen offers both paths and no longer sends people to the website for an account', () => {
  const screen = read('../mobile/src/auth/SignIn.tsx');
  assert.doesNotMatch(screen, /New accounts are made on the website/);
  assert.match(screen, /createAccount\(supabase\.auth/);
  assert.match(screen, /signIn\(supabase\.auth/);
  assert.match(screen, /COPY\.toSignUp/);
  assert.match(screen, /COPY\.toSignIn/);
  assert.match(screen, /COPY\.backToSignIn/);
  // the phone does not call Supabase sign-up anywhere else, and offers no third-party login
  assert.doesNotMatch(screen, /signInWithOAuth|google/i);
  const copy = Object.values(COPY).join(' ');
  assert.doesNotMatch(copy, /[–—]/);
  assert.doesNotMatch(copy, /\p{Extended_Pictographic}/u);
});

test('the consent line says the same as the website: terms, 18 or over, and storing health information', () => {
  const web = read('../src/features/auth/SignIn.tsx');
  for (const phrase of ['I am 18 or over', 'I consent to Intus storing the health information I enter, to provide the service to me', 'Intus is a tracker, not medical advice']) {
    assert.ok(COPY.consent.includes(phrase), phrase);
    assert.ok(web.includes(phrase), phrase);
  }
});
