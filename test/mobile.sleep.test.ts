import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixedOffset, validateSleepForm } from '../src/features/sleep/model.ts';
import { buildNights } from '../src/features/sleep/nights.ts';
import { parseClock, phoneResolver, sessionFromValues, sleepForm } from '../mobile/src/sleep/entry.ts';

const NOW = Date.UTC(2026, 9, 21, 6, 0);
const base = { wakeDate: '2026-10-21', latency: '', awake: '', notes: '' };

test('a clock time is read in the ways people type it', () => {
  assert.equal(parseClock('23:00'), '23:00');
  assert.equal(parseClock('2300'), '23:00');
  assert.equal(parseClock('7:05'), '07:05');
  assert.equal(parseClock(' 705 '), '07:05');
  assert.equal(parseClock('24:00'), null);
  assert.equal(parseClock('12:60'), null);
  assert.equal(parseClock('late'), null);
  assert.equal(parseClock(''), null);
});

test('getting into bed is the day before when its clock time is later than getting up', () => {
  assert.deepEqual(sleepForm({ ...base, bed: '23:00', wake: '07:00' }), { start: '2026-10-20T23:00', end: '2026-10-21T07:00', latency: '', awake: '', notes: '' });
  assert.equal(sleepForm({ ...base, bed: '01:00', wake: '08:00' }).start, '2026-10-21T01:00');
  assert.equal(sleepForm({ ...base, bed: '23:00', wake: '07:00', wakeDate: '2026-03-01' }).start, '2026-02-28T23:00');
  assert.equal(sleepForm({ ...base, bed: 'x', wake: '07:00' }).start, '');
});

test('the web rules accept a normal night and refuse the usual mistakes', () => {
  const ctx = { nowMs: NOW, resolve: fixedOffset(330), tzId: 'Asia/Kolkata', existing: [] };
  const ok = validateSleepForm(sleepForm({ ...base, bed: '23:00', wake: '06:30' }), ctx);
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.value.source_kind, 'manual');
    assert.equal(ok.value.start_at, '2026-10-20T17:30:00.000Z');
    assert.equal(ok.value.end_at, '2026-10-21T01:00:00.000Z');
  }
  const future = validateSleepForm(sleepForm({ ...base, bed: '23:00', wake: '23:30' }), ctx);
  assert.equal(future.ok, false);
  const tooShort = validateSleepForm(sleepForm({ ...base, bed: '06:00', wake: '06:10' }), ctx);
  assert.equal(tooShort.ok, false);
  const noTimes = validateSleepForm(sleepForm({ ...base, bed: '', wake: '' }), ctx);
  assert.equal(noTimes.ok, false);
});

test('the phone resolver uses the offset in force on that date and refuses impossible dates', () => {
  process.env.TZ = 'Asia/Kolkata';
  assert.deepEqual(phoneResolver('2026-10-20', '23:00'), { utcMs: Date.UTC(2026, 9, 20, 17, 30), offsetMin: 330 });
  assert.equal(phoneResolver('2026-02-30', '07:00'), null);
});

test('a queued night shows as a night before it is sent', () => {
  const ctx = { nowMs: NOW, resolve: fixedOffset(330), tzId: null, existing: [] };
  const r = validateSleepForm(sleepForm({ ...base, bed: '23:00', wake: '06:30' }), ctx);
  assert.ok(r.ok);
  if (!r.ok) return;
  const session = sessionFromValues('abc', r.value, NOW);
  const built = buildNights([session], { nowMs: NOW });
  assert.equal(built.nights.length, 1);
  assert.equal(built.nights[0].key, '2026-10-21');
  assert.equal(built.nights[0].main.metrics.tstMin, 450);
});

import { uuid } from '../mobile/src/util/uuid.ts';

test('a made id is a version 4 uuid, and two differ', () => {
  const a = uuid();
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(a, uuid());
  assert.match(uuid((n) => new Uint8Array(n)), /^00000000-0000-4000-8000-000000000000$/);
  // without crypto.getRandomValues it still makes a valid one
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
  try {
    assert.match(uuid(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  } finally {
    if (saved) Object.defineProperty(globalThis, 'crypto', saved);
  }
});
