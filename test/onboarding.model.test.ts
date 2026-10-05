import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Profile } from '../src/db/profile.ts';
import {
  EMPTY_ONBOARDING, MAX_AGE, firstInvalidStep, formFromProfile, goalNotes, goalSentence, habitsFromForm, needsOnboarding,
  profileFromForm, suggestCalories, validateStep, type OnboardingForm,
} from '../src/features/onboarding/model.ts';

const TODAY = '2026-10-05';
const full = (over: Partial<OnboardingForm> = {}): OnboardingForm => ({
  ...EMPTY_ONBOARDING, name: 'Pat', sex: 'male', age: '30', height_cm: '180', weight_kg: '85', activity: 'moderate', direction: 'lose',
  goal_weight: '78', weeks: '14', smokes: false, drinks: true, workout_days: '4', does_cardio: true, cardio_notes: 'Stairmaster',
  diet: 'non_vegetarian', track_steps: true, steps_goal: '9000', typical_day: 'Desk job, late dinners', desired_day: 'Walk, early dinner',
  ...over,
});
const profile = (over: Partial<Profile> = {}): Profile => ({
  id: 'p', user_id: 'u', activity_level: null, cardio_notes: null, desired_day: null, diet: null, typical_day: null, workout_days_per_week: null,
  age: null, sex: null, family_colorectal_cancer: false, family_prostate_cancer: false, noise_or_blast_exposure: false,
  bf_goal: null, bf_start: null, blood_type: null, calorie_target: null, carb_target: null, fat_target: null, goal_date: null,
  goal_weight: null, height_cm: null, initials: null, name: null, onboarded: false, protein_target: null, sleep_goal: null,
  start_date: null, start_weight: null, step_target: null, updated_at: null, water_target: null, ...over,
});

test('a person with no profile, or an unfinished one, is taken through onboarding', () => {
  assert.equal(needsOnboarding(null), true);
  assert.equal(needsOnboarding(profile()), true);
  assert.equal(needsOnboarding(profile({ start_weight: 80, goal_weight: 75 })), true, 'a goal with no date is not complete');
});

test('someone who finished onboarding, or already set a goal, goes straight to the dashboard', () => {
  assert.equal(needsOnboarding(profile({ onboarded: true })), false);
  assert.equal(needsOnboarding(profile({ start_weight: 82, goal_weight: 75, goal_date: '2026-07-14' })), false, 'the original owner, who never saw onboarding');
});

test('what the profile already holds fills the form, and nothing is invented for a blank one', () => {
  assert.deepEqual(formFromProfile(null), EMPTY_ONBOARDING);
  const f = formFromProfile(profile({
    name: 'Sam', sex: 'M', age: 26, height_cm: 179, start_weight: 82, activity_level: 'active', diet: 'vegan', workout_days_per_week: 5,
    cardio_notes: 'Runs', calorie_target: 2100, typical_day: 'a', desired_day: 'b',
  }));
  assert.deepEqual([f.name, f.sex, f.age, f.height_cm, f.weight_kg, f.activity, f.diet, f.workout_days, f.does_cardio, f.cardio_notes, f.calorie_target, f.typical_day, f.desired_day],
    ['Sam', 'male', '26', '179', '82', 'active', 'vegan', '5', true, 'Runs', '2100', 'a', 'b']);
  const odd = formFromProfile(profile({ activity_level: 'extreme', diet: 'carnivore', sex: 'x' }));
  assert.deepEqual([odd.activity, odd.diet, odd.sex], ['', '', ''], 'unknown stored values load as blank');
});

test('the first step needs sex, age, height, weight and activity, and says what is wrong with each', () => {
  const e = validateStep('about', EMPTY_ONBOARDING);
  assert.deepEqual(Object.keys(e).sort(), ['activity', 'age', 'height_cm', 'sex', 'weight_kg']);
  assert.deepEqual(validateStep('about', full()), {});
});

test('the name is optional and short', () => {
  assert.deepEqual(validateStep('about', full({ name: '' })), {});
  assert.ok(validateStep('about', full({ name: 'x'.repeat(41) })).name);
  assert.equal(profileFromForm(full({ name: '  ' }), TODAY)?.name, null);
  assert.equal(profileFromForm(full({ name: ' Pat ' }), TODAY)?.name, 'Pat');
});

test('age is whole years, an adult, and not absurd', () => {
  for (const [age, ok] of [['17', false], ['18', true], ['120', true], ['121', false], ['30.5', false], ['abc', false], ['', false], ['-5', false]] as const) {
    assert.equal(!validateStep('about', full({ age })).age, ok, age);
  }
  assert.equal(validateStep('about', full({ age: '16' })).age, 'This app is built for adults, 18 and over');
  assert.equal(MAX_AGE, 120);
});

test('height and weight must be sensible numbers', () => {
  for (const [key, bad] of [['height_cm', '99'], ['height_cm', '251'], ['height_cm', 'tall'], ['weight_kg', '19'], ['weight_kg', '401'], ['weight_kg', 'x']] as const) {
    assert.ok(validateStep('about', full({ [key]: bad }))[key], `${key} ${bad}`);
  }
  assert.deepEqual(validateStep('about', full({ height_cm: '100', weight_kg: '20' })), {});
  assert.deepEqual(validateStep('about', full({ height_cm: '250', weight_kg: '400' })), {});
});

test('a lose goal must be below the current weight, a gain goal above, and keeping needs no goal weight', () => {
  assert.equal(validateStep('goal', full({ direction: 'lose', goal_weight: '90' })).goal_weight, 'To lose weight, your goal must be below your current weight');
  assert.equal(validateStep('goal', full({ direction: 'lose', goal_weight: '85' })).goal_weight, 'To lose weight, your goal must be below your current weight');
  assert.equal(validateStep('goal', full({ direction: 'gain', goal_weight: '80' })).goal_weight, 'To gain weight, your goal must be above your current weight');
  assert.deepEqual(validateStep('goal', full({ direction: 'gain', goal_weight: '90' })), {});
  assert.deepEqual(validateStep('goal', full({ direction: 'maintain', goal_weight: '' })), {});
  assert.deepEqual(Object.keys(validateStep('goal', { ...full(), direction: '' })), ['direction']);
  assert.ok(validateStep('goal', full({ goal_weight: '' })).goal_weight);
  assert.ok(validateStep('goal', full({ goal_weight: '10' })).goal_weight);
});

test('weeks are a whole number from 1 to 104, and calories are optional but sensible', () => {
  for (const [weeks, ok] of [['1', true], ['104', true], ['0', false], ['105', false], ['12.5', false], ['', false], ['soon', false]] as const) {
    assert.equal(!validateStep('goal', full({ weeks })).weeks, ok, weeks);
  }
  for (const [cals, ok] of [['', true], ['2000', true], ['799', false], ['6001', false], ['2000.5', false], ['lots', false]] as const) {
    assert.equal(!validateStep('goal', full({ calorie_target: cals })).calorie_target, ok, cals);
  }
});

test('a pace faster than a kilo a week is a note, never a block', () => {
  const fast = full({ weight_kg: '85', goal_weight: '75', weeks: '5' });
  assert.deepEqual(validateStep('goal', fast), {});
  assert.equal(goalNotes(fast).length, 1);
  assert.ok(goalNotes(fast)[0].includes('2.0 kg a week'));
  assert.deepEqual(goalNotes(full()), []);
  assert.deepEqual(goalNotes(full({ direction: 'maintain' })), []);
});

test('the habits step needs every question answered', () => {
  const e = validateStep('habits', { ...EMPTY_ONBOARDING });
  assert.deepEqual(Object.keys(e).sort(), ['diet', 'does_cardio', 'drinks', 'smokes']);
  assert.deepEqual(validateStep('habits', full()), {});
  assert.ok(validateStep('habits', full({ workout_days: '8' })).workout_days);
  assert.ok(validateStep('habits', full({ workout_days: '' })).workout_days);
  assert.deepEqual(validateStep('habits', full({ workout_days: '0' })), {});
  assert.ok(validateStep('habits', full({ steps_goal: '999' })).steps_goal);
  assert.deepEqual(validateStep('habits', full({ track_steps: false, steps_goal: 'x' })), {}, 'the step goal only matters when tracking steps');
  assert.ok(validateStep('habits', full({ cardio_notes: 'x'.repeat(201) })).cardio_notes);
});

test('the day step is optional and capped', () => {
  assert.deepEqual(validateStep('day', full({ typical_day: '', desired_day: '' })), {});
  assert.ok(validateStep('day', full({ typical_day: 'x'.repeat(1001) })).typical_day);
  assert.ok(validateStep('day', full({ desired_day: 'x'.repeat(1001) })).desired_day);
  assert.deepEqual(validateStep('day', full({ typical_day: 'x'.repeat(1000) })), {});
});

test('the first problem anywhere is found, in step order', () => {
  assert.equal(firstInvalidStep(full()), null);
  assert.equal(firstInvalidStep(EMPTY_ONBOARDING), 'about');
  assert.equal(firstInvalidStep(full({ goal_weight: '' })), 'goal');
  assert.equal(firstInvalidStep(full({ diet: '' })), 'habits');
});

test('the calorie starting point follows the standard formula, with a floor', () => {
  // 10*85 + 6.25*180 - 5*30 + 5 = 1830; x1.55 = 2836.5; lose 500 = 2336.5 -> 2350
  assert.equal(suggestCalories(full()), 2350);
  assert.equal(suggestCalories(full({ direction: 'gain' })), 3150); // 3136.5 -> 3150
  assert.equal(suggestCalories(full({ direction: 'maintain' })), 2850); // 2836.5 -> 2850
  // female, 60 kg, 165 cm, 30, light: 600 + 1031.25 - 150 - 161 = 1320.25; x1.375 = 1815.3; lose = 1315.3 -> 1300
  assert.equal(suggestCalories(full({ sex: 'female', weight_kg: '60', height_cm: '165', activity: 'light' })), 1300);
  // a small, inactive woman losing weight would land under 1,200, so it stops there
  assert.equal(suggestCalories(full({ sex: 'female', weight_kg: '45', height_cm: '150', age: '60', activity: 'sedentary' })), 1200);
  assert.equal(suggestCalories(full({ weight_kg: '45', height_cm: '150', age: '60', activity: 'sedentary' })), 1500, 'men have a higher floor');
  assert.equal(suggestCalories({ ...full(), sex: '' }), null);
  assert.equal(suggestCalories(full({ age: 'x' })), null);
  assert.equal(suggestCalories({ ...full(), direction: '' }), null);
});

test('a finished form becomes the profile columns, with dates counted from today', () => {
  const p = profileFromForm(full(), TODAY);
  assert.deepEqual(p, {
    name: 'Pat', age: 30, sex: 'male', height_cm: 180, start_weight: 85, goal_weight: 78, start_date: '2026-10-05', goal_date: '2027-01-11',
    calorie_target: null, activity_level: 'moderate', diet: 'non_vegetarian', workout_days_per_week: 4, cardio_notes: 'Stairmaster',
    typical_day: 'Desk job, late dinners', desired_day: 'Walk, early dinner', onboarded: true,
  });
  assert.equal(profileFromForm(full({ calorie_target: '2200' }), TODAY)?.calorie_target, 2200);
});

test('keeping weight uses the current weight as the goal, and blank text becomes null', () => {
  const p = profileFromForm(full({ direction: 'maintain', goal_weight: '', does_cardio: false, cardio_notes: 'ignored', typical_day: '  ', desired_day: '' }), TODAY);
  assert.equal(p?.goal_weight, 85);
  assert.equal(p?.cardio_notes, null, 'notes only count when there is cardio');
  assert.equal(p?.typical_day, null);
  assert.equal(p?.desired_day, null);
});

test('nothing is produced while any step is invalid', () => {
  assert.equal(profileFromForm(EMPTY_ONBOARDING, TODAY), null);
  assert.equal(profileFromForm(full({ diet: '' }), TODAY), null);
  assert.equal(goalSentence(EMPTY_ONBOARDING, TODAY), null);
});

test('the goal reads as a sentence on the last screen', () => {
  assert.equal(goalSentence(full(), TODAY), 'Lose 7 kg over 14 weeks, about 0.5 kg a week.');
  assert.equal(goalSentence(full({ direction: 'gain', goal_weight: '92', weeks: '10' }), TODAY), 'Gain 7 kg over 10 weeks, about 0.7 kg a week.');
  assert.equal(goalSentence(full({ direction: 'maintain' }), TODAY), 'Keep your weight around 85 kg for 14 weeks.');
});

test('the answers choose which habits to start tracking', () => {
  assert.deepEqual(habitsFromForm(full()).map((h) => h.name), ['Drinks', 'Lift', 'Cardio', 'Steps']);
  assert.deepEqual(habitsFromForm(full({ smokes: true, drinks: false, workout_days: '0', does_cardio: false, track_steps: false })).map((h) => h.name), ['Cigarettes']);
  assert.deepEqual(habitsFromForm(full({ smokes: false, drinks: false, workout_days: '0', does_cardio: false, track_steps: false })), []);
  const steps = habitsFromForm(full()).find((h) => h.name === 'Steps');
  assert.deepEqual(steps, { name: 'Steps', kind: 'amount', unit: 'steps', goal: 9000, better: 'higher' });
});

test('habits a person already tracks are not made twice', () => {
  assert.deepEqual(habitsFromForm(full(), ['lift', ' STEPS ']).map((h) => h.name), ['Drinks', 'Cardio']);
});
