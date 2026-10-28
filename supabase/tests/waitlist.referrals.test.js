import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

// Referrals (INT-151): a friend counts only once confirmed, nobody refers themselves, the place is computed, and the
// API roles still see nothing.

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const DIR = process.env.MIGRATIONS_DIR ?? '../migrations';
const WAITLIST = read(`${DIR}/20261028000100_waitlist.sql`);
const REFERRALS = read(`${DIR}/20261029000100_waitlist_referrals.sql`);

let seq = 0;
const hash = () => (++seq).toString(16).padStart(64, '0');

async function database({ before = '' } = {}) {
  const db = new PGlite();
  await db.exec(read('./fixtures/supabase-stub.sql'));
  await db.exec(WAITLIST);
  if (before) await db.exec(before);
  await db.exec(REFERRALS);
  return db;
}

/** Inserts a row as the service role and returns its id. Confirmed rows get confirmed_at. */
async function add(db, email, { status = 'pending', referredBy = null, createdAt = null } = {}) {
  const confirmed = status === 'confirmed' ? 'now()' : 'null';
  const by = referredBy ? `'${referredBy}'` : 'null';
  const at = createdAt ? `'${createdAt}'` : 'now()';
  const res = await db.query(
    `insert into public.waitlist (email, device, status, confirm_token_hash, confirm_token_expires_at, confirmed_at, referred_by, created_at)
     values ('${email}', 'laptop', '${status}', '${hash()}', now() + interval '7 days', ${confirmed}, ${by}, ${at}) returning id`,
  );
  return res.rows[0].id;
}

const standing = async (db) => (await db.query('select id, referrals, place from public.waitlist_standing order by place')).rows;

test('every row gets a unique ten-character code, including rows that existed before the migration', async () => {
  const db = await database({
    before: `insert into public.waitlist (email, device, confirm_token_hash, confirm_token_expires_at) values
      ('old1@example.com', 'laptop', '${hash()}', now() + interval '1 day'),
      ('old2@example.com', 'iphone', '${hash()}', now() + interval '1 day')`,
  });
  await add(db, 'new@example.com');
  const codes = (await db.query('select referral_code from public.waitlist')).rows.map((r) => r.referral_code);
  assert.equal(codes.length, 3);
  assert.equal(new Set(codes).size, 3);
  for (const code of codes) assert.match(code, /^[0-9A-F]{10}$/);
  await assert.rejects(() => db.exec(`update public.waitlist set referral_code = '${codes[0]}' where email = 'old2@example.com'`), /duplicate key/);
  await assert.rejects(() => db.exec(`update public.waitlist set referral_code = 'abc' where email = 'old2@example.com'`), /check/);
});

test('a referral counts only after the friend confirms', async () => {
  const db = await database();
  const referrer = await add(db, 'referrer@example.com', { status: 'confirmed', createdAt: '2026-10-29T10:00:00Z' });
  const friend = await add(db, 'friend@example.com', { referredBy: referrer });
  assert.deepEqual((await standing(db)).map((r) => [r.id, r.referrals]), [[referrer, 0]]);
  await db.exec(`update public.waitlist set status = 'confirmed', confirmed_at = now() where id = '${friend}'`);
  const rows = await standing(db);
  assert.equal(rows.find((r) => r.id === referrer).referrals, 1);
  assert.equal(rows.find((r) => r.id === friend).referrals, 0);
});

test('the place is most confirmed friends first, then earliest sign-up, and only confirmed rows have one', async () => {
  const db = await database();
  const early = await add(db, 'early@example.com', { status: 'confirmed', createdAt: '2026-10-29T09:00:00Z' });
  const late = await add(db, 'late@example.com', { status: 'confirmed', createdAt: '2026-10-29T11:00:00Z' });
  await add(db, 'pending@example.com', { createdAt: '2026-10-29T08:00:00Z' });
  assert.deepEqual((await standing(db)).map((r) => [r.id, r.place]), [[early, 1], [late, 2]]);

  await add(db, 'friend1@example.com', { status: 'confirmed', referredBy: late, createdAt: '2026-10-29T12:00:00Z' });
  await add(db, 'friend2@example.com', { referredBy: late, createdAt: '2026-10-29T12:30:00Z' });
  const rows = await standing(db);
  assert.equal(rows[0].id, late, 'one confirmed friend moves late ahead of early; the pending friend does not count');
  assert.equal(rows[0].place, 1);
  assert.equal(rows.find((r) => r.id === early).place, 2);
  assert.equal(rows.length, 3);
});

test('nobody can refer themselves, by the same address or the same address in another spelling', async () => {
  const db = await database();
  const referrer = await add(db, 'first.last@gmail.com', { status: 'confirmed' });
  await assert.rejects(() => add(db, 'first.last@gmail.com', { referredBy: referrer }), /duplicate key|cannot refer/);
  await assert.rejects(() => add(db, 'firstlast+friend@gmail.com', { referredBy: referrer }), /cannot refer themselves/);
  await assert.rejects(() => add(db, 'FIRST.LAST+x@googlemail.com'.toLowerCase(), { referredBy: referrer }), /cannot refer themselves/);

  const other = await add(db, 'person@example.com', { status: 'confirmed' });
  await assert.rejects(() => add(db, 'person+again@example.com', { referredBy: other }), /cannot refer themselves/);
  // A dot means a different person outside gmail.
  await add(db, 'per.son@example.com', { referredBy: other });

  await assert.rejects(() => db.exec(`update public.waitlist set referred_by = id where id = '${other}'`), /cannot refer itself/);
  const friend = await add(db, 'friend@example.com');
  await assert.rejects(() => db.exec(`update public.waitlist set email = 'person+moved@example.com', referred_by = '${other}' where id = '${friend}'`), /cannot refer themselves/);
  assert.equal((await db.query('select count(*)::int as n from public.waitlist')).rows[0].n, 4);
});

test('deleting a referrer keeps the friend and clears the link', async () => {
  const db = await database();
  const referrer = await add(db, 'gone@example.com', { status: 'confirmed' });
  const friend = await add(db, 'stays@example.com', { referredBy: referrer });
  await db.exec(`delete from public.waitlist where id = '${referrer}'`);
  assert.equal((await db.query(`select referred_by from public.waitlist where id = '${friend}'`)).rows[0].referred_by, null);
});

test('the API roles still see nothing, and cannot call the helpers; the service role can read the standing', async () => {
  const db = await database();
  await add(db, 'someone@example.com', { status: 'confirmed' });
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role}`);
    try {
      await assert.rejects(() => db.query('select * from public.waitlist_standing'), /permission denied/);
      await assert.rejects(() => db.query('select * from public.waitlist'), /permission denied/);
      await assert.rejects(() => db.query(`select public.waitlist_normal_email('a@b.com')`), /permission denied/);
      await assert.rejects(() => db.query('select public.waitlist_new_referral_code()'), /permission denied/);
    } finally {
      await db.exec('reset role');
    }
  }
  await db.exec('set role service_role');
  try {
    assert.equal((await db.query('select * from public.waitlist_standing')).rows.length, 1);
  } finally {
    await db.exec('reset role');
  }
});

test('the migration is safe to run twice', async () => {
  const db = await database();
  const id = await add(db, 'again@example.com', { status: 'confirmed' });
  const before = (await db.query(`select referral_code from public.waitlist where id = '${id}'`)).rows[0].referral_code;
  await db.exec(REFERRALS);
  assert.equal((await db.query(`select referral_code from public.waitlist where id = '${id}'`)).rows[0].referral_code, before);
});
