import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formFromProfile, groupScreening, normalizeSex, profileIsReady, PROFILE_FORM_DEFAULTS, validateProfileForm, validateRecordDate } from '../src/features/screening/model.ts';
import { SCREENING_STATUS as S, type ScreeningItem } from '../src/lib/screening.ts';
import type { Profile } from '../src/db/profile.ts';

const profile = (over: Partial<Profile> = {}): Profile => ({
  id: 'p', age: 26, sex: 'male', family_colorectal_cancer: false, family_prostate_cancer: true, noise_or_blast_exposure: false,
  bf_goal: null, bf_start: null, blood_type: null, calorie_target: null, carb_target: null, fat_target: null, goal_date: null,
  goal_weight: null, height_cm: null, initials: null, name: null, onboarded: false, protein_target: null, sleep_goal: null,
  start_date: null, start_weight: null, step_target: null, updated_at: null, water_target: null, ...over,
});
const item = (code: string, status: ScreeningItem['status']): ScreeningItem => ({ code, label: code, status, detail: '', lastDone: null });

test('items are grouped by status and keep their order within a group', () => {
  const g = groupScreening([item('a', S.DUE), item('b', S.OVERDUE), item('c', S.DUE), item('d', S.UP_TO_DATE), item('e', S.NOT_YET)]);
  assert.deepEqual([g.overdue, g.due, g.upToDate, g.notYet].map((x) => x.map((i) => i.code)), [['b'], ['a', 'c'], ['d'], ['e']]);
});

test('sex is normalised and anything else is blank', () => {
  assert.deepEqual(['M', ' female ', 'f', 'Male', 'other', '', null, undefined].map(normalizeSex), ['male', 'female', 'female', 'male', '', '', '', '']);
});

test('the profile form loads from a saved row, and prefills from the header only when there is none', () => {
  assert.deepEqual(formFromProfile(null), PROFILE_FORM_DEFAULTS);
  assert.deepEqual(formFromProfile(profile({ age: 31, sex: 'F' })), {
    age: '31', sex: 'female', family_colorectal_cancer: false, family_prostate_cancer: true, noise_or_blast_exposure: false,
  });
  assert.equal(formFromProfile(profile({ age: null, sex: null })).age, '');
});

test('the profile form needs a whole-number age and an explicit sex', () => {
  const ok = validateProfileForm({ ...PROFILE_FORM_DEFAULTS });
  assert.deepEqual(ok.ok && ok.value, { age: 26, sex: 'male', family_colorectal_cancer: false, family_prostate_cancer: false, noise_or_blast_exposure: false });
  for (const age of ['', 'abc', '26.5', '-1', '121']) {
    assert.equal(validateProfileForm({ ...PROFILE_FORM_DEFAULTS, age }).ok, false, age);
  }
  const noSex = validateProfileForm({ ...PROFILE_FORM_DEFAULTS, sex: '' });
  assert.equal(noSex.ok === false && !!noSex.errors.sex, true);
});

test('the calendar is only ready with an age and a recognisable sex, so nothing is dropped quietly', () => {
  assert.equal(profileIsReady(profile()), true);
  assert.equal(profileIsReady(null), false);
  assert.equal(profileIsReady(profile({ age: null })), false);
  assert.equal(profileIsReady(profile({ sex: null })), false);
  assert.equal(profileIsReady(profile({ sex: 'unsure' })), false);
});

test('a record date must be a real day, no later than today', () => {
  const today = '2026-10-01';
  assert.equal(validateRecordDate('2026-10-01', today), null);
  assert.equal(validateRecordDate('2020-02-29', today), null);
  assert.equal(validateRecordDate('2026-10-02', today), 'That date is in the future');
  assert.equal(validateRecordDate('2026-02-30', today), 'That is not a valid date');
  assert.equal(validateRecordDate('', today), 'Choose the date it was done');
});
