import { test } from 'node:test';
import assert from 'node:assert/strict';
import { confirmationMatches, confirmationPhrase, providerLabel } from '../src/features/account/model.ts';
import { SECTIONS, sectionFromHash } from '../src/features/dashboard/sections.ts';

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

test('the page sections are numbered 01, 02, ... in order, with the account section last', () => {
  assert.deepEqual(SECTIONS.map((s) => s.n), SECTIONS.map((_, i) => String(i + 1).padStart(2, '0')));
  assert.equal(new Set(SECTIONS.map((s) => s.id)).size, SECTIONS.length, 'ids are unique');
  assert.equal(SECTIONS.at(-1)?.id, 'account');
  assert.equal(sectionFromHash('#account'), 'account');
  assert.equal(sectionFromHash('#nonsense'), null);
});
