// Public waitlist endpoint. Callers are signed out, so this checks the body itself and writes with the service role
// (wired in index.ts). The raw confirmation token is never stored and never returned: only its SHA-256 hash is.
//
// TODO(INT-94 follow-up): email that token with Resend. Do not send mail from here. Country, UTM and analytics
// are later pull requests and are not accepted on this body.

import {
  CONFIRM_TOKEN_TTL_MS,
  JOIN_RATE_LIMIT,
  JOIN_RATE_WINDOW_MS,
  emailError,
  honeypotTripped,
  isConfirmToken,
  isDevice,
  newConfirmToken,
  normalizeEmail,
  sha256Hex,
  type Device,
} from '../../../src/features/home/waitlist.ts';
import { createMemoryRateLimit, type RateLimiter } from './rateLimit.ts';

export interface StoredWaitlist {
  id: string;
  status: 'pending' | 'confirmed';
  confirmTokenHash: string | null;
  confirmTokenExpiresAt: string | null;
}

export interface Deps {
  now(): number;
  /** 5 joins per IP per 10 minutes, by default. Confirm is not counted: the token is 32 random bytes. */
  allowJoin(ip: string, now: number): boolean;
  clientIp(req: Request): string;
  findByEmail(email: string): Promise<StoredWaitlist | null>;
  insert(row: { email: string; device: Device; confirmTokenHash: string; confirmTokenExpiresAt: string }): Promise<'created' | 'exists'>;
  replaceToken(id: string, hash: string, expiresAt: string, device: Device): Promise<void>;
  findByTokenHash(hash: string): Promise<StoredWaitlist | null>;
  markConfirmed(id: string, confirmedAt: string): Promise<void>;
  /** Overridable in tests. Production draws a fresh token per insert. */
  newToken(): string;
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

async function issue(deps: Deps, now: number): Promise<{ hash: string; expiresAt: string }> {
  // The raw token is hashed and dropped. The later email pull request is what will send it.
  const token = deps.newToken();
  return {
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

    // Missing action is a join. Anything else is refused. Joins are rate limited; confirms are not.
    if (body.action != null && body.action !== 'join') return reply(400, { error: 'bad_request' });
    if (!deps.allowJoin(ip, now)) return reply(429, { error: 'rate_limited' });

    // A filled honeypot looks like success and writes nothing, so a bot learns no new trick.
    if (honeypotTripped(body.company)) return reply(200, { result: 'created' });

    if (typeof body.email !== 'string' || emailError(body.email)) return reply(400, { error: 'invalid_email' });
    if (!isDevice(body.device)) return reply(400, { error: 'invalid_device' });
    const email = normalizeEmail(body.email);
    const device = body.device;

    try {
      const existing = await deps.findByEmail(email);
      if (existing) {
        const expires = existing.confirmTokenExpiresAt ? Date.parse(existing.confirmTokenExpiresAt) : 0;
        const stillPending = existing.status === 'pending' && !(expires > now);
        if (!stillPending) return reply(200, { result: 'exists' });
        // The old link is dead and no mail has gone out for a new one yet. Mint a replacement hash.
        const next = await issue(deps, now);
        await deps.replaceToken(existing.id, next.hash, next.expiresAt, device);
        return reply(200, { result: 'created' });
      }
      const next = await issue(deps, now);
      const outcome = await deps.insert({
        email,
        device,
        confirmTokenHash: next.hash,
        confirmTokenExpiresAt: next.expiresAt,
      });
      return reply(200, { result: outcome });
    } catch {
      deps.log('join failed');
      return reply(500, { error: 'unavailable' });
    }
  };
}

async function confirm(deps: Deps, body: Record<string, unknown>, now: number): Promise<Response> {
  if (!isConfirmToken(body.token)) return reply(200, { result: 'expired' });
  try {
    const row = await deps.findByTokenHash(await sha256Hex(body.token));
    if (!row) return reply(200, { result: 'expired' });
    if (row.status === 'confirmed') return reply(200, { result: 'confirmed' });
    const expires = row.confirmTokenExpiresAt ? Date.parse(row.confirmTokenExpiresAt) : 0;
    if (!(expires > now)) return reply(200, { result: 'expired' });
    await deps.markConfirmed(row.id, new Date(now).toISOString());
    return reply(200, { result: 'confirmed' });
  } catch {
    deps.log('confirm failed');
    return reply(500, { error: 'unavailable' });
  }
}

/** Used by index.ts. Tests pass their own token. */
export function productionToken(): string {
  return newConfirmToken();
}
