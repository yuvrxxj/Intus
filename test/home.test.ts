import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialModeFor, routeFor, SIGN_UP_URL } from '../src/features/home/route.ts';

test('the homepage is the default, and only /signin opens sign-in', () => {
  assert.equal(routeFor('/'), 'home');
  assert.equal(routeFor(''), 'home');
  assert.equal(routeFor('/signin'), 'signin');
  assert.equal(routeFor('/signin/'), 'signin');
  assert.equal(routeFor('/anything-else'), 'home');
  assert.equal(routeFor('/signin/extra'), 'home');
});

test('the create-account link opens the create-account tab and nothing else does', () => {
  assert.equal(initialModeFor(new URL(SIGN_UP_URL, 'https://intus.fit').search), 'sign-up');
  assert.equal(initialModeFor(''), 'sign-in');
  assert.equal(initialModeFor('?mode=signin'), 'sign-in');
  assert.equal(initialModeFor('?mode=other'), 'sign-in');
});
