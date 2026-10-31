// The unsubscribe link in the "place ready" and "launch" emails (INT-163). Stateless: the link carries the row id and
// an HMAC-SHA256 of that id under the secret WAITLIST_UNSUBSCRIBE_SECRET, so nothing new is stored and a link cannot be
// made for someone else's id without the secret. No Deno or Node imports, so node:test, Vite and Deno all read this.

export const UNSUBSCRIBE_ORIGIN = 'https://intus.fit';
export const UNSUBSCRIBE_PATH = '/waitlist/unsubscribe';

/** A waitlist row id: a lower-case or upper-case UUID. Anything else is refused before any work is done. */
export function isWaitlistId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/** HMAC-SHA256 output in base64url without padding is always 43 characters. */
export function isUnsubscribeToken(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
}

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}

function fromBase64url(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value.replaceAll('-', '+').replaceAll('_', '/'));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function hmacKey(secret: string, usage: 'sign' | 'verify'): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [usage]);
}

/** The id is lower-cased first, so the same row always gets the same token. */
export async function unsubscribeToken(id: string, secret: string): Promise<string> {
  if (!secret) throw new Error('unsubscribe secret missing');
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(secret, 'sign'), new TextEncoder().encode(id.toLowerCase()));
  return base64url(new Uint8Array(signature));
}

/** True only when the token is the HMAC of this id. crypto.subtle.verify compares in constant time. */
export async function verifyUnsubscribeToken(id: unknown, token: unknown, secret: string | undefined): Promise<boolean> {
  if (!secret || !isWaitlistId(id) || !isUnsubscribeToken(token)) return false;
  try {
    return await crypto.subtle.verify('HMAC', await hmacKey(secret, 'verify'), fromBase64url(token), new TextEncoder().encode(id.toLowerCase()));
  } catch {
    return false;
  }
}

export function unsubscribeLink(id: string, token: string): string {
  return `${UNSUBSCRIBE_ORIGIN}${UNSUBSCRIBE_PATH}?id=${encodeURIComponent(id.toLowerCase())}&t=${encodeURIComponent(token)}`;
}

/**
 * Compares two secrets without leaking where they differ or how long the right one is: both are hashed to 32 bytes
 * first, then every byte is compared. Used for the admin token of send-waitlist-email.
 */
export async function constantTimeEqual(a: string, b: string): Promise<boolean> {
  const [x, y] = await Promise.all([a, b].map(async (s) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))));
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
