import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  courseStatus, EMPTY_SUPPLEMENT_FORM, formFromSupplement, sortSupplements, validateSupplementForm, type SupplementForm,
} from '../src/features/supplements/model.ts';
import type { Medication } from '../src/db/medications.ts';

const form = (over: Partial<SupplementForm> = {}): SupplementForm => ({ ...EMPTY_SUPPLEMENT_FORM, name: 'Creatine', ...over });
const item = (over: Partial<Medication> & Pick<Medication, 'name'>): Medication => ({
  id: over.name, user_id: 'u', active: true, created_at: '2026-01-01T00:00:00Z', days_of_week: [0, 1, 2, 3, 4, 5, 6], dosage: null,
  doses_per_day: null, end_date: null, frequency: null, notes: null, paracetamol_mg_per_dose: null, start_date: null, ...over,
});

test('course status follows the dates, inclusive at both ends, and ignores the generated active flag', () => {
  const today = '2026-10-01';
  assert.equal(courseStatus(item({ name: 'a' }), today), 'current');
  assert.equal(courseStatus(item({ name: 'a', start_date: '2026-10-01' }), today), 'current');
  assert.equal(courseStatus(item({ name: 'a', start_date: '2026-10-02' }), today), 'upcoming');
  assert.equal(courseStatus(item({ name: 'a', end_date: '2026-10-01' }), today), 'current');
  assert.equal(courseStatus(item({ name: 'a', end_date: '2026-09-30' }), today), 'ended');
  // a course ending next week is still current, even though the database says active = false for it
  assert.equal(courseStatus(item({ name: 'a', end_date: '2026-10-08', active: false }), today), 'current');
});

test('a valid form becomes a row with blanks as null and text trimmed', () => {
  const r = validateSupplementForm(form({ name: '  Creatine monohydrate  ', dosage: ' 5 g ', start_date: '2026-10-01', notes: ' with water ' }));
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(r.value, {
    name: 'Creatine monohydrate', dosage: '5 g', doses_per_day: 1, days_of_week: [0, 1, 2, 3, 4, 5, 6],
    start_date: '2026-10-01', end_date: null, notes: 'with water',
  });
});

test('a saved row never carries dose-check columns, so editing cannot change them', () => {
  const r = validateSupplementForm(form());
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(Object.keys(r.value).sort(), ['days_of_week', 'dosage', 'doses_per_day', 'end_date', 'name', 'notes', 'start_date']);
});

test('a name is required and dates must be real and in order', () => {
  const bad = validateSupplementForm(form({ name: '   ', start_date: '2026-02-30', end_date: 'soon' }));
  assert.equal(bad.ok, false);
  if (bad.ok) return;
  assert.deepEqual(Object.keys(bad.errors).sort(), ['end_date', 'name', 'start_date']);
  const order = validateSupplementForm(form({ start_date: '2026-10-05', end_date: '2026-10-01' }));
  assert.equal(order.ok === false && order.errors.end_date, 'End date is before the start date');
  assert.equal(validateSupplementForm(form({ start_date: '2026-10-05', end_date: '2026-10-05' })).ok, true);
  assert.equal(validateSupplementForm(form({ name: 'x'.repeat(121) })).ok, false);
});

test('editing a saved row round-trips through the form unchanged', () => {
  const original = item({ name: 'Multivitamin', dosage: '1 tablet', doses_per_day: 2, days_of_week: [1, 3, 5], start_date: '2026-10-01', end_date: '2026-10-05', notes: 'n' });
  const r = validateSupplementForm(formFromSupplement(original));
  assert.equal(r.ok, true);
  if (!r.ok) return;
  for (const key of ['name', 'dosage', 'doses_per_day', 'days_of_week', 'start_date', 'end_date', 'notes'] as const) {
    assert.deepEqual(r.value[key], original[key], key);
  }
});

test('supplements sort current, upcoming then ended', () => {
  const today = '2026-10-01';
  const sorted = sortSupplements([
    item({ name: 'ended', end_date: '2026-01-01' }),
    item({ name: 'upcoming', start_date: '2026-11-01' }),
    item({ name: 'old current', start_date: '2026-01-01' }),
    item({ name: 'new current', start_date: '2026-09-01' }),
  ], today);
  assert.deepEqual(sorted.map((m) => m.name), ['new current', 'old current', 'upcoming', 'ended']);
});

test('doses a day must be 1 to 6, and at least one day must be chosen', () => {
  for (const bad of ['0', '7', '1.5', '', 'twice', '-1']) {
    const r = validateSupplementForm(form({ doses_per_day: bad }));
    assert.equal(r.ok === false && r.errors.doses_per_day, 'Choose 1 to 6 doses a day', bad);
  }
  for (const good of ['1', '2', '6']) assert.equal(validateSupplementForm(form({ doses_per_day: good })).ok, true, good);
  const noDays = validateSupplementForm(form({ days: [] }));
  assert.equal(noDays.ok === false && noDays.errors.days, 'Choose at least one day');
});

test('days are sorted and repeats or impossible days are dropped before saving', () => {
  const r = validateSupplementForm(form({ days: [5, 1, 1, 3, 9, -1, 2.5] }));
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(r.value.days_of_week, [1, 3, 5]);
  assert.equal(validateSupplementForm(form({ days: [9] })).ok, false, 'only impossible days leaves none');
});

test('a row from before the schedule columns existed opens as once a day, every day', () => {
  const old = { ...item({ name: 'Zinc' }), days_of_week: undefined, doses_per_day: null } as unknown as Medication;
  const f = formFromSupplement(old);
  assert.equal(f.doses_per_day, '1');
  assert.deepEqual(f.days, [0, 1, 2, 3, 4, 5, 6]);
});
