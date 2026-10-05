import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_GOALS_FORM, formFromProfile, newGoalFrom, summarizeGoal, validateGoalsForm, type GoalsForm } from '../src/features/goals/model.ts';

const TODAY = '2026-10-05';
const form = (over: Partial<GoalsForm> = {}): GoalsForm => ({
  start_weight: '82', goal_weight: '75', start_date: '2026-10-05', goal_date: '2026-12-28',
  calorie_target: '2100', protein_target: '165', step_target: '9000', ...over,
});

test('a stored goal fills the form, and no goal gives a blank form', () => {
  assert.deepEqual(formFromProfile(null), EMPTY_GOALS_FORM);
  assert.deepEqual(
    formFromProfile({ start_weight: 82, goal_weight: '75.5', start_date: '2026-04-05', goal_date: '2026-07-14', calorie_target: 2100, protein_target: null, step_target: undefined }),
    { start_weight: '82', goal_weight: '75.5', start_date: '2026-04-05', goal_date: '2026-07-14', calorie_target: '2100', protein_target: '', step_target: '' },
  );
});

test('a valid form becomes numbers, with blank targets as null and surrounding spaces ignored', () => {
  const r = validateGoalsForm(form({ start_weight: ' 82.5 ', calorie_target: '', protein_target: ' ', step_target: '' }), TODAY);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(r.value, {
    start_weight: 82.5, goal_weight: 75, start_date: '2026-10-05', goal_date: '2026-12-28',
    calorie_target: null, protein_target: null, step_target: null,
  });
  assert.deepEqual(r.notes, []);
});

test('weights and dates are required, and every problem is reported at once', () => {
  const r = validateGoalsForm(EMPTY_GOALS_FORM, TODAY);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.deepEqual(Object.keys(r.errors).sort(), ['goal_date', 'goal_weight', 'start_date', 'start_weight']);
});

test('weights must be sensible numbers', () => {
  for (const bad of ['abc', '0', '-5', '19.9', '401', '1e9']) {
    const r = validateGoalsForm(form({ goal_weight: bad }), TODAY);
    assert.equal(r.ok === false && r.errors.goal_weight, 'Enter a weight between 20 and 400 kg', bad);
  }
  assert.equal(validateGoalsForm(form({ goal_weight: '20' }), TODAY).ok, true);
  assert.equal(validateGoalsForm(form({ goal_weight: '400' }), TODAY).ok, true);
});

test('dates must be real, and the goal must come after the start', () => {
  assert.equal(validateGoalsForm(form({ start_date: '2026-02-30' }), TODAY).ok, false);
  assert.equal(validateGoalsForm(form({ goal_date: 'soon' }), TODAY).ok, false);
  const same = validateGoalsForm(form({ goal_date: '2026-10-05' }), TODAY);
  assert.equal(same.ok === false && same.errors.goal_date, 'The goal date must be after the start date');
  const before = validateGoalsForm(form({ goal_date: '2026-09-01' }), TODAY);
  assert.equal(before.ok === false && before.errors.goal_date, 'The goal date must be after the start date');
  assert.equal(validateGoalsForm(form({ goal_date: '2026-10-06' }), TODAY).ok, true);
});

test('targets are optional but must be whole numbers in range when given', () => {
  for (const [key, bad] of [['calorie_target', '799'], ['calorie_target', '6001'], ['calorie_target', '2100.5'], ['protein_target', '-1'], ['protein_target', '501'], ['step_target', '100001'], ['step_target', 'lots']] as const) {
    const r = validateGoalsForm(form({ [key]: bad }), TODAY);
    assert.equal(r.ok === false && !!r.errors[key], true, `${key} ${bad}`);
  }
  assert.equal(validateGoalsForm(form({ calorie_target: '800', protein_target: '0', step_target: '100000' }), TODAY).ok, true);
});

test('a goal date in the past, or two equal weights, save with a note rather than an error', () => {
  const past = validateGoalsForm(form({ start_date: '2026-04-05', goal_date: '2026-07-14' }), TODAY);
  assert.equal(past.ok, true);
  assert.ok(past.ok && past.notes.some((n) => n.includes('already passed')));
  const steady = validateGoalsForm(form({ goal_weight: '82' }), TODAY);
  assert.ok(steady.ok && steady.notes.some((n) => n.includes('keeping your weight steady')));
  const today = validateGoalsForm(form({ goal_date: TODAY, start_date: '2026-10-01' }), TODAY);
  assert.ok(today.ok && today.notes.length === 0, 'a goal ending today has not passed');
});

test('the summary says lose, gain or keep, with the weeks and the weekly rate', () => {
  assert.equal(summarizeGoal(form()), 'Lose 7 kg over 12 weeks, about 0.6 kg a week.');
  assert.equal(summarizeGoal(form({ start_weight: '70', goal_weight: '76', goal_date: '2026-12-14' })), 'Gain 6 kg over 10 weeks, about 0.6 kg a week.');
  assert.equal(summarizeGoal(form({ goal_weight: '82' })), 'Keep your weight around 82 kg for 12 weeks.');
  assert.equal(summarizeGoal(form({ goal_weight: '81.5', goal_date: '2027-10-05' })), 'Lose 0.5 kg over 53 weeks, about 0.01 kg a week.');
});

test('the summary stays quiet until the weights and dates make sense', () => {
  assert.equal(summarizeGoal(EMPTY_GOALS_FORM), null);
  assert.equal(summarizeGoal(form({ goal_weight: 'abc' })), null);
  assert.equal(summarizeGoal(form({ goal_date: '2026-10-05' })), null);
  assert.equal(summarizeGoal(form({ goal_date: 'soon' })), null);
  assert.equal(summarizeGoal(form({ start_weight: '0' })), null);
});

test('starting a new goal begins today from the latest weigh-in and clears the old finish line', () => {
  const next = newGoalFrom(form(), TODAY, 78.04);
  assert.deepEqual(next, { ...form(), start_date: TODAY, start_weight: '78', goal_weight: '', goal_date: '' });
  assert.equal(newGoalFrom(form(), TODAY, null).start_weight, '', 'no weigh-in yet, so the person types it');
  assert.equal(newGoalFrom(form(), TODAY, 80.26).start_weight, '80.3');
});
