import { test } from 'node:test';
import assert from 'node:assert/strict';
import { habitStreakDays, streakLabel } from '../src/features/habits/streaks.ts';

const cigs = { id: 'cig', name: 'Cigarettes', kind: 'count', goal: 0, better: 'lower', unit: null } as const;
const coffee = { id: 'cof', name: 'Coffee', kind: 'count', goal: 2, better: 'lower', unit: 'cups' } as const;
const lift = { id: 'lift', name: 'Lift', kind: 'yesno', goal: null, better: 'higher', unit: null } as const;
const drank = { id: 'dr', name: 'Drank today', kind: 'yesno', goal: null, better: 'lower', unit: null } as const;
const steps = { id: 'st', name: 'Steps', kind: 'amount', goal: 8000, better: 'higher', unit: 'steps' } as const;

const TODAY = '2026-10-10';
const day = (log_date: string, habits: Record<string, { value: number | boolean }> = {}) => ({ log_date, habits });

test('a habit where less is better is on a streak for every day at or under its goal', () => {
  const logs = [day('2026-10-10', { cig: { value: 0 } }), day('2026-10-09', { cig: { value: 0 } }), day('2026-10-08', { cig: { value: 0 } }), day('2026-10-07', { cig: { value: 3 } })];
  assert.equal(habitStreakDays(cigs, logs, TODAY), 3);
  assert.equal(habitStreakDays(coffee, [day('2026-10-10', { cof: { value: 2 } }), day('2026-10-09', { cof: { value: 3 } })], TODAY), 1, 'two cups meets a goal of two, three does not');
});

test('a day with a cigarette ends the streak', () => {
  const logs = [day('2026-10-10', { cig: { value: 1 } }), day('2026-10-09', { cig: { value: 0 } })];
  assert.equal(habitStreakDays(cigs, logs, TODAY), 0);
});

test('a count left untouched on a saved day is zero', () => {
  assert.equal(habitStreakDays(cigs, [day('2026-10-10'), day('2026-10-09')], TODAY), 2);
});

test('a day with no saved log ends the streak, and so does a gap in the middle', () => {
  const logs = [day('2026-10-10', { cig: { value: 0 } }), day('2026-10-08', { cig: { value: 0 } })];
  assert.equal(habitStreakDays(cigs, logs, TODAY), 1, '9 October is missing');
  assert.equal(habitStreakDays(cigs, [day('2026-10-07', { cig: { value: 0 } })], TODAY), 0, 'nothing for the last three days');
});

test('today is not over: with no log yet it neither counts nor breaks, yesterday carries the streak', () => {
  const logs = [day('2026-10-09', { cig: { value: 0 } }), day('2026-10-08', { cig: { value: 0 } })];
  assert.equal(habitStreakDays(cigs, logs, TODAY), 2);
  assert.equal(habitStreakDays(lift, [day('2026-10-10'), day('2026-10-09', { lift: { value: true } })], TODAY), 1, 'today saved but lift not answered yet');
});

test('a more-is-better habit that has not reached its goal yet today does not end the streak, but a fewer-is-better one over its goal does', () => {
  const steps2 = [day('2026-10-10', { st: { value: 6000 } }), day('2026-10-09', { st: { value: 9000 } }), day('2026-10-08', { st: { value: 9000 } })];
  assert.equal(habitStreakDays(steps, steps2, TODAY), 2, 'today is still in progress');
  assert.equal(habitStreakDays(steps, [day('2026-10-10', { st: { value: 9000 } }), ...steps2.slice(1)], TODAY), 3, 'and counts once it gets there');
  assert.equal(habitStreakDays(steps, [day('2026-10-09', { st: { value: 6000 } }), day('2026-10-08', { st: { value: 9000 } })], TODAY), 0, 'a past day under the goal does end it');
  assert.equal(habitStreakDays(cigs, [day('2026-10-10', { cig: { value: 4 } }), day('2026-10-09', { cig: { value: 0 } })], TODAY), 0);
});

test('a yes-or-no habit counts the answer that matches its direction', () => {
  const logs = [day('2026-10-10', { lift: { value: true } }), day('2026-10-09', { lift: { value: true } }), day('2026-10-08', { lift: { value: false } })];
  assert.equal(habitStreakDays(lift, logs, TODAY), 2);
  const dry = [day('2026-10-10', { dr: { value: false } }), day('2026-10-09', { dr: { value: false } }), day('2026-10-08', { dr: { value: true } })];
  assert.equal(habitStreakDays(drank, dry, TODAY), 2, 'answering no is the good answer for Drank today');
});

test('a yes-or-no habit with no answer on a past day ends the streak', () => {
  assert.equal(habitStreakDays(lift, [day('2026-10-10', { lift: { value: true } }), day('2026-10-09'), day('2026-10-08', { lift: { value: true } })], TODAY), 1);
});

test('an amount habit counts days at or past its goal', () => {
  const logs = [day('2026-10-10', { st: { value: 9000 } }), day('2026-10-09', { st: { value: 8000 } }), day('2026-10-08', { st: { value: 7999 } })];
  assert.equal(habitStreakDays(steps, logs, TODAY), 2);
});

test('there is no streak without any logs, and a long history is read in full', () => {
  assert.equal(habitStreakDays(cigs, [], TODAY), 0);
  const long = Array.from({ length: 120 }, (_, i) => day(new Date(Date.UTC(2026, 9, 10) - i * 86_400_000).toISOString().slice(0, 10), { cig: { value: 0 } }));
  assert.equal(habitStreakDays(cigs, long, TODAY), 120, 'not cut off at the latest 40 entries');
});

test('the label says "No Cigarettes" for less-is-better habits with a goal of none, and the goal for the rest', () => {
  assert.deepEqual(streakLabel(cigs), { title: 'No Cigarettes', hint: null });
  assert.deepEqual(streakLabel({ ...cigs, goal: null }), { title: 'No Cigarettes', hint: null });
  assert.deepEqual(streakLabel(coffee), { title: 'Coffee', hint: 'At most 2 cups' });
  assert.deepEqual(streakLabel(lift), { title: 'Lift', hint: 'Aim for yes' });
  assert.deepEqual(streakLabel(steps), { title: 'Steps', hint: 'At least 8,000 steps' });
  assert.deepEqual(streakLabel(drank), { title: 'Drank today', hint: 'days answered no' });
});
