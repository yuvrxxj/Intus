// Sends the "place ready" or "launch" email to the waitlist (INT-163). Called by the founder with curl, never by the
// browser. The gateway check is off (--no-verify-jwt), so this checks the caller itself: the x-admin-token header must
// equal the secret WAITLIST_ADMIN_TOKEN, compared in constant time. With that secret unset, every request is refused.
//
// A dry run is the default: it counts, shows a few masked addresses and a preview, and sends and writes nothing. A
// real run needs "dryRun": false. For each person it first records the send in waitlist_emails_sent (insert-or-skip),
// so a retry or a double click can never send twice, then sends; a failed send removes that record so the person can
// be retried. The go-live gate is the confirm email's: until WAITLIST_EMAIL_LIVE is "true", only addresses in
// WAITLIST_EMAIL_ALLOWLIST are eligible. Nothing here logs an address or a token.
// No Deno or Node imports: index.ts passes the pieces in, so node:test can run this with fakes.

import { mailAllowed, type MailGate, type OutgoingMail } from '../_shared/resendMail.ts';
import {
  MARKETING_FROM,
  isWaitlistEmailKind,
  maskEmail,
  missingSettings,
  waitlistEmail,
  type WaitlistDevice,
  type WaitlistEmailKind,
  type WaitlistEmailSettings,
} from '../_shared/waitlistEmails.ts';
import { constantTimeEqual, unsubscribeLink, unsubscribeToken } from '../_shared/waitlistUnsubscribe.ts';

export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 500;
/** Resend allows two requests a second by default. */
export const SEND_DELAY_MS = 600;
/** Three failures in a row (a bad key, Resend down) stop the run instead of failing through the whole list. */
export const MAX_FAILURES_IN_A_ROW = 3;
/** A shorter admin token is treated as unset. */
export const MIN_ADMIN_TOKEN = 32;
export const ADMIN_HEADER = 'x-admin-token';

export interface Recipient {
  id: string;
  email: string;
  device: WaitlistDevice;
  place: number;
}

export interface SendConfig extends MailGate, WaitlistEmailSettings {
  adminToken: string | undefined;
  apiKey: string | undefined;
  unsubscribeSecret: string | undefined;
}

export interface SendDeps {
  config: SendConfig;
  /** Confirmed, not unsubscribed, not yet sent this kind. `only` keeps just those addresses; null means everyone. */
  countCandidates(kind: WaitlistEmailKind, only: string[] | null): Promise<number>;
  /** The same people, best place first, at most `limit`. */
  listRecipients(kind: WaitlistEmailKind, limit: number, only: string[] | null): Promise<Recipient[]>;
  /** Inserts the sent row. False when it was already there: someone else sent it, so skip. */
  claim(id: string, kind: WaitlistEmailKind): Promise<boolean>;
  /** Deletes the sent row after a failed send, so the person can be retried. */
  release(id: string, kind: WaitlistEmailKind): Promise<void>;
  send(mail: OutgoingMail): Promise<void>;
  sleep(ms: number): Promise<void>;
  log(message: string): void;
}

export interface SendSummary {
  kind: WaitlistEmailKind;
  dryRun: boolean;
  live: boolean;
  /** Everyone due this email who may get it now (all of them once live, only the allowlist before). */
  eligible: number;
  sent: number;
  /** Not allowlisted before go-live, or already sent by an earlier or parallel run. */
  skipped: number;
  failed: number;
  /** Dry run only: how many this call would try. */
  wouldSend?: number;
  /** Dry run only: the first few, masked. */
  sample?: { place: number; email: string; device: WaitlistDevice }[];
  /** Settings still needed before a real run. Empty means ready. */
  missingSettings: string[];
  /** Dry run only: what the email says, with an example unsubscribe link. Absent while settings are missing. */
  preview?: { subject: string; text: string };
  /** True when the run stopped after too many failures in a row. */
  stopped?: boolean;
}

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

async function authorised(deps: SendDeps, req: Request): Promise<'ok' | 'disabled' | 'denied'> {
  const expected = deps.config.adminToken;
  if (!expected || expected.length < MIN_ADMIN_TOKEN) return 'disabled';
  const given = req.headers.get(ADMIN_HEADER) ?? '';
  return (await constantTimeEqual(given, expected)) ? 'ok' : 'denied';
}

/** Everything a real run needs, by setting name. */
export function missingFor(kind: WaitlistEmailKind, config: SendConfig): string[] {
  const missing = missingSettings(kind, config);
  if (!config.apiKey) missing.push('RESEND_API_KEY');
  if (!config.unsubscribeSecret || config.unsubscribeSecret.length < MIN_ADMIN_TOKEN) missing.push('WAITLIST_UNSUBSCRIBE_SECRET');
  return missing;
}

export function createSendHandler(deps: SendDeps) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== 'POST') return reply(405, { error: 'bad_request' });
    const auth = await authorised(deps, req);
    if (auth === 'disabled') {
      deps.log('send-waitlist-email: WAITLIST_ADMIN_TOKEN is not set, refusing');
      return reply(503, { error: 'disabled' });
    }
    if (auth === 'denied') return reply(401, { error: 'unauthorized' });

    let body: unknown;
    try {
      const raw = await req.text();
      if (raw.length > 2_000) return reply(413, { error: 'bad_request' });
      body = JSON.parse(raw);
    } catch {
      return reply(400, { error: 'bad_request' });
    }
    if (!isRecord(body) || !isWaitlistEmailKind(body.kind)) return reply(400, { error: 'bad_kind' });
    if (body.dryRun !== undefined && typeof body.dryRun !== 'boolean') return reply(400, { error: 'bad_dry_run' });
    if (body.order !== undefined && body.order !== 'place') return reply(400, { error: 'bad_order' });
    const limit = body.limit === undefined ? DEFAULT_LIMIT : body.limit;
    if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) return reply(400, { error: 'bad_limit' });

    const kind = body.kind;
    // Only an explicit false sends. Missing, true, anything else: a dry run.
    const dryRun = body.dryRun !== false;
    const { config } = deps;
    const missing = missingFor(kind, config);
    if (!dryRun && missing.length > 0) return reply(409, { error: 'settings_missing', missing });

    const only = config.live ? null : config.allowlist;
    try {
      const total = await deps.countCandidates(kind, null);
      const eligible = only ? (only.length === 0 ? 0 : await deps.countCandidates(kind, only)) : total;
      const batch = only && only.length === 0 ? [] : await deps.listRecipients(kind, limit, only);
      const summary: SendSummary = { kind, dryRun, live: config.live, eligible, sent: 0, skipped: total - eligible, failed: 0, missingSettings: missing };

      if (dryRun) {
        summary.wouldSend = batch.filter((r) => mailAllowed(config, r.email)).length;
        summary.sample = batch.slice(0, 5).map((r) => ({ place: r.place, email: maskEmail(r.email), device: r.device }));
        if (missingSettings(kind, config).length === 0) {
          const example = waitlistEmail(kind, config, unsubscribeLink('00000000-0000-0000-0000-000000000000', 'example'), batch[0]?.device ?? 'iphone');
          summary.preview = { subject: example.subject, text: example.text };
        }
        return reply(200, summary);
      }

      let failuresInARow = 0;
      for (let i = 0; i < batch.length; i++) {
        const person = batch[i];
        // The query already filtered; this is the second lock on the same door.
        if (!mailAllowed(config, person.email)) {
          summary.skipped += 1;
          continue;
        }
        let claimed: boolean;
        try {
          claimed = await deps.claim(person.id, kind);
        } catch {
          // Without the record there is no guard against a second send, so nothing more goes out in this run.
          deps.log('send-waitlist-email: could not record a send, stopping');
          summary.stopped = true;
          break;
        }
        if (!claimed) {
          summary.skipped += 1;
          continue;
        }
        try {
          const link = unsubscribeLink(person.id, await unsubscribeToken(person.id, config.unsubscribeSecret!));
          const message = waitlistEmail(kind, config, link, person.device);
          await deps.send({
            from: MARKETING_FROM,
            to: person.email,
            ...message,
            headers: { 'List-Unsubscribe': `<${link}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
            idempotencyKey: `waitlist-${kind}-${person.id}`,
          });
          summary.sent += 1;
          failuresInARow = 0;
        } catch {
          summary.failed += 1;
          failuresInARow += 1;
          deps.log('send-waitlist-email: one send failed');
          try {
            await deps.release(person.id, kind);
          } catch {
            deps.log('send-waitlist-email: could not clear a failed send; that person will not be retried');
          }
          if (failuresInARow >= MAX_FAILURES_IN_A_ROW) {
            summary.stopped = true;
            break;
          }
        }
        if (i < batch.length - 1) await deps.sleep(SEND_DELAY_MS);
      }
      deps.log(`send-waitlist-email: ${kind} sent ${summary.sent}, skipped ${summary.skipped}, failed ${summary.failed}`);
      return reply(200, summary);
    } catch {
      deps.log('send-waitlist-email: database call failed');
      return reply(500, { error: 'unavailable' });
    }
  };
}
