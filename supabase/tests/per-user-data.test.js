import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
// MIGRATIONS_DIR lets a mutation check point the suite at a deliberately broken copy
const migration = (name) => read(`${process.env.MIGRATIONS_DIR ?? '../migrations'}/${name}.sql`);

// What the live database has today: the owner tables, then the owner-only lockdown.
const OWNER_SETUP = ['20261001000100_app_owner', '20261001000150_private_is_owner'].map(migration);
const LOCKDOWN = migration('20261001000200_owner_lockdown');
// What this change adds.
const EXPAND = migration('20261005000100_per_user_data');
const CONTRACT = migration('20261005000200_drop_single_user_unique');
// Independent of the two above: when each supplement is taken.
const SCHEDULE = migration('20261005000300_supplement_schedule');
// Also independent of the per-user pair: the habits table and the daily log's habits column.
const HABITS = migration('20261005000400_habits');
// A data fix, not a migration: carries the owner's old hardcoded habits into the new table.
const SEED_HABITS = read(`${process.env.ONE_OFF_DIR ?? '../one-off'}/20261005_seed_owner_habits.sql`);

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const THIRD = '44444444-4444-4444-8444-444444444444';
const BIOMARKER = '33333333-3333-4333-8333-333333333333';

const PERSONAL = [
  'biomarker_readings', 'daily_logs', 'body_composition', 'cardio_metrics', 'profile', 'meals',
  'photo_log', 'medications', 'diagnoses', 'screening_history', 'action_items', 'devices', 'supplement_catalog',
];
const TEXT_KEYED = ['action_items', 'devices', 'supplement_catalog'];
const REFERENCE = ['biomarkers', 'screening_rules'];
const ALL = [...PERSONAL, ...REFERENCE];

// The least a row needs to exist in each table. n keeps dates and text keys distinct.
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
 * stage: live (as the database is today, owner's data in every table), expanded (plus the first
 * per-user migration), contracted (plus the second). owners: accounts registered in app_owner.
 * schedule, habits: when each of those independent migrations goes in, 'before' or 'after' the per-user one (or not at all).
 */
async function world({ stage = 'expanded', owners = [OWNER], schedule = 'none', habits = 'none' } = {}) {
  const db = new PGlite();
  await db.exec(read('./fixtures/supabase-stub.sql'));
  await db.exec(read('./fixtures/pre-lockdown.sql'));
  await db.exec(`
    insert into public.biomarkers (id, code, name, unit, category) values ('${BIOMARKER}', 'potassium', 'Potassium', 'mmol/L', 'electrolytes');
    insert into public.screening_rules (code, label) values ('bp', 'Blood pressure');`);
  for (const table of PERSONAL) await insertRow(db, table, 1);
  for (const id of [OWNER, OTHER, THIRD]) await db.query('insert into auth.users (id, email) values ($1, $2)', [id, `${id}@example.test`]);
  for (const sql of OWNER_SETUP) await runScript(db, sql);
  for (const id of owners) await db.query('insert into public.app_owner (user_id) values ($1)', [id]);
  await runScript(db, LOCKDOWN);
  if (schedule === 'before') await runScript(db, SCHEDULE);
  if (habits === 'before') await runScript(db, HABITS);
  if (stage === 'live') return db;
  await runScript(db, EXPAND);
  if (schedule === 'after') await runScript(db, SCHEDULE);
  if (habits === 'after') await runScript(db, HABITS);
  if (stage === 'expanded') return db;
  await runScript(db, CONTRACT);
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
const rowsOf = async (db, table) => count(db, `select count(*) as n from public.${table}`);

test('before this change, the owner-only rule is what protects the data', async () => {
  const db = await world({ stage: 'live' });
  await asUser(db, OTHER, async () => assert.equal(await rowsOf(db, 'biomarker_readings'), 0));
  await asUser(db, OWNER, async () => assert.equal(await rowsOf(db, 'biomarker_readings'), 1));
});

test('the migration refuses to run unless exactly one owner can receive the existing data, and changes nothing', async () => {
  for (const owners of [[], [OWNER, OTHER]]) {
    // the live database has one owner (the lockdown needs it), so change who is registered afterwards
    const db = await world({ stage: 'live' });
    await db.exec('delete from public.app_owner');
    for (const id of owners) await db.query('insert into public.app_owner (user_id) values ($1)', [id]);
    await assert.rejects(() => runScript(db, EXPAND), /expected exactly one row in app_owner/);
    const cols = await db.query(`select 1 from information_schema.columns where table_schema = 'public' and table_name = 'daily_logs' and column_name = 'user_id'`);
    assert.equal(cols.rows.length, 0, `no user_id column after a refused run with ${owners.length} owners`);
    assert.equal(await count(db, 'select count(*) as n from public.daily_logs'), 1, 'data untouched');
  }
});

test('every existing row is assigned to the owner, and the owner still sees all of it', async () => {
  const db = await world();
  for (const table of PERSONAL) {
    assert.equal(await count(db, `select count(*) as n from public.${table} where user_id = '${OWNER}'`), 1, `backfill ${table}`);
    assert.equal(await count(db, `select count(*) as n from public.${table} where user_id is null`), 0, `no orphan ${table}`);
    await asUser(db, OWNER, async () => assert.equal(await rowsOf(db, table), 1, `owner reads ${table}`));
  }
  for (const table of REFERENCE) await asUser(db, OWNER, async () => assert.equal(await rowsOf(db, table), 1, `owner reads ${table}`));
});

test('a second person sees none of the owner\'s data, in any table', async () => {
  const db = await world();
  await asUser(db, OTHER, async () => {
    for (const table of PERSONAL) assert.equal(await rowsOf(db, table), 0, `read ${table}`);
  });
});

test('a second person can read the shared reference tables but not change them', async () => {
  const db = await world();
  await asUser(db, OTHER, async () => {
    for (const table of REFERENCE) {
      assert.equal(await rowsOf(db, table), 1, `read ${table}`);
      const [cols, vals] = table === 'biomarkers'
        ? ['code, name, unit, category', `'x', 'n', 'u', 'c'`]
        : ['code, label', `'x', 'l'`];
      await assert.rejects(() => db.exec(`insert into public.${table} (${cols}) values (${vals})`), /permission denied/, `insert ${table}`);
      await assert.rejects(() => db.exec(`update public.${table} set name = 'x'`.replace('name', table === 'biomarkers' ? 'name' : 'label')), /permission denied/, `update ${table}`);
      await assert.rejects(() => db.exec(`delete from public.${table}`), /permission denied/, `delete ${table}`);
    }
  });
  // not even the owner can edit them through the API
  await asUser(db, OWNER, async () => {
    await assert.rejects(() => db.exec(`delete from public.biomarkers`), /permission denied/);
  });
  assert.equal(await count(db, 'select count(*) as n from public.biomarkers'), 1);
});

test('rows are filled in with the signed-in person\'s id, and cannot be written for someone else', async () => {
  const db = await world();
  await asUser(db, OTHER, async () => {
    for (const table of PERSONAL) {
      await insertRow(db, table, 2);
      assert.equal(await count(db, `select count(*) as n from public.${table} where user_id = '${OTHER}'`), 1, `default id ${table}`);
      const [cols, vals] = minimalRow[table](3);
      await assert.rejects(
        () => db.exec(`insert into public.${table} (${cols}, user_id) values (${vals}, '${OWNER}')`),
        /row-level security/, `insert as owner ${table}`,
      );
    }
  });
  // nothing leaked into the owner's data
  for (const table of PERSONAL) assert.equal(await count(db, `select count(*) as n from public.${table} where user_id = '${OWNER}'`), 1, table);
});

test('a second person cannot change or delete the owner\'s rows, or take one over', async () => {
  const db = await world();
  await asUser(db, OTHER, async () => {
    for (const table of PERSONAL) {
      assert.equal((await db.query(`update public.${table} set user_id = '${OTHER}' returning 1`)).rows.length, 0, `take over ${table}`);
      assert.equal((await db.query(`delete from public.${table} returning 1`)).rows.length, 0, `delete ${table}`);
    }
  });
  for (const table of PERSONAL) assert.equal(await count(db, `select count(*) as n from public.${table} where user_id = '${OWNER}'`), 1, table);
});

test('a person cannot hand their own row to someone else', async () => {
  const db = await world();
  await asUser(db, OWNER, async () => {
    for (const table of PERSONAL) {
      await assert.rejects(() => db.exec(`update public.${table} set user_id = '${OTHER}'`), /row-level security/, table);
    }
  });
});

test('the owner can still insert, update and delete in every table', async () => {
  const db = await world();
  await asUser(db, OWNER, async () => {
    for (const table of PERSONAL) {
      const rows = table === 'profile' ? 1 : 2; // a person has one profile, and the owner already has theirs
      if (table !== 'profile') await insertRow(db, table, 2);
      const key = minimalRow[table](2)[0].split(',')[0].trim();
      assert.equal((await db.query(`update public.${table} set ${key} = ${key} returning 1`)).rows.length, rows, `update ${table}`);
      assert.equal((await db.query(`delete from public.${table} returning 1`)).rows.length, rows, `delete ${table}`);
    }
  });
});

test('a signed-in caller with no usable id can neither read nor write', async () => {
  const db = await world();
  await as(db, 'authenticated', null, async () => {
    for (const table of PERSONAL) {
      assert.equal(await rowsOf(db, table), 0, `read ${table}`);
      const [cols, vals] = minimalRow[table](4);
      await assert.rejects(() => db.exec(`insert into public.${table} (${cols}) values (${vals})`), /row-level security|null value/, `insert ${table}`);
    }
  });
});

test('the signed-out role cannot touch any table, and nobody can reach app_owner through the API', async () => {
  const db = await world();
  await asAnon(db, async () => {
    for (const table of [...ALL, 'app_owner']) {
      await assert.rejects(() => db.query(`select * from public.${table}`), /permission denied/, `select ${table}`);
      await assert.rejects(() => db.exec(`insert into public.${table} default values`), /permission denied/, `insert ${table}`);
      await assert.rejects(() => db.exec(`delete from public.${table}`), /permission denied/, `delete ${table}`);
    }
  });
  await asUser(db, OTHER, async () => {
    await assert.rejects(() => db.query('select * from public.app_owner'), /permission denied/);
    await assert.rejects(() => db.exec(`insert into public.app_owner (user_id) values ('${OTHER}')`), /permission denied/);
  });
});

test('the same text key is allowed for different people (supplements, devices, action items), but not twice for one', async () => {
  const db = await world();
  await asUser(db, OTHER, async () => {
    for (const table of TEXT_KEYED) {
      await insertRow(db, table, 1); // the owner already has this key
      await assert.rejects(() => insertRow(db, table, 1), /duplicate key/, `${table} twice for one person`);
    }
  });
  for (const table of TEXT_KEYED) assert.equal(await rowsOf(db, table), 2, table);
});

test('each person has at most one profile', async () => {
  const db = await world();
  await asUser(db, OWNER, async () => assert.rejects(() => insertRow(db, 'profile', 2), /duplicate key/));
  await asUser(db, OTHER, async () => {
    await insertRow(db, 'profile', 1);
    await assert.rejects(() => insertRow(db, 'profile', 2), /duplicate key/);
  });
});

test('saving a day upserts per person: the new app\'s conflict target works for the owner', async () => {
  const db = await world();
  await asUser(db, OWNER, async () => {
    const r = await db.query(`insert into public.daily_logs (log_date, weight) values ('2026-01-01', 70)
                              on conflict (user_id, log_date) do update set weight = excluded.weight returning weight`);
    assert.equal(r.rows[0].weight, 70);
    assert.equal(await rowsOf(db, 'daily_logs'), 1, 'updated the existing day, no second row');
    await db.query(`insert into public.daily_logs (log_date, weight) values ('2026-01-09', 71)
                    on conflict (user_id, log_date) do update set weight = excluded.weight`);
    assert.equal(await rowsOf(db, 'daily_logs'), 2, 'a new day inserts');
  });
});

test('between the two migrations the old app keeps working, and a second person cannot yet share a date', async () => {
  const db = await world({ stage: 'expanded' });
  await asUser(db, OWNER, async () => {
    // the current app's save: upsert on log_date
    await db.query(`insert into public.daily_logs (log_date, weight) values ('2026-01-01', 69)
                    on conflict (log_date) do update set weight = excluded.weight`);
    assert.equal(await rowsOf(db, 'daily_logs'), 1);
  });
  await asUser(db, OTHER, async () => {
    await assert.rejects(() => db.exec(`insert into public.daily_logs (log_date) values ('2026-01-01')`), /duplicate key/);
  });
});

test('after the second migration two people can log the same date, and the old conflict target is gone', async () => {
  const db = await world({ stage: 'contracted' });
  await asUser(db, OTHER, async () => {
    await db.exec(`insert into public.daily_logs (log_date, weight) values ('2026-01-01', 80)`);
    assert.equal(await rowsOf(db, 'daily_logs'), 1);
    await db.query(`insert into public.daily_logs (log_date, weight) values ('2026-01-01', 81)
                    on conflict (user_id, log_date) do update set weight = excluded.weight`);
    assert.equal((await db.query('select weight from public.daily_logs')).rows[0].weight, 81);
  });
  await asUser(db, OWNER, async () => {
    assert.equal((await db.query('select weight from public.daily_logs')).rows.length, 1);
    await assert.rejects(
      () => db.query(`insert into public.daily_logs (log_date) values ('2026-01-01') on conflict (log_date) do nothing`),
      /no unique or exclusion constraint/,
    );
  });
});

test('the second migration refuses to run before the first', async () => {
  const db = await world({ stage: 'live' });
  await assert.rejects(() => runScript(db, CONTRACT), /apply 20261005000100_per_user_data.sql first/);
});

test('deleting an account removes that person\'s data and leaves everyone else\'s', async () => {
  const db = await world();
  await asUser(db, OTHER, async () => {
    for (const table of PERSONAL) await insertRow(db, table, 2);
  });
  await db.exec(`delete from auth.users where id = '${OTHER}'`);
  for (const table of PERSONAL) {
    assert.equal(await count(db, `select count(*) as n from public.${table} where user_id = '${OTHER}'`), 0, `gone ${table}`);
    assert.equal(await count(db, `select count(*) as n from public.${table} where user_id = '${OWNER}'`), 1, `kept ${table}`);
  }
});

test('three people each see exactly their own rows', async () => {
  const db = await world({ stage: 'contracted' });
  for (const id of [OTHER, THIRD]) {
    await asUser(db, id, async () => {
      await insertRow(db, 'daily_logs', 5);
      await insertRow(db, 'medications', 5);
    });
  }
  for (const id of [OWNER, OTHER, THIRD]) {
    await asUser(db, id, async () => {
      const ids = (await db.query('select distinct user_id from public.daily_logs')).rows.map((r) => r.user_id);
      assert.deepEqual(ids, [id]);
      const meds = (await db.query('select distinct user_id from public.medications')).rows.map((r) => r.user_id);
      assert.deepEqual(meds, [id]);
    });
  }
});

test('every personal table has a not-null user id that cascades from the account', async () => {
  const db = await world();
  for (const table of PERSONAL) {
    const col = await db.query(`select is_nullable, column_default from information_schema.columns
                                where table_schema = 'public' and table_name = '${table}' and column_name = 'user_id'`);
    assert.equal(col.rows[0]?.is_nullable, 'NO', `${table} not null`);
    assert.match(col.rows[0]?.column_default ?? '', /auth\.uid\(\)/, `${table} default`);
    const fk = await db.query(`select pg_get_constraintdef(oid) as def from pg_constraint
                               where conrelid = 'public.${table}'::regclass and contype = 'f' and pg_get_constraintdef(oid) like '%auth.users%'`);
    assert.match(fk.rows[0]?.def ?? '', /ON DELETE CASCADE/, `${table} cascade`);
  }
});

test('every table has row level security and exactly one policy: own rows for personal tables, read-only for reference tables', async () => {
  const db = await world();
  const open = await db.query(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
                               where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`);
  assert.deepEqual(open.rows, []);
  const { rows } = await db.query(`select tablename, policyname, roles, cmd from pg_policies where schemaname = 'public' order by tablename`);
  assert.deepEqual(rows.map((r) => r.tablename), [...ALL].sort());
  for (const row of rows) {
    assert.deepEqual(row.roles, ['authenticated'], row.tablename);
    if (REFERENCE.includes(row.tablename)) {
      assert.equal(row.policyname, 'read_reference', row.tablename);
      assert.equal(row.cmd, 'SELECT', row.tablename);
    } else {
      assert.equal(row.policyname, 'own_rows', row.tablename);
      assert.equal(row.cmd, 'ALL', row.tablename);
    }
  }
  const anon = await db.query(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
                               where n.nspname = 'public' and c.relkind = 'r' and has_table_privilege('anon', c.oid, 'select')`);
  assert.deepEqual(anon.rows, []);
});

test('the first migration can be applied twice without changing the result', async () => {
  const db = await world();
  await runScript(db, EXPAND);
  const policies = await db.query(`select count(*) as n from pg_policies where schemaname = 'public'`);
  assert.equal(Number(policies.rows[0].n), ALL.length);
  await asUser(db, OWNER, async () => assert.equal(await rowsOf(db, 'daily_logs'), 1));
  await asUser(db, OTHER, async () => assert.equal(await rowsOf(db, 'daily_logs'), 0));
});

test('tables created after the migration are closed to the signed-out role', async () => {
  const db = await world();
  await db.exec('create table public.created_later (id int)');
  assert.equal((await db.query(`select has_table_privilege('anon', 'public.created_later', 'select') as ok`)).rows[0].ok, false);
  assert.equal((await db.query(`select has_table_privilege('authenticated', 'public.created_later', 'select') as ok`)).rows[0].ok, true);
});

// ── supplement schedule ──────────────────────────────────────────────────────────────────────────────

const DEFAULT_DAYS = '{0,1,2,3,4,5,6}';
const scheduleOf = async (db, name) => (await db.query('select days_of_week::text as days, doses_per_day from public.medications where name = $1', [name])).rows[0];

test('the schedule migration gives every existing supplement every day, and the old app\'s inserts still work', async () => {
  const db = await world({ stage: 'live', schedule: 'before' });
  assert.equal((await scheduleOf(db, 'med1')).days, DEFAULT_DAYS, 'existing row');
  await db.exec(`insert into public.medications (name, dosage, frequency) values ('old app', '5 g', 'daily')`);
  assert.equal((await scheduleOf(db, 'old app')).days, DEFAULT_DAYS, 'insert that does not mention the column');
});

test('days of the week must be between 0 and 6, at least one and at most seven', async () => {
  const db = await world({ stage: 'live', schedule: 'before' });
  const days = (value) => db.exec(`insert into public.medications (name, days_of_week) values ('t', '${value}')`);
  for (const bad of ['{}', '{7}', '{-1}', '{0,1,2,3,4,5,6,0}', '{1,9}']) {
    await assert.rejects(() => days(bad), /medications_days_of_week_valid/, bad);
  }
  for (const good of ['{0}', '{1,3,5}', '{6,0}', DEFAULT_DAYS]) await days(good);
  await assert.rejects(() => db.exec(`insert into public.medications (name, days_of_week) values ('t', null)`), /null value/);
});

test('doses a day must be a whole number from 1 to 6, or blank', async () => {
  const db = await world({ stage: 'live', schedule: 'before' });
  const doses = (value) => db.exec(`insert into public.medications (name, doses_per_day) values ('t', ${value})`);
  for (const bad of ['0', '7', '1.5', '-1', '100']) await assert.rejects(() => doses(bad), /medications_doses_per_day_valid/, bad);
  for (const good of ['null', '1', '2', '6', '3.0']) await doses(good);
});

test('the schedule migration can be applied twice without changing the result', async () => {
  const db = await world({ stage: 'live', schedule: 'before' });
  await db.exec(`update public.medications set days_of_week = '{1,3}' where name = 'med1'`);
  await runScript(db, SCHEDULE);
  assert.equal((await scheduleOf(db, 'med1')).days, '{1,3}', 'a saved schedule survives a second run');
  assert.equal(await count(db, `select count(*) as n from pg_constraint where conrelid = 'public.medications'::regclass and conname like 'medications_%_valid'`), 2);
});

test('the schedule migration and the per-user one work in either order, and a schedule survives both', async () => {
  for (const order of ['before', 'after']) {
    const db = await world({ stage: 'expanded', schedule: order });
    await asUser(db, OWNER, async () => {
      await db.exec(`update public.medications set days_of_week = '{0}', doses_per_day = 2 where name = 'med1'`);
      const row = await scheduleOf(db, 'med1');
      assert.equal(row.days, '{0}', `${order}: days`);
      assert.equal(Number(row.doses_per_day), 2, `${order}: doses`);
    });
    await db.exec('delete from public.medications');
  }
});

test('a second person cannot see or change the owner\'s supplement schedule', async () => {
  const db = await world({ stage: 'expanded', schedule: 'after' });
  await asUser(db, OTHER, async () => {
    assert.equal(await rowsOf(db, 'medications'), 0, 'cannot read');
    await db.exec(`update public.medications set days_of_week = '{3}'`);
  });
  assert.equal((await scheduleOf(db, 'med1')).days, DEFAULT_DAYS, 'owner\'s schedule unchanged');
  await asUser(db, OTHER, async () => {
    await db.exec(`insert into public.medications (name, days_of_week) values ('mine', '{2,4}')`);
    assert.equal((await scheduleOf(db, 'mine')).days, '{2,4}');
  });
  await asUser(db, OWNER, async () => assert.equal(await count(db, `select count(*) as n from public.medications where name = 'mine'`), 0, 'owner cannot see theirs'));
});

// ── habits ───────────────────────────────────────────────────────────────────────────────────────────

const habit = (cols, vals) => `insert into public.habits (${cols}) values (${vals})`;

test('a person can create their own habit, it is filled in with their id, and they cannot create one for someone else', async () => {
  const db = await world({ stage: 'live', habits: 'before' });
  await asUser(db, OWNER, async () => {
    await db.exec(habit('name, kind', `'Lift', 'yesno'`));
    assert.equal(await count(db, `select count(*) as n from public.habits where user_id = '${OWNER}'`), 1);
    await assert.rejects(() => db.exec(habit('user_id, name, kind', `'${OTHER}', 'Lift', 'yesno'`)), /row-level security/);
  });
});

test('habits are private: another person sees none of them, and cannot change or delete them', async () => {
  const db = await world({ stage: 'live', habits: 'before' });
  await asUser(db, OWNER, () => db.exec(habit('name, kind', `'Lift', 'yesno'`)));
  await asUser(db, OTHER, async () => {
    assert.equal(await rowsOf(db, 'habits'), 0, 'cannot read');
    await db.exec(`update public.habits set name = 'taken'`);
    await db.exec(`delete from public.habits`);
  });
  assert.equal(await count(db, `select count(*) as n from public.habits where name = 'Lift'`), 1, 'untouched');
});

test('the signed-out role cannot read or write habits', async () => {
  const db = await world({ stage: 'live', habits: 'before' });
  await asAnon(db, async () => {
    await assert.rejects(() => db.exec('select * from public.habits'), /permission denied/);
    await assert.rejects(() => db.exec(habit('name, kind', `'x', 'count'`)), /permission denied/);
  });
});

test('a habit needs a sensible name, kind, goal and unit, and a yes or no carries neither goal nor unit', async () => {
  const db = await world({ stage: 'live', habits: 'before' });
  // as the signed-in owner, so user_id is filled in and it is the check under test that speaks, not the not-null rule
  const ok = (cols, vals) => asUser(db, OWNER, () => db.exec(habit(cols, vals)));
  for (const [what, cols, vals, rule] of [
    ['empty name', 'name, kind', `'', 'count'`, /habits_name_check/],
    ['blank name', 'name, kind', `'   ', 'count'`, /habits_name_check/],
    ['long name', 'name, kind', `'${'x'.repeat(61)}', 'count'`, /habits_name_check/],
    ['unknown kind', 'name, kind', `'a', 'tally'`, /habits_kind_check/],
    ['unknown direction', 'name, kind, better', `'a', 'count', 'sideways'`, /habits_better_check/],
    ['negative goal', 'name, kind, goal', `'a', 'count', -1`, /habits_goal_check/],
    ['huge goal', 'name, kind, goal', `'a', 'amount', 100001`, /habits_goal_check/],
    ['long unit', 'name, kind, unit', `'a', 'amount', '${'u'.repeat(21)}'`, /habits_unit_check/],
    ['blank unit', 'name, kind, unit', `'a', 'amount', ' '`, /habits_unit_check/],
    ['yes or no with a goal', 'name, kind, goal', `'a', 'yesno', 5`, /habits_yesno_has_no_goal/],
    ['yes or no with a unit', 'name, kind, unit', `'a', 'yesno', 'x'`, /habits_yesno_has_no_goal/],
  ]) {
    await assert.rejects(() => ok(cols, vals), rule, what);
  }
  await ok('name, kind', `'Lift', 'yesno'`);
  await ok('name, kind, better, goal', `'Cigarettes', 'count', 'lower', 0`);
  await ok('name, kind, unit, goal', `'Steps', 'amount', 'steps', 9000`);
  await ok('name, kind, goal', `'Max', 'amount', 100000`);
});

test('the daily log gets a habits column that starts as an empty object and must stay an object', async () => {
  const db = await world({ stage: 'live', habits: 'before' });
  assert.equal((await db.query(`select habits::text as h from public.daily_logs`)).rows[0].h, '{}', 'existing row');
  await db.exec(`insert into public.daily_logs (log_date, cigs) values ('2026-02-01', 3)`);
  assert.equal((await db.query(`select habits::text as h from public.daily_logs where log_date = '2026-02-01'`)).rows[0].h, '{}', 'insert from the old app');
  for (const bad of ['[]', '"x"', '3', 'null']) {
    await assert.rejects(() => db.exec(`update public.daily_logs set habits = '${bad}'::jsonb`), /daily_logs_habits_is_object/, bad);
  }
  await assert.rejects(() => db.exec(`update public.daily_logs set habits = null`), /null value/);
  await db.exec(`update public.daily_logs set habits = '{"a": {"value": 2, "note": "n"}}'`);
});

test('the habits migration can be applied twice, and in either order with the per-user one', async () => {
  const db = await world({ stage: 'live', habits: 'before' });
  await asUser(db, OWNER, () => db.exec(habit('name, kind', `'Lift', 'yesno'`)));
  await runScript(db, HABITS);
  assert.equal(await count(db, 'select count(*) as n from public.habits'), 1, 'a second run keeps the data');
  assert.equal(await count(db, `select count(*) as n from pg_policies where schemaname = 'public' and tablename = 'habits'`), 1, 'still one policy');
  for (const order of ['before', 'after']) {
    const w = await world({ stage: 'expanded', habits: order });
    await asUser(w, OWNER, () => w.exec(habit('name, kind', `'Lift', 'yesno'`)));
    await asUser(w, OTHER, async () => assert.equal(await rowsOf(w, 'habits'), 0, `${order}: private`));
    await asUser(w, OWNER, async () => assert.equal(await rowsOf(w, 'habits'), 1, `${order}: own`));
    // saving a day still works with the new column present
    await asUser(w, OWNER, () => w.exec(`insert into public.daily_logs (log_date, habits) values ('2026-03-01', '{"x": {"value": true}}')`));
  }
});

test('deleting an account removes that person\'s habits and leaves everyone else\'s', async () => {
  const db = await world({ stage: 'live', habits: 'before' });
  await asUser(db, OWNER, () => db.exec(habit('name, kind', `'Lift', 'yesno'`)));
  await asUser(db, OTHER, () => db.exec(habit('name, kind', `'Core', 'yesno'`)));
  await db.exec(`delete from auth.users where id = '${OTHER}'`);
  assert.deepEqual((await db.query('select name from public.habits')).rows.map((r) => r.name), ['Lift']);
});

// the one-off that carries the original owner's hardcoded habits across
const habitsOf = async (db) => (await db.query(`select name, kind, unit, goal::text as goal, better, sort_order from public.habits order by sort_order`)).rows;
const logHabits = async (db, date) => {
  const { rows } = await db.query(`select habits from public.daily_logs where log_date = $1`, [date]);
  const byName = Object.fromEntries((await db.query('select id::text, name from public.habits')).rows.map((h) => [h.id, h.name]));
  return Object.fromEntries(Object.entries(rows[0].habits).map(([id, entry]) => [byName[id], entry]));
};
async function seededWorld(options = {}) {
  const db = await world({ stage: 'live', habits: 'before', ...options });
  await db.exec(`
    delete from public.daily_logs;
    insert into public.daily_logs (log_date, cigs, lift, core, cardio, steps) values
      ('2026-04-01', 3, 'yes', 'no', 'yes', 8200),
      ('2026-04-02', 0, 'no', 'yes', 'bad', null),
      ('2026-04-03', null, null, null, 'no', 12000),
      ('2026-04-04', null, null, null, null, null);`);
  return db;
}

test('the seed creates the five habits the app used to hardcode, in the old order', async () => {
  const db = await seededWorld();
  await runScript(db, SEED_HABITS);
  assert.deepEqual(await habitsOf(db), [
    { name: 'Cigarettes', kind: 'count', unit: null, goal: '0', better: 'lower', sort_order: 0 },
    { name: 'Lift', kind: 'yesno', unit: null, goal: null, better: 'higher', sort_order: 1 },
    { name: 'Core', kind: 'yesno', unit: null, goal: null, better: 'higher', sort_order: 2 },
    { name: 'Cardio', kind: 'yesno', unit: null, goal: null, better: 'higher', sort_order: 3 },
    { name: 'Steps', kind: 'amount', unit: 'steps', goal: '9000', better: 'higher', sort_order: 4 },
  ]);
  assert.equal(await count(db, `select count(*) as n from public.habits where user_id = '${OWNER}'`), 5, 'all belong to the registered owner');
});

test('the steps goal comes from the person\'s own saved step target when they have one', async () => {
  const db = await seededWorld();
  await db.exec('update public.profile set step_target = 11000');
  await runScript(db, SEED_HABITS);
  assert.equal((await habitsOf(db)).find((h) => h.name === 'Steps').goal, '11000');
});

test('the seed copies each day\'s old columns into habits, with cardio words kept as notes', async () => {
  const db = await seededWorld();
  await runScript(db, SEED_HABITS);
  assert.deepEqual(await logHabits(db, '2026-04-01'), {
    Cigarettes: { value: 3 }, Lift: { value: true }, Core: { value: false }, Cardio: { value: true, note: 'Stairmaster' }, Steps: { value: 8200 },
  });
  assert.deepEqual(await logHabits(db, '2026-04-02'), {
    Cigarettes: { value: 0 }, Lift: { value: false }, Core: { value: true }, Cardio: { value: true, note: 'Badminton' },
  });
  assert.deepEqual(await logHabits(db, '2026-04-03'), { Cardio: { value: false }, Steps: { value: 12000 } });
  assert.deepEqual(await logHabits(db, '2026-04-04'), {}, 'a day with nothing recorded stays empty');
  assert.equal(await count(db, `select count(*) as n from public.daily_logs where cigs = 3 and lift = 'yes'`), 1, 'the old columns are left as they were');
});

test('running the seed again changes nothing, but picks up days logged since and never overwrites a habit value', async () => {
  const db = await seededWorld();
  await runScript(db, SEED_HABITS);
  const before = JSON.stringify((await db.query('select log_date::text, habits from public.daily_logs order by log_date')).rows);
  await runScript(db, SEED_HABITS);
  assert.equal(JSON.stringify((await db.query('select log_date::text, habits from public.daily_logs order by log_date')).rows), before, 'idempotent');
  assert.equal(await count(db, 'select count(*) as n from public.habits'), 5, 'no duplicate habits');

  // the new app already wrote a different cigarette count for the first day, and the old app logged a new day
  const cig = (await db.query(`select id::text from public.habits where name = 'Cigarettes'`)).rows[0].id;
  await db.query(`update public.daily_logs set habits = jsonb_set(habits, array[$1], '{"value": 99}') where log_date = '2026-04-01'`, [cig]);
  await db.exec(`insert into public.daily_logs (log_date, cigs, lift) values ('2026-04-05', 1, 'yes')`);
  await runScript(db, SEED_HABITS);
  assert.equal((await logHabits(db, '2026-04-01')).Cigarettes.value, 99, 'a value already in habits is kept');
  assert.deepEqual(await logHabits(db, '2026-04-05'), { Cigarettes: { value: 1 }, Lift: { value: true } }, 'the new day is filled in');
});

test('the seed leaves a habit a person already made alone, and only adds the ones that are missing', async () => {
  const db = await seededWorld();
  await db.exec(`insert into public.habits (user_id, name, kind, goal, better) values ('${OWNER}', 'Lift', 'count', 4, 'higher')`);
  await runScript(db, SEED_HABITS);
  const lift = (await habitsOf(db)).filter((h) => h.name === 'Lift');
  assert.equal(lift.length, 1);
  assert.equal(lift[0].kind, 'count', 'their version is kept');
  assert.equal(await count(db, 'select count(*) as n from public.habits'), 5);
});

test('the seed refuses unless exactly one owner can receive the habits, and changes nothing', async () => {
  for (const owners of [[], [OWNER, OTHER]]) {
    const db = await seededWorld();
    await db.exec('delete from public.app_owner');
    for (const id of owners) await db.query('insert into public.app_owner (user_id) values ($1)', [id]);
    await assert.rejects(() => runScript(db, SEED_HABITS), /expected exactly one row in app_owner/);
    assert.equal(await count(db, 'select count(*) as n from public.habits'), 0);
    assert.equal(await count(db, `select count(*) as n from public.daily_logs where habits <> '{}'::jsonb`), 0);
  }
});

test('after the per-user migration the seed only fills in the owner\'s days, never another person\'s', async () => {
  const db = await world({ stage: 'expanded', habits: 'after' });
  await db.exec(`delete from public.daily_logs`);
  await db.exec(`
    insert into public.daily_logs (user_id, log_date, cigs, lift) values
      ('${OWNER}', '2026-05-01', 2, 'yes'),
      ('${OTHER}', '2026-05-02', 9, 'no');`);
  await runScript(db, SEED_HABITS);
  const mine = await db.query(`select habits::text as h from public.daily_logs where user_id = '${OWNER}'`);
  const theirs = await db.query(`select habits::text as h from public.daily_logs where user_id = '${OTHER}'`);
  assert.notEqual(mine.rows[0].h, '{}', 'the owner\'s day is filled in');
  assert.equal(theirs.rows[0].h, '{}', 'the other person\'s day is untouched');
});
