import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACTIVITY, bmr, calorieSuggestion, maintenanceCalories, paceOf, proteinSuggestion } from '../src/lib/nutrition.ts';

const man = { sex: 'male', weightKg: 80, heightCm: 180, ageYears: 30 } as const;
const woman = { sex: 'female', weightKg: 65, heightCm: 165, ageYears: 30 } as const;
const near = (a: number | null, b: number, tol = 0.01) => assert.ok(a !== null && Math.abs(a - b) <= tol, `${a} is not ${b}`);

test('Mifflin-St Jeor: 10W + 6.25H - 5A, plus 5 for men and minus 161 for women', () => {
  near(bmr(man), 1780); // 800 + 1125 - 150 + 5
  near(bmr(woman), 1370.25); // 650 + 1031.25 - 150 - 161
});

test('revised Harris-Benedict, by sex', () => {
  near(bmr(man, 'harris_benedict'), 1853.632);
  near(bmr(woman, 'harris_benedict'), 1429.918);
});

test('Katch-McArdle needs a body fat figure, and uses lean mass', () => {
  near(bmr({ ...man, bodyFatPct: 20 }, 'katch_mcardle'), 1752.4); // 370 + 21.6 x 0.8 x 80
  assert.equal(bmr(man, 'katch_mcardle'), null);
  assert.equal(bmr({ ...man, bodyFatPct: 0 }, 'katch_mcardle'), null);
  assert.equal(bmr({ ...man, bodyFatPct: 80 }, 'katch_mcardle'), null);
});

test('an input that is missing or impossible gives no number', () => {
  for (const bad of [{ weightKg: 0 }, { heightCm: -1 }, { ageYears: 0 }, { weightKg: Number.NaN }]) assert.equal(bmr({ ...man, ...bad }), null);
});

test('maintenance is the BMR times the activity factor', () => {
  near(maintenanceCalories(man, 'sedentary'), 1780 * 1.2);
  near(maintenanceCalories(man, 'moderate'), 1780 * 1.55);
  assert.deepEqual(ACTIVITY.map((a) => a.factor), [1.2, 1.375, 1.55, 1.725, 1.9]);
});

test('losing or gaining moves the target by the pace: about 7,700 kcal a kilo', () => {
  const lose = calorieSuggestion(man, 'moderate', 'lose', 0.5);
  assert.equal(lose?.maintenance, 2750); // 2759 -> 2750
  assert.equal(lose?.adjustment, -550, '0.5 kg a week is 550 kcal a day');
  assert.equal(lose?.target, 2200); // 2759 - 550 = 2209 -> 2200
  assert.equal(lose?.limitedBy, null);
  const gain = calorieSuggestion(man, 'moderate', 'gain', 0.25);
  assert.equal(gain?.target, 3050); // 2759 + 275 = 3034 -> 3050
  assert.equal(calorieSuggestion(man, 'moderate', 'maintain', 0.5)?.target, 2750);
});

test('the deficit is capped at 1,000 kcal a day, however fast a pace is asked for', () => {
  const fast = calorieSuggestion(man, 'active', 'lose', 1.5);
  assert.equal(fast?.limitedBy, 'deficit_cap');
  assert.equal(fast?.adjustment, -1000);
  const justUnder = calorieSuggestion(man, 'active', 'lose', 0.9); // 990 kcal, under the cap
  assert.equal(justUnder?.limitedBy, null);
  assert.equal(calorieSuggestion(man, 'active', 'lose', 1)?.limitedBy, 'deficit_cap', '1 kg a week is 1,100 kcal');
});

test('the target never goes under the floor: 1,500 for men, 1,200 for women', () => {
  const small = { sex: 'female', weightKg: 45, heightCm: 150, ageYears: 60 } as const;
  const w = calorieSuggestion(small, 'sedentary', 'lose', 0.5);
  assert.equal(w?.target, 1200);
  assert.equal(w?.limitedBy, 'floor');
  assert.equal(calorieSuggestion({ ...small, sex: 'male' }, 'sedentary', 'lose', 0.5)?.target, 1500);
});

test('a blank or impossible input gives no suggestion', () => {
  assert.equal(calorieSuggestion({ ...man, weightKg: 0 }, 'light', 'lose', 0.5), null);
});

test('protein starts at 1.2 g a kilo for people who sit or walk, and 1.6 g for people who train', () => {
  assert.equal(proteinSuggestion(80, 'sedentary'), 95); // 96 -> 95
  assert.equal(proteinSuggestion(80, 'light'), 95);
  assert.equal(proteinSuggestion(80, 'moderate'), 130); // 128 -> 130
  assert.equal(proteinSuggestion(80, 'very_active'), 130);
  assert.equal(proteinSuggestion(0, 'light'), null);
});

test('the pace a goal implies is kilograms over weeks', () => {
  assert.equal(paceOf(85, 78, 14), 0.5);
  assert.equal(paceOf(70, 75, 10), 0.5);
  assert.equal(paceOf(70, 75, 0), null);
  assert.equal(paceOf(Number.NaN, 75, 5), null);
});
