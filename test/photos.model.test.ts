import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runDeletion } from '../src/features/account/deletion.ts';
import {
  BUCKET, compareEnds, daysApart, describeWeightChange, extensionFor, fileProblem, fitWithin, LIMITS, newestFirst, objectPath,
  POSES, roomFor, validateCheckIn, type CheckIn,
} from '../src/features/photos/model.ts';
import { removeAll } from '../src/features/photos/removeAll.ts';

const USER = '11111111-1111-4111-8111-111111111111';
const PHOTO = '22222222-2222-4222-8222-222222222222';
const TODAY = '2026-10-09';

const entry = (over: Partial<CheckIn> & { id: string }): CheckIn => ({
  log_date: '2026-09-01', pose: 'front', label: null, weight: null, storage_path: `${USER}/${over.id}.webp`, ...over,
});

test('a photo is stored at <user id>/<photo id>.jpg or .webp, and nothing else', () => {
  assert.equal(objectPath(USER, PHOTO, 'image/jpeg'), `${USER}/${PHOTO}.jpg`);
  assert.equal(objectPath(USER, PHOTO, 'image/webp'), `${USER}/${PHOTO}.webp`);
  assert.equal(extensionFor('image/png'), null);
  assert.throws(() => objectPath(USER, PHOTO, 'image/png'), /JPEG or WebP/);
  assert.throws(() => objectPath(USER, PHOTO, ''), /JPEG or WebP/);
});

test('a path built here matches the rule the database enforces', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261009000200_photo_check_ins.sql', import.meta.url), 'utf8');
  const rule = /'\/\[0-9a-f-\]\{36\}\\\.\(jpg\|webp\)\$'/;
  assert.ok(rule.test(sql), 'the migration still names files <uuid>.jpg or .webp');
  const path = objectPath(USER, crypto.randomUUID(), 'image/webp');
  assert.match(path, new RegExp(`^${USER}/[0-9a-f-]{36}\\.(jpg|webp)$`));
});

test('the limits here are the limits in the migration', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261009000200_photo_check_ins.sql', import.meta.url), 'utf8');
  assert.ok(sql.includes(`'${BUCKET}'`), 'same bucket name');
  assert.ok(sql.includes(`false, ${LIMITS.maxBytes}`), 'same file size limit, and the bucket is private');
  assert.ok(sql.includes(`< ${LIMITS.maxPhotos}`), 'same cap on photos');
  assert.ok(sql.includes(`char_length(label) <= ${LIMITS.labelChars}`), 'same note length');
  assert.ok(sql.includes(`weight >= ${LIMITS.weightKg.min} and weight <= ${LIMITS.weightKg.max}`), 'same weight range');
  assert.ok(sql.includes(`in ('front', 'side', 'back', 'other')`) && POSES.join() === 'front,side,back,other', 'same poses');
});

test('a picture is scaled down to fit, keeps its shape, and is never enlarged', () => {
  assert.deepEqual(fitWithin(4000, 3000), { width: 1280, height: 960 });
  assert.deepEqual(fitWithin(3000, 4000), { width: 960, height: 1280 });
  assert.deepEqual(fitWithin(1280, 1280), { width: 1280, height: 1280 });
  assert.deepEqual(fitWithin(800, 600), { width: 800, height: 600 }, 'a small picture stays as it is');
  assert.deepEqual(fitWithin(12000, 10), { width: 1280, height: 1 }, 'a thin strip keeps at least one pixel');
  assert.throws(() => fitWithin(0, 100), /no size/);
  assert.throws(() => fitWithin(100, Number.NaN), /no size/);
});

test('a check-in needs a real date that is not in the future, a known angle, a short note and a sane weight', () => {
  const good = { date: '2026-10-09', pose: 'side', label: ' Week 6 ', weight: '81.24' };
  const ok = validateCheckIn(good, TODAY);
  assert.deepEqual(ok, { ok: true, value: { log_date: '2026-10-09', pose: 'side', label: 'Week 6', weight: 81.2 } });

  const blank = validateCheckIn({ date: '2026-10-01', pose: 'back', label: '  ', weight: '' }, TODAY);
  assert.deepEqual(blank, { ok: true, value: { log_date: '2026-10-01', pose: 'back', label: null, weight: null } });

  const bad = (over: Partial<typeof good>) => validateCheckIn({ ...good, ...over }, TODAY);
  const errors = (over: Partial<typeof good>) => { const r = bad(over); assert.equal(r.ok, false); return r.ok ? {} : r.errors; };
  assert.match(errors({ date: '' }).date ?? '', /Choose the date/);
  assert.match(errors({ date: '2026-10-10' }).date ?? '', /not happened yet/);
  assert.match(errors({ date: '2026-02-31' }).date ?? '', /not a valid date/);
  assert.match(errors({ date: 'yesterday' }).date ?? '', /not a valid date/);
  assert.match(errors({ pose: 'selfie' }).pose ?? '', /front, side, back or other/);
  assert.match(errors({ pose: '' }).pose ?? '', /front, side, back or other/);
  assert.match(errors({ label: 'x'.repeat(41) }).label ?? '', /40 characters/);
  assert.equal(bad({ label: 'x'.repeat(40) }).ok, true);
  assert.match(errors({ weight: '12' }).weight ?? '', /between 20 and 500/);
  assert.match(errors({ weight: '501' }).weight ?? '', /between 20 and 500/);
  assert.match(errors({ weight: 'heavy' }).weight ?? '', /between 20 and 500/);
  assert.equal(bad({ date: TODAY }).ok, true, 'today is fine');
});

test('photos are listed newest first, with a steady order within a day', () => {
  const list = newestFirst([
    entry({ id: 'b', log_date: '2026-08-01', pose: 'back' }),
    entry({ id: 'a', log_date: '2026-09-15', pose: 'side' }),
    entry({ id: 'c', log_date: '2026-09-15', pose: 'front' }),
    entry({ id: 'd', log_date: '2026-09-15', pose: null }),
    entry({ id: 'e', log_date: '2026-08-01', pose: 'back' }),
  ]);
  assert.deepEqual(list.map((e) => e.id), ['c', 'a', 'd', 'b', 'e']);
});

test('the first and latest photo of one angle are compared, and only when they are on different days', () => {
  const entries = [
    entry({ id: '3', log_date: '2026-10-01', weight: 78.4 }),
    entry({ id: '1', log_date: '2026-07-10', weight: 82.1 }),
    entry({ id: '2', log_date: '2026-08-20', weight: 80 }),
    entry({ id: '4', log_date: '2026-09-01', pose: 'side' }),
  ];
  const pair = compareEnds(entries, 'front');
  assert.equal(pair?.before.id, '1');
  assert.equal(pair?.after.id, '3');
  assert.equal(pair?.days, 83);
  assert.equal(pair?.weightChange, -3.7);

  assert.equal(compareEnds(entries, 'side'), null, 'one photo is nothing to compare');
  assert.equal(compareEnds(entries, 'back'), null);
  assert.equal(compareEnds([entry({ id: 'x', log_date: '2026-10-01' }), entry({ id: 'y', log_date: '2026-10-01' })], 'front'), null, 'two on the same day');
  assert.equal(compareEnds([...entries, entry({ id: 'z', log_date: '2026-10-05', pose: 'front', storage_path: null })], 'front')?.after.id, '3', 'a row with no picture is skipped');
  const noWeight = compareEnds([entry({ id: 'p', log_date: '2026-01-01' }), entry({ id: 'q', log_date: '2026-02-01', weight: 70 })], 'front');
  assert.equal(noWeight?.weightChange, null, 'no change is claimed when a weight is missing');
});

test('the change in weight is stated plainly and never called good or bad', () => {
  assert.equal(describeWeightChange(-3.2), '-3.2 kg');
  assert.equal(describeWeightChange(0.4), '+0.4 kg');
  assert.equal(describeWeightChange(0), 'no change in weight');
  assert.equal(describeWeightChange(null), null);
  assert.equal(daysApart(1), '1 day apart');
  assert.equal(daysApart(84), '84 days apart');
});

test('room for more photos counts down to zero and no further', () => {
  assert.equal(roomFor(0), 200);
  assert.equal(roomFor(199), 1);
  assert.equal(roomFor(200), 0);
  assert.equal(roomFor(250), 0);
});

test('a chosen file is checked before any work is done on it', () => {
  assert.equal(fileProblem({ type: 'image/jpeg', size: 4_000_000 }), null);
  assert.equal(fileProblem({ type: 'image/heic', size: 4_000_000 }), null, 'the browser decides whether it can open it');
  assert.equal(fileProblem({ type: '', size: 4_000_000, name: 'IMG_1.jpg' }), null, 'some systems give no type');
  assert.match(fileProblem({ type: 'application/pdf', size: 100 }) ?? '', /Choose a photo/);
  assert.match(fileProblem({ type: 'image/png', size: 0 }) ?? '', /empty/);
  assert.match(fileProblem({ type: 'image/png', size: 41 * 1024 * 1024 }) ?? '', /too large/);
});

// ── removing everything, and the order an account is deleted in ──────────────────────────────────────────

function folder(names: string[], opts: { stuck?: boolean } = {}) {
  const remaining = [...names];
  const calls: string[][] = [];
  return {
    remaining,
    calls,
    deps: {
      list: async () => [...remaining],
      remove: async (batch: string[]) => {
        calls.push(batch);
        // Storage answers a delete it may not make with success and nothing removed
        if (opts.stuck) return;
        for (const n of batch) remaining.splice(remaining.indexOf(n), 1);
      },
    },
  };
}

test('removing everything lists again until the folder is empty', async () => {
  const f = folder(['a.jpg', 'b.webp', 'c.jpg']);
  await removeAll(f.deps);
  assert.deepEqual(f.remaining, []);
  assert.deepEqual(f.calls, [['a.jpg', 'b.webp', 'c.jpg']]);
});

test('an empty folder needs no delete at all', async () => {
  const f = folder([]);
  await removeAll(f.deps);
  assert.deepEqual(f.calls, []);
});

test('a delete that silently does nothing is an error, not a success', async () => {
  const f = folder(['a.jpg', 'b.jpg'], { stuck: true });
  await assert.rejects(() => removeAll(f.deps), /2 of your photos could not be removed/);
  assert.equal(f.calls.length, 1, 'it tried once, saw no progress, and stopped');
});

test('a partial removal that keeps making progress finishes', async () => {
  const remaining = ['a', 'b', 'c', 'd'];
  await removeAll({
    list: async () => [...remaining],
    remove: async (batch) => { for (const n of batch.slice(0, 2)) remaining.splice(remaining.indexOf(n), 1); },
  });
  assert.deepEqual(remaining, []);
});

test('an error from listing or removing stops everything', async () => {
  await assert.rejects(() => removeAll({ list: async () => { throw new Error('offline'); }, remove: async () => {} }), /offline/);
  await assert.rejects(() => removeAll({ list: async () => ['a'], remove: async () => { throw new Error('denied'); } }), /denied/);
});

test('a folder that never empties gives up after a fixed number of rounds', async () => {
  let n = 100;
  await assert.rejects(() => removeAll({ list: async () => Array.from({ length: n }, (_, i) => String(i)), remove: async () => { n -= 1; } }, 5), /could not all be removed/);
});

test('an account is deleted after its photos, in that order', async () => {
  const order: string[] = [];
  await runDeletion({ removePhotos: async () => { order.push('photos'); }, deleteAccount: async () => { order.push('account'); } });
  assert.deepEqual(order, ['photos', 'account']);
});

test('if the photos cannot be removed the account is not touched, and the person is told why', async () => {
  let deleted = false;
  await assert.rejects(
    () => runDeletion({ removePhotos: async () => { throw new Error('2 of your photos could not be removed'); }, deleteAccount: async () => { deleted = true; } }),
    /Your photos could not be removed, so nothing was deleted\. 2 of your photos could not be removed/,
  );
  assert.equal(deleted, false);
});

test('an error from deleting the account itself is passed on as it is', async () => {
  await assert.rejects(() => runDeletion({ removePhotos: async () => {}, deleteAccount: async () => { throw new Error('remove your photos first'); } }), /^Error: remove your photos first$/);
});
