// The second and third waitlist emails (INT-163): "your place is ready" and "the app has launched". Pure text, no
// network, so a test can read every word. The how-to-get-in text, the store link and the postal address are not
// decided yet, so they come from settings, and a missing or placeholder value makes the template throw: nothing half
// written can be sent. The wording here is a draft for the founder to approve in the pull request.
// Getting in is TestFlight for now (WAITLIST_TESTFLIGHT_URL); the launch email needs a real App Store link
// (WAITLIST_STORE_URL), which stays unset until launch, so the launch kind is refused until then.

export const MARKETING_FROM = 'Intus <marketing@mail.intus.fit>';

export type WaitlistEmailKind = 'place_ready' | 'launch';
export const WAITLIST_EMAIL_KINDS: readonly WaitlistEmailKind[] = ['place_ready', 'launch'];

export function isWaitlistEmailKind(value: unknown): value is WaitlistEmailKind {
  return value === 'place_ready' || value === 'launch';
}

/** Both emails carry this line, so nobody wonders why they are hearing from us. */
export const THREE_EMAILS_LINE = 'This is one of the three emails you signed up for on the Intus waitlist.';

export const PLACE_READY_SUBJECT = 'Your place on Intus is ready';
export const LAUNCH_SUBJECT = 'The Intus app is live';

/** The settings each email needs, by the name the founder sets them under. place_ready never needs the store link. */
export const SETTINGS_FOR: Record<WaitlistEmailKind, readonly ('WAITLIST_TESTFLIGHT_URL' | 'WAITLIST_STORE_URL' | 'WAITLIST_POSTAL_ADDRESS')[]> = {
  place_ready: ['WAITLIST_TESTFLIGHT_URL', 'WAITLIST_POSTAL_ADDRESS'],
  launch: ['WAITLIST_STORE_URL', 'WAITLIST_POSTAL_ADDRESS'],
};

export interface WaitlistEmailSettings {
  testflightUrl?: string;
  storeUrl?: string;
  postalAddress?: string;
}

/** Where the person said they would use Intus most. Only iPhone can get in first; the others get a variant. */
export type WaitlistDevice = 'laptop' | 'iphone' | 'android';

// Any '<' or '>' at all: a pasted example such as "<plot no., street>" must never reach a real inbox.
const PLACEHOLDER = /[<>]|TBD|\bTBC\b|TODO|\bFIXME\b|XXX|\{\{|\}\}|\[\[|\]\]|placeholder|lorem ipsum|example\.com/i;

/** Empty, whitespace or a placeholder ("TBD", "XXX", "TODO", "{{...}}", any < or >, "example.com", "placeholder") all count as not set. */
export function settingProblem(value: string | undefined): 'missing' | 'placeholder' | null {
  if (value == null || value.trim() === '') return 'missing';
  if (PLACEHOLDER.test(value)) return 'placeholder';
  return null;
}

/** A link setting must pass the placeholder check, start with `prefix` (always https://...) and have more after it. */
function linkProblem(value: string | undefined, prefix: string): 'missing' | 'placeholder' | null {
  const problem = settingProblem(value);
  if (problem) return problem;
  const link = value!.trim();
  if (!link.startsWith(prefix) || link.length <= prefix.length || /\s/.test(link)) return 'placeholder';
  try {
    return new URL(link).protocol === 'https:' ? null : 'placeholder';
  } catch {
    return 'placeholder';
  }
}

export const TESTFLIGHT_PREFIX = 'https://testflight.apple.com/join/';
export const STORE_PREFIX = 'https://apps.apple.com/';

/** The names of every setting this email still needs. Empty means it can be written. */
export function missingSettings(kind: WaitlistEmailKind, settings: WaitlistEmailSettings): string[] {
  const value = {
    WAITLIST_TESTFLIGHT_URL: linkProblem(settings.testflightUrl, TESTFLIGHT_PREFIX),
    WAITLIST_STORE_URL: linkProblem(settings.storeUrl, STORE_PREFIX),
    WAITLIST_POSTAL_ADDRESS: settingProblem(settings.postalAddress),
  };
  return SETTINGS_FOR[kind].filter((name) => value[name] !== null);
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function assertReady(kind: WaitlistEmailKind, settings: WaitlistEmailSettings, unsubscribeUrl: string): void {
  const missing = missingSettings(kind, settings);
  if (missing.length > 0) throw new Error(`waitlist email settings missing: ${missing.join(', ')}`);
  if (!unsubscribeUrl.startsWith('https://')) throw new Error('waitlist email needs an unsubscribe link');
}

export interface WaitlistEmail {
  subject: string;
  text: string;
  html: string;
}

function footer(nextLine: string, unsubscribeUrl: string, postalAddress: string): { text: string[]; html: string[] } {
  const address = postalAddress.trim().replace(/\s*\r?\n\s*/g, ', ');
  return {
    text: ['', '--', `${THREE_EMAILS_LINE} ${nextLine}`, `Unsubscribe: ${unsubscribeUrl}`, `Intus, ${address}`],
    html: [
      '<hr>',
      `<p style="font-size:12px;color:#555">${escapeHtml(`${THREE_EMAILS_LINE} ${nextLine}`)}<br>`,
      `<a href="${escapeHtml(unsubscribeUrl)}">Unsubscribe</a><br>`,
      `Intus, ${escapeHtml(address)}</p>`,
    ],
  };
}

const ABOUT = "Intus keeps your daily log, bloodwork, sleep and supplements in one place. It flags values outside the lab's range. It does not diagnose anything.";

function testflightSteps(link: string): string[] {
  return [
    '1. Install the free TestFlight app from the App Store.',
    `2. Open this link on your iPhone: ${link}`,
    '3. Tap Install.',
    '4. Open Intus, then sign in or create an account.',
  ];
}

const DEVICE_WORDS: Record<Exclude<WaitlistDevice, 'iphone'>, string> = {
  android: 'Android',
  laptop: 'a laptop or desktop',
};

/** iPhone people get the steps. Android and laptop people are told iPhone is the first way in and the web is coming. */
export function placeReadyEmail(settings: WaitlistEmailSettings, unsubscribeUrl: string, device: WaitlistDevice = 'iphone'): WaitlistEmail {
  assertReady('place_ready', settings, unsubscribeUrl);
  const link = settings.testflightUrl!.trim();
  const steps = testflightSteps(link);
  const intro = device === 'iphone'
    ? ['Intus starts on iPhone. To get in:']
    : [
        `You told us you would use Intus most on ${DEVICE_WORDS[device]}. The iPhone app is the first way in. Intus on the web is coming, but it is not ready yet.`,
        '',
        'If you have an iPhone, you can get in now:',
      ];
  const end = footer('One more will follow, when the app ships.', unsubscribeUrl, settings.postalAddress!);
  const text = ['Your place on Intus is ready.', '', ...intro, ...steps, '', ABOUT, ...end.text].join('\n');
  const htmlSteps = [
    '<li>Install the free TestFlight app from the App Store.</li>',
    `<li>Open this link on your iPhone: <a href="${escapeHtml(link)}">${escapeHtml(link)}</a></li>`,
    '<li>Tap Install.</li>',
    '<li>Open Intus, then sign in or create an account.</li>',
  ];
  const html = [
    '<p>Your place on Intus is ready.</p>',
    ...intro.filter((line) => line !== '').map((line) => `<p>${escapeHtml(line)}</p>`),
    '<ol>',
    ...htmlSteps,
    '</ol>',
    `<p>${escapeHtml(ABOUT)}</p>`,
    ...end.html,
  ].join('\n');
  return { subject: PLACE_READY_SUBJECT, text, html };
}

export function launchEmail(settings: WaitlistEmailSettings, unsubscribeUrl: string): WaitlistEmail {
  assertReady('launch', settings, unsubscribeUrl);
  const store = settings.storeUrl!.trim();
  const end = footer('It is the last one: we will not email you about the waitlist again.', unsubscribeUrl, settings.postalAddress!);
  const text = [
    'The Intus app is live.',
    '',
    'Get it here:',
    store,
    '',
    ABOUT,
    ...end.text,
  ].join('\n');
  const html = [
    '<p>The Intus app is live.</p>',
    `<p><a href="${escapeHtml(store)}">Get Intus</a></p>`,
    `<p>${escapeHtml(ABOUT)}</p>`,
    ...end.html,
  ].join('\n');
  return { subject: LAUNCH_SUBJECT, text, html };
}

export function waitlistEmail(kind: WaitlistEmailKind, settings: WaitlistEmailSettings, unsubscribeUrl: string, device: WaitlistDevice = 'iphone'): WaitlistEmail {
  return kind === 'place_ready' ? placeReadyEmail(settings, unsubscribeUrl, device) : launchEmail(settings, unsubscribeUrl);
}

/** a***@gmail.com: enough to recognise a test address in a dry run, not enough to read someone's address. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at < 1) return '***';
  return `${email[0]}***${email.slice(at)}`;
}
