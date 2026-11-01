import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authEntryRedirect, carriesSupabaseReturn, isAuthEntryPath, webAuthEnabled } from '../src/features/auth/webAuth.ts';

test('web auth is off unless the flag is exactly true', () => {
  assert.equal(webAuthEnabled(undefined), false);
  assert.equal(webAuthEnabled(''), false);
  assert.equal(webAuthEnabled('false'), false);
  assert.equal(webAuthEnabled('TRUE'), false);
  assert.equal(webAuthEnabled('1'), false);
  assert.equal(webAuthEnabled('true'), true);
});

test('auth entry paths are the sign-in addresses and nothing that only starts the same way', () => {
  for (const path of ['/signin', '/signin/', '/login', '/signup', '/register', '/auth', '/auth/callback', '/signin/extra']) {
    assert.equal(isAuthEntryPath(path), true, path);
  }
  for (const path of ['/', '/pricing', '/privacy', '/terms', '/waitlist', '/waitlist/confirmed', '/author', '/signup-extra']) {
    assert.equal(isAuthEntryPath(path), false, path);
  }
});

test('a closed auth address redirects to the waitlist, and an open one does not', () => {
  assert.equal(authEntryRedirect('/signin', '', false), '/#waitlist');
  assert.equal(authEntryRedirect('/signin/', '?mode=signup', false), '/#waitlist');
  assert.equal(authEntryRedirect('/login', '', false), '/#waitlist');
  assert.equal(authEntryRedirect('/signup', '', false), '/#waitlist');
  assert.equal(authEntryRedirect('/register', '', false), '/#waitlist');
  assert.equal(authEntryRedirect('/auth/callback', '', false), '/#waitlist');
  assert.equal(authEntryRedirect('/signin', '?mode=signup', true), null);
  assert.equal(authEntryRedirect('/pricing', '', false), null);
  assert.equal(authEntryRedirect('/waitlist/confirmed', '?token=abc', false), null);
  assert.equal(authEntryRedirect('/', '', false), null);
});

test('a Supabase return on an auth path is left alone so the link can finish', () => {
  assert.equal(carriesSupabaseReturn('?code=abc'), true);
  assert.equal(carriesSupabaseReturn('?token_hash=abc&type=recovery'), true);
  assert.equal(carriesSupabaseReturn('?error=access_denied'), true);
  assert.equal(carriesSupabaseReturn('?type=signup'), true);
  assert.equal(carriesSupabaseReturn('?type=other'), false);
  assert.equal(carriesSupabaseReturn('', '#access_token=abc&type=recovery'), true);
  assert.equal(authEntryRedirect('/signin', '?code=abc', false), null);
  assert.equal(authEntryRedirect('/signin', '?mode=signup', false, '#access_token=abc'), null);
  assert.equal(authEntryRedirect('/auth/callback', '?error_description=expired', false), null);
});
