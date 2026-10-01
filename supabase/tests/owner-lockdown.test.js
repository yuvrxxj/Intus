import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const migration = (name) => read(`../migrations/${name}.sql`);
const ADDITIVE = ['20261001000100_app_owner', '20261001000150_private_is_owner'].map(migration);
const LOCKDOWN = migration('20261001000200_owner_lockdown');
const GUARD = migration('20261001000300_close_default_access');

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const BIOMARKER = '33333333-3333-4333-8333-333333333333';

const PERSONAL = [
  'biomarker_readings', 'daily_logs', 'body_composition', 'cardio_metrics', 'profile', 'meals',
  'photo_log', 'medications', 'diagnoses', 'screening_history', 'action_items', 'devices', 'supplement_catalog',
];
const REFERENCE = ['biomarkers', 'screening_rules'];
const ALL = [...PERSONAL, ...REFERENCE];

// the least a row needs to exist in each table: [columns, values]. n keeps dates and text keys distinct.
const minimalRow = {
  biomarker_readings: (n) => ['biomarker_id, value, measured_at', `'${BIOMARKER}', 1.5, '2026-01-0${n}'`],
  daily_logs: (n) => ['log_date', `'2026-01-0${n}'`],
  body_composition: (n) => ['measured_at', `'2026-01-0${n}'`],
  cardio_metrics: (n) => ['measured_at', `'2026-01-0${n}'`],
  profile: (n) => ['name', `'p${n}'`],
  meals: (n) => ['meal, name', `'lunch', 'm${n}'`],
  photo_log: (n) => ['log_date', `'2026-01-0${n}'`],
  medications: (n) => ['name', `'med${n}'`],
  diagnoses: (n) => ['condition', `'c${n}'`],
  screening_history: (n) => ['screening_code, done_date', `'bp', '2026-01-0${n}'`],
  action_items: (n) => ['id, text', `'a${n}', 'x'`],
  devices: (n) => ['id, name', `'d${n}', 'x'`],
  supplement_catalog: (n) => ['id, name', `'s${n}', 'x'`],
  biomarkers: (n) => ['code, name, unit, category', `'code${n}', 'n', 'u', 'c'`],
  screening_rules: (n) => ['code, label', `'rule${n}', 'l'`],
};
const insertRow = (db, table, n) => {
  const [cols, vals] = minimalRow[table](n);
  return db.exec(`insert into public.${table} (${cols}) values (${vals})`);
};

async function runScript(db, sql) {
  try {
    await db.exec(sql);
  } catch (error) {
    await db.exec('rollback');
    throw error;
  }
}

/**
 * stage: before (open policies, as live today), additive (first two migrations), locked (plus the
 * lockdown), final (plus the default-access guard). owners: accounts registered in app_owner.
 */
async function world({ stage = 'locked', owners = [OWNER] } = {}) {
  const db = new PGlite();
  await db.exec(read('./fixtures/supabase-stub.sql'));
  await db.exec(read('./fixtures/pre-lockdown.sql'));
  await db.exec(`
    insert into public.biomarkers (id, code, name, unit, category) values ('${BIOMARKER}', 'potassium', 'Potassium', 'mmol/L', 'electrolytes');
    insert into public.screening_rules (code, label) values ('bp', 'Blood pressure');`);
  for (const table of PERSONAL) await insertRow(db, table, 1);
  for (const id of [OWNER, OTHER]) await db.query('insert into auth.users (id, email) values ($1, $2)', [id, `${id}@example.test`]);
  if (stage === 'before') return db;
  for (const sql of ADDITIVE) await runScript(db, sql);
  for (const id of owners) await db.query('insert into public.app_owner (user_id) values ($1)', [id]);
  if (stage === 'additive') return db;
  await runScript(db, LOCKDOWN);
  if (stage === 'locked') return db;
  await runScript(db, GUARD);
  return db;
}

// act as an API caller: the role PostgREST switches to, with the signed-in user's id in the token claims
async function as(db, role, sub, fn) {
  await db.exec(`set role ${role}`);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [sub ?? '']);
  try {
    return await fn();
  } finally {
    await db.exec('reset role');
    await db.exec("select set_config('request.jwt.claim.sub', '', false)");
  }
}
const asAnon = (db, fn) => as(db, 'anon', null, fn);
const asUser = (db, id, fn) => as(db, 'authenticated', id, fn);
const count = async (db, sql) => Number((await db.query(sql)).rows[0].n);

test('today, with the open policies, the anon key reads and writes everything', async () => {
  const db = await world({ stage: 'before' });
  await asAnon(db, async () => {
    assert.equal(await count(db, 'select count(*) as n from public.biomarker_readings'), 1);
    await db.exec(`insert into public.daily_logs (log_date) values ('2026-05-05')`);
  });
});

test('the first two migrations add the owner check without changing any existing access', async () => {
  const db = await world({ stage: 'additive' });
  await asAnon(db, async () => {
    for (const table of ALL) assert.equal(await count(db, `select count(*) as n from public.${table}`) >= 1, true, table);
  });
  assert.equal(await count(db, 'select count(*) as n from public.biomarker_readings'), 1);
});

test('nobody can reach app_owner through the API, so a signed-in user cannot make themselves the owner', async () => {
  const db = await world({ stage: 'locked' });
  for (const [role, sub] of [['anon', null], ['authenticated', OTHER], ['authenticated', OWNER]]) {
    await as(db, role, sub, async () => {
      await assert.rejects(() => db.query('select * from public.app_owner'), /permission denied/, `${role} select`);
      await assert.rejects(() => db.exec(`insert into public.app_owner (user_id) values ('${OTHER}')`), /permission denied/, `${role} insert`);
      await assert.rejects(() => db.exec(`update public.app_owner set user_id = '${OTHER}'`), /permission denied/, `${role} update`);
      await assert.rejects(() => db.exec('delete from public.app_owner'), /permission denied/, `${role} delete`);
    });
  }
  assert.equal(await count(db, 'select count(*) as n from public.app_owner'), 1);
});

test('the owner check answers for the signed-in caller only, and is not exposed on the API schema', async () => {
  const db = await world({ stage: 'locked' });
  const check = () => db.query('select private.is_owner() as ok').then((r) => r.rows[0].ok);
  assert.equal(await asUser(db, OWNER, check), true);
  assert.equal(await asUser(db, OTHER, check), false);
  await asAnon(db, () => assert.rejects(check, /permission denied/));
  await assert.rejects(() => db.query('select public.is_owner()'), /does not exist/);
});

test('the lockdown refuses to run while nobody is registered as owner, and changes nothing', async () => {
  const db = await world({ stage: 'additive', owners: [] });
  await assert.rejects(() => runScript(db, LOCKDOWN), /app_owner is empty/);
  await asAnon(db, async () => assert.equal(await count(db, 'select count(*) as n from public.biomarker_readings'), 1));
});

test('after the lockdown the anon role cannot touch any table', async () => {
  const db = await world();
  await asAnon(db, async () => {
    for (const table of ALL) {
      await assert.rejects(() => db.query(`select * from public.${table}`), /permission denied/, `select ${table}`);
      await assert.rejects(() => db.exec(`insert into public.${table} default values`), /permission denied/, `insert ${table}`);
      await assert.rejects(() => db.exec(`delete from public.${table}`), /permission denied/, `delete ${table}`);
    }
  });
});

test('the owner reads everything and can insert, update and delete in every table', async () => {
  const db = await world();
  await asUser(db, OWNER, async () => {
    for (const table of ALL) {
      assert.equal(await count(db, `select count(*) as n from public.${table}`), 1, `read ${table}`);
      await insertRow(db, table, 2);
      const [cols] = minimalRow[table](2);
      const key = cols.split(',')[0].trim();
      assert.equal((await db.query(`update public.${table} set ${key} = ${key} returning 1`)).rows.length, 2, `update ${table}`);
      assert.equal((await db.query(`delete from public.${table} returning 1`)).rows.length, 2, `delete ${table}`);
      assert.equal(await count(db, `select count(*) as n from public.${table}`), 0, `after delete ${table}`);
    }
  });
});

test('a signed-in person who is not the owner sees nothing and changes nothing', async () => {
  const db = await world();
  for (const table of ALL) {
    const before = await count(db, `select count(*) as n from public.${table}`);
    await asUser(db, OTHER, async () => {
      assert.equal(await count(db, `select count(*) as n from public.${table}`), 0, `read ${table}`);
      const [cols, vals] = minimalRow[table](3);
      await assert.rejects(() => db.exec(`insert into public.${table} (${cols}) values (${vals})`), /row-level security/, `insert ${table}`);
      const key = cols.split(',')[0].trim();
      assert.equal((await db.query(`update public.${table} set ${key} = ${key} returning 1`)).rows.length, 0, `update ${table}`);
      assert.equal((await db.query(`delete from public.${table} returning 1`)).rows.length, 0, `delete ${table}`);
    });
    assert.equal(await count(db, `select count(*) as n from public.${table}`), before, table);
  }
});

test('deleting the owner account removes the owner, which locks everyone out and keeps the data', async () => {
  const db = await world();
  await db.exec(`delete from auth.users where id = '${OWNER}'`);
  assert.equal(await count(db, 'select count(*) as n from public.app_owner'), 0);
  await asUser(db, OTHER, async () => assert.equal(await count(db, 'select count(*) as n from public.biomarker_readings'), 0));
  assert.equal(await count(db, 'select count(*) as n from public.biomarker_readings'), 1);
});

test('every table has row level security and exactly one policy, for signed-in users only', async () => {
  const db = await world();
  const open = await db.query(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
                               where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`);
  assert.deepEqual(open.rows, []);
  const { rows } = await db.query(`select tablename, policyname, roles, cmd from pg_policies where schemaname = 'public' order by tablename`);
  assert.deepEqual(rows.map((r) => r.tablename), [...ALL].sort());
  for (const row of rows) {
    assert.equal(row.policyname, 'owner_only', row.tablename);
    assert.deepEqual(row.roles, ['authenticated'], row.tablename);
    assert.equal(row.cmd, 'ALL', row.tablename);
  }
  const anonCanRead = await db.query(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
                                      where n.nspname = 'public' and c.relkind = 'r' and has_table_privilege('anon', c.oid, 'select')`);
  assert.deepEqual(anonCanRead.rows, []);
});

test('the lockdown can be applied twice without changing the result', async () => {
  const db = await world();
  await runScript(db, LOCKDOWN);
  const policies = await db.query(`select count(*) as n from pg_policies where schemaname = 'public'`);
  assert.equal(Number(policies.rows[0].n), ALL.length);
  await asAnon(db, () => assert.rejects(() => db.query('select * from public.biomarker_readings'), /permission denied/));
});

test('the undo recipe in supabase/README.md restores the old open access', async () => {
  const db = await world();
  for (const table of ALL) {
    await db.exec(`create policy allow_all on public.${table} for all using (true) with check (true)`);
    await db.exec(`grant all on public.${table} to anon`);
  }
  await asAnon(db, async () => assert.equal(await count(db, 'select count(*) as n from public.biomarker_readings'), 1));
});

test('tables created after the guard migration are closed to anon', async () => {
  const db = await world({ stage: 'final' });
  await db.exec('create table public.created_later (id int)');
  assert.equal((await db.query(`select has_table_privilege('anon', 'public.created_later', 'select') as ok`)).rows[0].ok, false);
  assert.equal((await db.query(`select has_table_privilege('authenticated', 'public.created_later', 'select') as ok`)).rows[0].ok, true);
});
