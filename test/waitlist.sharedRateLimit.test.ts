import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHandler, clientIpFrom, type Deps, type StoredWaitlist } from '../supabase/functions/join-waitlist/handler.ts';
import { createSharedAllowJoin } from '../supabase/functions/join-waitlist/sharedRateLimit.ts';
import { createMemoryRateLimit } from '../supabase/functions/join-waitlist/rateLimit.ts';
import { JOIN_RATE_LIMIT, JOIN_RATE_WINDOW_MS, sha256Hex } from '../src/features/home/waitlist.ts';

const TOKEN = 'd'.repeat(43);
const NOW = Date.parse('2026-11-01T12:00:00.000Z');

/** A stand-in for waitlist_allow_join: one shared counter, like the database. */
function fakeStore() {
  const seen = new Map<string, number>();
  const calls: string[] = [];
  return {
    calls,
    check: async (keyHash: string) => {
      calls.push(keyHash);
      const n = (seen.get(keyHash) ?? 0) + 1;
      if (n > JOIN_RATE_LIMIT) return false;
      seen.set(keyHash, n);
      return true;
    },
  };
}

test('the limit comes from the one shared rules file: five joins in ten minutes', () => {
  assert.equal(JOIN_RATE_LIMIT, 5);
  assert.equal(JOIN_RATE_WINDOW_MS, 10 * 60 * 1000);
});

test('the shared limiter hashes the address before it reaches the store, and the sixth call is refused', async () => {
  const store = fakeStore();
  const logs: string[] = [];
  const allow = createSharedAllowJoin({
    hashKey: (ip) => sha256Hex(`salt:${ip}`),
    check: store.check,
    fallback: createMemoryRateLimit(JOIN_RATE_LIMIT, JOIN_RATE_WINDOW_MS),
    log: (m) => { logs.push(m); },
  });
  const results: boolean[] = [];
  for (let i = 0; i < 7; i++) results.push(await allow('203.0.113.8', NOW + i));
  assert.deepEqual(results, [true, true, true, true, true, false, false]);
  assert.equal(new Set(store.calls).size, 1);
  assert.match(store.calls[0], /^[0-9a-f]{64}$/);
  assert.ok(!store.calls[0].includes('203'), 'the raw address never reaches the store');
  assert.deepEqual(logs, []);
  assert.equal(await allow('198.51.100.1', NOW), true, 'another address has its own count');
});

test('two instances share one count because the count is not kept in either of them', async () => {
  const store = fakeStore();
  const make = () => createSharedAllowJoin({
    hashKey: (ip) => sha256Hex(ip),
    check: store.check,
    fallback: createMemoryRateLimit(JOIN_RATE_LIMIT, JOIN_RATE_WINDOW_MS),
    log: () => {},
  });
  const a = make();
  const b = make();
  const results: boolean[] = [];
  for (let i = 0; i < 8; i++) results.push(await (i % 2 ? a : b)('203.0.113.8', NOW));
  assert.equal(results.filter(Boolean).length, 5, 'alternating between two instances still stops at five');
});

test('when the database call fails, the in-memory limit answers and the failure is logged', async () => {
  const logs: string[] = [];
  const allow = createSharedAllowJoin({
    hashKey: (ip) => sha256Hex(ip),
    check: async () => { throw new Error('down'); },
    fallback: createMemoryRateLimit(JOIN_RATE_LIMIT, JOIN_RATE_WINDOW_MS),
    log: (m) => { logs.push(m); },
  });
  const results: boolean[] = [];
  for (let i = 0; i < 6; i++) results.push(await allow('203.0.113.8', NOW + i));
  assert.deepEqual(results, [true, true, true, true, true, false], 'people can still join, and the memory limit still applies');
  assert.equal(logs.length, 6);
  assert.match(logs[0], /in-memory/);
});

test('a failing hash step also falls back instead of failing the request', async () => {
  const allow = createSharedAllowJoin({
    hashKey: async () => { throw new Error('crypto'); },
    check: async () => true,
    fallback: createMemoryRateLimit(1, JOIN_RATE_WINDOW_MS),
    log: () => {},
  });
  assert.equal(await allow('203.0.113.8', NOW), true);
  assert.equal(await allow('203.0.113.8', NOW), false);
});

function setup(allowJoin: Deps['allowJoin']) {
  const rows = new Map<string, StoredWaitlist & { email: string }>();
  let seq = 0;
  const deps: Deps = {
    now: () => NOW,
    allowJoin,
    clientIp: clientIpFrom,
    newToken: () => TOKEN,
    log: () => {},
    findByEmail: async (email) => rows.get(email) ?? null,
    insert: async (row) => {
      if (rows.has(row.email)) return 'exists';
      seq += 1;
      rows.set(row.email, { id: `r${seq}`, email: row.email, device: row.device, status: 'pending', confirmTokenHash: row.confirmTokenHash, confirmTokenExpiresAt: row.confirmTokenExpiresAt, confirmSentAt: row.confirmSentAt, tracksToday: null, answeredAt: null });
      return 'created';
    },
    replaceToken: async () => {},
    findByTokenHash: async () => null,
    markConfirmed: async () => {},
    saveAnswers: async () => {},
  };
  const handle = createHandler(deps);
  const post = (body: unknown) => handle(new Request('https://fn.test/', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.8' }, body: JSON.stringify(body) }));
  return { post, rows };
}

test('the handler waits for an async limiter: joins and resends are both counted and the sixth is a 429', async () => {
  const store = fakeStore();
  const allow = createSharedAllowJoin({ hashKey: (ip) => sha256Hex(ip), check: store.check, fallback: createMemoryRateLimit(JOIN_RATE_LIMIT, JOIN_RATE_WINDOW_MS), log: () => {} });
  const t = setup(allow);
  const join = () => t.post({ action: 'join', email: 'a@example.com', device: 'laptop', company: '' });
  const resend = () => t.post({ action: 'resend', email: 'a@example.com' });
  const statuses: number[] = [];
  statuses.push((await join()).status, (await resend()).status, (await join()).status, (await resend()).status, (await join()).status);
  assert.deepEqual(statuses, [200, 200, 200, 200, 200]);
  const sixth = await join();
  assert.equal(sixth.status, 429);
  assert.deepEqual(await sixth.json(), { error: 'rate_limited' });
  assert.equal((await resend()).status, 429, 'resend shares the same count');
  assert.equal(t.rows.size, 1);
});

test('a refused join writes nothing', async () => {
  const t = setup(async () => false);
  const res = await t.post({ action: 'join', email: 'new@example.com', device: 'laptop', company: '' });
  assert.equal(res.status, 429);
  assert.equal(t.rows.size, 0);
});
