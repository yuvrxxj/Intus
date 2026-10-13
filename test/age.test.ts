import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ageOn, currentAge } from '../src/lib/age.ts';

test('the age goes up on the birthday itself, not the day before', () => {
  assert.equal(ageOn('1996-10-06', '2026-10-05'), 29);
  assert.equal(ageOn('1996-10-06', '2026-10-06'), 30);
  assert.equal(ageOn('1996-10-06', '2026-10-07'), 30);
  assert.equal(ageOn('1996-10-06', '2027-10-05'), 30);
  assert.equal(ageOn('1996-10-06', '2027-10-06'), 31);
});

test('a month or day earlier in the year than the birthday is the year before', () => {
  assert.equal(ageOn('1990-12-31', '2026-01-01'), 35);
  assert.equal(ageOn('1990-01-01', '2026-12-31'), 36);
});

test('a leap-day birthday turns a year older on 1 March in a common year, and on 29 February in a leap year', () => {
  assert.equal(ageOn('1996-02-29', '2025-02-28'), 28);
  assert.equal(ageOn('1996-02-29', '2025-03-01'), 29);
  assert.equal(ageOn('1996-02-29', '2028-02-28'), 31);
  assert.equal(ageOn('1996-02-29', '2028-02-29'), 32);
});

test('a missing, impossible, future or ancient date gives no age', () => {
  for (const dob of [null, undefined, '', 'abc', '2026-02-30', '2030-01-01', '1899-12-31']) assert.equal(ageOn(dob as string | null, '2026-10-05'), null, String(dob));
  assert.equal(ageOn('2026-10-05', '2026-10-05'), 0, 'born today');
});

test('a stored age is only used while there is no date of birth', () => {
  assert.equal(currentAge({ date_of_birth: null, age: 41 }, '2026-10-05'), 41);
  assert.equal(currentAge({ date_of_birth: '1996-10-06', age: 41 }, '2026-10-05'), 29, 'the date wins over a stale number');
  assert.equal(currentAge({}, '2026-10-05'), null);
});
