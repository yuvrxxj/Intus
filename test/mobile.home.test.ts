import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Habit } from '../src/db/rows.ts';
import { EMPTY_DRAFT } from '../src/features/today/draft.ts';
import { greeting, hasAnyEntry, homeLine, saveLabel } from '../mobile/src/today/summary.ts';

const lift = { id: 'h1', name: 'Lift', kind: 'yesno', unit: null, goal: null, better: 'higher', archived_at: null } as unknown as Habit;

test('the greeting follows the hour on the phone', () => {
  assert.equal(greeting(2), 'Good evening');
  assert.equal(greeting(8), 'Good morning');
  assert.equal(greeting(14), 'Good afternoon');
  assert.equal(greeting(21), 'Good evening');
});

test('an empty day says nothing is logged; any entry counts as logged', () => {
  assert.equal(hasAnyEntry(EMPTY_DRAFT), false);
  assert.equal(homeLine(EMPTY_DRAFT, [lift], false), 'Nothing logged yet today.');
  assert.equal(hasAnyEntry({ ...EMPTY_DRAFT, weight: '80' }), true);
  assert.equal(hasAnyEntry({ ...EMPTY_DRAFT, supplements: { a: false } }), false);
  assert.equal(hasAnyEntry({ ...EMPTY_DRAFT, supplements: { a: true } }), true);
});

test('the home line counts the habits on track, and waits while loading', () => {
  const done = { ...EMPTY_DRAFT, habits: { h1: { value: true } } };
  assert.equal(homeLine(done, [lift], false), 'Today is logged. 1 of 1 habits on track.');
  assert.equal(homeLine({ ...EMPTY_DRAFT, weight: '80' }, [], false), 'Today is logged.');
  assert.equal(homeLine(done, [lift], true), 'Loading today…');
});

test('the save button says what it will do, or why it is off', () => {
  assert.equal(saveLabel(EMPTY_DRAFT, true, false), 'Save today');
  assert.equal(saveLabel(EMPTY_DRAFT, false, true), 'Save today');
  assert.equal(saveLabel(EMPTY_DRAFT, false, false), 'Nothing to save');
  assert.equal(saveLabel({ ...EMPTY_DRAFT, weight: '80' }, false, false), 'Saved');
});
