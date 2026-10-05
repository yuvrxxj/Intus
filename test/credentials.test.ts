import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeAuthError, MIN_PASSWORD_LENGTH, validateCredentials } from '../src/features/auth/credentials.ts';

const input = (over: Partial<{ email: string; password: string; confirm: string }> = {}) => ({
  email: 'a@example.com', password: 'longenough1', confirm: 'longenough1', ...over,
});

test('signing in only needs an email and a password, so an older short password still works', () => {
  assert.deepEqual(validateCredentials('sign-in', input({ password: 'abc', confirm: '' })), {});
  assert.deepEqual(validateCredentials('sign-in', input({ email: '  ', password: '' })), { email: 'Enter your email', password: 'Enter a password' });
});

test('a bad email is caught in both modes, and surrounding spaces are ignored', () => {
  for (const mode of ['sign-in', 'sign-up'] as const) {
    assert.equal(validateCredentials(mode, input({ email: 'nope' })).email, 'That does not look like an email address', mode);
    assert.equal(validateCredentials(mode, input({ email: 'a@b' })).email, 'That does not look like an email address', mode);
    assert.equal(validateCredentials(mode, input({ email: '  a@example.com ' })).email, undefined, mode);
  }
});

test('a new password must be long enough, must not be the email, and must be typed twice the same', () => {
  assert.equal(validateCredentials('sign-up', input({ password: 'x'.repeat(MIN_PASSWORD_LENGTH - 1), confirm: 'x'.repeat(MIN_PASSWORD_LENGTH - 1) })).password, `Use at least ${MIN_PASSWORD_LENGTH} characters`);
  assert.deepEqual(validateCredentials('sign-up', input({ password: 'x'.repeat(MIN_PASSWORD_LENGTH), confirm: 'x'.repeat(MIN_PASSWORD_LENGTH) })), {});
  assert.equal(validateCredentials('sign-up', input({ email: 'someone@example.com', password: 'SOMEONE@example.com', confirm: 'SOMEONE@example.com' })).password, 'Your password cannot be your email');
  assert.equal(validateCredentials('sign-up', input({ confirm: 'different1' })).confirm, 'The two passwords do not match');
  assert.deepEqual(validateCredentials('sign-up', input()), {});
});

test('errors from Supabase become one plain sentence', () => {
  assert.equal(describeAuthError('sign-up', { message: 'Signups not allowed for this project', code: 'signup_disabled', status: 422 }), 'New accounts are not open yet.');
  assert.equal(describeAuthError('sign-up', { message: 'Password should be at least 6 characters', code: 'weak_password' }), `That password is too weak. Use at least ${MIN_PASSWORD_LENGTH} characters.`);
  assert.equal(describeAuthError('sign-in', { message: 'rate limit', status: 429 }), 'Too many attempts. Wait a minute and try again.');
  assert.equal(describeAuthError('sign-in', { message: 'Email not confirmed', code: 'email_not_confirmed' }), 'Confirm your email first. Check your inbox for the link.');
  assert.equal(describeAuthError('sign-in', { message: 'Invalid login credentials', code: 'invalid_credentials' }), 'Sign-in failed. Check your email and password.');
});

test('neither screen reveals whether an email already has an account', () => {
  const taken = describeAuthError('sign-up', { message: 'User already registered', code: 'user_already_exists' });
  const other = describeAuthError('sign-up', { message: 'something else' });
  assert.ok(!/registered|exists/i.test(taken), 'does not confirm the email is taken');
  assert.ok(taken.startsWith('Could not create the account'));
  assert.ok(other.startsWith('Could not create the account'));
  // signing in gives the same sentence for a wrong password and an unknown email
  assert.equal(
    describeAuthError('sign-in', { message: 'Invalid login credentials', code: 'invalid_credentials' }),
    describeAuthError('sign-in', { message: 'User not found' }),
  );
});
