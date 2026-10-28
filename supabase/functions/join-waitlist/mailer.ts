// Sends the confirm email through Resend. Off unless RESEND_API_KEY is set. Until WAITLIST_EMAIL_LIVE is "true", mail
// goes only to addresses listed in WAITLIST_EMAIL_ALLOWLIST (comma separated), so no real sign-up gets an email
// before the founder says so. No Deno or Node imports: index.ts passes the settings and `fetch` in.

import { CONFIRM_FROM, confirmEmail } from '../_shared/confirmEmail.ts';

export interface MailerSettings {
  apiKey: string | undefined;
  live: boolean;
  allowlist: string[];
  fetch: typeof fetch;
}

export type SendConfirm = (email: string, token: string) => Promise<'sent' | 'skipped'>;

export function mailerSettingsFrom(env: (name: string) => string | undefined, fetchFn: typeof fetch): MailerSettings {
  return {
    apiKey: env('RESEND_API_KEY'),
    live: env('WAITLIST_EMAIL_LIVE') === 'true',
    allowlist: (env('WAITLIST_EMAIL_ALLOWLIST') ?? '').split(',').map((a) => a.trim().toLowerCase()).filter(Boolean),
    fetch: fetchFn,
  };
}

export function createSendConfirm(settings: MailerSettings): SendConfirm {
  return async (email, token) => {
    if (!settings.apiKey) return 'skipped';
    if (!settings.live && !settings.allowlist.includes(email.toLowerCase())) return 'skipped';
    const message = confirmEmail(token);
    const res = await settings.fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${settings.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: CONFIRM_FROM, to: [email], subject: message.subject, text: message.text, html: message.html }),
    });
    if (!res.ok) throw new Error('resend failed');
    return 'sent';
  };
}
