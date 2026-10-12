import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cycleDayOn, isFemale, periodsOf, summarize } from '../src/features/cycle/model.ts';
import { chooseRange } from '../src/lib/ranges.ts';

const run = (start: string, n: number, flow = 'medium') => {
  const d = new Date(`${start}T00:00:00Z`);
  return Array.from({ length: n }, (_, i) => ({ day: new Date(d.getTime() + i * 86400000).toISOString().slice(0, 10), flow }));
};

test('periods: runs of bleeding, a one-day gap is the same period, spotting extends but never starts one', () => {
  const days = [
    ...run('2026-06-01', 5), { day: '2026-06-07', flow: 'light' }, // a day off, then light: same period
    { day: '2026-06-20', flow: 'spotting' }, // spotting alone: not a period
    ...run('2026-06-29', 4), { day: '2026-07-03', flow: 'spotting' }, // spotting right after: extends it
    ...run('2026-06-29', 1, 'heavy'), // the same day from another source counts once
  ];
  assert.deepEqual(periodsOf(days), [
    { start: '2026-06-01', end: '2026-06-07', days: 7 },
    { start: '2026-06-29', end: '2026-07-03', days: 5 },
  ]);
});

test('summary: nothing until three complete cycles, then the median and spread of the latest six; no predictions', () => {
  const starts = ['2026-01-01', '2026-01-29', '2026-02-27', '2026-03-27', '2026-04-26', '2026-05-24', '2026-06-22', '2026-07-21'];
  const periods = periodsOf(starts.flatMap((s) => run(s, 5)));
  assert.equal(summarize(periods.slice(0, 3)).median, null); // two cycles
  const s = summarize(periods);
  assert.deepEqual(s.lengths, [29, 28, 30, 28, 29, 29]); // the latest six of seven
  assert.equal(s.median, 29);
  assert.deepEqual([s.shortest, s.longest, s.periodMedian], [28, 30, 5]);
  assert.equal(Object.keys(s).some((k) => /next|predict|ovulat|fertile/i.test(k)), false);
});

test('cycle day of a blood draw, and none when the last period is long past or not logged', () => {
  const periods = periodsOf([...run('2026-09-01', 5), ...run('2026-09-29', 5)]);
  assert.equal(cycleDayOn(periods, '2026-09-29'), 1);
  assert.equal(cycleDayOn(periods, '2026-10-06T08:00:00Z'), 8);
  assert.equal(cycleDayOn(periods, '2026-08-15'), null);
  assert.equal(cycleDayOn(periods, '2027-02-01'), null);
  assert.equal(isFemale('F'), true);
  assert.equal(isFemale('male'), false);
});

test('in pregnancy only a printed range is used', () => {
  const k = { code: 'k', ref_low: 3.5, ref_high: 5.1 };
  assert.deepEqual(chooseRange(k, null, 'female', { pregnant: true }), { low: null, high: null, source: 'none', reason: 'pregnancy' });
  assert.equal(chooseRange(k, { ref_low: 3.4, ref_high: 5 }, 'female', { pregnant: true }).source, 'printed');
  assert.equal(chooseRange(k, null, 'female').source, 'default');
});
