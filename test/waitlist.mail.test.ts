import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHandler, clientIpFrom, type Deps, type StoredWaitlist } from '../supabase/functions/join-waitlist/handler.ts';
import { createSendConfirm, mailerSettingsFrom } from '../supabase/functions/join-waitlist/mailer.ts';
import { confirmEmail, confirmLink, CONFIRM_FROM } from '../supabase/functions/_shared/confirmEmail.ts';
import { PROMISE } from '../src/features/home/waitlist.ts';

const TOKEN = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const NOW = Date.parse('2026-10-29T12:00:00.000Z');

test('the function folder only imports from itself, _shared and packages, so Supabase can bundle it', () => {
  const dir = 'supabase/functions/join-waitlist';
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
    const source = readFileSync(join(dir, file), 'utf8');
    for (const match of source.matchAll(/from\s+'([^']+)'/g)) {
      const target = match[1];
      const ok = target.startsWith('./') || target.startsWith('../_shared/') || target.startsWith('npm:') || target.startsWith('jsr:');
      assert.ok(ok, `${file} imports ${target}, which Supabase does not bundle`);
    }
  }
});

test('the web page and the function read the same rules file', () => {
  const web = readFileSync('src/features/home/waitlist.ts', 'utf8');
  assert.match(web, /supabase\/functions\/_shared\/waitlistRules\.ts/);
});

test('the confirm email carries the link, the seven-day note and the three-email promise', () => {
  const mail = confirmEmail(TOKEN);
  assert.equal(confirmLink(TOKEN), `https://intus.fit/waitlist/confirmed?token=${TOKEN}`);
  assert.ok(mail.text.includes(confirmLink(TOKEN)));
  assert.match(mail.text, /7 days/);
  assert.match(mail.text, /If this was not you, ignore this email/);
  assert.ok(mail.text.includes(PROMISE));
  assert.ok(mail.html.includes(PROMISE));
  assert.equal(CONFIRM_FROM, 'Intus <marketing@mail.intus.fit>');
});

function fakeFetch(ok = true) {
  const sent: { url: string; body: Record<string, unknown>; auth: string | null }[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    sent.push({ url, body: JSON.parse(String(init.body)), auth: (init.headers as Record<string, string>).authorization });
    return { ok } as Response;
  }) as unknown as typeof fetch;
  return { fn, sent };
}

test('without a key nothing is sent', async () => {
  const f = fakeFetch();
  const send = createSendConfirm(mailerSettingsFrom(() => undefined, f.fn));
  assert.equal(await send('a@example.com', TOKEN), 'skipped');
  assert.equal(f.sent.length, 0);
});

test('before go-live only allowlisted addresses get mail', async () => {
  const f = fakeFetch();
  const env: Record<string, string> = { RESEND_API_KEY: 'key', WAITLIST_EMAIL_ALLOWLIST: 'Me+test@example.com, other@example.com' };
  const send = createSendConfirm(mailerSettingsFrom((n) => env[n], f.fn));
  assert.equal(await send('stranger@example.com', TOKEN), 'skipped');
  assert.equal(await send('me+test@example.com', TOKEN), 'sent');
  assert.equal(f.sent.length, 1);
  assert.equal(f.sent[0].url, 'https://api.resend.com/emails');
  assert.equal(f.sent[0].auth, 'Bearer key');
  assert.deepEqual(f.sent[0].body.to, ['me+test@example.com']);
  assert.equal(f.sent[0].body.from, CONFIRM_FROM);
});

test('with WAITLIST_EMAIL_LIVE=true everyone gets mail, and a Resend error throws', async () => {
  const good = fakeFetch();
  const env: Record<string, string> = { RESEND_API_KEY: 'key', WAITLIST_EMAIL_LIVE: 'true' };
  assert.equal(await createSendConfirm(mailerSettingsFrom((n) => env[n], good.fn))('anyone@example.com', TOKEN), 'sent');
  const bad = fakeFetch(false);
  await assert.rejects(createSendConfirm(mailerSettingsFrom((n) => env[n], bad.fn))('anyone@example.com', TOKEN));
});

function setup(sendConfirm?: Deps['sendConfirm']) {
  const rows = new Map<string, StoredWaitlist & { email: string }>();
  const logs: string[] = [];
  let seq = 0;
  const deps: Deps = {
    now: () => NOW,
    allowJoin: () => true,
    clientIp: clientIpFrom,
    newToken: () => TOKEN,
    log: (m) => { logs.push(m); },
    findByEmail: async (email) => rows.get(email) ?? null,
    insert: async (row) => {
      if (rows.has(row.email)) return 'exists';
      seq += 1;
      rows.set(row.email, { id: `r${seq}`, email: row.email, device: row.device, status: 'pending', confirmTokenHash: row.confirmTokenHash, confirmTokenExpiresAt: row.confirmTokenExpiresAt, confirmSentAt: row.confirmSentAt, tracksToday: null, answeredAt: null });
      return 'created';
    },
    replaceToken: async (id, hash, expiresAt, device, sentAt) => {
      for (const r of rows.values()) if (r.id === id) Object.assign(r, { confirmTokenHash: hash, confirmTokenExpiresAt: expiresAt, confirmSentAt: sentAt, device });
    },
    findByTokenHash: async () => null,
    markConfirmed: async () => {},
    saveAnswers: async () => {},
    sendConfirm,
  };
  const handle = createHandler(deps);
  const post = (body: unknown) => handle(new Request('https://fn.test/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
  return { post, rows, logs };
}

test('a join emails the raw token once, and the stored row keeps only the hash', async () => {
  const sent: [string, string][] = [];
  const t = setup(async (email, token) => { sent.push([email, token]); return 'sent'; });
  const res = await t.post({ action: 'join', email: 'Test@Example.com', device: 'iphone', company: '' });
  assert.deepEqual(await res.json(), { result: 'pending' });
  assert.deepEqual(sent, [['test@example.com', TOKEN]]);
  assert.doesNotMatch(JSON.stringify([...t.rows.values()]), new RegExp(TOKEN));
});

test('a second join while pending emails a fresh link, and a honeypot or bad email emails nothing', async () => {
  const sent: string[] = [];
  const t = setup(async (email) => { sent.push(email); return 'sent'; });
  await t.post({ action: 'join', email: 'a@example.com', device: 'laptop', company: '' });
  await t.post({ action: 'join', email: 'a@example.com', device: 'laptop', company: '' });
  await t.post({ action: 'join', email: 'bot@example.com', device: 'laptop', company: 'x' });
  await t.post({ action: 'join', email: 'not-an-email', device: 'laptop', company: '' });
  assert.deepEqual(sent, ['a@example.com', 'a@example.com']);
});

test('a mail failure is logged, not shown: the sign-up still succeeds', async () => {
  const t = setup(async () => { throw new Error('resend failed'); });
  const res = await t.post({ action: 'join', email: 'a@example.com', device: 'laptop', company: '' });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { result: 'pending' });
  assert.deepEqual(t.logs, ['confirm email failed']);
  assert.equal(t.rows.size, 1);
});
