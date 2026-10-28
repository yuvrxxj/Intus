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
  RESEND_COOLDOWN_MS,
  checkEmailMessage,
  interpretConfirmResponse,
  interpretJoinResponse,
  interpretResendResponse,
  isConfirmToken,
  isInviteEligible,
  resendLabel,
  newConfirmToken,
  TRACKS_MAX,
  normalizeTracks,
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

test('the email promise is the agreed sentence, and it is the line used in each state', () => {
  assert.equal(WAITLIST.promise, PROMISE);
  assert.equal(WAITLIST.promiseConfirmed, "We'll email you twice more: when your place is ready, and when the app ships for your device. Nothing else.");
  assert.notEqual(WAITLIST.promiseConfirmed, WAITLIST.promise);
  assert.equal(WAITLIST.heroLead, "Log your day, read your bloodwork and keep your supplements in one place. Intus flags values outside the lab's range. It does not diagnose anything.");
  assert.equal(WAITLIST.footer, "Not medical advice. Intus flags values outside the lab's range and does not diagnose anything.");
  assert.equal(WAITLIST.confirmedTitle, 'You are on the list.');
  assert.equal(WAITLIST.whatIntus.includes('does not diagnose anything'), true);
  assert.equal(checkEmailMessage('a@b.co'), `Check your inbox. We sent a link to a@b.co. Tap it to confirm your place on the list. ${PROMISE}`);
  assert.equal(WAITLIST.expiredBody, 'That link has expired. Enter your email again and we will send a new one.');
  assert.equal(isInviteEligible('confirmed'), true);
  assert.equal(isInviteEligible('pending'), false);
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
  assert.equal(after.phase, 'idle');
});

test('a new signup shows check your email, and a confirmed address says it is already on the list', () => {
  const editing = state({ email: '  Person@Example.com ' });
  const submitting = reduceWaitlist(editing, { type: 'submit' });
  assert.equal(submitting.phase, 'submitting');
  assert.deepEqual(payloadFrom(submitting), { action: 'join', email: 'person@example.com', device: 'laptop', company: '' });

  const pending = reduceWaitlist(submitting, { type: 'result', outcome: { kind: 'pending' } });
  assert.equal(pending.phase, 'check');
  assert.equal(pending.sentTo, 'person@example.com');
  assert.equal(checkEmailMessage(pending.sentTo ?? ''), `Check your inbox. We sent a link to person@example.com. Tap it to confirm your place on the list. ${PROMISE}`);
  assert.equal(pending.email, '  Person@Example.com ');

  const exists = reduceWaitlist(submitting, { type: 'result', outcome: { kind: 'exists' } });
  assert.equal(exists.phase, 'listed');

  const edited = reduceWaitlist(pending, { type: 'change-email' });
  assert.equal(edited.phase, 'idle');
  assert.equal(edited.email, '  Person@Example.com ');
});

test('send it again is quiet for a minute, then can be asked for once more', () => {
  const checking = reduceWaitlist(reduceWaitlist(state(), { type: 'submit' }), { type: 'result', outcome: { kind: 'pending' } });
  const started = reduceWaitlist(checking, { type: 'resend', now: 1_000 });
  assert.equal(started.resending, true);
  const sent = reduceWaitlist(started, { type: 'resend-result', outcome: { kind: 'sent' }, now: 1_000 });
  assert.equal(resendLabel(sent.resentUntil, 1_000), WAITLIST.sentAgain);
  assert.equal(reduceWaitlist(sent, { type: 'resend', now: 1_000 + RESEND_COOLDOWN_MS - 1 }).resending, false);
  assert.equal(resendLabel(sent.resentUntil, 1_000 + RESEND_COOLDOWN_MS), WAITLIST.sendAgain);
  const cooled = reduceWaitlist(started, { type: 'resend-result', outcome: { kind: 'cooled' }, now: 2_000 });
  assert.equal(resendLabel(cooled.resentUntil, 2_000), WAITLIST.sentAgain);
});

test('a filled honeypot shows check your email with nothing to send, and a rate limit or offline notice keeps the form', () => {
  const trapped = reduceWaitlist(state({ company: 'acme' }), { type: 'submit' });
  assert.equal(trapped.phase, 'check');
  assert.equal(trapped.sentTo, 'person@example.com');
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
  assert.equal(interpretJoinResponse(200, { result: 'pending' }, false).kind, 'pending');
  assert.equal(interpretJoinResponse(200, { result: 'exists' }, false).kind, 'exists');
  assert.equal(interpretResendResponse(200, { result: 'pending', again: true }, false).kind, 'sent');
  assert.equal(interpretResendResponse(200, { result: 'pending', again: false }, false).kind, 'cooled');
  assert.equal(interpretJoinResponse(429, { error: 'rate_limited' }, false).kind, 'rate_limited');
  assert.equal(interpretJoinResponse(400, { error: 'invalid_email' }, false).kind, 'invalid_email');
  assert.deepEqual(interpretJoinResponse(500, { error: 'unavailable' }, true), { kind: 'network', offline: true });
  assert.deepEqual(interpretJoinResponse(0, null, false), { kind: 'network', offline: false });
  assert.deepEqual(interpretConfirmResponse(200, { result: 'confirmed', device: 'iphone', tracksToday: 'sleep' }), { kind: 'confirmed', details: { device: 'iphone', tracksToday: 'sleep', referral: null } });
  assert.deepEqual(interpretConfirmResponse(200, { result: 'expired' }), { kind: 'expired' });
  assert.deepEqual(interpretConfirmResponse(500, null), { kind: 'error' });
  assert.deepEqual(interpretConfirmResponse(404, { error: 'nope' }), { kind: 'expired' });
  assert.deepEqual(normalizeTracks('  sleep  '), { ok: true, value: 'sleep' });
  assert.deepEqual(normalizeTracks('   '), { ok: true, value: null });
  assert.deepEqual(normalizeTracks('x'.repeat(TRACKS_MAX + 1)), { ok: false });
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
