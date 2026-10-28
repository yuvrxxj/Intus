// Copy and rules for the early-access waitlist (INT-94). No network and no React, so the edge function can share them.
//
// TODO(INT-94 follow-up): send the confirmation email with Resend (double opt-in). This file only describes the
// promise and checks the form. Country (INT-110), campaign/UTM and analytics are later pull requests too.

/** How long a confirmation link stays valid. The later email carries the raw token; the database stores only its hash. */
export const CONFIRM_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Join attempts allowed from one address inside JOIN_RATE_WINDOW_MS. Enforced in the edge function. */
export const JOIN_RATE_LIMIT = 5;
export const JOIN_RATE_WINDOW_MS = 10 * 60 * 1000;

export const DEVICES = [
  { value: 'laptop', label: 'Laptop or desktop' },
  { value: 'iphone', label: 'iPhone' },
  { value: 'android', label: 'Android' },
] as const;

export type Device = (typeof DEVICES)[number]['value'];

export const WAITLIST = {
  heroKicker: 'Early access',
  heroTitle: 'Your health, in plain numbers.',
  heroLead: 'Log your day, read your bloodwork and keep your supplements in one place. Ranges are flagged, never diagnosed.',
  heroButton: 'Join the waitlist',
  heroNote: 'Free during early access. No card needed. Only you can see your data.',
  headerLink: 'Waitlist',
  kicker: 'Early access',
  title: 'Join the waitlist.',
  intro: 'We let people in in small groups.',
  promise: "We'll email you three times: to confirm, when your place is ready, and when the app ships for your device. Nothing else.",
  emailLabel: 'Email',
  deviceLabel: 'Where will you use Intus most?',
  button: 'Join the waitlist',
  consent: 'Only emails about your place on the list. Unsubscribe any time.',
  emailEmpty: 'Enter your email.',
  emailFormat: 'That email looks incomplete. Check for a missing @ or dot.',
  successKicker: 'On the list',
  success: 'Check your inbox to confirm',
  exists: 'This email is already on the list. Nothing else to do.',
  rateLimit: 'Too many tries. Wait a minute and try again.',
  saveError: 'We could not save that. Your email is still in the box. Try again.',
  offline: 'You look offline.',
  expiredKicker: 'Early access',
  expiredTitle: 'This link has expired',
  expiredBody: 'This confirmation link is no longer valid. Join the waitlist again from the homepage.',
  confirmedKicker: 'On the list',
  confirmedTitle: 'You are confirmed',
  confirmedBody: 'Your email is confirmed. We will email you when your place is ready, and when the app ships for your device.',
  confirmChecking: 'Checking the link',
  confirmError: 'We could not check that link. Try again.',
  confirmRetry: 'Try again',
  backHome: 'Back to the homepage',
} as const;

/** A local part, an @, and a domain with a dot. Deliberately short of the full RFC. */
const EMAIL = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Empty and malformed are different messages. Checked on blur and submit, not on each keystroke. */
export function emailError(raw: string): string | null {
  const email = normalizeEmail(raw);
  if (email.length === 0) return WAITLIST.emailEmpty;
  if (email.length > 254 || email.includes('..') || !EMAIL.test(email)) return WAITLIST.emailFormat;
  return null;
}

export function isDevice(value: unknown): value is Device {
  return DEVICES.some((d) => d.value === value);
}

/** Laptop or desktop, except on a phone-width screen, where iPhone starts selected. */
export function defaultDevice(phoneWidth: boolean): Device {
  return phoneWidth ? 'iphone' : 'laptop';
}

export function isConfirmToken(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
}

/** 32 random bytes, base64url, no padding. This is what a confirmation link will carry. Never store it. */
export function newConfirmToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function confirmTokenFrom(search: string): string | null {
  const token = new URLSearchParams(search).get('token');
  return isConfirmToken(token) ? token : null;
}

export type JoinOutcome =
  | { kind: 'success' }
  | { kind: 'exists' }
  | { kind: 'rate_limited' }
  | { kind: 'invalid_email' }
  | { kind: 'invalid_device' }
  | { kind: 'network'; offline: boolean };

export function interpretJoinResponse(status: number, body: unknown, offline: boolean): JoinOutcome {
  const record = body && typeof body === 'object' ? body as Record<string, unknown> : null;
  const error = record && typeof record.error === 'string' ? record.error : null;
  if (status === 429 || error === 'rate_limited') return { kind: 'rate_limited' };
  if (error === 'invalid_email') return { kind: 'invalid_email' };
  if (error === 'invalid_device') return { kind: 'invalid_device' };
  if (record?.result === 'created') return { kind: 'success' };
  if (record?.result === 'exists') return { kind: 'exists' };
  return { kind: 'network', offline };
}

export type ConfirmOutcome = 'confirmed' | 'expired' | 'error';

export function interpretConfirmResponse(status: number, body: unknown): ConfirmOutcome {
  const record = body && typeof body === 'object' ? body as Record<string, unknown> : null;
  if (record?.result === 'confirmed') return 'confirmed';
  if (record?.result === 'expired') return 'expired';
  if (status === 0 || status >= 500) return 'error';
  return 'expired';
}

export interface WaitlistNotice {
  tone: 'warn' | 'bad';
  text: string;
}

export interface WaitlistDone {
  kicker: string;
  text: string;
}

export interface WaitlistState {
  email: string;
  device: Device;
  /** Honeypot. People never see it. A filled value is treated as success and is not saved. */
  company: string;
  emailError: string | null;
  phase: 'idle' | 'submitting' | 'done';
  notice: WaitlistNotice | null;
  done: WaitlistDone | null;
}

export type WaitlistEvent =
  | { type: 'email'; value: string }
  | { type: 'device'; value: Device }
  | { type: 'company'; value: string }
  | { type: 'blur-email' }
  | { type: 'submit' }
  | { type: 'result'; outcome: JoinOutcome };

export function initialWaitlistState(phoneWidth: boolean): WaitlistState {
  return {
    email: '',
    device: defaultDevice(phoneWidth),
    company: '',
    emailError: null,
    phase: 'idle',
    notice: null,
    done: null,
  };
}

function doneState(state: WaitlistState, text: string): WaitlistState {
  return {
    ...state,
    phase: 'done',
    emailError: null,
    notice: null,
    done: { kicker: WAITLIST.successKicker, text },
  };
}

function applyOutcome(state: WaitlistState, outcome: JoinOutcome): WaitlistState {
  switch (outcome.kind) {
    case 'success':
      return doneState(state, WAITLIST.success);
    case 'exists':
      return doneState(state, WAITLIST.exists);
    case 'rate_limited':
      return { ...state, phase: 'idle', notice: { tone: 'warn', text: WAITLIST.rateLimit }, done: null };
    case 'invalid_email':
      return { ...state, phase: 'idle', emailError: emailError(state.email) ?? WAITLIST.emailFormat, notice: null, done: null };
    case 'invalid_device':
      return { ...state, phase: 'idle', notice: { tone: 'bad', text: WAITLIST.saveError }, done: null };
    case 'network':
      return {
        ...state,
        phase: 'idle',
        notice: { tone: 'bad', text: outcome.offline ? `${WAITLIST.saveError} ${WAITLIST.offline}` : WAITLIST.saveError },
        done: null,
      };
    default: {
      const _never: never = outcome;
      return _never;
    }
  }
}

/**
 * The form as data. Submit does not clear the email. A filled honeypot ends as success with nothing to send.
 * A result is applied only while a submit is in flight, so a late reply cannot overwrite a newer edit.
 */
export function reduceWaitlist(state: WaitlistState, event: WaitlistEvent): WaitlistState {
  switch (event.type) {
    case 'email':
      if (state.phase !== 'idle') return state;
      return { ...state, email: event.value, emailError: null, notice: null };
    case 'device':
      if (state.phase !== 'idle') return state;
      return { ...state, device: event.value };
    case 'company':
      if (state.phase !== 'idle') return state;
      return { ...state, company: event.value };
    case 'blur-email':
      if (state.phase !== 'idle') return state;
      return { ...state, emailError: emailError(state.email) };
    case 'submit': {
      if (state.phase !== 'idle') return state;
      if (state.company.trim() !== '') return doneState(state, WAITLIST.success);
      const error = emailError(state.email);
      if (error) return { ...state, emailError: error, notice: null };
      return { ...state, phase: 'submitting', emailError: null, notice: null };
    }
    case 'result':
      if (state.phase !== 'submitting') return state;
      return applyOutcome(state, event.outcome);
    default: {
      const _never: never = event;
      return _never;
    }
  }
}

export interface JoinPayload {
  action: 'join';
  email: string;
  device: Device;
  company: string;
}

/** The body of a real join. The honeypot is sent empty; a filled one never reaches here. */
export function payloadFrom(state: WaitlistState): JoinPayload {
  return { action: 'join', email: normalizeEmail(state.email), device: state.device, company: '' };
}

export function confirmPayload(token: string): { action: 'confirm'; token: string } {
  return { action: 'confirm', token };
}

export function waitlistFunctionUrl(supabaseUrl: string): string {
  return `${supabaseUrl.replace(/\/$/, '')}/functions/v1/join-waitlist`;
}

/** True when the hidden company field should be treated as a bot and answered with a fake success. */
export function honeypotTripped(company: unknown): boolean {
  if (company == null) return false;
  if (typeof company !== 'string') return true;
  return company.trim() !== '';
}
