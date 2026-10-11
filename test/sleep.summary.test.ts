import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NOW, session } from './sleep.helpers.ts';
import { dayNumber, isoDay } from '../src/lib/dates.ts';
import { buildNights } from '../src/features/sleep/nights.ts';
import { dayStrip, MIN_NIGHTS, nightsInWindow, ROUGH_BELOW, summarize } from '../src/features/sleep/summary.ts';
import type { SleepSession } from '../src/features/sleep/model.ts';

/** A manual night ending on `date` ('2026-10-09'), going to bed at `bed` ('23:30') and getting up at `up`. */
const night = (date: string, bed: string, up: string): SleepSession => {
  const prev = new Date(Date.parse(`${date}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  const bedHour = Number(bed.slice(0, 2));
  return session({ from: `${bedHour < 12 ? date : prev} ${bed}`, to: `${date} ${up}` });
};
const nights = (sessions: SleepSession[]) => buildNights(sessions, { nowMs: NOW }).nights;
const days = (from: number, count: number) => Array.from({ length: count }, (_, i) => `2026-10-${String(from + i).padStart(2, '0')}`);

test('under five nights nothing is averaged, so a handful of nights is not dressed up as a pattern', () => {
  const few = nights(days(6, MIN_NIGHTS - 1).map((d) => night(d, '23:00', '07:00')));
  const s = summarize(few, '2026-10-12', 28);
  assert.equal(s.nights, 4);
  assert.equal(s.enough, false);
  for (const field of ['medianAsleepMin', 'usualAsleepClock', 'usualWakeClock', 'usualMidpointClock', 'asleepSdMin', 'wakeSdMin', 'midpointSdMin'] as const) {
    assert.equal(s[field], null, field);
  }
});

test('with five or more nights the middle night and the usual times are shown, based on that many nights', () => {
  const list = nights([
    night('2026-10-08', '23:00', '07:00'), night('2026-10-09', '23:30', '07:00'), night('2026-10-10', '23:15', '07:30'),
    night('2026-10-11', '22:45', '06:45'), night('2026-10-12', '23:00', '07:15'),
  ]);
  const s = summarize(list, '2026-10-12', 7);
  assert.equal(s.nights, 5);
  assert.equal(s.enough, true);
  assert.equal(s.medianAsleepMin, 480, 'the middle of 480, 450, 495, 480, 495');
  assert.equal(s.usualAsleepClock, 23 * 60);
  assert.equal(s.usualWakeClock, 7 * 60 + 15 - 15, 'the middle of 07:00 07:00 07:30 06:45 07:15');
  assert.ok(s.asleepSdMin !== null && s.asleepSdMin > 5 && s.asleepSdMin < 25);
  assert.equal(s.rough, true, 'five nights is a rough spread');
});

test('fourteen nights or more is no longer rough', () => {
  const keys = Array.from({ length: ROUGH_BELOW }, (_, i) => isoDay(dayNumber('2026-10-12') - ROUGH_BELOW + 1 + i));
  const list = nights(keys.map((d) => night(d, '23:00', '07:00')));
  const s = summarize(list, '2026-10-12', 28);
  assert.equal(s.nights, 14);
  assert.equal(s.rough, false);
  assert.equal(s.asleepSdMin, 0, 'the same bedtime every night does not vary');
});

test('bedtimes either side of midnight are one cluster, not a spread of half a day', () => {
  const list = nights([
    night('2026-10-06', '23:30', '07:30'), night('2026-10-07', '00:30', '08:30'), night('2026-10-08', '23:45', '07:45'),
    night('2026-10-09', '00:15', '08:15'), night('2026-10-10', '23:50', '07:50'), night('2026-10-11', '00:10', '08:10'),
  ]);
  const s = summarize(list, '2026-10-11', 7);
  assert.ok(s.asleepSdMin !== null && s.asleepSdMin < 40, `got ${s.asleepSdMin}`);
  const usual = s.usualAsleepClock;
  assert.ok(usual !== null && (usual > 1430 || usual < 10), `the usual bedtime is near midnight, got ${usual}`);
});

test('the window is the stated number of days ending on the date given, both ends included', () => {
  const list = nights(days(1, 12).map((d) => night(d, '23:00', '07:00')));
  const inWindow = nightsInWindow(list, '2026-10-12', 7).map((n) => n.key).sort();
  assert.deepEqual(inWindow, days(6, 7));
  assert.equal(nightsInWindow(list, '2026-10-12', 1).length, 1);
  assert.equal(nightsInWindow(list, '2026-09-01', 7).length, 0);
});

test('missing nights are gaps in the strip, never zero, and they do not count toward an average', () => {
  const list = nights([night('2026-10-08', '23:00', '07:00'), night('2026-10-10', '23:00', '07:00'), night('2026-10-11', '23:00', '06:00')]);
  const strip = dayStrip(list, '2026-10-12', 6);
  assert.deepEqual(strip.map((d) => d.key), days(7, 6), 'oldest first');
  assert.deepEqual(strip.map((d) => d.night === null ? null : d.night.main.metrics.tstMin), [null, 480, null, 480, 420, null]);
  assert.equal(summarize(list, '2026-10-12', 6).nights, 3);
});

test('a nap-only day has no main night to average', () => {
  const list = nights([night('2026-10-08', '23:00', '07:00')]);
  assert.equal(list.length, 1);
  assert.equal(dayStrip(list, '2026-10-09', 2)[1].night, null);
});
