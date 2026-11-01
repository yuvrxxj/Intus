import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  LAUNCH_SUBJECT,
  MARKETING_FROM,
  PLACE_READY_SUBJECT,
  THREE_EMAILS_LINE,
  launchEmail,
  maskEmail,
  missingSettings,
  placeReadyEmail,
  settingProblem,
  type WaitlistEmailSettings,
} from '../supabase/functions/_shared/waitlistEmails.ts';
import {
  constantTimeEqual,
  unsubscribeLink,
  unsubscribeToken,
  verifyUnsubscribeToken,
} from '../supabase/functions/_shared/waitlistUnsubscribe.ts';
import { postResend, RESEND_URL, resendUrlFrom, type OutgoingMail } from '../supabase/functions/_shared/resendMail.ts';
import { createHandler, clientIpFrom, type Deps } from '../supabase/functions/join-waitlist/handler.ts';
import { createSendHandler, MAX_LIMIT, SEND_DELAY_MS, type Recipient, type SendConfig, type SendDeps } from '../supabase/functions/send-waitlist-email/handler.ts';
import { interpretUnsubscribeResponse, unsubscribeParamsFrom, unsubscribePayload } from '../src/features/home/waitlist.ts';
import { routeFor, UNSUBSCRIBE_PATH } from '../src/features/home/route.ts';
import { isOneClickUnsubscribe, oneClickUnsubscribe } from '../src/features/home/unsubscribePost.ts';

// Made-up values only. None of these is a real address, link or secret.
const SECRET = 's'.repeat(40);
const ADMIN = 'a'.repeat(40);
const ID = '0b6f3b8e-1c2d-4e5f-8a9b-0c1d2e3f4a5b';
const OTHER_ID = '1b6f3b8e-1c2d-4e5f-8a9b-0c1d2e3f4a5b';
const SETTINGS: WaitlistEmailSettings = {
  testflightUrl: 'https://testflight.apple.com/join/AbCd1234',
  storeUrl: 'https://apps.apple.com/app/id0000000000',
  postalAddress: '1 Test Street\nTestville 00000',
};
const UNSUB = 'https://intus.fit/waitlist/unsubscribe?id=x&t=y';

test('both function folders only import from themselves, _shared and packages, so Supabase can bundle them', () => {
  for (const dir of ['supabase/functions/join-waitlist', 'supabase/functions/send-waitlist-email', 'supabase/functions/_shared']) {
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
      const source = readFileSync(join(dir, file), 'utf8');
      for (const match of source.matchAll(/from\s+'([^']+)'/g)) {
        const target = match[1];
        const ok = target.startsWith('./') || target.startsWith('../_shared/') || target.startsWith('npm:') || target.startsWith('jsr:');
        assert.ok(ok, `${dir}/${file} imports ${target}, which Supabase does not bundle`);
      }
    }
  }
});

test('CI type-checks both functions', () => {
  const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
  assert.match(ci, /deno check supabase\/functions\/join-waitlist\/index\.ts/);
  assert.match(ci, /deno check supabase\/functions\/send-waitlist-email\/index\.ts/);
});

// ── templates ──

test('the place-ready email: subject, TestFlight steps, the three-emails line, unsubscribe and address', () => {
  const mail = placeReadyEmail(SETTINGS, UNSUB);
  assert.equal(mail.subject, PLACE_READY_SUBJECT);
  for (const body of [mail.text, mail.html]) {
    assert.ok(body.includes(SETTINGS.testflightUrl!));
    assert.ok(body.includes(THREE_EMAILS_LINE));
    assert.match(body, /TestFlight app from the App Store/);
    assert.match(body, /Tap Install/);
    assert.match(body, /sign in or create an account/);
    assert.match(body, /does not diagnose anything/);
    assert.match(body, /1 Test Street, Testville 00000/);
  }
  assert.ok(mail.text.includes(`Unsubscribe: ${UNSUB}`));
  assert.ok(mail.html.includes(`href="${UNSUB.replaceAll('&', '&amp;')}"`));
  assert.match(mail.text, /One more will follow/);
  assert.doesNotMatch(mail.text, /web is coming/);
});

test('android and laptop people are told iPhone is first and the web is coming, with no extra email promised', () => {
  for (const device of ['android', 'laptop'] as const) {
    const mail = placeReadyEmail(SETTINGS, UNSUB, device);
    assert.match(mail.text, /The iPhone app is the first way in\. Intus on the web is coming/);
    assert.match(mail.text, device === 'android' ? /most on Android/ : /most on a laptop or desktop/);
    assert.ok(mail.text.includes(SETTINGS.testflightUrl!), 'the steps are still there for anyone with an iPhone');
    assert.ok(mail.text.includes(THREE_EMAILS_LINE));
    assert.doesNotMatch(mail.text, /email you again when|another email|fourth/i);
  }
});

test('the launch email: subject, store link, last-of-three line, unsubscribe and address', () => {
  const mail = launchEmail(SETTINGS, UNSUB);
  assert.equal(mail.subject, LAUNCH_SUBJECT);
  for (const body of [mail.text, mail.html]) {
    assert.ok(body.includes(SETTINGS.storeUrl!));
    assert.ok(body.includes(THREE_EMAILS_LINE));
    assert.match(body, /1 Test Street, Testville 00000/);
  }
  assert.match(mail.text, /last one/);
  assert.ok(mail.text.includes(`Unsubscribe: ${UNSUB}`));
});

test('no medical claims and no hype in either email', () => {
  for (const mail of [placeReadyEmail(SETTINGS, UNSUB), placeReadyEmail(SETTINGS, UNSUB, 'android'), launchEmail(SETTINGS, UNSUB)]) {
    assert.doesNotMatch(mail.text, /diagnos(is|e your)|treat|cure|advice|doctor|revolution|amazing|!/i);
  }
});

test('place_ready does not need the store link; launch does not need TestFlight', () => {
  assert.deepEqual(missingSettings('place_ready', { ...SETTINGS, storeUrl: 'TBD' }), []);
  assert.deepEqual(missingSettings('launch', { ...SETTINGS, testflightUrl: undefined }), []);
  assert.doesNotThrow(() => placeReadyEmail({ ...SETTINGS, storeUrl: undefined }, UNSUB));
});

test('a missing setting, or any placeholder, makes the template throw', () => {
  const bad = [
    undefined, '', '   ', 'TBD', 'tbd', 'Address TBD', 'XXX', 'xxx street', 'TODO', 'todo: fill in', '{{POSTAL_ADDRESS}}',
    '<plot no., street>', 'Street <3', '12 > 11 Road', 'see example.com', 'PLACEHOLDER', 'placeholder address',
  ];
  for (const value of bad) {
    assert.notEqual(settingProblem(value), null, String(value));
    assert.throws(() => placeReadyEmail({ ...SETTINGS, postalAddress: value }, UNSUB), /WAITLIST_POSTAL_ADDRESS/, String(value));
    assert.throws(() => launchEmail({ ...SETTINGS, postalAddress: value }, UNSUB), /WAITLIST_POSTAL_ADDRESS/, String(value));
  }
  assert.equal(settingProblem('1 Test Street, Testville'), null);
});

test('the TestFlight link must be https://testflight.apple.com/join/... and nothing else', () => {
  for (const value of [
    undefined, 'TBD', 'http://testflight.apple.com/join/AbCd1234', 'https://testflight.apple.com/join/', 'https://testflight.apple.com/AbCd1234',
    'https://evil.test/join/AbCd1234', 'testflight.apple.com/join/AbCd1234', 'https://testflight.apple.com/join/<code>', 'https://testflight.apple.com/join/XXX',
    'https://testflight.apple.com/join/Ab Cd',
  ]) {
    assert.deepEqual(missingSettings('place_ready', { ...SETTINGS, testflightUrl: value }), ['WAITLIST_TESTFLIGHT_URL'], String(value));
    assert.throws(() => placeReadyEmail({ ...SETTINGS, testflightUrl: value }, UNSUB), /WAITLIST_TESTFLIGHT_URL/);
  }
});

test('the store link must start with https:// on the App Store, and placeholders are refused', () => {
  for (const value of [undefined, 'TBD', 'http://apps.apple.com/app/id1', 'apps.apple.com/app/id1', 'https://apps.apple.com/', 'https://apps.apple.com/<id>', 'https://example.com/app', 'https://apps.apple.com/app/TODO']) {
    assert.deepEqual(missingSettings('launch', { ...SETTINGS, storeUrl: value }), ['WAITLIST_STORE_URL'], String(value));
    assert.throws(() => launchEmail({ ...SETTINGS, storeUrl: value }, UNSUB), /WAITLIST_STORE_URL/);
  }
});

test('a template without an https unsubscribe link throws', () => {
  assert.throws(() => placeReadyEmail(SETTINGS, ''), /unsubscribe/);
  assert.throws(() => launchEmail(SETTINGS, 'http://intus.fit/x'), /unsubscribe/);
});

test('masked addresses keep the first letter and the domain only', () => {
  assert.equal(maskEmail('alice@gmail.com'), 'a***@gmail.com');
  assert.equal(maskEmail('nope'), '***');
});

// ── unsubscribe token ──

test('the unsubscribe token verifies for its id and nothing else', async () => {
  const token = await unsubscribeToken(ID, SECRET);
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(await unsubscribeToken(ID.toUpperCase(), SECRET), token, 'case of the id does not matter');
  assert.equal(await verifyUnsubscribeToken(ID, token, SECRET), true);
  assert.equal(await verifyUnsubscribeToken(OTHER_ID, token, SECRET), false, 'wrong id');
  assert.equal(await verifyUnsubscribeToken(ID, token, 'another-secret-another-secret-another'), false, 'wrong secret');
  const tampered = (token[0] === 'A' ? 'B' : 'A') + token.slice(1);
  assert.equal(await verifyUnsubscribeToken(ID, tampered, SECRET), false, 'tampered');
  for (const bad of [undefined, '', 'short', `${token}x`, 42]) assert.equal(await verifyUnsubscribeToken(ID, bad, SECRET), false);
  assert.equal(await verifyUnsubscribeToken('not-a-uuid', token, SECRET), false);
  assert.equal(await verifyUnsubscribeToken(ID, token, undefined), false, 'no secret, no unsubscribe');
  assert.equal(unsubscribeLink(ID, token), `https://intus.fit/waitlist/unsubscribe?id=${ID}&t=${token}`);
});

test('the admin token comparison is exact', async () => {
  assert.equal(await constantTimeEqual(ADMIN, ADMIN), true);
  assert.equal(await constantTimeEqual(ADMIN, `${ADMIN}x`), false);
  assert.equal(await constantTimeEqual('', ADMIN), false);
});

// ── the unsubscribe action of join-waitlist ──

function joinHandler(over: Partial<Deps> = {}) {
  const marks: [string, string][] = [];
  const logs: string[] = [];
  const deps: Deps = {
    now: () => Date.parse('2026-11-01T12:00:00Z'),
    allowJoin: () => true,
    clientIp: clientIpFrom,
    newToken: () => 'b'.repeat(43),
    log: (m) => { logs.push(m); },
    findByEmail: async () => null,
    insert: async () => 'created',
    replaceToken: async () => {},
    findByTokenHash: async () => null,
    markConfirmed: async () => {},
    saveAnswers: async () => {},
    unsubscribeSecret: SECRET,
    markUnsubscribed: async (id, at) => { marks.push([id, at]); },
    ...over,
  };
  const handle = createHandler(deps);
  const post = async (body: unknown) => {
    const res = await handle(new Request('https://fn.test/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
    return { status: res.status, body: await res.json() };
  };
  return { post, marks, logs };
}

test('a good unsubscribe link unsubscribes, and opening it again says the same', async () => {
  const t = joinHandler();
  const token = await unsubscribeToken(ID, SECRET);
  assert.deepEqual((await t.post({ action: 'unsubscribe', id: ID, t: token })).body, { result: 'unsubscribed' });
  assert.deepEqual((await t.post({ action: 'unsubscribe', id: ID.toUpperCase(), t: token })).body, { result: 'unsubscribed' });
  assert.deepEqual(t.marks.map(([id]) => id), [ID, ID]);
  assert.deepEqual(t.logs, []);
});

test('a bad unsubscribe link answers invalid and writes nothing', async () => {
  const t = joinHandler();
  const token = await unsubscribeToken(ID, SECRET);
  for (const body of [{ id: OTHER_ID, t: token }, { id: ID, t: 'x'.repeat(43) }, { id: ID }, { t: token }, { id: 'nope', t: token }]) {
    assert.deepEqual((await t.post({ action: 'unsubscribe', ...body })).body, { result: 'invalid' });
  }
  assert.equal(t.marks.length, 0);
});

test('unsubscribe is unavailable without the secret, and a database error is not shown', async () => {
  const token = await unsubscribeToken(ID, SECRET);
  const unset = joinHandler({ unsubscribeSecret: undefined });
  assert.equal((await unset.post({ action: 'unsubscribe', id: ID, t: token })).status, 500);
  assert.equal(unset.marks.length, 0);
  const broken = joinHandler({ markUnsubscribed: async () => { throw new Error('db'); } });
  const res = await broken.post({ action: 'unsubscribe', id: ID, t: token });
  assert.deepEqual([res.status, res.body], [500, { error: 'unavailable' }]);
  assert.deepEqual(broken.logs, ['unsubscribe failed']);
});

// ── the web page and the one-click POST ──

test('the unsubscribe page has its own route and reads the link', async () => {
  assert.equal(routeFor(UNSUBSCRIBE_PATH), 'unsubscribe');
  assert.equal(routeFor(`${UNSUBSCRIBE_PATH}/`), 'unsubscribe');
  const token = await unsubscribeToken(ID, SECRET);
  assert.deepEqual(unsubscribeParamsFrom(`?id=${ID}&t=${token}`), { id: ID, t: token });
  assert.equal(unsubscribeParamsFrom(`?id=${ID}`), null);
  assert.equal(unsubscribeParamsFrom(`?id=x&t=${token}`), null);
  assert.deepEqual(unsubscribePayload(ID, token), { action: 'unsubscribe', id: ID, t: token });
  assert.equal(interpretUnsubscribeResponse(200, { result: 'unsubscribed' }), 'unsubscribed');
  assert.equal(interpretUnsubscribeResponse(200, { result: 'invalid' }), 'invalid');
  assert.equal(interpretUnsubscribeResponse(500, { error: 'unavailable' }), 'error');
  assert.equal(interpretUnsubscribeResponse(0, null), 'error');
});

test('a mail app one-click POST is forwarded to the function; a GET is not', async () => {
  assert.equal(isOneClickUnsubscribe('POST', UNSUBSCRIBE_PATH), true);
  assert.equal(isOneClickUnsubscribe('GET', UNSUBSCRIBE_PATH), false);
  assert.equal(isOneClickUnsubscribe('POST', '/signin'), false);
  const token = await unsubscribeToken(ID, SECRET);
  const calls: { url: string; body: unknown }[] = [];
  const fake = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)) });
    return new Response(JSON.stringify({ result: 'unsubscribed' }), { status: 200 });
  }) as unknown as typeof fetch;
  const res = await oneClickUnsubscribe(`https://intus.fit${UNSUBSCRIBE_PATH}?id=${ID}&t=${token}`, fake, 'https://project.test');
  assert.equal(res.status, 200);
  assert.deepEqual(calls, [{ url: 'https://project.test/functions/v1/join-waitlist', body: { action: 'unsubscribe', id: ID, t: token } }]);
  const bad = await oneClickUnsubscribe(`https://intus.fit${UNSUBSCRIBE_PATH}?id=${ID}`, fake, 'https://project.test');
  assert.equal(bad.status, 400);
  assert.equal(calls.length, 1, 'a malformed link is refused without a request');
  const down = await oneClickUnsubscribe(`https://intus.fit${UNSUBSCRIBE_PATH}?id=${ID}&t=${token}`, (async () => { throw new Error('down'); }) as unknown as typeof fetch, 'https://project.test');
  assert.equal(down.status, 503);
});

test('the Resend call carries the unsubscribe headers and the idempotency key, and an error hides the reply', async () => {
  const seen: { headers: Record<string, string>; body: Record<string, unknown> }[] = [];
  const fake = (ok: boolean) => (async (_url: string, init: RequestInit) => {
    seen.push({ headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) });
    return { ok } as Response;
  }) as unknown as typeof fetch;
  const mail: OutgoingMail = { from: MARKETING_FROM, to: 'x@test.invalid', subject: 's', text: 't', html: 'h', headers: { 'List-Unsubscribe': '<https://intus.fit/u>' }, idempotencyKey: 'k1' };
  await postResend(fake(true), 'key', mail);
  assert.equal(seen[0].headers['idempotency-key'], 'k1');
  assert.deepEqual(seen[0].body.headers, { 'List-Unsubscribe': '<https://intus.fit/u>' });
  await assert.rejects(postResend(fake(false), 'key', mail), (e: Error) => e.message === 'resend failed');
});

test('mail goes to Resend unless a local test run points it at this machine', async () => {
  const env = (value?: string) => (name: string) => (name === 'RESEND_API_URL' ? value : undefined);
  assert.equal(resendUrlFrom(env()), RESEND_URL);
  assert.equal(RESEND_URL, 'https://api.resend.com/emails');
  assert.equal(resendUrlFrom(env('  ')), RESEND_URL);
  assert.equal(resendUrlFrom(env('http://host.docker.internal:8787/emails')), 'http://host.docker.internal:8787/emails');
  assert.equal(resendUrlFrom(env('http://127.0.0.1:8787/emails')), 'http://127.0.0.1:8787/emails');
  // plain http anywhere else is ignored, so a typo can never send mail unencrypted to another host
  assert.equal(resendUrlFrom(env('http://example.org/emails')), RESEND_URL);
  assert.equal(resendUrlFrom(env('http://localhost.example.org/emails')), RESEND_URL);
  const urls: string[] = [];
  const fake = (async (url: string) => { urls.push(url); return { ok: true } as Response; }) as unknown as typeof fetch;
  const mail: OutgoingMail = { from: MARKETING_FROM, to: 'x@test.invalid', subject: 's', text: 't', html: 'h' };
  await postResend(fake, 'key', mail);
  await postResend(fake, 'key', mail, 'http://127.0.0.1:8787/emails');
  assert.deepEqual(urls, [RESEND_URL, 'http://127.0.0.1:8787/emails']);
});

// ── send-waitlist-email ──

interface World {
  people: (Recipient & { status: 'pending' | 'confirmed'; unsubscribed: boolean })[];
  sentRows: Set<string>;
  mails: OutgoingMail[];
  events: string[];
  logs: string[];
  sleeps: number[];
}

function sender(over: Partial<SendConfig> = {}, behave: { failFor?: string[]; preclaimed?: string[]; staleList?: boolean } = {}) {
  const world: World = {
    people: [
      { id: ID, email: 'third@test.invalid', device: 'iphone', place: 3, status: 'confirmed', unsubscribed: false },
      { id: OTHER_ID, email: 'first@test.invalid', device: 'android', place: 1, status: 'confirmed', unsubscribed: false },
      { id: '2b6f3b8e-1c2d-4e5f-8a9b-0c1d2e3f4a5b', email: 'second@test.invalid', device: 'laptop', place: 2, status: 'confirmed', unsubscribed: false },
      { id: '3b6f3b8e-1c2d-4e5f-8a9b-0c1d2e3f4a5b', email: 'pending@test.invalid', device: 'iphone', place: 0, status: 'pending', unsubscribed: false },
      { id: '4b6f3b8e-1c2d-4e5f-8a9b-0c1d2e3f4a5b', email: 'left@test.invalid', device: 'iphone', place: 4, status: 'confirmed', unsubscribed: true },
    ],
    sentRows: new Set(behave.preclaimed ?? []),
    mails: [],
    events: [],
    logs: [],
    sleeps: [],
  };
  // The fake does what the SQL functions do: confirmed, not unsubscribed, not yet sent, in place order.
  const due = (kind: string, only: string[] | null, stale = false) => world.people
    .filter((p) => p.status === 'confirmed' && !p.unsubscribed && (stale || !world.sentRows.has(`${p.id}:${kind}`)) && (only === null || only.includes(p.email)))
    .sort((a, b) => a.place - b.place);
  const config: SendConfig = {
    adminToken: ADMIN,
    apiKey: 'test-key',
    unsubscribeSecret: SECRET,
    live: false,
    allowlist: ['first@test.invalid', 'third@test.invalid', 'pending@test.invalid', 'left@test.invalid'],
    ...SETTINGS,
    ...over,
  };
  const deps: SendDeps = {
    config,
    countCandidates: async (kind, only) => due(kind, only).length,
    listRecipients: async (kind, limit, only) => due(kind, only, behave.staleList).slice(0, limit).map(({ id, email, device, place }) => ({ id, email, device, place })),
    claim: async (id, kind) => {
      world.events.push(`claim ${id}`);
      if (world.sentRows.has(`${id}:${kind}`)) return false;
      world.sentRows.add(`${id}:${kind}`);
      return true;
    },
    release: async (id, kind) => {
      world.events.push(`release ${id}`);
      world.sentRows.delete(`${id}:${kind}`);
    },
    send: async (mail) => {
      const row = world.people.find((p) => p.email === mail.to)!;
      world.events.push(`send ${row.id} (recorded: ${world.sentRows.has(`${row.id}:place_ready`) || world.sentRows.has(`${row.id}:launch`)})`);
      if (behave.failFor?.includes(mail.to)) throw new Error('resend failed');
      world.mails.push(mail);
    },
    sleep: async (ms) => { world.sleeps.push(ms); },
    log: (m) => { world.logs.push(m); },
  };
  const handle = createSendHandler(deps);
  const call = async (body: unknown, token: string | null = ADMIN) => {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (token !== null) headers['x-admin-token'] = token;
    const res = await handle(new Request('https://fn.test/', { method: 'POST', headers, body: JSON.stringify(body) }));
    return { status: res.status, body: await res.json() as Record<string, unknown> };
  };
  return { call, world };
}

test('the admin token is required, and an unset or short token refuses everything', async () => {
  const s = sender();
  assert.equal((await s.call({ kind: 'place_ready' }, null)).status, 401);
  assert.equal((await s.call({ kind: 'place_ready' }, 'wrong')).status, 401);
  assert.equal((await s.call({ kind: 'place_ready' }, `${ADMIN}x`)).status, 401);
  for (const adminToken of [undefined, '', 'short']) {
    const off = sender({ adminToken });
    assert.equal((await off.call({ kind: 'place_ready', dryRun: false }, adminToken ?? '')).status, 503);
    assert.equal(off.world.events.length, 0);
  }
  assert.equal(s.world.events.length + s.world.mails.length, 0);
});

test('bad bodies are refused', async () => {
  const s = sender();
  for (const body of [{}, { kind: 'confirm' }, { kind: 'launch', limit: 0 }, { kind: 'launch', limit: MAX_LIMIT + 1 }, { kind: 'launch', limit: 1.5 }, { kind: 'launch', order: 'email' }, { kind: 'launch', dryRun: 'no' }]) {
    assert.equal((await s.call(body)).status, 400, JSON.stringify(body));
  }
});

test('a dry run is the default: it counts and previews, and sends and writes nothing', async () => {
  const s = sender();
  const res = await s.call({ kind: 'place_ready' });
  assert.equal(res.status, 200);
  assert.equal(res.body.dryRun, true);
  assert.equal(res.body.eligible, 2, 'first and third are allowlisted and due; pending and unsubscribed are not');
  assert.equal(res.body.skipped, 1, 'second is due but not on the allowlist');
  assert.equal(res.body.wouldSend, 2);
  assert.equal(res.body.sent, 0);
  assert.deepEqual(res.body.sample, [{ place: 1, email: 'f***@test.invalid', device: 'android' }, { place: 3, email: 't***@test.invalid', device: 'iphone' }]);
  assert.deepEqual(res.body.missingSettings, []);
  assert.equal((res.body.preview as { subject: string }).subject, PLACE_READY_SUBJECT);
  assert.equal(s.world.mails.length, 0);
  assert.equal(s.world.events.length, 0);
  assert.equal(s.world.sentRows.size, 0);
  assert.equal((await s.call({ kind: 'place_ready', dryRun: true })).body.dryRun, true);
});

test('a dry run lists what is missing; a real run with anything missing is refused before any work', async () => {
  const s = sender({ storeUrl: 'TBD', postalAddress: '<plot no., street>', unsubscribeSecret: undefined });
  const dry = await s.call({ kind: 'launch' });
  assert.deepEqual(dry.body.missingSettings, ['WAITLIST_STORE_URL', 'WAITLIST_POSTAL_ADDRESS', 'WAITLIST_UNSUBSCRIBE_SECRET']);
  assert.equal(dry.body.preview, undefined);
  const real = await s.call({ kind: 'launch', dryRun: false });
  assert.equal(real.status, 409);
  assert.deepEqual(real.body, { error: 'settings_missing', missing: ['WAITLIST_STORE_URL', 'WAITLIST_POSTAL_ADDRESS', 'WAITLIST_UNSUBSCRIBE_SECRET'] });
  const noKey = await sender({ apiKey: undefined }).call({ kind: 'place_ready', dryRun: false });
  assert.deepEqual(noKey.body, { error: 'settings_missing', missing: ['RESEND_API_KEY'] });
  assert.equal(s.world.events.length + s.world.mails.length, 0);
});

test('the launch email is refused while the store link is still a placeholder, but place_ready goes', async () => {
  const s = sender({ storeUrl: 'TBD' });
  assert.equal((await s.call({ kind: 'launch', dryRun: false })).status, 409);
  assert.equal((await s.call({ kind: 'place_ready', dryRun: false })).body.sent, 2);
});

test('a real run mails only allowlisted, confirmed, subscribed people, in place order, recording each send first', async () => {
  const s = sender();
  const res = await s.call({ kind: 'place_ready', dryRun: false });
  assert.deepEqual(
    { eligible: res.body.eligible, sent: res.body.sent, skipped: res.body.skipped, failed: res.body.failed, dryRun: res.body.dryRun, kind: res.body.kind },
    { eligible: 2, sent: 2, skipped: 1, failed: 0, dryRun: false, kind: 'place_ready' },
  );
  assert.deepEqual(s.world.mails.map((m) => m.to), ['first@test.invalid', 'third@test.invalid'], 'place 1 first; second is not allowlisted; pending and unsubscribed never');
  assert.deepEqual(s.world.events, [`claim ${OTHER_ID}`, `send ${OTHER_ID} (recorded: true)`, `claim ${ID}`, `send ${ID} (recorded: true)`]);
  assert.deepEqual(s.world.sleeps, [SEND_DELAY_MS], 'a pause between sends, none after the last');
  const first = s.world.mails[0];
  assert.equal(first.from, 'Intus <marketing@mail.intus.fit>');
  assert.match(first.text, /web is coming/, 'the android person gets the android wording');
  assert.doesNotMatch(s.world.mails[1].text, /web is coming/);
  const link = unsubscribeLink(OTHER_ID, await unsubscribeToken(OTHER_ID, SECRET));
  assert.ok(first.text.includes(link));
  assert.deepEqual(first.headers, { 'List-Unsubscribe': `<${link}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' });
  assert.equal(first.idempotencyKey, `waitlist-place_ready-${OTHER_ID}`);
});

test('a second run sends nothing new: everyone already sent is skipped', async () => {
  const s = sender();
  await s.call({ kind: 'place_ready', dryRun: false });
  const again = await s.call({ kind: 'place_ready', dryRun: false });
  assert.equal(again.body.sent, 0);
  assert.equal(s.world.mails.length, 2);
});

test('someone recorded by a parallel run after the list was read is skipped, not mailed', async () => {
  const s = sender({}, { preclaimed: [`${OTHER_ID}:place_ready`], staleList: true });
  const res = await s.call({ kind: 'place_ready', dryRun: false });
  assert.equal(res.body.sent, 1);
  assert.deepEqual(s.world.mails.map((m) => m.to), ['third@test.invalid']);
  assert.ok(s.world.events.includes(`claim ${OTHER_ID}`));
  assert.ok(!s.world.events.some((e) => e.startsWith(`send ${OTHER_ID}`)));
});

test('a failed send removes its record so it can be retried, and is counted', async () => {
  const s = sender({}, { failFor: ['first@test.invalid'] });
  const res = await s.call({ kind: 'place_ready', dryRun: false });
  assert.deepEqual([res.body.sent, res.body.failed], [1, 1]);
  assert.deepEqual(s.world.events.slice(0, 3), [`claim ${OTHER_ID}`, `send ${OTHER_ID} (recorded: true)`, `release ${OTHER_ID}`]);
  assert.equal(s.world.sentRows.has(`${OTHER_ID}:place_ready`), false);
  assert.equal(s.world.sentRows.has(`${ID}:place_ready`), true);
});

test('three failures in a row stop the run', async () => {
  const s = sender({ live: true }, { failFor: ['first@test.invalid', 'second@test.invalid', 'third@test.invalid'] });
  s.world.people.push({ id: '5b6f3b8e-1c2d-4e5f-8a9b-0c1d2e3f4a5b', email: 'fifth@test.invalid', device: 'iphone', place: 5, status: 'confirmed', unsubscribed: false });
  const res = await s.call({ kind: 'launch', dryRun: false });
  assert.deepEqual([res.body.sent, res.body.failed, res.body.stopped], [0, 3, true]);
  assert.equal(s.world.events.some((e) => e.includes('5b6f3b8e')), false);
});

test('once live, everyone due is eligible and nobody is skipped for the allowlist', async () => {
  const s = sender({ live: true, allowlist: [] });
  const res = await s.call({ kind: 'launch', dryRun: false, limit: 2 });
  assert.deepEqual([res.body.eligible, res.body.sent, res.body.skipped], [3, 2, 0]);
  assert.deepEqual(s.world.mails.map((m) => m.to), ['first@test.invalid', 'second@test.invalid']);
});

test('before go-live with an empty allowlist nothing is eligible and nothing is sent', async () => {
  const s = sender({ allowlist: [] });
  const res = await s.call({ kind: 'launch', dryRun: false });
  assert.deepEqual([res.body.eligible, res.body.sent, res.body.skipped], [0, 0, 3]);
  assert.equal(s.world.events.length, 0);
});

test('no email address, token or secret is ever logged', async () => {
  const s = sender({ live: true }, { failFor: ['second@test.invalid'] });
  await s.call({ kind: 'place_ready', dryRun: false });
  await s.call({ kind: 'place_ready' });
  await s.call({ kind: 'place_ready' }, 'wrong');
  const logs = s.world.logs.join('\n');
  assert.ok(s.world.logs.length > 0);
  assert.doesNotMatch(logs, /@|test\.invalid/);
  assert.ok(!logs.includes(SECRET) && !logs.includes(ADMIN) && !logs.includes(await unsubscribeToken(ID, SECRET)));
});
