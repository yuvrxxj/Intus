import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Medication } from '../src/db/medications.ts';
import {
  describeDays, describeSchedule, doseKey, dosesDue, dosesOf, isDueOn, normalizeDays, skippedToday, weekdayOf,
} from '../src/features/supplements/schedule.ts';

const item = (over: Partial<Medication> & Pick<Medication, 'name'>): Medication => ({
  id: over.name, active: true, created_at: '2026-01-01T00:00:00Z', days_of_week: [0, 1, 2, 3, 4, 5, 6], dosage: null,
  doses_per_day: null, end_date: null, frequency: null, notes: null, paracetamol_mg_per_dose: null, start_date: null, ...over,
});

test('the weekday of a date, Sunday as 0, including dates before 1970 and across leap days', () => {
  assert.equal(weekdayOf('2026-10-04'), 0, 'Sunday');
  assert.equal(weekdayOf('2026-10-05'), 1, 'Monday');
  assert.equal(weekdayOf('2026-10-10'), 6, 'Saturday');
  assert.equal(weekdayOf('1970-01-01'), 4, 'Thursday');
  assert.equal(weekdayOf('1969-12-31'), 3, 'Wednesday');
  assert.equal(weekdayOf('2024-02-29'), 4, 'Thursday');
  assert.equal(weekdayOf('2024-03-01'), 5, 'Friday');
});

test('every date in a week lines up with the JavaScript calendar', () => {
  for (let day = 1; day <= 31; day++) {
    const key = `2026-10-${String(day).padStart(2, '0')}`;
    assert.equal(weekdayOf(key), new Date(2026, 9, day).getDay(), key);
  }
});

test('days are cleaned up, and nothing valid means every day', () => {
  assert.deepEqual(normalizeDays([5, 1, 1, 3]), [1, 3, 5]);
  assert.deepEqual(normalizeDays([7, -1, 2.5, '3', null]), [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(normalizeDays([]), [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(normalizeDays(null), [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(normalizeDays(undefined), [0, 1, 2, 3, 4, 5, 6]);
});

test('doses a day is a whole number from 1 to 6, whatever the numeric column hands back', () => {
  assert.equal(dosesOf({ doses_per_day: 2 }), 2);
  assert.equal(dosesOf({ doses_per_day: '3' }), 3);
  assert.equal(dosesOf({ doses_per_day: null }), 1);
  assert.equal(dosesOf({ doses_per_day: undefined }), 1);
  assert.equal(dosesOf({ doses_per_day: '' }), 1);
  assert.equal(dosesOf({ doses_per_day: 'lots' }), 1);
  assert.equal(dosesOf({ doses_per_day: 0 }), 1);
  assert.equal(dosesOf({ doses_per_day: 1.5 }), 1);
  assert.equal(dosesOf({ doses_per_day: 99 }), 6);
});

test('a supplement is due on its weekdays, inside its dates', () => {
  const sundays = item({ name: 'D3', days_of_week: [0] });
  assert.equal(isDueOn(sundays, '2026-10-04'), true, 'Sunday');
  assert.equal(isDueOn(sundays, '2026-10-05'), false, 'Monday');
  assert.equal(isDueOn(item({ name: 'a', start_date: '2026-10-06' }), '2026-10-05'), false, 'not started');
  assert.equal(isDueOn(item({ name: 'a', end_date: '2026-10-04' }), '2026-10-05'), false, 'ended');
  assert.equal(isDueOn(item({ name: 'a', end_date: '2026-10-05' }), '2026-10-05'), true, 'last day counts');
  assert.equal(isDueOn({ ...item({ name: 'a' }), days_of_week: undefined }, '2026-10-05'), true, 'old row, every day');
});

test('each dose is its own checklist entry, and the first keeps the supplement id as its key', () => {
  const doses = dosesDue([item({ name: 'Ashwagandha', id: 'ash', doses_per_day: 2, dosage: '300 mg' })], '2026-10-05');
  assert.deepEqual(doses.map((d) => [d.key, d.n, d.of, d.dosage]), [['ash', 1, 2, '300 mg'], ['ash#2', 2, 2, '300 mg']]);
  assert.equal(doseKey('x', 1), 'x');
  assert.equal(doseKey('x', 3), 'x#3');
});

test('the checklist keeps the order they were added in and leaves out anything not due', () => {
  const items = [
    item({ name: 'Magnesium', id: 'mg', created_at: '2026-01-03T00:00:00Z' }),
    item({ name: 'Zinc', id: 'zn', created_at: '2026-01-01T00:00:00Z' }),
    item({ name: 'D3', id: 'd3', created_at: '2026-01-02T00:00:00Z', days_of_week: [0] }),
    item({ name: 'Old', id: 'old', end_date: '2026-09-01' }),
    item({ name: 'Later', id: 'later', start_date: '2026-12-01' }),
  ];
  assert.deepEqual(dosesDue(items, '2026-10-05').map((d) => d.itemId), ['zn', 'mg'], 'Monday');
  assert.deepEqual(dosesDue(items, '2026-10-04').map((d) => d.itemId), ['zn', 'd3', 'mg'], 'Sunday');
  assert.deepEqual(skippedToday(items, '2026-10-05').map((i) => i.id), ['d3'], 'only current courses can be skipped');
  assert.deepEqual(skippedToday(items, '2026-10-04'), []);
});

test('an empty list gives an empty checklist', () => {
  assert.deepEqual(dosesDue([], '2026-10-05'), []);
  assert.deepEqual(skippedToday([], '2026-10-05'), []);
});

test('schedules read as plain sentences', () => {
  assert.equal(describeSchedule(1, [0, 1, 2, 3, 4, 5, 6]), 'Once a day');
  assert.equal(describeSchedule(2, [0, 1, 2, 3, 4, 5, 6]), 'Twice a day');
  assert.equal(describeSchedule(3, [0, 1, 2, 3, 4, 5, 6]), '3 times a day');
  assert.equal(describeSchedule(1, [0]), 'Once on Sundays');
  assert.equal(describeSchedule(2, [1, 2, 3, 4, 5]), 'Twice on weekdays');
  assert.equal(describeSchedule(1, [6, 0]), 'Once on weekends');
  assert.equal(describeSchedule(1, [5, 1, 3]), 'Once on Mon, Wed, Fri');
  assert.equal(describeDays([]), 'every day');
});
