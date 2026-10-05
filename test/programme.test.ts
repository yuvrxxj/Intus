import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DIRECTION_LABEL, directionOf, programmeFromProfile } from '../src/lib/programme.ts';

const goal = { start_weight: 82, goal_weight: 75, start_date: '2026-04-05', goal_date: '2026-07-14', calorie_target: 2100 };

test('a complete goal becomes a programme with the direction, weeks and calorie lines worked out', () => {
  const p = programmeFromProfile({ ...goal, protein_target: 165 })!;
  assert.deepEqual(
    [p.startDate, p.goalDate, p.startWeightKg, p.goalWeightKg, p.direction, p.weeks],
    ['2026-04-05', '2026-07-14', 82, 75, 'lose', 15],
  );
  // 100 days is 14.3 weeks, rounded up to whole weeks
  assert.equal(p.calorieTarget, 2100);
  assert.equal(p.calorieOver, 2200);
  assert.equal(p.calorieNear, 1900);
  assert.equal(p.proteinTarget, 165);
});

test('the direction follows the two weights, and nearly equal weights mean keep steady', () => {
  assert.equal(directionOf(82, 75), 'lose');
  assert.equal(directionOf(70, 76), 'gain');
  assert.equal(directionOf(80, 80), 'maintain');
  assert.equal(directionOf(80, 80.04), 'maintain');
  assert.equal(directionOf(80, 80.2), 'gain');
  assert.deepEqual(DIRECTION_LABEL, { lose: 'Cut', gain: 'Gain', maintain: 'Maintain' });
});

test('numbers arrive from the database as strings or numbers and both work', () => {
  const p = programmeFromProfile({ start_weight: '82.0', goal_weight: '75', start_date: '2026-04-05', goal_date: '2026-07-14', calorie_target: '2100' })!;
  assert.deepEqual([p.startWeightKg, p.goalWeightKg, p.calorieTarget], [82, 75, 2100]);
});

test('a calorie target is optional, and without one there are no calorie lines', () => {
  const p = programmeFromProfile({ ...goal, calorie_target: null })!;
  assert.deepEqual([p.calorieTarget, p.calorieOver, p.calorieNear], [null, null, null]);
  assert.equal(programmeFromProfile({ ...goal, calorie_target: 0 })!.calorieTarget, null);
  assert.equal(programmeFromProfile({ ...goal, calorie_target: 150 })!.calorieNear, 0);
});

test('an incomplete or contradictory goal is not a programme, so nothing is measured against it', () => {
  assert.equal(programmeFromProfile(null), null);
  assert.equal(programmeFromProfile(undefined), null);
  assert.equal(programmeFromProfile({}), null);
  for (const missing of ['start_weight', 'goal_weight', 'start_date', 'goal_date'] as const) {
    assert.equal(programmeFromProfile({ ...goal, [missing]: null }), null, missing);
  }
  assert.equal(programmeFromProfile({ ...goal, goal_date: '2026-04-05' }), null, 'goal on the start day');
  assert.equal(programmeFromProfile({ ...goal, goal_date: '2026-03-01' }), null, 'goal before the start');
  assert.equal(programmeFromProfile({ ...goal, start_weight: 0 }), null);
  assert.equal(programmeFromProfile({ ...goal, goal_weight: -5 }), null);
});

test('garbage in the stored values never throws', () => {
  assert.equal(programmeFromProfile({ ...goal, start_weight: 'abc' }), null);
  assert.equal(programmeFromProfile({ ...goal, start_date: 'soon' }), null);
  assert.equal(programmeFromProfile({ ...goal, goal_date: '2026-02-30' }), null);
  const p = programmeFromProfile({ ...goal, protein_target: 'lots' })!;
  assert.equal(p.proteinTarget, null);
});

test('a goal of one day still counts as one week', () => {
  assert.equal(programmeFromProfile({ ...goal, goal_date: '2026-04-06' })!.weeks, 1);
  assert.equal(programmeFromProfile({ ...goal, goal_date: '2026-04-12' })!.weeks, 1);
  assert.equal(programmeFromProfile({ ...goal, goal_date: '2026-04-13' })!.weeks, 2);
});
