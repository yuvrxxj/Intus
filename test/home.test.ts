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

test('the privacy policy and terms have their own addresses', () => {
  assert.equal(routeFor('/privacy'), 'privacy');
  assert.equal(routeFor('/terms/'), 'terms');
  assert.equal(routeFor('/privacy-policy'), 'home');
});

test('the pricing page has its own address', () => {
  assert.equal(routeFor('/pricing'), 'pricing');
  assert.equal(routeFor('/pricing/'), 'pricing');
  assert.equal(routeFor('/pricing-plans'), 'home');
  assert.equal(routeFor('/pricing/extra'), 'home');
});

test('a confirmation link has its own address and the waitlist section does not', () => {
  assert.equal(routeFor('/waitlist/confirmed'), 'confirmed');
  assert.equal(routeFor('/waitlist/confirmed/'), 'confirmed');
  assert.equal(routeFor('/waitlist'), 'home');
  assert.equal(routeFor('/waitlist/confirmed/extra'), 'home');
  assert.equal(routeFor('/waitlist/confirm'), 'home');
});
