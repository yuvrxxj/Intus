import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  courseStatus, EMPTY_SUPPLEMENT_FORM, formFromSupplement, sortSupplements, validateSupplementForm, type SupplementForm,
} from '../src/features/supplements/model.ts';
import type { Medication } from '../src/db/medications.ts';

const form = (over: Partial<SupplementForm> = {}): SupplementForm => ({ ...EMPTY_SUPPLEMENT_FORM, name: 'Creatine', ...over });
const item = (over: Partial<Medication> & Pick<Medication, 'name'>): Medication => ({
  id: over.name, user_id: 'u', active: true, created_at: '2026-01-01T00:00:00Z', dosage: null, doses_per_day: null, end_date: null,
  frequency: null, notes: null, paracetamol_mg_per_dose: null, start_date: null, ...over,
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
  const r = validateSupplementForm(form({ name: '  Creatine monohydrate  ', dosage: ' 5 g ', frequency: '', start_date: '2026-10-01', notes: ' with water ' }));
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(r.value, {
    name: 'Creatine monohydrate', dosage: '5 g', frequency: null, start_date: '2026-10-01', end_date: null, notes: 'with water',
  });
});

test('a saved row never carries dose-check columns, so editing cannot change them', () => {
  const r = validateSupplementForm(form());
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(Object.keys(r.value).sort(), ['dosage', 'end_date', 'frequency', 'name', 'notes', 'start_date']);
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
  const original = item({ name: 'Multivitamin', dosage: '1 tablet', frequency: 'daily', start_date: '2026-10-01', end_date: '2026-10-05', notes: 'n' });
  const r = validateSupplementForm(formFromSupplement(original));
  assert.equal(r.ok, true);
  if (!r.ok) return;
  for (const key of ['name', 'dosage', 'frequency', 'start_date', 'end_date', 'notes'] as const) {
    assert.equal(r.value[key], original[key], key);
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
