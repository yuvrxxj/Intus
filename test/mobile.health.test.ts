import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HEALTH_FIELDS, UNLOCK_AFTER_DAYS, isLocked } from '../mobile/src/health/fields.ts';
import { readFile } from 'node:fs/promises';

const field = (id: string) => {
  const f = HEALTH_FIELDS.find((x) => x.id === id);
  assert.ok(f, id);
  return f;
};

// healthkit.ts imports the native module, so read the list out of its source instead of importing it under Node
test('the fields marked connected are exactly the types the app reads today', async () => {
  const source = await readFile(new URL('../mobile/src/healthkit.ts', import.meta.url), 'utf8');
  const list = /READ_TYPES = \[([\s\S]*?)\] as const/.exec(source)?.[1] ?? '';
  const reads = [...list.matchAll(/'(HK[A-Za-z]+)'/g)].map((m) => m[1]).sort();
  const connected = HEALTH_FIELDS.filter((f) => f.connected).flatMap((f) => f.types).sort();
  assert.ok(reads.length > 0);
  assert.deepEqual(connected, reads);
});

test('only device-measured fields lock; things a person also types do not', () => {
  const locking = HEALTH_FIELDS.filter((f) => f.lock).map((f) => f.id).sort();
  assert.deepEqual(locking, ['active_kcal', 'exercise_minutes', 'hrv', 'resting_hr', 'sleep', 'steps']);
  for (const id of ['weight', 'water', 'calories', 'protein', 'carbs', 'fat', 'lift', 'mood']) assert.equal(field(id).lock, false);
});

test('a locking field locks while samples are recent and only while it is being read', () => {
  const steps = field('steps');
  assert.equal(isLocked(steps, '2026-10-20', '2026-10-20', true), true);
  assert.equal(isLocked(steps, '2026-10-17', '2026-10-20', true), true);
  assert.equal(isLocked(steps, '2026-10-16', '2026-10-20', true), false);
  assert.equal(isLocked(steps, '2026-10-20', '2026-10-20', false), false);
  assert.equal(isLocked(steps, null, '2026-10-20', true), false);
  assert.equal(UNLOCK_AFTER_DAYS, 3);
});

test('a field that never locks is never locked, and a sample from the future does not lock', () => {
  assert.equal(isLocked(field('weight'), '2026-10-20', '2026-10-20', true), false);
  assert.equal(isLocked(field('steps'), '2026-10-25', '2026-10-20', true), false);
});
