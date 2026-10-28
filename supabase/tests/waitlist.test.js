import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

// The waitlist is not a person's table: no user_id, no public read, writes only for the service role.
// The email is stored in lower case, so uniqueness does not depend on citext. The confirm token column accepts only a SHA-256 hex hash.

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const MIGRATION = read(`${process.env.MIGRATIONS_DIR ?? '../migrations'}/20261028000100_waitlist.sql`);
const HASH = 'a'.repeat(64);

async function database() {
  const db = new PGlite();
  await db.exec(read('./fixtures/supabase-stub.sql'));
  await db.exec(MIGRATION);
  return db;
}

async function asRole(db, role, fn) {
  await db.exec(`set role ${role}`);
  try {
    return await fn();
  } finally {
    await db.exec('reset role');
  }
}

const count = async (db, sql) => Number((await db.query(sql)).rows[0].n);

test('the waitlist table keeps a hashed confirm token and a pending or confirmed status', async () => {
  const db = await database();
  const columns = (await db.query(`select column_name from information_schema.columns where table_schema = 'public' and table_name = 'waitlist' order by 1`)).rows.map((row) => row.column_name);
  for (const name of ['id', 'email', 'device', 'status', 'confirm_token_hash', 'confirm_token_expires_at', 'confirm_sent_at', 'confirmed_at', 'created_at']) {
    assert.ok(columns.includes(name), name);
  }
  assert.equal(await count(db, `select count(*) as n from information_schema.columns where table_schema = 'public' and table_name = 'waitlist' and column_name = 'user_id'`), 0);

  await db.exec(`insert into public.waitlist (email, device, confirm_token_hash, confirm_token_expires_at) values ('person@example.com', 'iphone', '${HASH}', now() + interval '7 days')`);
  const row = (await db.query(`select email, status, created_at is not null as has_created from public.waitlist`)).rows[0];
  assert.equal(row.email, 'person@example.com');
  assert.equal(row.status, 'pending');
  assert.equal(row.has_created, true);
  await assert.rejects(
    () => db.exec(`insert into public.waitlist (email, device, confirm_token_hash, confirm_token_expires_at) values ('Person@Example.com', 'laptop', '${'b'.repeat(64)}', now() + interval '7 days')`),
    /check/,
  );
  await assert.rejects(
    () => db.exec(`insert into public.waitlist (email, device, confirm_token_hash, confirm_token_expires_at) values ('person@example.com', 'laptop', '${'b'.repeat(64)}', now() + interval '7 days')`),
    /duplicate key/,
  );
  await assert.rejects(
    () => db.exec(`insert into public.waitlist (email, device, confirm_token_hash, confirm_token_expires_at) values ('other@example.com', 'phone', '${HASH}', now() + interval '1 day')`),
    /check/,
  );
  await assert.rejects(
    () => db.exec(`insert into public.waitlist (email, device, status, confirm_token_hash, confirm_token_expires_at) values ('third@example.com', 'laptop', 'invited', '${'c'.repeat(64)}', now() + interval '1 day')`),
    /check/,
  );
  await assert.rejects(
    () => db.exec(`insert into public.waitlist (email, device, confirm_token_hash, confirm_token_expires_at) values ('fourth@example.com', 'laptop', 'not-a-hash', now() + interval '1 day')`),
    /check/,
  );
  await assert.rejects(
    () => db.exec(`insert into public.waitlist (email, device) values ('fifth@example.com', 'laptop')`),
    /check/,
  );
  await db.exec(`update public.waitlist set status = 'confirmed', confirmed_at = now(), confirm_token_hash = null, confirm_token_expires_at = null where email = 'person@example.com'`);
  assert.equal((await db.query(`select status from public.waitlist where email = 'person@example.com'`)).rows[0].status, 'confirmed');
});

test('row level security is on and the public roles cannot read or insert', async () => {
  const db = await database();
  await db.exec(`insert into public.waitlist (email, device, confirm_token_hash, confirm_token_expires_at) values ('person@example.com', 'laptop', '${HASH}', now() + interval '7 days')`);
  const locked = (await db.query(`select relrowsecurity, relforcerowsecurity from pg_class where oid = 'public.waitlist'::regclass`)).rows[0];
  assert.equal(locked.relrowsecurity, true);
  assert.equal(locked.relforcerowsecurity, true);

  for (const role of ['anon', 'authenticated']) {
    await asRole(db, role, async () => {
      await assert.rejects(() => db.query('select email from public.waitlist'), /permission denied/);
      await assert.rejects(
        () => db.exec(`insert into public.waitlist (email, device, confirm_token_hash, confirm_token_expires_at) values ('new@example.com', 'android', '${'d'.repeat(64)}', now() + interval '1 day')`),
        /permission denied/,
      );
    });
  }

  await asRole(db, 'service_role', async () => {
    assert.equal(await count(db, 'select count(*) as n from public.waitlist'), 1);
    await db.exec(`update public.waitlist set status = 'confirmed', confirmed_at = now() where email = 'person@example.com'`);
    assert.equal((await db.query(`select status from public.waitlist`)).rows[0].status, 'confirmed');
  });
});

test('the waitlist migration can be applied twice', async () => {
  const db = await database();
  await db.exec(MIGRATION);
  assert.equal(await count(db, `select count(*) as n from information_schema.tables where table_schema = 'public' and table_name = 'waitlist'`), 1);
});
