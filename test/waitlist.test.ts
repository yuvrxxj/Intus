import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CONFIRM_TOKEN_TTL_MS,
  DEVICES,
  WAITLIST,
  confirmTokenFrom,
  defaultDevice,
  emailError,
  honeypotTripped,
  initialWaitlistState,
  interpretConfirmResponse,
  interpretJoinResponse,
  isConfirmToken,
  newConfirmToken,
  normalizeEmail,
  payloadFrom,
  reduceWaitlist,
  sha256Hex,
  type WaitlistState,
} from '../src/features/home/waitlist.ts';

const PROMISE = "We'll email you three times: to confirm, when your place is ready, and when the app ships for your device. Nothing else.";

function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

function state(over: Partial<WaitlistState> = {}): WaitlistState {
  return { ...initialWaitlistState(false), email: 'person@example.com', ...over };
}

test('the email promise and the success line are the agreed sentences', () => {
  assert.equal(WAITLIST.promise, PROMISE);
  assert.equal(WAITLIST.success, 'Check your inbox to confirm');
  assert.equal(WAITLIST.expiredTitle, 'This link has expired');
});

test('waitlist copy names no price, plan, open sign-up, emoji or exclamation mark', () => {
  const words = [...strings(WAITLIST), ...DEVICES.map((d) => d.label)];
  for (const text of words) {
    assert.equal(text.includes('!'), false, text);
    assert.doesNotMatch(text, /\p{Extended_Pictographic}/u, text);
    assert.doesNotMatch(text, /[$€£₹]\s?\d|\d\s?(USD|EUR|GBP|INR)\b/i, text);
    assert.doesNotMatch(text, /\b(subscription|lifetime|one-time|per month|a month|per year|a year|discount|trial|founding)\b/i, text);
    assert.doesNotMatch(text, /\b(create account|sign up|sign-up|open sign-ups)\b/i, text);
    assert.doesNotMatch(text, /[–—]/, text);
  }
  assert.deepEqual(DEVICES.map((d) => d.value), ['laptop', 'iphone', 'android']);
});

test('an email is trimmed and lowercased, and empty is a different error from a broken one', () => {
  assert.equal(normalizeEmail('  Person@Example.com '), 'person@example.com');
  assert.equal(emailError('   '), WAITLIST.emailEmpty);
  assert.equal(emailError('person@example.com'), null);
  assert.equal(emailError('Person@Example.com'), null);
  assert.equal(emailError('person@example'), WAITLIST.emailFormat);
  assert.equal(emailError('person.example.com'), WAITLIST.emailFormat);
  assert.equal(emailError('a@b.'), WAITLIST.emailFormat);
  assert.equal(emailError(`${'a'.repeat(250)}@b.co`), WAITLIST.emailFormat);
});

test('the device starts as laptop, and as iPhone on a phone width', () => {
  assert.equal(defaultDevice(false), 'laptop');
  assert.equal(defaultDevice(true), 'iphone');
  assert.equal(initialWaitlistState(true).device, 'iphone');
});

test('typing does not validate, blur and submit do, and a failure keeps the typed email', () => {
  const started = state({ email: 'not-an-email' });
  const typed = reduceWaitlist(started, { type: 'email', value: 'still-wrong' });
  assert.equal(typed.emailError, null);
  assert.equal(typed.email, 'still-wrong');

  const blurred = reduceWaitlist(typed, { type: 'blur-email' });
  assert.equal(blurred.emailError, WAITLIST.emailFormat);
  assert.equal(blurred.email, 'still-wrong');

  const submitted = reduceWaitlist(blurred, { type: 'submit' });
  assert.equal(submitted.phase, 'idle');
  assert.equal(submitted.email, 'still-wrong');
  assert.equal(submitted.emailError, WAITLIST.emailFormat);

  const failed = reduceWaitlist(state(), { type: 'submit' });
  const after = reduceWaitlist(failed, { type: 'result', outcome: { kind: 'network', offline: false } });
  assert.equal(after.phase, 'idle');
  assert.equal(after.email, 'person@example.com');
  assert.equal(after.notice?.text, WAITLIST.saveError);
  assert.equal(after.done, null);
});

test('submit sends the normalised email, and success or an existing row replaces the form', () => {
  const editing = state({ email: '  Person@Example.com ' });
  const submitting = reduceWaitlist(editing, { type: 'submit' });
  assert.equal(submitting.phase, 'submitting');
  assert.deepEqual(payloadFrom(submitting), { action: 'join', email: 'person@example.com', device: 'laptop', company: '' });

  const created = reduceWaitlist(submitting, { type: 'result', outcome: { kind: 'success' } });
  assert.equal(created.phase, 'done');
  assert.equal(created.done?.text, WAITLIST.success);
  assert.equal(created.email, '  Person@Example.com ');

  const exists = reduceWaitlist(submitting, { type: 'result', outcome: { kind: 'exists' } });
  assert.equal(exists.done?.text, WAITLIST.exists);
});

test('a filled honeypot is success with nothing to send, and a rate limit or offline notice keeps the form', () => {
  const trapped = reduceWaitlist(state({ company: 'acme' }), { type: 'submit' });
  assert.equal(trapped.phase, 'done');
  assert.equal(trapped.done?.text, WAITLIST.success);
  assert.equal(honeypotTripped('acme'), true);
  assert.equal(honeypotTripped('  '), false);
  assert.equal(honeypotTripped(1), true);

  const limited = reduceWaitlist(reduceWaitlist(state(), { type: 'submit' }), { type: 'result', outcome: { kind: 'rate_limited' } });
  assert.equal(limited.phase, 'idle');
  assert.equal(limited.email, 'person@example.com');
  assert.equal(limited.notice?.tone, 'warn');
  assert.equal(limited.notice?.text, WAITLIST.rateLimit);

  const offline = reduceWaitlist(reduceWaitlist(state(), { type: 'submit' }), { type: 'result', outcome: { kind: 'network', offline: true } });
  assert.equal(offline.notice?.text, `${WAITLIST.saveError} ${WAITLIST.offline}`);
  assert.equal(offline.email, 'person@example.com');
});

test('join and confirm responses map onto the form states', () => {
  assert.equal(interpretJoinResponse(200, { result: 'created' }, false).kind, 'success');
  assert.equal(interpretJoinResponse(200, { result: 'exists' }, false).kind, 'exists');
  assert.equal(interpretJoinResponse(429, { error: 'rate_limited' }, false).kind, 'rate_limited');
  assert.equal(interpretJoinResponse(400, { error: 'invalid_email' }, false).kind, 'invalid_email');
  assert.deepEqual(interpretJoinResponse(500, { error: 'unavailable' }, true), { kind: 'network', offline: true });
  assert.deepEqual(interpretJoinResponse(0, null, false), { kind: 'network', offline: false });
  assert.equal(interpretConfirmResponse(200, { result: 'confirmed' }), 'confirmed');
  assert.equal(interpretConfirmResponse(200, { result: 'expired' }), 'expired');
  assert.equal(interpretConfirmResponse(500, null), 'error');
  assert.equal(interpretConfirmResponse(404, { error: 'nope' }), 'expired');
});

test('a confirmation token is 32 bytes of base64url, and only that shape is read from a link', async () => {
  const token = newConfirmToken();
  assert.equal(isConfirmToken(token), true);
  assert.equal(token.includes('='), false);
  assert.equal(confirmTokenFrom(`?token=${token}`), token);
  assert.equal(confirmTokenFrom('?token=short'), null);
  assert.equal(confirmTokenFrom(''), null);
  const hash = await sha256Hex(token);
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.equal(hash.includes(token), false);
  assert.equal(CONFIRM_TOKEN_TTL_MS, 7 * 24 * 60 * 60 * 1000);
});
