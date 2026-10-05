import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daysToGoal, programmeWeek, weightStats } from '../src/features/today/stats.ts';
import { programmeFromProfile } from '../src/lib/programme.ts';
import type { DailyLog } from '../src/db/dailyLogs.ts';

// the cut the page was originally built around: 82 to 75 kg between 5 Apr and 14 Jul 2026
const CUT = programmeFromProfile({ start_weight: 82, goal_weight: 75, start_date: '2026-04-05', goal_date: '2026-07-14', calorie_target: 2100 })!;
const GAIN = programmeFromProfile({ start_weight: 70, goal_weight: 76, start_date: '2026-10-01', goal_date: '2026-12-24' })!;
const STEADY = programmeFromProfile({ start_weight: 80, goal_weight: 80, start_date: '2026-10-01', goal_date: '2026-12-24' })!;

const log = (log_date: string, over: Partial<DailyLog> = {}): DailyLog => ({
  id: log_date, user_id: 'u', log_date, weight: null, total_cals: null, protein: null, carbs: null, fat: null, lift: null, core: null,
  cardio: null, cigs: 0, mood: null, mood_notes: null, supplements: null, saved_at: null, steps: null, water_ml: 0,
  active_kcal: null, rings: null, habits: {}, ...over,
});

test('weight stats come from the newest weigh-in and skip days without one', () => {
  const stats = weightStats([log('2026-06-09'), log('2026-06-08', { weight: 78 }), log('2026-06-01', { weight: 79 })], CUT);
  assert.deepEqual(stats.latest, { weight: 78, date: '2026-06-08' });
  assert.equal(stats.fromStartKg, -4);
  assert.equal(stats.progressKg, 4);
  assert.equal(stats.toGoKg, 3);
  assert.ok(Math.abs((stats.percentDone ?? 0) - (4 / 7) * 100) < 1e-9);
  assert.deepEqual(stats.recentAverage, { kg: 78.5, count: 2 });
});

test('the average covers at most the seven latest weigh-ins', () => {
  const logs = Array.from({ length: 9 }, (_, i) => log(`2026-06-${String(20 - i).padStart(2, '0')}`, { weight: 80 - i }));
  assert.equal(weightStats(logs, CUT).recentAverage?.count, 7);
  assert.equal(weightStats(logs, CUT).recentAverage?.kg, (80 + 79 + 78 + 77 + 76 + 75 + 74) / 7);
});

test('progress is clamped, and no weigh-ins at all gives empty stats', () => {
  assert.equal(weightStats([log('2026-06-01', { weight: 74 })], CUT).percentDone, 100);
  assert.equal(weightStats([log('2026-06-01', { weight: 74 })], CUT).toGoKg, 0);
  assert.equal(weightStats([log('2026-06-01', { weight: 85 })], CUT).percentDone, 0);
  assert.equal(weightStats([log('2026-06-01', { weight: 85 })], CUT).progressKg, 0);
  assert.equal(weightStats([], CUT).latest, null);
  assert.equal(weightStats([log('2026-06-01')], CUT).percentDone, null);
});

test('days to the goal count calendar days and end once it has passed', () => {
  assert.equal(daysToGoal(CUT, '2026-07-13'), 1);
  assert.equal(daysToGoal(CUT, '2026-04-05'), 100);
  assert.equal(daysToGoal(CUT, '2026-07-14'), null);
  assert.equal(daysToGoal(CUT, '2026-10-01'), null);
});

test('programme week follows the start date and caps at the last planned week', () => {
  assert.equal(programmeWeek(CUT, '2026-04-05'), 1);
  assert.equal(programmeWeek(CUT, '2026-04-11'), 1);
  assert.equal(programmeWeek(CUT, '2026-04-12'), 2);
  assert.equal(programmeWeek(CUT, '2026-10-01'), CUT.weeks);
  assert.equal(CUT.weeks, 15);
  assert.equal(programmeWeek(CUT, '2026-03-01'), 1);
});

test('without a goal the weigh-in stats still work, and nothing is measured against a goal', () => {
  const stats = weightStats([log('2026-06-08', { weight: 78 }), log('2026-06-01', { weight: 79 })], null);
  assert.deepEqual(stats.latest, { weight: 78, date: '2026-06-08' });
  assert.deepEqual(stats.recentAverage, { kg: 78.5, count: 2 });
  assert.deepEqual([stats.fromStartKg, stats.progressKg, stats.toGoKg, stats.percentDone], [null, null, null, null]);
  assert.equal(weightStats([], null).latest, null);
});

test('a gain goal counts progress upward, and never below zero or above 100', () => {
  const stats = weightStats([log('2026-11-01', { weight: 73 })], GAIN);
  assert.equal(stats.fromStartKg, 3);
  assert.equal(stats.progressKg, 3);
  assert.equal(stats.toGoKg, 3);
  assert.equal(stats.percentDone, 50);
  assert.equal(weightStats([log('2026-11-01', { weight: 69 })], GAIN).percentDone, 0);
  assert.equal(weightStats([log('2026-11-01', { weight: 69 })], GAIN).progressKg, 0);
  assert.equal(weightStats([log('2026-11-01', { weight: 80 })], GAIN).percentDone, 100);
  assert.equal(weightStats([log('2026-11-01', { weight: 80 })], GAIN).toGoKg, 0);
});

test('a keep-steady goal reports distance from the goal weight and no percentage', () => {
  const stats = weightStats([log('2026-11-01', { weight: 82 })], STEADY);
  assert.equal(stats.toGoKg, 2);
  assert.equal(stats.percentDone, null);
  assert.equal(stats.progressKg, null);
  assert.equal(stats.fromStartKg, 2);
});
