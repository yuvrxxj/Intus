// Copy and rules for the early-access waitlist (INT-94). No network and no React, so the edge function can share them.
//
// TODO(INT-94 follow-up): send the confirmation email with Resend (double opt-in). This file only describes the
// promise and checks the form. Country (INT-110), campaign/UTM and analytics are later pull requests too.

import {
  CONFIRM_TOKEN_TTL_MS,
  DEVICES,
  EMAIL_EMPTY,
  EMAIL_FORMAT,
  JOIN_RATE_LIMIT,
  JOIN_RATE_WINDOW_MS,
  PROMISE,
  PROMISE_CONFIRMED,
  RESEND_COOLDOWN_MS,
  TRACKS_MAX,
  emailError,
  honeypotTripped,
  isConfirmToken,
  isDevice,
  newConfirmToken,
  normalizeEmail,
  normalizeTracks,
  sha256Hex,
  type Device,
} from '../../../supabase/functions/_shared/waitlistRules.ts';

// The pure rules the edge function also needs live in supabase/functions/_shared/waitlistRules.ts, and are re-exported
// here so the page and the tests keep importing from one place.
export {
  CONFIRM_TOKEN_TTL_MS,
  DEVICES,
  JOIN_RATE_LIMIT,
  JOIN_RATE_WINDOW_MS,
  PROMISE,
  RESEND_COOLDOWN_MS,
  TRACKS_MAX,
  emailError,
  honeypotTripped,
  isConfirmToken,
  isDevice,
  newConfirmToken,
  normalizeEmail,
  normalizeTracks,
  sha256Hex,
  type Device,
};

export const WAITLIST = {
  heroKicker: 'Early access',
  heroTitle: 'Your health, in plain numbers.',
  heroLead: "Log your day, read your bloodwork and keep your supplements in one place. Intus flags values outside the lab's range. It does not diagnose anything.",
  footer: "Not medical advice. Intus flags values outside the lab's range and does not diagnose anything.",
  heroButton: 'Join the waitlist',
  heroNote: 'Free during early access. No card needed. Only you can see your data.',
  headerLink: 'Waitlist',
  kicker: 'Early access',
  title: 'Join the waitlist.',
  intro: 'We let people in in small groups.',
  promise: PROMISE,
  /** After someone has confirmed, one of the three emails has already been sent. */
  promiseConfirmed: PROMISE_CONFIRMED,
  emailLabel: 'Email',
  deviceLabel: 'Where will you use Intus most?',
  button: 'Join the waitlist',
  emailEmpty: EMAIL_EMPTY,
  emailFormat: EMAIL_FORMAT,
  checkKicker: 'One more step',
  sendAgain: 'Send it again',
  sentAgain: 'Sent again.',
  changeEmail: 'Wrong email? Change it',
  exists: 'This email is already on the list. Nothing else to do.',
  rateLimit: 'Too many tries. Wait a minute and try again.',
  saveError: 'We could not save that. Your email is still in the box. Try again.',
  offline: 'You look offline.',
  expiredBody: 'That link has expired. Enter your email again and we will send a new one.',
  confirmedKicker: 'On the list',
  confirmedTitle: 'You are on the list.',
  whatIntus: "One place for your daily log, your bloodwork, your sleep and your supplements. Values outside the lab's reference range are flagged. Intus does not diagnose anything. Only you can see your data.",
  questionsKicker: 'Two quick questions, optional',
  questionsLead: 'Help us decide what to build first. Skip if you like.',
  deviceHelper: 'We picked what you chose when you signed up. Change it if that is wrong.',
  tracksLabel: 'What do you track today, and with which app or wearable?',
  tracksPlaceholder: 'For example: sleep on a watch, steps on my phone, blood tests in PDFs',
  sendAnswers: 'Send answers',
  skip: 'Skip and go to intus.fit',
  finePrint: 'Answers are saved with your place on the list. They are not shared.',
  sentThanks: 'Thanks. Your answers are saved.',
  sentBack: 'Back to intus.fit',
  answersError: 'We could not save your answers. They are still here. Try again.',
  confirmedLink: 'https://intus.fit',
  confirmChecking: 'Checking the link',
  confirmError: 'We could not check that link. Try again.',
  confirmRetry: 'Try again',
} as const;

/** Body of the check-your-email notice, including the promise line. */
export function checkEmailMessage(email: string): string {
  return `Check your inbox. We sent a link to ${email}. Tap it to confirm your place on the list. ${PROMISE}`;
}

/** An invite goes only to someone who has confirmed. Pending rows are not eligible. */
export function isInviteEligible(status: 'pending' | 'confirmed'): boolean {
  return status === 'confirmed';
}

/** The resend control reads "Sent again." until a minute has passed. */
export function resendLabel(resentUntil: number | null, now: number): string {
  return resentUntil != null && now < resentUntil ? WAITLIST.sentAgain : WAITLIST.sendAgain;
}

/** Laptop or desktop, except on a phone-width screen, where iPhone starts selected. */
export function defaultDevice(phoneWidth: boolean): Device {
  return phoneWidth ? 'iphone' : 'laptop';
}

export function confirmTokenFrom(search: string): string | null {
  const token = new URLSearchParams(search).get('token');
  return isConfirmToken(token) ? token : null;
}

export type JoinOutcome =
  | { kind: 'pending' }
  | { kind: 'exists' }
  | { kind: 'rate_limited' }
  | { kind: 'invalid_email' }
  | { kind: 'invalid_device' }
  | { kind: 'network'; offline: boolean };

export type ResendOutcome =
  | { kind: 'sent' }
  | { kind: 'cooled' }
  | { kind: 'exists' }
  | { kind: 'rate_limited' }
  | { kind: 'network'; offline: boolean };

function recordOf(body: unknown): Record<string, unknown> | null {
  return body && typeof body === 'object' ? body as Record<string, unknown> : null;
}

export function interpretJoinResponse(status: number, body: unknown, offline: boolean): JoinOutcome {
  const record = recordOf(body);
  const error = record && typeof record.error === 'string' ? record.error : null;
  if (status === 429 || error === 'rate_limited') return { kind: 'rate_limited' };
  if (error === 'invalid_email') return { kind: 'invalid_email' };
  if (error === 'invalid_device') return { kind: 'invalid_device' };
  if (record?.result === 'pending') return { kind: 'pending' };
  if (record?.result === 'exists') return { kind: 'exists' };
  return { kind: 'network', offline };
}

export function interpretResendResponse(status: number, body: unknown, offline: boolean): ResendOutcome {
  const record = recordOf(body);
  const error = record && typeof record.error === 'string' ? record.error : null;
  if (status === 429 || error === 'rate_limited') return { kind: 'rate_limited' };
  if (record?.result === 'exists') return { kind: 'exists' };
  if (record?.result === 'pending') return record.again === false ? { kind: 'cooled' } : { kind: 'sent' };
  return { kind: 'network', offline };
}

export interface ConfirmedDetails {
  device: Device;
  tracksToday: string;
}

export type ConfirmPageResult =
  | { kind: 'confirmed'; details: ConfirmedDetails }
  | { kind: 'expired' }
  | { kind: 'error' };

/** What the confirmed page needs from a confirm response. A missing device falls back to laptop. */
export function interpretConfirmResponse(status: number, body: unknown): ConfirmPageResult {
  const record = body && typeof body === 'object' ? body as Record<string, unknown> : null;
  if (record?.result === 'confirmed') {
    const tracks = typeof record.tracksToday === 'string' ? record.tracksToday : '';
    return { kind: 'confirmed', details: { device: isDevice(record.device) ? record.device : 'laptop', tracksToday: tracks.slice(0, TRACKS_MAX) } };
  }
  if (record?.result === 'expired') return { kind: 'expired' };
  if (status === 0 || status >= 500) return { kind: 'error' };
  return { kind: 'expired' };
}

export type AnswersOutcome = 'saved' | 'expired' | 'error';

export function interpretAnswersResponse(status: number, body: unknown): AnswersOutcome {
  const record = body && typeof body === 'object' ? body as Record<string, unknown> : null;
  if (record?.result === 'saved') return 'saved';
  if (record?.result === 'expired') return 'expired';
  if (status === 0 || status >= 500 || status === 400) return 'error';
  return 'error';
}

export function answersPayload(token: string, device: Device, tracks: string): { action: 'answers'; token: string; device: Device; tracksToday: string } {
  return { action: 'answers', token, device, tracksToday: tracks };
}

export interface WaitlistNotice {
  tone: 'warn' | 'bad';
  text: string;
}

export interface WaitlistState {
  email: string;
  device: Device;
  /** Honeypot. People never see it. A filled value is treated as the check-your-email state and is not saved. */
  company: string;
  emailError: string | null;
  phase: 'idle' | 'submitting' | 'check' | 'listed';
  notice: WaitlistNotice | null;
  /** Normalised address shown in the check-your-email notice. */
  sentTo: string | null;
  /** Epoch ms until which "Send it again" reads "Sent again." */
  resentUntil: number | null;
  resending: boolean;
}

export type WaitlistEvent =
  | { type: 'email'; value: string }
  | { type: 'device'; value: Device }
  | { type: 'company'; value: string }
  | { type: 'blur-email' }
  | { type: 'submit' }
  | { type: 'result'; outcome: JoinOutcome }
  | { type: 'change-email' }
  | { type: 'resend'; now: number }
  | { type: 'resend-result'; outcome: ResendOutcome; now: number };

export function initialWaitlistState(phoneWidth: boolean): WaitlistState {
  return {
    email: '',
    device: defaultDevice(phoneWidth),
    company: '',
    emailError: null,
    phase: 'idle',
    notice: null,
    sentTo: null,
    resentUntil: null,
    resending: false,
  };
}

function checkState(state: WaitlistState): WaitlistState {
  return {
    ...state,
    phase: 'check',
    emailError: null,
    notice: null,
    sentTo: normalizeEmail(state.email),
    resentUntil: null,
    resending: false,
  };
}

function applyOutcome(state: WaitlistState, outcome: JoinOutcome): WaitlistState {
  switch (outcome.kind) {
    case 'pending':
      return checkState(state);
    case 'exists':
      return { ...state, phase: 'listed', emailError: null, notice: null, resending: false };
    case 'rate_limited':
      return { ...state, phase: 'idle', notice: { tone: 'warn', text: WAITLIST.rateLimit } };
    case 'invalid_email':
      return { ...state, phase: 'idle', emailError: emailError(state.email) ?? WAITLIST.emailFormat, notice: null };
    case 'invalid_device':
      return { ...state, phase: 'idle', notice: { tone: 'bad', text: WAITLIST.saveError } };
    case 'network':
      return {
        ...state,
        phase: 'idle',
        notice: { tone: 'bad', text: outcome.offline ? `${WAITLIST.saveError} ${WAITLIST.offline}` : WAITLIST.saveError },
      };
    default: {
      const _never: never = outcome;
      return _never;
    }
  }
}

/**
 * The form as data. Submit does not clear the email. A filled honeypot ends on check-your-email with nothing to send.
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
      if (state.company.trim() !== '') return checkState(state);
      const error = emailError(state.email);
      if (error) return { ...state, emailError: error, notice: null };
      return { ...state, phase: 'submitting', emailError: null, notice: null };
    }
    case 'result':
      if (state.phase !== 'submitting') return state;
      return applyOutcome(state, event.outcome);
    case 'change-email':
      if (state.phase !== 'check' && state.phase !== 'listed') return state;
      return { ...state, phase: 'idle', notice: null, resending: false };
    case 'resend': {
      if (state.phase !== 'check' || state.resending) return state;
      if (state.resentUntil != null && event.now < state.resentUntil) return state;
      if (state.company.trim() !== '') return { ...state, resentUntil: event.now + RESEND_COOLDOWN_MS };
      return { ...state, resending: true, notice: null };
    }
    case 'resend-result': {
      if (state.phase !== 'check') return state;
      if (event.outcome.kind === 'sent' || event.outcome.kind === 'cooled') {
        return { ...state, resending: false, resentUntil: event.now + RESEND_COOLDOWN_MS, notice: null };
      }
      if (event.outcome.kind === 'exists') return { ...state, phase: 'listed', resending: false, notice: null };
      if (event.outcome.kind === 'rate_limited') {
        return { ...state, resending: false, notice: { tone: 'warn', text: WAITLIST.rateLimit } };
      }
      return {
        ...state,
        resending: false,
        notice: { tone: 'bad', text: event.outcome.offline ? `${WAITLIST.saveError} ${WAITLIST.offline}` : WAITLIST.saveError },
      };
    }
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

export function resendPayload(email: string): { action: 'resend'; email: string } {
  return { action: 'resend', email: normalizeEmail(email) };
}

export function waitlistFunctionUrl(supabaseUrl: string): string {
  return `${supabaseUrl.replace(/\/$/, '')}/functions/v1/join-waitlist`;
}
