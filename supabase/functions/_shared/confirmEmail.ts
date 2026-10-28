// The first of the three waitlist emails (INT-94): confirm your place. Pure text, no network, so a test can read it.
// The raw token goes in the link and nowhere else. Only its hash is stored.

import { PROMISE } from './waitlistRules.ts';

export const CONFIRM_FROM = 'Intus <marketing@mail.intus.fit>';
export const CONFIRM_SUBJECT = 'Confirm your place on the Intus waitlist';
export const CONFIRM_ORIGIN = 'https://intus.fit';

export function confirmLink(token: string): string {
  return `${CONFIRM_ORIGIN}/waitlist/confirmed?token=${encodeURIComponent(token)}`;
}

export function confirmEmail(token: string): { subject: string; text: string; html: string } {
  const link = confirmLink(token);
  const text = [
    'Tap to confirm your place on the Intus waitlist:',
    link,
    '',
    'The link works for 7 days.',
    'If this was not you, ignore this email and nothing happens.',
    '',
    PROMISE,
  ].join('\n');
  const html = [
    '<p>Tap to confirm your place on the Intus waitlist:</p>',
    `<p><a href="${link}">Confirm my place</a></p>`,
    '<p>The link works for 7 days. If this was not you, ignore this email and nothing happens.</p>',
    `<p>${PROMISE}</p>`,
  ].join('\n');
  return { subject: CONFIRM_SUBJECT, text, html };
}
