import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

// The cleanup after the 5 Oct per-person change (INT-67): one word carried into habits, then the screening tables,
// the old columns, the owner check and the backup schema are dropped. The suite builds the database the way the
// live project got there, applies every earlier migration in order, and then the cleanup.

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
// MIGRATIONS_DIR lets a mutation check point the suite at a deliberately broken copy
const DIR = process.env.MIGRATIONS_DIR ?? '../migrations';
const CLEANUP_FILE = '20261015000100_cleanup_after_per_user_change.sql';
const EARLIER = readdirSync(fileURLToPath(new URL(DIR, import.meta.url))).filter((f) => f.endsWith('.sql') && f < CLEANUP_FILE).sort();
const CLEANUP = read(`${DIR}/${CLEANUP_FILE}`);
// A data fix that ran once on the live project: carries the owner's old hardcoded habits into the habits table.
const SEED_HABITS = read(`${process.env.ONE_OFF_DIR ?? '../one-off'}/20261005_seed_owner_habits.sql`);

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const THIRD = '44444444-4444-4444-8444-444444444444';
const BIOMARKER = '33333333-3333-4333-8333-333333333333';

const PERSONAL = [
  'biomarker_readings', 'daily_logs', 'body_composition', 'cardio_metrics', 'profile', 'meals',
  'photo_log', 'medications', 'diagnoses', 'screening_history', 'action_items', 'devices', 'supplement_catalog',
];
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

async function runScript(db, sql) {
  try {
    await db.exec(sql);
  } catch (error) {
    await db.exec('rollback');
    throw error;
  }
}

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

/**
 * The live project just before the cleanup: the old tables with the owner's data, every earlier migration applied,
 * the habits seed already run, and a copy of the data in a backup schema.
 * Extra days (all dated June 2026) cover each case the cleanup has to handle.
 */
async function buildWorld() {
  const db = new PGlite();
  await db.exec(read('./fixtures/supabase-stub.sql'));
  await db.exec(read('./fixtures/pre-lockdown.sql'));
  await db.exec(`
    insert into public.biomarkers (id, code, name, unit, category) values ('${BIOMARKER}', 'potassium', 'Potassium', 'mmol/L', 'electrolytes');
    insert into public.screening_rules (code, label) values ('bp', 'Blood pressure');`);
  for (const table of PERSONAL) {
    const [cols, vals] = minimalRow[table](1);
    await db.exec(`insert into public.${table} (${cols}) values (${vals})`);
  }
  for (const id of [OWNER, OTHER, THIRD]) await db.query('insert into auth.users (id, email) values ($1, $2)', [id, `${id}@example.test`]);

  for (const file of EARLIER) {
    await runScript(db, read(`${DIR}/${file}`));
    // the owner is registered once the owner tables exist and before the lockdown, as on the live project
    if (file === '20261001000150_private_is_owner.sql') await db.query('insert into public.app_owner (user_id) values ($1)', [OWNER]);
  }

  // the owner's old days, copied into habits by the one-off seed. 'stairs' is a word the seed has no mapping for.
  await db.exec(`
    insert into public.daily_logs (user_id, log_date, lift, core, cardio, cigs, steps) values
      ('${OWNER}', '2026-06-18', 'yes', 'yes', 'yes',    3, null),
      ('${OWNER}', '2026-06-19', 'yes', 'yes', 'stairs', 1, 7240),
      ('${OWNER}', '2026-06-20', 'no',  'no',  'bad',    0, null),
      ('${OWNER}', '2026-06-22', null,  null,  'No',     0, null),
      ('${OWNER}', '2026-06-23', null,  null,  '  ',     0, null),
      ('${OWNER}', '2026-06-24', null,  null,  null,     0, null)`);
  await runScript(db, SEED_HABITS);

  // days added after the seed ran, as the live project has: one where the person already has a Cardio entry
  const cardio = (await db.query(`select id from public.habits where user_id = '${OWNER}' and name = 'Cardio'`)).rows[0].id;
  await db.exec(`
    insert into public.daily_logs (user_id, log_date, cardio, habits)
      values ('${OWNER}', '2026-06-21', 'walk', '{"${cardio}": {"value": false}}')`);

  // OTHER has an archived Cardio habit made first and a current one; THIRD has none at all
  await db.exec(`
    insert into public.habits (user_id, name, kind, archived_at, created_at) values ('${OTHER}', 'Cardio', 'yesno', '2026-02-01', '2026-01-01');
    insert into public.habits (user_id, name, kind, created_at) values ('${OTHER}', 'Cardio', 'yesno', '2026-03-01');
    insert into public.daily_logs (user_id, log_date, cardio) values ('${OTHER}', '2026-06-19', ' Stairs ');
    insert into public.daily_logs (user_id, log_date, cardio) values ('${THIRD}', '2026-06-19', 'stairs')`);

  // the copy made before the per-person change
  await db.exec(`create schema backup_20261005; create table backup_20261005.daily_logs as select * from public.daily_logs`);
  return db;
}

// Building the world applies every migration, which is slow, so it is done once and each test gets its own copy.
let dumped;
const open = [];
async function worldBeforeCleanup() {
  dumped ??= buildWorld().then(async (db) => {
    const data = await db.dumpDataDir();
    await db.close();
    return data;
  });
  const db = new PGlite({ loadDataDir: await dumped });
  open.push(db);
  return db;
}
// an open database keeps the test process alive, so every copy is closed when the file is done
after(async () => {
  for (const db of open) await db.close();
});

const OWNER_CARDIO = `(select id::text from public.habits where user_id = '${OWNER}' and name = 'Cardio')`;
const habitsOn = async (db, user, day) =>
  (await db.query(`select habits from public.daily_logs where user_id = $1 and log_date = $2`, [user, day])).rows[0].habits;
const snapshot = async (db) =>
  (await db.query(`select user_id, log_date::text as d, habits::text as h from public.daily_logs order by user_id, log_date`)).rows;

const existsColumn = async (db, table, column) =>
  (await count(db, `select count(*) as n from information_schema.columns where table_schema = 'public' and table_name = '${table}' and column_name = '${column}'`)) === 1;
const existsTable = async (db, schema, table) =>
  (await count(db, `select count(*) as n from information_schema.tables where table_schema = '${schema}' and table_name = '${table}'`)) === 1;

test('before the cleanup, everything it removes is there (so the checks below can fail)', async () => {
  const db = await worldBeforeCleanup();
  for (const table of ['screening_history', 'screening_rules', 'app_owner']) assert.ok(await existsTable(db, 'public', table), table);
  assert.ok(await existsTable(db, 'backup_20261005', 'daily_logs'));
  assert.equal(await count(db, `select count(*) as n from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'private' and p.proname = 'is_owner'`), 1);
  for (const column of ['lift', 'core', 'cardio', 'cigs', 'steps']) assert.ok(await existsColumn(db, 'daily_logs', column), column);
  assert.ok(await existsColumn(db, 'medications', 'paracetamol_mg_per_dose'));
  for (const column of ['family_colorectal_cancer', 'family_prostate_cancer', 'noise_or_blast_exposure']) assert.ok(await existsColumn(db, 'profile', column), column);
});

test('the one cardio word the seed could not map is carried into the Cardio habit, as a yes with the word as the note', async () => {
  const db = await worldBeforeCleanup();
  assert.equal((await habitsOn(db, OWNER, '2026-06-19'))[(await db.query(`select ${OWNER_CARDIO} as id`)).rows[0].id], undefined, 'the seed left that day without a Cardio entry');
  await runScript(db, CLEANUP);
  const cardio = (await db.query(`select ${OWNER_CARDIO} as id`)).rows[0].id;
  const day = await habitsOn(db, OWNER, '2026-06-19');
  assert.deepEqual(day[cardio], { value: true, note: 'Stairs' });
  const cigarettes = (await db.query(`select id from public.habits where user_id = '${OWNER}' and name = 'Cigarettes'`)).rows[0].id;
  const steps = (await db.query(`select id from public.habits where user_id = '${OWNER}' and name = 'Steps'`)).rows[0].id;
  assert.deepEqual(day[cigarettes], { value: 1 }, 'what the seed copied for that day is untouched');
  assert.deepEqual(day[steps], { value: 7240 });
});

test('nothing else in any daily log changes: mapped words, a day that already has a Cardio entry, blank and empty values', async () => {
  const db = await worldBeforeCleanup();
  const before = await snapshot(db);
  await runScript(db, CLEANUP);
  const after = await snapshot(db);
  assert.equal(after.length, before.length, 'no day is deleted');
  const changed = after.filter((row, i) => row.h !== before[i].h).map((row) => `${row.user_id} ${row.d}`);
  // the owner's 19 Jun and OTHER's 19 Jun (the word with spaces and a capital) are the only days that change
  assert.deepEqual(changed.sort(), [`${OTHER} 2026-06-19`, `${OWNER} 2026-06-19`].sort());
  const cardio = (await db.query(`select ${OWNER_CARDIO} as id`)).rows[0].id;
  assert.deepEqual((await habitsOn(db, OWNER, '2026-06-21'))[cardio], { value: false }, 'an existing Cardio entry is never overwritten');
});

test('with two Cardio habits the current one gets the word, and a person with no Cardio habit gets nothing and does not stop the run', async () => {
  const db = await worldBeforeCleanup();
  await runScript(db, CLEANUP);
  const current = (await db.query(`select id from public.habits where user_id = '${OTHER}' and archived_at is null`)).rows[0].id;
  const archived = (await db.query(`select id from public.habits where user_id = '${OTHER}' and archived_at is not null`)).rows[0].id;
  const day = await habitsOn(db, OTHER, '2026-06-19');
  assert.deepEqual(day[current], { value: true, note: 'Stairs' }, 'trimmed and capitalised');
  assert.equal(day[archived], undefined);
  assert.deepEqual(await habitsOn(db, THIRD, '2026-06-19'), {}, 'no Cardio habit, nothing to write into');
});

test('the screening tables, owner check, backup schema and old columns are gone', async () => {
  const db = await worldBeforeCleanup();
  await runScript(db, CLEANUP);
  for (const table of ['screening_history', 'screening_rules', 'app_owner']) assert.equal(await existsTable(db, 'public', table), false, table);
  assert.equal(await count(db, `select count(*) as n from pg_namespace where nspname = 'backup_20261005'`), 0, 'the backup schema');
  assert.equal(await count(db, `select count(*) as n from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'private' and p.proname = 'is_owner'`), 0, 'is_owner()');
  for (const column of ['lift', 'core', 'cardio', 'cigs', 'steps']) assert.equal(await existsColumn(db, 'daily_logs', column), false, column);
  assert.equal(await existsColumn(db, 'medications', 'paracetamol_mg_per_dose'), false);
  for (const column of ['family_colorectal_cancer', 'family_prostate_cancer', 'noise_or_blast_exposure']) assert.equal(await existsColumn(db, 'profile', column), false, column);
});

test('only those things go: every other table keeps its rows and every other column stays', async () => {
  const db = await worldBeforeCleanup();
  const dropped = new Set(['public.screening_history', 'public.screening_rules', 'public.app_owner']);
  const droppedColumns = new Set([
    'daily_logs.lift', 'daily_logs.core', 'daily_logs.cardio', 'daily_logs.cigs', 'daily_logs.steps',
    'medications.paracetamol_mg_per_dose', 'profile.family_colorectal_cancer', 'profile.family_prostate_cancer', 'profile.noise_or_blast_exposure',
  ]);
  const tables = async () => (await db.query(`select table_name as t from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1`)).rows.map((r) => r.t);
  const columns = async () => (await db.query(`select table_name || '.' || column_name as c from information_schema.columns where table_schema = 'public' order by 1`)).rows.map((r) => r.c);
  const counts = async () => Object.fromEntries(await Promise.all((await tables()).map(async (t) => [t, await count(db, `select count(*) as n from public."${t}"`)])));

  const [tablesBefore, columnsBefore, countsBefore] = [await tables(), await columns(), await counts()];
  await runScript(db, CLEANUP);
  const [tablesAfter, columnsAfter, countsAfter] = [await tables(), await columns(), await counts()];

  assert.deepEqual(tablesAfter, tablesBefore.filter((t) => !dropped.has(`public.${t}`)));
  assert.deepEqual(columnsAfter, columnsBefore.filter((c) => !droppedColumns.has(c) && !dropped.has(`public.${c.split('.')[0]}`)));
  for (const t of tablesAfter) assert.equal(countsAfter[t], countsBefore[t], `${t} keeps all its rows`);
});

test('a view that still depends on a column stops the whole cleanup and nothing is lost, rather than being dropped silently', async () => {
  const db = await worldBeforeCleanup();
  await db.exec('create view public.old_steps as select log_date, steps from public.daily_logs');
  const before = await snapshot(db);
  await assert.rejects(() => runScript(db, CLEANUP), /depend on it|cannot drop/);
  assert.ok(await existsColumn(db, 'daily_logs', 'steps'));
  assert.ok(await existsTable(db, 'public', 'screening_rules'));
  assert.ok(await existsTable(db, 'public', 'app_owner'));
  assert.equal(await count(db, `select count(*) as n from pg_namespace where nspname = 'backup_20261005'`), 1, 'the backup schema survives a refused run');
  assert.deepEqual(await snapshot(db), before, 'the carried word is rolled back too');
});

test('the cleanup can be applied twice without changing the result', async () => {
  const db = await worldBeforeCleanup();
  await runScript(db, CLEANUP);
  const once = await snapshot(db);
  await runScript(db, CLEANUP);
  assert.deepEqual(await snapshot(db), once);
});

test('on a database that never had the backup schema or the old columns, the cleanup is a no-op', async () => {
  const db = await worldBeforeCleanup();
  await db.exec('drop schema backup_20261005 cascade');
  await runScript(db, CLEANUP);
  await runScript(db, CLEANUP);
  assert.equal(await existsTable(db, 'public', 'app_owner'), false);
});

test('people still see only their own rows, the signed-out role still sees nothing, and every other table keeps its policy', async () => {
  const db = await worldBeforeCleanup();
  const policies = async () => (await db.query(`select tablename || ' / ' || policyname as p from pg_policies where schemaname = 'public' order by 1`)).rows.map((r) => r.p);
  const before = await policies();
  await runScript(db, CLEANUP);
  const after = await policies();
  assert.deepEqual(after, before.filter((p) => !p.startsWith('screening_')), 'the same policies, minus the two dropped tables');
  assert.ok(after.includes('daily_logs / own_rows') && after.includes('biomarkers / read_reference'));

  const unprotected = await db.query(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
                                      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`);
  assert.deepEqual(unprotected.rows, []);
  const anon = await db.query(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
                               where n.nspname = 'public' and c.relkind = 'r' and has_table_privilege('anon', c.oid, 'select')`);
  assert.deepEqual(anon.rows, []);

  await asUser(db, OWNER, async () => assert.equal(await count(db, 'select count(*) as n from public.daily_logs where user_id <> auth.uid()'), 0));
  await asUser(db, OTHER, async () => assert.equal(await count(db, 'select count(*) as n from public.daily_logs'), 1));
  await asAnon(db, async () => assert.rejects(() => db.query('select * from public.daily_logs'), /permission denied/));
});

test('saving a day still works, and the old activity columns can no longer be written', async () => {
  const db = await worldBeforeCleanup();
  await runScript(db, CLEANUP);
  await asUser(db, THIRD, async () => {
    await db.exec(`insert into public.daily_logs (log_date, weight, habits) values ('2026-07-01', 80, '{}')`);
    await db.exec(`insert into public.daily_logs (log_date, weight) values ('2026-07-01', 79) on conflict (user_id, log_date) do update set weight = excluded.weight`);
    assert.equal(await count(db, `select count(*) as n from public.daily_logs where log_date = '2026-07-01' and weight = 79`), 1);
    await assert.rejects(() => db.exec(`insert into public.daily_logs (log_date, steps) values ('2026-07-02', 100)`), /column "steps"/);
  });
});

test('deleting an account still works, including the former owner, and removes all of their rows', async () => {
  const db = await worldBeforeCleanup();
  await runScript(db, CLEANUP);
  await asUser(db, OWNER, () => db.exec('select public.delete_my_account()'));
  assert.equal(await count(db, `select count(*) as n from auth.users where id = '${OWNER}'`), 0);
  for (const table of ['daily_logs', 'habits', 'profile', 'medications', 'biomarker_readings']) {
    assert.equal(await count(db, `select count(*) as n from public.${table} where user_id = '${OWNER}'`), 0, table);
  }
  assert.equal(await count(db, `select count(*) as n from auth.users where id = '${OTHER}'`), 1, 'nobody else is touched');
});
