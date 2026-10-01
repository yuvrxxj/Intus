import { test } from 'node:test';
import assert from 'node:assert/strict';
import { courseStatus, EMPTY_MED_FORM, formFromMedication, paracetamolPerDay, sortMedications, validateMedForm, type MedForm } from '../src/features/meds/model.ts';
import type { Medication } from '../src/db/medications.ts';

const form = (over: Partial<MedForm> = {}): MedForm => ({ ...EMPTY_MED_FORM, name: 'Paracetamol', ...over });
const med = (over: Partial<Medication> & Pick<Medication, 'name'>): Medication => ({
  id: over.name, active: true, created_at: '2026-01-01T00:00:00Z', dosage: null, doses_per_day: null, end_date: null,
  frequency: null, notes: null, paracetamol_mg_per_dose: null, start_date: null, ...over,
});

test('course status follows the dates, inclusive at both ends, and ignores the generated active flag', () => {
  const today = '2026-10-01';
  assert.equal(courseStatus(med({ name: 'a' }), today), 'current');
  assert.equal(courseStatus(med({ name: 'a', start_date: '2026-10-01' }), today), 'current');
  assert.equal(courseStatus(med({ name: 'a', start_date: '2026-10-02' }), today), 'upcoming');
  assert.equal(courseStatus(med({ name: 'a', end_date: '2026-10-01' }), today), 'current');
  assert.equal(courseStatus(med({ name: 'a', end_date: '2026-09-30' }), today), 'ended');
  // a course ending next week is still current, even though the database says active = false for it
  assert.equal(courseStatus(med({ name: 'a', end_date: '2026-10-08', active: false }), today), 'current');
});

test('a valid form becomes a row with blanks as null and text trimmed', () => {
  const r = validateMedForm(form({ name: '  Paracetamol 500  ', dosage: ' 500 mg ', frequency: '', start_date: '2026-10-01', paracetamol_mg: '500', doses_per_day: '4', notes: ' with food ' }));
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(r.value, {
    name: 'Paracetamol 500', dosage: '500 mg', frequency: null, start_date: '2026-10-01', end_date: null, notes: 'with food',
    paracetamol_mg_per_dose: 500, doses_per_day: 4,
  });
  assert.deepEqual(r.hints, []);
});

test('a name is required and dates must be real and in order', () => {
  const bad = validateMedForm(form({ name: '   ', start_date: '2026-02-30', end_date: 'soon' }));
  assert.equal(bad.ok, false);
  if (bad.ok) return;
  assert.deepEqual(Object.keys(bad.errors).sort(), ['end_date', 'name', 'start_date']);
  const order = validateMedForm(form({ start_date: '2026-10-05', end_date: '2026-10-01' }));
  assert.equal(order.ok === false && order.errors.end_date, 'End date is before the start date');
  assert.equal(validateMedForm(form({ start_date: '2026-10-05', end_date: '2026-10-05' })).ok, true);
});

test('paracetamol figures are all or nothing, positive, and doses are capped', () => {
  const half = validateMedForm(form({ paracetamol_mg: '500' }));
  assert.equal(half.ok === false && !!half.errors.doses_per_day, true);
  const other = validateMedForm(form({ doses_per_day: '3' }));
  assert.equal(other.ok === false && !!other.errors.paracetamol_mg, true);
  for (const bad of ['0', '-5', 'abc', '1e999']) {
    assert.equal(validateMedForm(form({ paracetamol_mg: bad, doses_per_day: '2' })).ok, false, bad);
  }
  assert.equal(validateMedForm(form({ paracetamol_mg: '500', doses_per_day: '25' })).ok, false);
  assert.equal(validateMedForm(form({ paracetamol_mg: '500', doses_per_day: '24' })).ok, true);
  assert.equal(validateMedForm(form({ paracetamol_mg: '500', doses_per_day: '0.5' })).ok, true);
});

test('hints warn about a paracetamol product with no figures, an unusual single dose, and biotin', () => {
  const none = validateMedForm(form({ name: 'Dolo 650' }));
  assert.equal(none.ok && none.hints.some((h) => h.includes('cannot be counted')), true);
  const big = validateMedForm(form({ paracetamol_mg: '1500', doses_per_day: '2' }));
  assert.equal(big.ok && big.hints.some((h) => h.includes('unusual')), true);
  const biotin = validateMedForm(form({ name: 'Biotin 10000 mcg' }));
  assert.equal(biotin.ok && biotin.hints.some((h) => h.includes('3 days')), true);
  const plain = validateMedForm(form({ name: 'Vitamin C' }));
  assert.deepEqual(plain.ok && plain.hints, []);
});

test('editing a saved row round-trips through the form unchanged', () => {
  const original = med({ name: 'Paracetamol', dosage: '500 mg', frequency: 'as needed', start_date: '2026-10-01', end_date: '2026-10-05', notes: 'n', paracetamol_mg_per_dose: 500, doses_per_day: 4 });
  const r = validateMedForm(formFromMedication(original));
  assert.equal(r.ok, true);
  if (!r.ok) return;
  for (const key of ['name', 'dosage', 'frequency', 'start_date', 'end_date', 'notes', 'paracetamol_mg_per_dose', 'doses_per_day'] as const) {
    assert.equal(r.value[key], original[key], key);
  }
});

test('paracetamol per day needs both figures, and medications sort current, upcoming then ended', () => {
  assert.equal(paracetamolPerDay(med({ name: 'a', paracetamol_mg_per_dose: 500, doses_per_day: 4 })), 2000);
  assert.equal(paracetamolPerDay(med({ name: 'a', paracetamol_mg_per_dose: 500 })), null);
  const today = '2026-10-01';
  const sorted = sortMedications([
    med({ name: 'ended', end_date: '2026-01-01' }),
    med({ name: 'upcoming', start_date: '2026-11-01' }),
    med({ name: 'old current', start_date: '2026-01-01' }),
    med({ name: 'new current', start_date: '2026-09-01' }),
  ], today);
  assert.deepEqual(sorted.map((m) => m.name), ['new current', 'old current', 'upcoming', 'ended']);
});
