import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { DailyLog, Habit } from '../src/db/rows.ts';
import { streaksFor } from '../mobile/src/today/streaks.ts';

const habit = (over: Partial<Habit>): Habit =>
  ({ id: 'h1', name: 'Lift', kind: 'yesno', unit: null, goal: null, better: 'higher', sort_order: 0, created_at: '2026-01-01T00:00:00Z', archived_at: null, user_id: 'u', ...over }) as Habit;
const log = (log_date: string, habits: unknown) => ({ log_date, habits }) as unknown as DailyLog;

test('a streak counts saved days in a row, with today as it stands on screen', () => {
  const h = habit({});
  const recent = [log('2026-10-16', { h1: { value: true } }), log('2026-10-15', { h1: { value: true } }), log('2026-10-14', { h1: { value: false } })];
  assert.deepEqual(streaksFor([h], recent, {}, '2026-10-17'), { h1: 2 });
  assert.deepEqual(streaksFor([h], recent, { h1: { value: true } }, '2026-10-17'), { h1: 3 });
});

test('a saved copy of today is replaced by what is on screen, and a not-yet-done today does not break the run', () => {
  const h = habit({});
  const recent = [log('2026-10-17', { h1: { value: true } }), log('2026-10-16', { h1: { value: true } })];
  assert.deepEqual(streaksFor([h], recent, { h1: { value: false } }, '2026-10-17'), { h1: 1 });
});

test('an untouched count on a saved day is zero, so a fewer-is-better habit holds its streak', () => {
  const h = habit({ id: 'c1', kind: 'count', better: 'lower', goal: 0 });
  const recent = [log('2026-10-16', {}), log('2026-10-15', {})];
  assert.deepEqual(streaksFor([h], recent, {}, '2026-10-17'), { c1: 3 });
});
