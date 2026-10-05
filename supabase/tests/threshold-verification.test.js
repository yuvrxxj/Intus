import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const migration = (name) => read(`${process.env.MIGRATIONS_DIR ?? '../migrations'}/${name}.sql`);

const OWNER_SETUP = ['20261001000100_app_owner', '20261001000150_private_is_owner'].map(migration);
const LOCKDOWN = migration('20261001000200_owner_lockdown');
const EXPAND = migration('20261005000100_per_user_data');
const VERIFICATION = migration('20261005000600_threshold_verification');

const OWNER = '11111111-1111-4111-8111-111111111111';
const BIOMARKER = '33333333-3333-4333-8333-333333333333';

async function runScript(db, sql) {
  try {
    await db.exec(sql);
  } catch (error) {
    await db.exec('rollback');
    throw error;
  }
}

/** The database as it is today (owner lock-down in place), with one marker that already has critical limits stored. */
async function world({ verification = 'after' } = {}) {
  const db = new PGlite();
  await db.exec(read('./fixtures/supabase-stub.sql'));
  await db.exec(read('./fixtures/pre-lockdown.sql'));
  await db.exec(`insert into public.biomarkers (id, code, name, unit, category, critical_low, critical_high)
                 values ('${BIOMARKER}', 'potassium', 'Potassium', 'mmol/L', 'electrolytes', 2.8, 6.0)`);
  await db.query('insert into auth.users (id, email) values ($1, $2)', [OWNER, 'owner@example.test']);
  for (const sql of OWNER_SETUP) await runScript(db, sql);
  await db.query('insert into public.app_owner (user_id) values ($1)', [OWNER]);
  await runScript(db, LOCKDOWN);
  if (verification === 'before') await runScript(db, VERIFICATION);
  await runScript(db, EXPAND);
  if (verification === 'after') await runScript(db, VERIFICATION);
  return db;
}

async function asUser(db, id, fn) {
  await db.exec('set role authenticated');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
  try {
    return await fn();
  } finally {
    await db.exec('reset role');
    await db.exec("select set_config('request.jwt.claim.sub', '', false)");
  }
}

const marker = async (db) => (await db.query(`select threshold_verified_at, threshold_verified_by from public.biomarkers where id = '${BIOMARKER}'`)).rows[0];

for (const order of ['before', 'after']) {
  test(`applied ${order} the per-user migration, no existing marker is marked verified`, async () => {
    const db = await world({ verification: order });
    assert.deepEqual(await marker(db), { threshold_verified_at: null, threshold_verified_by: null });
    // the limits themselves are untouched
    const limits = (await db.query(`select critical_low::float8 as lo, critical_high::float8 as hi from public.biomarkers where id = '${BIOMARKER}'`)).rows[0];
    assert.deepEqual(limits, { lo: 2.8, hi: 6 });
  });
}

test('a sign-off without a reviewer is refused, and one with a reviewer is accepted', async () => {
  const db = await world();
  for (const reviewer of ['null', "''", "'   '"]) {
    await assert.rejects(
      () => db.exec(`update public.biomarkers set threshold_verified_at = now(), threshold_verified_by = ${reviewer} where id = '${BIOMARKER}'`),
      /biomarkers_verified_needs_reviewer/,
      `reviewer ${reviewer}`,
    );
  }
  assert.deepEqual(await marker(db), { threshold_verified_at: null, threshold_verified_by: null });

  await db.exec(`update public.biomarkers set threshold_verified_at = now(), threshold_verified_by = 'Dr Test, reg 123, checked against local lab policy' where id = '${BIOMARKER}'`);
  const signed = await marker(db);
  assert.ok(signed.threshold_verified_at instanceof Date);
  assert.match(signed.threshold_verified_by, /^Dr Test/);

  // withdrawing a sign-off is just clearing both
  await db.exec(`update public.biomarkers set threshold_verified_at = null, threshold_verified_by = null where id = '${BIOMARKER}'`);
  assert.deepEqual(await marker(db), { threshold_verified_at: null, threshold_verified_by: null });
});

test('running the migration a second time changes nothing and does not fail', async () => {
  const db = await world();
  await db.exec(`update public.biomarkers set threshold_verified_at = now(), threshold_verified_by = 'Dr Test' where id = '${BIOMARKER}'`);
  const before = await marker(db);
  await runScript(db, VERIFICATION);
  assert.deepEqual(await marker(db), before);
});

test('a signed-in app user can read the sign-off but can never write it, so nobody can verify their own limits', async () => {
  const db = await world();
  await asUser(db, OWNER, async () => {
    const rows = (await db.query('select code, threshold_verified_at from public.biomarkers')).rows;
    assert.deepEqual(rows, [{ code: 'potassium', threshold_verified_at: null }]);
    await assert.rejects(() => db.exec(`update public.biomarkers set threshold_verified_at = now(), threshold_verified_by = 'me' where id = '${BIOMARKER}'`), /permission denied/);
    await assert.rejects(() => db.exec(`update public.biomarkers set critical_high = 999 where id = '${BIOMARKER}'`), /permission denied/);
  });
  assert.deepEqual(await marker(db), { threshold_verified_at: null, threshold_verified_by: null });
});
