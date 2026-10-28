// The waitlist rules that both the web page and the join-waitlist edge function use (INT-94). No network, no React,
// no Deno or Node imports, so Vite, tsc, node:test and `supabase functions deploy` all read the same file. Supabase
// bundles only the function's own folder plus supabase/functions/_shared/, so anything the function needs lives here.
// The web re-exports these from src/features/home/waitlist.ts: edit them here, not there.

/** How long a confirmation link stays valid. The email carries the raw token; the database stores only its hash. */
export const CONFIRM_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** "Send it again" may issue a new token once a minute. The form's own submit is not held to this. */
export const RESEND_COOLDOWN_MS = 60 * 1000;

/** The sentence the page, the check-your-email state, the confirmed page and the confirm email all use. */
export const PROMISE = "We'll email you three times: to confirm, when your place is ready, and when the app ships for your device. Nothing else.";

/** After someone has confirmed, one of the three emails has already been sent. */
export const PROMISE_CONFIRMED = "We'll email you twice more: when your place is ready, and when the app ships for your device. Nothing else.";

/** Join attempts allowed from one address inside JOIN_RATE_WINDOW_MS. Enforced in the edge function. */
export const JOIN_RATE_LIMIT = 5;
export const JOIN_RATE_WINDOW_MS = 10 * 60 * 1000;

export const DEVICES = [
  { value: 'laptop', label: 'Laptop or desktop' },
  { value: 'iphone', label: 'iPhone' },
  { value: 'android', label: 'Android' },
] as const;

export type Device = (typeof DEVICES)[number]['value'];

export const EMAIL_EMPTY = 'Enter your email.';
export const EMAIL_FORMAT = 'That email looks incomplete. Check for a missing @ or dot.';

/** Free-text answer on the confirmed page. Optional, and never longer than this. */
export const TRACKS_MAX = 280;

/** Blank stays blank. A longer note is refused. */
export function normalizeTracks(raw: string): { ok: true; value: string | null } | { ok: false } {
  const value = raw.trim();
  if (value.length > TRACKS_MAX) return { ok: false };
  return { ok: true, value: value.length === 0 ? null : value };
}

/** A local part, an @, and a domain with a dot. Deliberately short of the full RFC. */
const EMAIL = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Empty and malformed are different messages. Checked on blur and submit, not on each keystroke. */
export function emailError(raw: string): string | null {
  const email = normalizeEmail(raw);
  if (email.length === 0) return EMAIL_EMPTY;
  if (email.length > 254 || email.includes('..') || !EMAIL.test(email)) return EMAIL_FORMAT;
  return null;
}

export function isDevice(value: unknown): value is Device {
  return DEVICES.some((d) => d.value === value);
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

/** True when the hidden company field should be treated as a bot and answered with a fake success. */
export function honeypotTripped(company: unknown): boolean {
  if (company == null) return false;
  if (typeof company !== 'string') return true;
  return company.trim() !== '';
}
