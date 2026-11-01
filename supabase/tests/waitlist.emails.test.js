import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

// The place-ready and launch emails (INT-163): one row per person per email, unsubscribed people and pending rows are
// never listed, the order is the waitlist place, and the API roles see nothing.

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const DIR = process.env.MIGRATIONS_DIR ?? '../migrations';
const WAITLIST = read(`${DIR}/20261028000100_waitlist.sql`);
const REFERRALS = read(`${DIR}/20261029000100_waitlist_referrals.sql`);
const EMAILS = read(`${DIR}/20261101000300_waitlist_emails.sql`);

let seq = 0;
const hash = () => (++seq).toString(16).padStart(64, '0');

async function database() {
  const db = new PGlite();
  await db.exec(read('./fixtures/supabase-stub.sql'));
  await db.exec(WAITLIST);
  await db.exec(REFERRALS);
  await db.exec(EMAILS);
  return db;
}

async function add(db, email, { status = 'confirmed', referredBy = null, createdAt = '2026-10-29T10:00:00Z', unsubscribed = false } = {}) {
  const confirmed = status === 'confirmed' ? 'now()' : 'null';
  const by = referredBy ? `'${referredBy}'` : 'null';
  const unsub = unsubscribed ? 'now()' : 'null';
  const res = await db.query(
    `insert into public.waitlist (email, device, status, confirm_token_hash, confirm_token_expires_at, confirmed_at, referred_by, created_at, unsubscribed_at)
     values ('${email}', 'laptop', '${status}', '${hash()}', now() + interval '7 days', ${confirmed}, ${by}, '${createdAt}', ${unsub}) returning id`,
  );
  return res.rows[0].id;
}

const recipients = async (db, kind, limit = 50, only = null) =>
  (await db.query('select id, email, device, place from public.waitlist_email_recipients($1, $2, $3)', [kind, limit, only])).rows;
const candidates = async (db, kind, only = null) =>
  (await db.query('select public.waitlist_email_candidate_count($1, $2) as n', [kind, only])).rows[0].n;
const sent = async (db) => Number((await db.query('select count(*) as n from public.waitlist_emails_sent')).rows[0].n);

test('one row per person per email: a second insert of the same pair fails, the other email is fine', async () => {
  const db = await database();
  const id = await add(db, 'a@example.org');
  await db.exec(`insert into public.waitlist_emails_sent (waitlist_id, kind) values ('${id}', 'place_ready')`);
  await assert.rejects(() => db.exec(`insert into public.waitlist_emails_sent (waitlist_id, kind) values ('${id}', 'place_ready')`), /duplicate key/);
  await db.exec(`insert into public.waitlist_emails_sent (waitlist_id, kind) values ('${id}', 'launch')`);
  const conflict = await db.query(`insert into public.waitlist_emails_sent (waitlist_id, kind) values ('${id}', 'launch') on conflict do nothing returning waitlist_id`);
  assert.equal(conflict.rows.length, 0, 'insert-or-skip returns nothing when the row is already there');
  await assert.rejects(() => db.exec(`insert into public.waitlist_emails_sent (waitlist_id, kind) values ('${id}', 'newsletter')`), /check/);
  assert.equal(await sent(db), 2);
});

test('deleting a waitlist row deletes its sent rows', async () => {
  const db = await database();
  const id = await add(db, 'gone@example.org');
  await db.exec(`insert into public.waitlist_emails_sent (waitlist_id, kind) values ('${id}', 'place_ready'), ('${id}', 'launch')`);
  await db.exec(`delete from public.waitlist where id = '${id}'`);
  assert.equal(await sent(db), 0);
});

test('recipients are confirmed, not unsubscribed, not already sent, in place order', async () => {
  const db = await database();
  const early = await add(db, 'early@example.org', { createdAt: '2026-10-29T09:00:00Z' });
  const late = await add(db, 'late@example.org', { createdAt: '2026-10-29T11:00:00Z' });
  await add(db, 'friend@example.org', { referredBy: late, createdAt: '2026-10-29T12:00:00Z' });
  await add(db, 'pending@example.org', { status: 'pending', createdAt: '2026-10-29T08:00:00Z' });
  await add(db, 'left@example.org', { unsubscribed: true, createdAt: '2026-10-29T08:30:00Z' });

  const rows = await recipients(db, 'place_ready');
  assert.deepEqual(rows.map((r) => r.email), ['late@example.org', 'early@example.org', 'friend@example.org'], 'one confirmed friend puts late first');
  assert.ok(rows.every((r, i) => i === 0 || r.place > rows[i - 1].place));
  assert.equal(await candidates(db, 'place_ready'), 3);

  await db.exec(`insert into public.waitlist_emails_sent (waitlist_id, kind) values ('${late}', 'place_ready')`);
  assert.deepEqual((await recipients(db, 'place_ready')).map((r) => r.id), [early, (await recipients(db, 'place_ready'))[1].id]);
  assert.equal(await candidates(db, 'place_ready'), 2);
  assert.equal(await candidates(db, 'launch'), 3, 'sending one email does not count as the other');

  assert.deepEqual((await recipients(db, 'place_ready', 1)).map((r) => r.id), [early], 'the limit keeps the best places');
  assert.deepEqual((await recipients(db, 'launch', 50, ['early@example.org', 'nobody@example.org'])).map((r) => r.id), [early], 'only keeps listed addresses');
  assert.equal(await candidates(db, 'launch', ['early@example.org']), 1);
  assert.equal(await candidates(db, 'launch', []), 0);
});

test('bad arguments are refused', async () => {
  const db = await database();
  await assert.rejects(() => recipients(db, 'newsletter'), /bad arguments/);
  await assert.rejects(() => recipients(db, 'launch', 0), /bad arguments/);
  await assert.rejects(() => recipients(db, 'launch', 501), /bad arguments/);
  await assert.rejects(() => candidates(db, 'confirm'), /bad arguments/);
});

test('the API roles cannot read or write the table or call the functions; the service role can', async () => {
  const db = await database();
  const id = await add(db, 'a@example.org');
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role}`);
    try {
      await assert.rejects(() => db.query('select * from public.waitlist_emails_sent'), /permission denied/);
      await assert.rejects(() => db.query(`insert into public.waitlist_emails_sent (waitlist_id, kind) values ('${id}', 'launch')`), /permission denied/);
      await assert.rejects(() => db.query(`select * from public.waitlist_email_recipients('launch', 5)`), /permission denied/);
      await assert.rejects(() => db.query(`select public.waitlist_email_candidate_count('launch')`), /permission denied/);
      await assert.rejects(() => db.query(`update public.waitlist set unsubscribed_at = now()`), /permission denied/);
    } finally {
      await db.exec('reset role');
    }
  }
  await db.exec('set role service_role');
  try {
    assert.equal((await db.query(`select * from public.waitlist_email_recipients('launch', 5)`)).rows.length, 1);
    await db.exec(`insert into public.waitlist_emails_sent (waitlist_id, kind) values ('${id}', 'launch')`);
    await db.exec(`delete from public.waitlist_emails_sent where waitlist_id = '${id}' and kind = 'launch'`);
    await db.exec(`update public.waitlist set unsubscribed_at = now() where id = '${id}'`);
    assert.equal((await db.query(`select public.waitlist_email_candidate_count('launch') as n`)).rows[0].n, 0);
  } finally {
    await db.exec('reset role');
  }
});

test('row level security is forced on the table', async () => {
  const db = await database();
  const row = (await db.query(`select relrowsecurity as on, relforcerowsecurity as forced from pg_class where oid = 'public.waitlist_emails_sent'::regclass`)).rows[0];
  assert.deepEqual(row, { on: true, forced: true });
});

test('the migration is safe to run twice and keeps the rows', async () => {
  const db = await database();
  const id = await add(db, 'a@example.org', { unsubscribed: true });
  const other = await add(db, 'b@example.org');
  await db.exec(`insert into public.waitlist_emails_sent (waitlist_id, kind) values ('${other}', 'place_ready')`);
  await db.exec(EMAILS);
  assert.equal(await sent(db), 1);
  const kept = (await db.query(`select unsubscribed_at is not null as gone from public.waitlist where id = '${id}'`)).rows[0];
  assert.equal(kept.gone, true);
});
