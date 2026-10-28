// Public waitlist endpoint. Callers are signed out, so this checks the body itself and writes with the service role
// (wired in index.ts). The raw confirmation token is never stored and never returned: only its SHA-256 hash is.
//
// The raw token is emailed through Deps.sendConfirm (Resend, see mailer.ts) and nowhere else. Country, UTM and
// analytics are later pull requests and are not accepted on this body.

import {
  CONFIRM_TOKEN_TTL_MS,
  JOIN_RATE_LIMIT,
  JOIN_RATE_WINDOW_MS,
  RESEND_COOLDOWN_MS,
  emailError,
  honeypotTripped,
  isConfirmToken,
  isDevice,
  newConfirmToken,
  normalReferralEmail,
  normalizeEmail,
  normalizeTracks,
  referralCodeFrom,
  sha256Hex,
  type Device,
  type ReferralStanding,
} from '../_shared/waitlistRules.ts';
import { createMemoryRateLimit, type RateLimiter } from './rateLimit.ts';

export interface StoredWaitlist {
  id: string;
  status: 'pending' | 'confirmed';
  device: Device;
  confirmTokenHash: string | null;
  confirmTokenExpiresAt: string | null;
  confirmSentAt: string | null;
  tracksToday: string | null;
  answeredAt: string | null;
}

export interface Deps {
  now(): number;
  /** 5 joins per IP per 10 minutes, by default. Confirm is not counted: the token is 32 random bytes. */
  allowJoin(ip: string, now: number): boolean;
  clientIp(req: Request): string;
  findByEmail(email: string): Promise<StoredWaitlist | null>;
  insert(row: { email: string; device: Device; confirmTokenHash: string; confirmTokenExpiresAt: string; confirmSentAt: string; referredBy?: string | null }): Promise<'created' | 'exists'>;
  /** The confirmed row that owns this referral code, or null. Pending rows never match: only confirmed people share a link. */
  findReferrer?(code: string): Promise<{ id: string; email: string } | null>;
  /** Place and confirmed-friend count for a confirmed row (the waitlist_standing view). */
  standing?(id: string): Promise<ReferralStanding | null>;
  replaceToken(id: string, hash: string, expiresAt: string, device: Device, sentAt: string): Promise<void>;
  findByTokenHash(hash: string): Promise<StoredWaitlist | null>;
  /** Sets confirmed and keeps the token, so the same link can be opened again. */
  markConfirmed(id: string, confirmedAt: string): Promise<void>;
  saveAnswers(id: string, device: Device, tracksToday: string | null, answeredAt: string): Promise<void>;
  /** Overridable in tests. Production draws a fresh token per insert. */
  newToken(): string;
  /** Emails the raw token. Optional: absent or 'skipped' means nothing was sent. A throw is logged and not shown. */
  sendConfirm?(email: string, token: string): Promise<'sent' | 'skipped'>;
  log(message: string): void;
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
};

const MAX_BODY_CHARS = 8_000;

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function clientIpFrom(req: Request): string {
  const cf = req.headers.get('cf-connecting-ip')?.trim();
  if (cf) return cf;
  const forwarded = req.headers.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  return first || 'unknown';
}

export function createJoinLimiter(): RateLimiter {
  return createMemoryRateLimit(JOIN_RATE_LIMIT, JOIN_RATE_WINDOW_MS);
}

async function issue(deps: Deps, now: number): Promise<{ token: string; hash: string; expiresAt: string }> {
  // The raw token is hashed for the database. It stays in memory only long enough to email it.
  const token = deps.newToken();
  return {
    token,
    hash: await sha256Hex(token),
    expiresAt: new Date(now + CONFIRM_TOKEN_TTL_MS).toISOString(),
  };
}

export function createHandler(deps: Deps) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (req.method !== 'POST') return reply(405, { error: 'bad_request' });

    const now = deps.now();
    const ip = deps.clientIp(req);

    let body: unknown;
    try {
      const raw = await req.text();
      if (raw.length > MAX_BODY_CHARS) return reply(413, { error: 'bad_request' });
      body = raw.trim() === '' ? {} : JSON.parse(raw);
    } catch {
      return reply(400, { error: 'bad_request' });
    }
    if (!isRecord(body)) return reply(400, { error: 'bad_request' });

    if (body.action === 'confirm') return confirm(deps, body, now);
    if (body.action === 'answers') return answers(deps, body, now);
    if (body.action === 'resend') return resend(deps, body, now, ip);

    // Missing action is a join. Anything else is refused. Joins are rate limited; confirms are not.
    if (body.action != null && body.action !== 'join') return reply(400, { error: 'bad_request' });
    if (!deps.allowJoin(ip, now)) return reply(429, { error: 'rate_limited' });

    // A filled honeypot looks like the check-your-email state and writes nothing, so a bot learns no new trick.
    if (honeypotTripped(body.company)) return reply(200, { result: 'pending' });

    if (typeof body.email !== 'string' || emailError(body.email)) return reply(400, { error: 'invalid_email' });
    if (!isDevice(body.device)) return reply(400, { error: 'invalid_device' });
    const email = normalizeEmail(body.email);
    const device = body.device;

    try {
      const existing = await deps.findByEmail(email);
      if (existing?.status === 'confirmed') return reply(200, { result: 'exists' });
      if (existing) {
        // Still unconfirmed, whether or not the previous link is live: a new signup replaces the token.
        await issueFor(deps, existing.id, email, device, now);
        return reply(200, { result: 'pending' });
      }
      const next = await issue(deps, now);
      const sentAt = new Date(now).toISOString();
      const outcome = await deps.insert({
        email,
        device,
        confirmTokenHash: next.hash,
        confirmTokenExpiresAt: next.expiresAt,
        confirmSentAt: sentAt,
        referredBy: await referrerFor(deps, body.ref, email),
      });
      if (outcome === 'created') await mail(deps, email, next.token);
      if (outcome === 'exists') {
        const raced = await deps.findByEmail(email);
        if (raced?.status === 'confirmed') return reply(200, { result: 'exists' });
        if (raced) {
          await issueFor(deps, raced.id, email, device, now);
          return reply(200, { result: 'pending' });
        }
      }
      return reply(200, { result: 'pending' });
    } catch {
      deps.log('join failed');
      return reply(500, { error: 'unavailable' });
    }
  };
}

/**
 * Who referred this sign-up, or null. Only set when the row is created, so a later sign-up cannot re-attribute it.
 * An unknown code, a pending owner, the same inbox (+tag, gmail dots) or a lookup failure all mean "no referrer":
 * the join itself never fails over a referral.
 */
async function referrerFor(deps: Deps, ref: unknown, email: string): Promise<string | null> {
  const code = referralCodeFrom(ref);
  if (!code || !deps.findReferrer) return null;
  try {
    const referrer = await deps.findReferrer(code);
    if (!referrer || normalReferralEmail(referrer.email) === normalReferralEmail(email)) return null;
    return referrer.id;
  } catch {
    deps.log('referral lookup failed');
    return null;
  }
}

async function issueFor(deps: Deps, id: string, email: string, device: Device, now: number): Promise<void> {
  const next = await issue(deps, now);
  await deps.replaceToken(id, next.hash, next.expiresAt, device, new Date(now).toISOString());
  await mail(deps, email, next.token);
}

/** The row is already saved, so a mail failure must not fail the request: "Send it again" is the way back. */
async function mail(deps: Deps, email: string, token: string): Promise<void> {
  if (!deps.sendConfirm) return;
  try {
    await deps.sendConfirm(email, token);
  } catch {
    deps.log('confirm email failed');
  }
}

/** "Send it again": one new token a minute. Inside that minute the answer is still pending, with again: false. */
async function resend(deps: Deps, body: Record<string, unknown>, now: number, ip: string): Promise<Response> {
  if (!deps.allowJoin(ip, now)) return reply(429, { error: 'rate_limited' });
  if (typeof body.email !== 'string' || emailError(body.email)) return reply(400, { error: 'invalid_email' });
  const email = normalizeEmail(body.email);
  try {
    const existing = await deps.findByEmail(email);
    if (!existing || existing.status === 'confirmed') return reply(200, { result: existing ? 'exists' : 'pending', again: false });
    const sent = existing.confirmSentAt ? Date.parse(existing.confirmSentAt) : 0;
    if (sent > 0 && now - sent < RESEND_COOLDOWN_MS) return reply(200, { result: 'pending', again: false });
    await issueFor(deps, existing.id, email, existing.device, now);
    return reply(200, { result: 'pending', again: true });
  } catch {
    deps.log('resend failed');
    return reply(500, { error: 'unavailable' });
  }
}

async function confirmedPayload(deps: Deps, row: StoredWaitlist) {
  const base = { result: 'confirmed', device: row.device, tracksToday: row.tracksToday ?? '', answeredAt: row.answeredAt };
  if (!deps.standing) return base;
  try {
    const standing = await deps.standing(row.id);
    return standing ? { ...base, referral: standing } : base;
  } catch {
    // The page still confirms the person; it just has no place to show.
    deps.log('standing failed');
    return base;
  }
}

async function confirm(deps: Deps, body: Record<string, unknown>, now: number): Promise<Response> {
  if (!isConfirmToken(body.token)) return reply(200, { result: 'expired' });
  try {
    const row = await deps.findByTokenHash(await sha256Hex(body.token));
    if (!row) return reply(200, { result: 'expired' });
    // A second open of the same link still finds the row. The hash stays so the questions can load.
    if (row.status === 'confirmed') return reply(200, await confirmedPayload(deps, row));
    const expires = row.confirmTokenExpiresAt ? Date.parse(row.confirmTokenExpiresAt) : 0;
    if (!(expires > now)) return reply(200, { result: 'expired' });
    await deps.markConfirmed(row.id, new Date(now).toISOString());
    return reply(200, await confirmedPayload(deps, row));
  } catch {
    deps.log('confirm failed');
    return reply(500, { error: 'unavailable' });
  }
}

/** Saves the optional questions onto the confirmed row the token names. Nothing is written for a public caller. */
async function answers(deps: Deps, body: Record<string, unknown>, now: number): Promise<Response> {
  if (!isConfirmToken(body.token)) return reply(200, { result: 'expired' });
  const parsed = normalizeTracks(typeof body.tracksToday === 'string' ? body.tracksToday : '');
  if (!parsed.ok) return reply(400, { error: 'too_long' });
  try {
    const row = await deps.findByTokenHash(await sha256Hex(body.token));
    if (!row || row.status !== 'confirmed') return reply(200, { result: 'expired' });
    const device = isDevice(body.device) ? body.device : row.device;
    await deps.saveAnswers(row.id, device, parsed.value, new Date(now).toISOString());
    return reply(200, { result: 'saved' });
  } catch {
    deps.log('answers failed');
    return reply(500, { error: 'unavailable' });
  }
}

/** Used by index.ts. Tests pass their own token. */
export function productionToken(): string {
  return newConfirmToken();
}
