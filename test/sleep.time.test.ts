import { test } from 'node:test';
import assert from 'node:assert/strict';
import { at } from './sleep.helpers.ts';
import {
  clockConcentration, clockMean, clockMedian, clockSd, formatClock, formatDuration, instantFor, localDate, median, minutesIntoDay,
  nightKey, roundTo5, wrapDiff,
} from '../src/features/sleep/time.ts';

test('a night is filed under the date the person woke up, on the clock where they were', () => {
  // 06:30 on 9 Oct in a zone four hours behind UTC
  assert.equal(nightKey(at('2026-10-09 06:30', -240), -240), '2026-10-09');
  // the same instant read in UTC would be 10:30, still the 9th; but late evening differs by zone
  assert.equal(nightKey(at('2026-10-09 23:30', -240), -240), '2026-10-09');
  assert.equal(nightKey(at('2026-10-09 23:30', -240), 0), '2026-10-10', 'the offset has to be the one the person was in');
  // a session ending exactly at local midnight belongs to the new date
  assert.equal(nightKey(at('2026-10-10 00:00'), 0), '2026-10-10');
});

test('a sleep day that rolls over at 18:00 files an evening wake-up under the next date', () => {
  assert.equal(nightKey(at('2026-10-09 19:00'), 0, 18), '2026-10-10');
  assert.equal(nightKey(at('2026-10-09 17:59'), 0, 18), '2026-10-09');
  assert.equal(nightKey(at('2026-10-09 19:00'), 0, 24), '2026-10-09', 'midnight is the default');
});

test('local time is rebuilt from the instant and its offset, never from the browser', () => {
  const t = at('2026-10-09 23:10', 330); // India, UTC+5:30
  assert.equal(localDate(t, 330), '2026-10-09');
  assert.equal(localDate(t, 0), '2026-10-09');
  assert.equal(minutesIntoDay(t, 330), 23 * 60 + 10);
  assert.equal(minutesIntoDay(t, -300), (23 * 60 + 10 - 630 + 1440) % 1440, 'the same instant five hours behind UTC');
});

test('a local date and time become an instant, and a date that does not exist is refused', () => {
  assert.equal(instantFor('2026-10-09', '23:10', 60), Date.UTC(2026, 9, 9, 22, 10));
  assert.equal(instantFor('2026-02-31', '10:00', 0), null);
  assert.equal(instantFor('2026-10-09', '24:00', 0), null);
  assert.equal(instantFor('2026-10-09', '9:00', 0), null);
  assert.equal(instantFor('26-10-09', '09:00', 0), null);
  assert.equal(instantFor('2024-02-29', '12:00', 0), Date.UTC(2024, 1, 29, 12), 'a leap day is real');
  assert.equal(instantFor('2026-02-29', '12:00', 0), null, 'and not in other years');
});

test('durations and clock times read plainly', () => {
  assert.equal(formatDuration(425), '7 h 05');
  assert.equal(formatDuration(480), '8 h');
  assert.equal(formatDuration(45), '45 min');
  assert.equal(formatDuration(59.6), '1 h');
  assert.equal(formatClock(23 * 60 + 5), '23:05');
  assert.equal(formatClock(1440 + 30), '00:30', 'past midnight wraps');
  assert.equal(formatClock(-30), '23:30');
  assert.equal(roundTo5(422), 420);
  assert.equal(roundTo5(423), 425);
});

test('the middle value of a list', () => {
  assert.equal(median([]), null);
  assert.equal(median([7]), 7);
  assert.equal(median([5, 1, 9]), 5);
  assert.equal(median([4, 1, 9, 2]), 3);
});

test('clock times are averaged round the clock: 23:30 and 00:30 are an hour apart, not twelve', () => {
  const mean = clockMean([23 * 60 + 30, 30]);
  assert.ok(mean !== null && Math.min(mean, 1440 - mean) < 1e-6, `got ${mean}`);
  assert.equal(wrapDiff(30, 23 * 60 + 30), 60);
  assert.equal(wrapDiff(23 * 60 + 30, 30), -60);
  assert.equal(wrapDiff(720, 0), -720);
  assert.equal(wrapDiff(0, 0), 0);
});

test('the spread of bedtimes that straddle midnight is small', () => {
  const sd = clockSd([1380, 1410, 1365, 15]); // 23:00, 23:30, 22:45, 00:15
  assert.ok(sd !== null && Math.abs(sd - 39.69) < 0.05, `got ${sd}`);
  // plain arithmetic on the same numbers would give a spread of about 685 minutes
  const plain = Math.sqrt([1380, 1410, 1365, 15].reduce((a, x, _, xs) => a + (x - xs.reduce((p, q) => p + q, 0) / xs.length) ** 2, 0) / 3);
  assert.ok(plain > 600);
  assert.equal(clockSd([1380, 1380, 1380]), 0);
  assert.equal(clockSd([1380]), null, 'one night has no spread');
  assert.equal(clockSd([]), null);
});

test('times spread evenly round the clock have no usable centre or spread', () => {
  const spread = [0, 360, 720, 1080];
  assert.ok(clockConcentration(spread) < 1e-9);
  assert.equal(clockMean(spread), null);
  assert.equal(clockSd(spread), null);
  assert.equal(clockMedian(spread), null);
  // widely scattered shift-work times: no single spread figure is offered
  assert.equal(clockSd([0, 200, 500, 800, 1100, 1300]), null);
});

test('the usual clock time is the middle one, round the clock', () => {
  const usual = clockMedian([1410, 1380, 1425, 15, 1395]); // 23:30 23:00 23:45 00:15 23:15
  assert.ok(usual !== null && Math.abs(usual - 1410) < 1e-6, `got ${usual}`);
  assert.equal(clockMedian([]), null);
});
