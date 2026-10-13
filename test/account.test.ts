import { test } from 'node:test';
import assert from 'node:assert/strict';
import { confirmationMatches, confirmationPhrase, providerLabel } from '../src/features/account/model.ts';
import { NAV_PAGES, PAGES, pageFromHash } from '../src/features/dashboard/pages.ts';

test('the email has to be typed back in full before an account can be deleted', () => {
  const email = 'Yuvraaj@Intus.fit';
  assert.equal(confirmationMatches('yuvraaj@intus.fit', email), true, 'case does not matter');
  assert.equal(confirmationMatches('  YUVRAAJ@intus.fit  ', email), true, 'surrounding spaces do not matter');
  assert.equal(confirmationMatches('', email), false);
  assert.equal(confirmationMatches('yuvraaj', email), false);
  assert.equal(confirmationMatches('yuvraaj@intus.fi', email), false);
  assert.equal(confirmationMatches('yuvraaj@intus.fit.', email), false);
});

test('an account with no email asks for the word DELETE instead, and an empty box never matches', () => {
  for (const none of [null, undefined, '', '   ']) {
    assert.equal(confirmationPhrase(none), 'DELETE');
    assert.equal(confirmationMatches('delete', none), true);
    assert.equal(confirmationMatches('', none), false);
    assert.equal(confirmationMatches('yes', none), false);
  }
  assert.equal(confirmationPhrase(' a@b.co '), 'a@b.co');
});

test('the sign-in method reads the way a person would say it', () => {
  assert.equal(providerLabel('google'), 'Google');
  assert.equal(providerLabel('apple'), 'Apple');
  assert.equal(providerLabel('email'), 'email and password');
  assert.equal(providerLabel(null), 'email and password');
});

test('the pages are numbered 01, 02, ... in order, with the account page last and outside the top bar\'s main list', () => {
  assert.deepEqual(PAGES.map((p) => p.n), PAGES.map((_, i) => String(i + 1).padStart(2, '0')));
  assert.equal(new Set(PAGES.map((p) => p.id)).size, PAGES.length, 'ids are unique');
  assert.equal(PAGES.at(-1)?.id, 'account');
  assert.deepEqual(NAV_PAGES.map((p) => p.id), ['dashboard', 'today', 'goals', 'bloodwork', 'supplements', 'progress']);
  assert.equal(pageFromHash('#account'), 'account');
  assert.equal(pageFromHash('#nonsense'), null);
});
