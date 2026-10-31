import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

// The shared join limit (INT-152): five per ten minutes per key, counted in the database so every function instance
// sees the same count. Only the service role can reach it.

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const DIR = process.env.MIGRATIONS_DIR ?? '../migrations';
const MIGRATION = read(`${DIR}/20261101000100_waitlist_rate_limit.sql`);

const KEY_A = 'a'.repeat(64);
const KEY_B = 'b'.repeat(64);
const T0 = '2026-11-01T12:00:00Z';

async function database() {
  const db = new PGlite();
  await db.exec(read('./fixtures/supabase-stub.sql'));
  await db.exec(MIGRATION);
  return db;
}

/** One call to the limiter. `at` moves the clock; production never passes it. */
async function allow(db, key, at = T0) {
  const res = await db.query('select public.waitlist_allow_join($1, 5, 600, $2::timestamptz) as ok', [key, at]);
  return res.rows[0].ok;
}

const count = async (db) => (await db.query('select count(*)::int as n from public.waitlist_attempts')).rows[0].n;

test('the sixth attempt inside ten minutes is refused, and a refusal is not recorded', async () => {
  const db = await database();
  for (let i = 0; i < 5; i++) assert.equal(await allow(db, KEY_A), true, `attempt ${i + 1}`);
  assert.equal(await allow(db, KEY_A), false);
  assert.equal(await allow(db, KEY_A), false);
  assert.equal(await count(db), 5, 'refused attempts leave no row, so they do not extend the lockout');
});

test('the window slides: a slot frees ten minutes after the attempt that took it', async () => {
  const db = await database();
  const at = (minutes) => new Date(Date.parse(T0) + minutes * 60_000).toISOString();
  for (let i = 0; i < 5; i++) assert.equal(await allow(db, KEY_A, at(i)), true);
  assert.equal(await allow(db, KEY_A, at(5)), false);
  assert.equal(await allow(db, KEY_A, at(9.9)), false, 'the first attempt is still inside the window');
  assert.equal(await allow(db, KEY_A, at(10)), true, 'the first attempt (minute 0) has aged out');
  assert.equal(await allow(db, KEY_A, at(10.5)), false, 'minutes 1 to 4 and the new one still fill it');
  assert.equal(await allow(db, KEY_A, at(11)), true, 'minute 1 aged out');
  assert.equal(await allow(db, KEY_A, at(40)), true, 'a long quiet spell clears everything');
});

test('keys are counted separately', async () => {
  const db = await database();
  for (let i = 0; i < 5; i++) await allow(db, KEY_A);
  assert.equal(await allow(db, KEY_A), false);
  assert.equal(await allow(db, KEY_B), true);
});

test('old rows are deleted on each call, for every key', async () => {
  const db = await database();
  await allow(db, KEY_A, '2026-11-01T10:00:00Z');
  await allow(db, KEY_B, '2026-11-01T10:01:00Z');
  assert.equal(await count(db), 2);
  await allow(db, KEY_A, T0);
  assert.equal(await count(db), 1, 'both old rows are gone; only the new one remains');
});

test('two calls at the same instant cannot both take the last slot', async () => {
  const db = await database();
  for (let i = 0; i < 4; i++) await allow(db, KEY_A);
  const results = await Promise.all([allow(db, KEY_A), allow(db, KEY_A), allow(db, KEY_A)]);
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(await count(db), 5);
});

test('bad arguments are refused', async () => {
  const db = await database();
  await assert.rejects(() => db.query(`select public.waitlist_allow_join('1.2.3.4', 5, 600)`), /bad arguments/, 'a raw address is not a hash');
  await assert.rejects(() => db.query(`select public.waitlist_allow_join('${KEY_A}', 0, 600)`), /bad arguments/);
  await assert.rejects(() => db.query(`select public.waitlist_allow_join('${KEY_A}', 5, 0)`), /bad arguments/);
  await assert.rejects(() => db.query(`insert into public.waitlist_attempts (key_hash) values ('203.0.113.8')`), /check/);
});

test('the API roles cannot read the table or call the function; the service role can', async () => {
  const db = await database();
  await allow(db, KEY_A);
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role}`);
    try {
      await assert.rejects(() => db.query('select * from public.waitlist_attempts'), /permission denied/);
      await assert.rejects(() => db.query(`insert into public.waitlist_attempts (key_hash) values ('${KEY_B}')`), /permission denied/);
      await assert.rejects(() => db.query(`select public.waitlist_allow_join('${KEY_B}', 5, 600)`), /permission denied/);
    } finally {
      await db.exec('reset role');
    }
  }
  await db.exec('set role service_role');
  try {
    assert.equal((await db.query(`select public.waitlist_allow_join('${KEY_B}', 5, 600) as ok`)).rows[0].ok, true);
    assert.equal(Number((await db.query('select count(*) as n from public.waitlist_attempts')).rows[0].n), 2);
  } finally {
    await db.exec('reset role');
  }
});

test('row level security is forced on the table', async () => {
  const db = await database();
  const row = (await db.query(`select relrowsecurity as on, relforcerowsecurity as forced from pg_class where oid = 'public.waitlist_attempts'::regclass`)).rows[0];
  assert.deepEqual(row, { on: true, forced: true });
});

test('the migration is safe to run twice and keeps the rows', async () => {
  const db = await database();
  await allow(db, KEY_A);
  await db.exec(MIGRATION);
  assert.equal(await count(db), 1);
  assert.equal(await allow(db, KEY_A), true);
});
