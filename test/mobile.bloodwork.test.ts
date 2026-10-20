import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Biomarker, BiomarkerReading } from '../src/db/rows.ts';
import { buildBloodworkView } from '../src/features/bloodwork/model.ts';
import { emptyReadingForm, validateReadingForm } from '../src/features/bloodwork/entry.ts';
import { asReading, withWaiting } from '../mobile/src/bloodwork/pending.ts';

const marker = (over: Partial<Biomarker>): Biomarker =>
  ({ id: 'm1', code: 'potassium', name: 'Potassium', unit: 'mmol/L', category: 'electrolytes', sort_order: 1, ref_low: 3.5, ref_high: 5.1, ref_sex: null, critical_low: 2.8, critical_high: 6, ...over }) as Biomarker;
const stored = (over: Partial<BiomarkerReading>): BiomarkerReading =>
  ({ id: 'r1', user_id: 'u', created_at: '2026-10-01T00:00:00Z', biomarker_id: 'm1', measured_at: '2026-07-05', value: 4.4, source: 'manual', notes: null, ref_low: null, ref_high: null, ...over }) as BiomarkerReading;
const waiting = (value: number, over: Record<string, unknown> = {}) => ({
  id: 'w1',
  queuedAt: '2026-10-21T00:00:00Z',
  input: { biomarker_id: 'm1', measured_at: '2026-10-10', value, source: 'manual', notes: null, ...over },
});

test('a result typed on the phone is checked for critical limits before it is sent', () => {
  const { readings, unsentIds } = withWaiting([stored({})], [waiting(6.2)]);
  assert.deepEqual([...unsentIds], ['w1']);
  const view = buildBloodworkView({ biomarkers: [marker({})], readings, sex: 'male' });
  assert.equal(view.currentCritical.length, 1);
  assert.equal(view.currentCritical[0].measured_at, '2026-10-10');
  assert.equal(view.groups[0].rows[0].range, 'above');
});

test('a printed range typed with a waiting result is the one it is read against', () => {
  const w = waiting(18, { ref_low: 20, ref_high: 250 });
  const m = marker({ code: 'ferritin', name: 'Ferritin', unit: 'ng/mL', ref_low: 30, ref_high: 400, critical_low: null, critical_high: null });
  const view = buildBloodworkView({ biomarkers: [m], readings: [asReading(w)], sex: 'male' });
  const row = view.groups[0].rows[0];
  assert.equal(row.rangeUsed.source, 'printed');
  assert.equal(row.range, 'below');
});

test('a default range for the other sex is never used for a waiting result', () => {
  const m = marker({ code: 'testosterone', name: 'Testosterone', unit: 'ng/dL', ref_low: 300, ref_high: 1000, ref_sex: 'male', critical_low: null, critical_high: null });
  const view = buildBloodworkView({ biomarkers: [m], readings: [asReading(waiting(45))], sex: 'female' });
  assert.equal(view.groups[0].rows[0].range, 'no_range');
  assert.equal(view.groups[0].rows[0].rangeUsed.reason, 'default_other_sex');
});

test('a result sent between the two reads is shown once', () => {
  const { readings, unsentIds } = withWaiting([stored({ id: 'w1', measured_at: '2026-10-10', value: 6.2 })], [waiting(6.2)]);
  assert.equal(readings.length, 1);
  assert.equal(unsentIds.size, 0);
});

test('the web entry rules still refuse a second result for the same marker and day, and a number in the wrong unit asks first', () => {
  const m = marker({ code: 'glucose', name: 'Glucose', unit: 'mg/dL', ref_low: 70, ref_high: 99, critical_low: 54, critical_high: 250 });
  const form = { ...emptyReadingForm('2026-10-21'), biomarker_id: 'm1', value: '5.2' };
  const asked = validateReadingForm(form, [m], [], '2026-10-21');
  assert.ok(asked.ok);
  if (asked.ok) assert.match(asked.warning ?? '', /more than ten times below/);
  const dup = validateReadingForm({ ...form, value: '90' }, [m], [{ biomarker_id: 'm1', measured_at: '2026-10-21' }], '2026-10-21');
  assert.equal(dup.ok, false);
  const typo = validateReadingForm({ ...form, value: '1e3' }, [m], [], '2026-10-21');
  assert.equal(typo.ok, false);
});
