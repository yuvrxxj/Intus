// Sends the confirm email through Resend. Off unless RESEND_API_KEY is set. Until WAITLIST_EMAIL_LIVE is "true", mail
// goes only to addresses listed in WAITLIST_EMAIL_ALLOWLIST (comma separated), so no real sign-up gets an email
// before the founder says so. No Deno or Node imports: index.ts passes the settings and `fetch` in.
// The gate and the Resend call are shared with send-waitlist-email (../_shared/resendMail.ts).

import { CONFIRM_FROM, confirmEmail } from '../_shared/confirmEmail.ts';
import { mailAllowed, mailGateFrom, postResend } from '../_shared/resendMail.ts';

export interface MailerSettings {
  apiKey: string | undefined;
  live: boolean;
  allowlist: string[];
  fetch: typeof fetch;
}

export type SendConfirm = (email: string, token: string) => Promise<'sent' | 'skipped'>;

export function mailerSettingsFrom(env: (name: string) => string | undefined, fetchFn: typeof fetch): MailerSettings {
  return { apiKey: env('RESEND_API_KEY'), ...mailGateFrom(env), fetch: fetchFn };
}

export function createSendConfirm(settings: MailerSettings): SendConfirm {
  return async (email, token) => {
    if (!settings.apiKey) return 'skipped';
    if (!mailAllowed(settings, email)) return 'skipped';
    const message = confirmEmail(token);
    await postResend(settings.fetch, settings.apiKey, { from: CONFIRM_FROM, to: email, ...message });
    return 'sent';
  };
}
