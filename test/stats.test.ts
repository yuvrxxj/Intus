import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daysToGoal, programmeBlock, programmeWeek, streak, weightStats } from '../src/features/today/stats.ts';
import type { DailyLog } from '../src/db/dailyLogs.ts';

const log = (log_date: string, over: Partial<DailyLog> = {}): DailyLog => ({
  id: log_date, log_date, weight: null, total_cals: null, protein: null, carbs: null, fat: null, lift: null, core: null,
  cardio: null, cigs: 0, mood: null, mood_notes: null, supplements: null, saved_at: null, steps: null, water_ml: 0,
  active_kcal: null, rings: null, ...over,
});

test('weight stats come from the newest weigh-in and skip days without one', () => {
  const stats = weightStats([log('2026-06-09'), log('2026-06-08', { weight: 78 }), log('2026-06-01', { weight: 79 })]);
  assert.deepEqual(stats.latest, { weight: 78, date: '2026-06-08' });
  assert.equal(stats.fromStartKg, -4);
  assert.equal(stats.lostKg, 4);
  assert.equal(stats.toGoKg, 3);
  assert.ok(Math.abs((stats.percentDone ?? 0) - (4 / 7) * 100) < 1e-9);
  assert.deepEqual(stats.recentAverage, { kg: 78.5, count: 2 });
});

test('the average covers at most the seven latest weigh-ins', () => {
  const logs = Array.from({ length: 9 }, (_, i) => log(`2026-06-${String(20 - i).padStart(2, '0')}`, { weight: 80 - i }));
  assert.equal(weightStats(logs).recentAverage?.count, 7);
  assert.equal(weightStats(logs).recentAverage?.kg, (80 + 79 + 78 + 77 + 76 + 75 + 74) / 7);
});

test('progress is clamped, and no weigh-ins at all gives empty stats', () => {
  assert.equal(weightStats([log('2026-06-01', { weight: 74 })]).percentDone, 100);
  assert.equal(weightStats([log('2026-06-01', { weight: 74 })]).toGoKg, 0);
  assert.equal(weightStats([log('2026-06-01', { weight: 85 })]).percentDone, 0);
  assert.equal(weightStats([log('2026-06-01', { weight: 85 })]).lostKg, 0);
  assert.equal(weightStats([]).latest, null);
  assert.equal(weightStats([log('2026-06-01')]).percentDone, null);
});

test('days to the goal count calendar days and end once it has passed', () => {
  assert.equal(daysToGoal('2026-07-13'), 1);
  assert.equal(daysToGoal('2026-04-05'), 100);
  assert.equal(daysToGoal('2026-07-14'), null);
  assert.equal(daysToGoal('2026-10-01'), null);
});

test('programme week and block follow the start date and cap at the last planned week', () => {
  assert.equal(programmeWeek('2026-04-05'), 1);
  assert.equal(programmeWeek('2026-04-11'), 1);
  assert.equal(programmeWeek('2026-04-12'), 2);
  assert.equal(programmeWeek('2026-10-01'), 12);
  assert.equal(programmeWeek('2026-03-01'), 1);
  assert.deepEqual([4, 5, 8, 9].map(programmeBlock), [1, 2, 2, 3]);
});

test('a streak stops at the first entry that does not count', () => {
  const logs = [log('d4', { lift: 'yes' }), log('d3', { lift: 'yes' }), log('d2', { lift: 'no' }), log('d1', { lift: 'yes' })];
  assert.equal(streak(logs, (l) => l.lift === 'yes'), 2);
  assert.equal(streak([], (l) => l.lift === 'yes'), 0);
});
