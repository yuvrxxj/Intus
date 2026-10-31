// Sending through Resend, and the go-live gate every waitlist email shares (INT-94, INT-163). Until the secret
// WAITLIST_EMAIL_LIVE is exactly "true", only addresses in WAITLIST_EMAIL_ALLOWLIST (comma separated) may get mail.
// No Deno or Node imports: the caller passes `fetch` in, so tests use a fake and nothing reaches Resend.
// An error never carries Resend's reply, which can quote the address.

export interface MailGate {
  live: boolean;
  allowlist: string[];
}

export function mailGateFrom(env: (name: string) => string | undefined): MailGate {
  return {
    live: env('WAITLIST_EMAIL_LIVE') === 'true',
    allowlist: (env('WAITLIST_EMAIL_ALLOWLIST') ?? '').split(',').map((a) => a.trim().toLowerCase()).filter(Boolean),
  };
}

export function mailAllowed(gate: MailGate, email: string): boolean {
  return gate.live || gate.allowlist.includes(email.toLowerCase());
}

export interface OutgoingMail {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Extra mail headers, such as List-Unsubscribe. */
  headers?: Record<string, string>;
  /** Resend drops a second request with the same key, so a retry cannot send twice. */
  idempotencyKey?: string;
}

export async function postResend(fetchFn: typeof fetch, apiKey: string, mail: OutgoingMail): Promise<void> {
  const headers: Record<string, string> = { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' };
  if (mail.idempotencyKey) headers['idempotency-key'] = mail.idempotencyKey;
  const body: Record<string, unknown> = { from: mail.from, to: [mail.to], subject: mail.subject, text: mail.text, html: mail.html };
  if (mail.headers) body.headers = mail.headers;
  const res = await fetchFn('https://api.resend.com/emails', { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error('resend failed');
}
