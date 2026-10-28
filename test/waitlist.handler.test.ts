import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHandler, createJoinLimiter, clientIpFrom, type Deps, type StoredWaitlist } from '../supabase/functions/join-waitlist/handler.ts';
import { CONFIRM_TOKEN_TTL_MS, sha256Hex, type Device } from '../src/features/home/waitlist.ts';
import { createMemoryRateLimit } from '../supabase/functions/join-waitlist/rateLimit.ts';

const TOKEN = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const NOW = Date.parse('2026-10-28T12:00:00.000Z');

interface Row extends StoredWaitlist {
  email: string;
  device: Device;
}

function setup(over: Partial<Deps> = {}) {
  const rows = new Map<string, Row>();
  const calls = { insert: 0, replace: 0, confirm: 0, logs: [] as string[] };
  let seq = 0;
  let now = NOW;
  const deps: Deps = {
    now: () => now,
    allowJoin: () => true,
    clientIp: clientIpFrom,
    newToken: () => TOKEN,
    log: (message) => { calls.logs.push(message); },
    findByEmail: async (email) => rows.get(email) ?? null,
    insert: async (row) => {
      calls.insert += 1;
      if (rows.has(row.email)) return 'exists';
      seq += 1;
      rows.set(row.email, {
        id: `row-${seq}`,
        email: row.email,
        device: row.device,
        status: 'pending',
        confirmTokenHash: row.confirmTokenHash,
        confirmTokenExpiresAt: row.confirmTokenExpiresAt,
      });
      return 'created';
    },
    replaceToken: async (id, hash, expiresAt, device) => {
      calls.replace += 1;
      for (const row of rows.values()) {
        if (row.id === id) {
          row.confirmTokenHash = hash;
          row.confirmTokenExpiresAt = expiresAt;
          row.device = device;
        }
      }
    },
    findByTokenHash: async (hash) => [...rows.values()].find((row) => row.confirmTokenHash === hash) ?? null,
    markConfirmed: async (id, confirmedAt) => {
      calls.confirm += 1;
      for (const row of rows.values()) {
        if (row.id === id) {
          row.status = 'confirmed';
          void confirmedAt;
        }
      }
    },
    ...over,
  };
  const handle = createHandler(deps);
  const post = (body: unknown, headers: Record<string, string> = {}) =>
    handle(new Request('https://fn.test/join-waitlist', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.8', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }));
  return { rows, calls, post, handle, setNow: (value: number) => { now = value; } };
}

const json = async (res: Response) => res.json() as Promise<Record<string, unknown>>;

test('a preflight is answered and anything but POST is refused', async () => {
  const { handle } = setup();
  const pre = await handle(new Request('https://fn.test/join-waitlist', { method: 'OPTIONS' }));
  assert.equal(pre.status, 204);
  assert.equal((await handle(new Request('https://fn.test/join-waitlist', { method: 'GET' }))).status, 405);
});

test('a valid join stores a hash and an expiry, never the raw token', async () => {
  const { post, rows } = setup();
  const res = await post({ email: '  Person@Example.com ', device: 'iphone', company: '' });
  assert.equal(res.status, 200);
  const body = await json(res);
  assert.deepEqual(body, { result: 'created' });
  assert.equal(JSON.stringify(body).includes(TOKEN), false);
  const row = rows.get('person@example.com');
  assert.ok(row);
  assert.equal(row.device, 'iphone');
  assert.equal(row.status, 'pending');
  assert.equal(row.confirmTokenHash, await sha256Hex(TOKEN));
  assert.equal(row.confirmTokenHash?.includes(TOKEN), false);
  assert.equal(Date.parse(row.confirmTokenExpiresAt ?? ''), NOW + CONFIRM_TOKEN_TTL_MS);
});

test('a second join while the link is live reports exists and does not replace the hash', async () => {
  const { post, rows, calls } = setup();
  await post({ email: 'person@example.com', device: 'laptop' });
  const first = rows.get('person@example.com')?.confirmTokenHash;
  const again = await post({ email: 'Person@Example.com', device: 'android' });
  assert.deepEqual(await json(again), { result: 'exists' });
  assert.equal(calls.insert, 1);
  assert.equal(calls.replace, 0);
  assert.equal(rows.get('person@example.com')?.confirmTokenHash, first);
  assert.equal(rows.get('person@example.com')?.device, 'laptop');
});

test('a pending row with a dead link gets a new hash and looks like a fresh join', async () => {
  let issued = 0;
  const tokens = [TOKEN, 'b'.repeat(43)];
  const { post, rows, calls, setNow } = setup({ newToken: () => tokens[issued++] ?? TOKEN });
  await post({ email: 'person@example.com', device: 'laptop' });
  const first = rows.get('person@example.com')?.confirmTokenHash;
  setNow(NOW + CONFIRM_TOKEN_TTL_MS + 1);
  const again = await post({ email: 'person@example.com', device: 'android' });
  const body = await json(again);
  assert.deepEqual(body, { result: 'created' });
  assert.equal(JSON.stringify(body).includes('b'.repeat(43)), false);
  assert.equal(calls.replace, 1);
  assert.equal(calls.insert, 1);
  assert.notEqual(rows.get('person@example.com')?.confirmTokenHash, first);
  assert.equal(rows.get('person@example.com')?.confirmTokenHash, await sha256Hex('b'.repeat(43)));
  assert.equal(rows.get('person@example.com')?.device, 'android');
});

test('a honeypot is a fake success and writes nothing', async () => {
  const { post, rows, calls } = setup();
  for (const company of ['Acme', { name: 'Acme' }]) {
    const res = await post({ email: 'bot@example.com', device: 'laptop', company });
    assert.equal(res.status, 200);
    assert.deepEqual(await json(res), { result: 'created' });
  }
  assert.equal(rows.size, 0);
  assert.equal(calls.insert, 0);
});

test('bad input is refused before a write', async () => {
  const { post, calls } = setup();
  const missing = await post({ email: '', device: 'laptop' });
  const broken = await post({ email: 'no-at-sign', device: 'laptop' });
  const device = await post({ email: 'a@b.co', device: 'phone' });
  const junk = await post('{');
  assert.equal((await json(missing)).error, 'invalid_email');
  assert.equal((await json(broken)).error, 'invalid_email');
  assert.equal((await json(device)).error, 'invalid_device');
  assert.equal(junk.status, 400);
  assert.equal(calls.insert, 0);
});

test('the sixth join from one address in ten minutes is refused, and a later one is allowed', async () => {
  const limiter = createJoinLimiter();
  let now = NOW;
  const { post, calls } = setup({
    now: () => now,
    allowJoin: (ip, at) => limiter.allow(ip, at),
  });
  for (let n = 0; n < 5; n += 1) {
    const res = await post({ email: `p${n}@example.com`, device: 'laptop' });
    assert.equal(res.status, 200, `attempt ${n}`);
  }
  const blocked = await post({ email: 'p6@example.com', device: 'laptop' });
  assert.equal(blocked.status, 429);
  assert.equal((await json(blocked)).error, 'rate_limited');
  assert.equal(calls.insert, 5);

  const other = await post({ email: 'other@example.com', device: 'laptop' }, { 'x-forwarded-for': '203.0.113.9' });
  assert.equal(other.status, 200);

  now = NOW + 10 * 60 * 1000;
  const later = await post({ email: 'later@example.com', device: 'android' });
  assert.equal(later.status, 200);
});

test('the rate limit is a sliding window of five in ten minutes', () => {
  const limit = createMemoryRateLimit(5, 10 * 60 * 1000);
  const start = NOW;
  for (let n = 0; n < 5; n += 1) assert.equal(limit.allow('ip', start + n), true);
  assert.equal(limit.allow('ip', start + 5), false);
  assert.equal(limit.allow('ip', start + 10 * 60 * 1000), true);
});

test('the client address is the first forwarded hop', () => {
  const req = new Request('https://fn.test/', { headers: { 'x-forwarded-for': ' 198.51.100.4, 10.0.0.1 ' } });
  assert.equal(clientIpFrom(req), '198.51.100.4');
  const cf = new Request('https://fn.test/', { headers: { 'cf-connecting-ip': '198.51.100.7', 'x-forwarded-for': '10.0.0.1' } });
  assert.equal(clientIpFrom(cf), '198.51.100.7');
  assert.equal(clientIpFrom(new Request('https://fn.test/')), 'unknown');
});

test('a live token confirms once, a repeat stays confirmed, and a dead or unknown token is expired', async () => {
  const { post, handle, rows, calls, setNow } = setup();
  await post({ email: 'person@example.com', device: 'laptop' });
  const confirm = (token: string) => handle(new Request('https://fn.test/join-waitlist', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'confirm', token }),
  }));

  const ok = await confirm(TOKEN);
  assert.deepEqual(await json(ok), { result: 'confirmed' });
  assert.equal(rows.get('person@example.com')?.status, 'confirmed');
  assert.equal(calls.confirm, 1);

  const again = await confirm(TOKEN);
  assert.deepEqual(await json(again), { result: 'confirmed' });
  assert.equal(calls.confirm, 1);

  const unknown = await confirm(`${'b'.repeat(43)}`);
  assert.deepEqual(await json(unknown), { result: 'expired' });
  const malformed = await confirm('nope');
  assert.deepEqual(await json(malformed), { result: 'expired' });

  setNow(NOW);
  rows.set('late@example.com', {
    id: 'late',
    email: 'late@example.com',
    device: 'android',
    status: 'pending',
    confirmTokenHash: await sha256Hex('c'.repeat(43)),
    confirmTokenExpiresAt: new Date(NOW - 1000).toISOString(),
  });
  const expired = await confirm('c'.repeat(43));
  assert.deepEqual(await json(expired), { result: 'expired' });
  assert.equal(rows.get('late@example.com')?.status, 'pending');
});

test('a database failure becomes an unavailable error and does not echo the address', async () => {
  const { post, calls } = setup({
    findByEmail: async () => { throw new Error('db down'); },
  });
  const res = await post({ email: 'person@example.com', device: 'laptop' });
  assert.equal(res.status, 500);
  const body = await json(res);
  assert.deepEqual(body, { error: 'unavailable' });
  assert.equal(JSON.stringify(body).includes('person@example.com'), false);
  assert.deepEqual(calls.logs, ['join failed']);
});
