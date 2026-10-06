import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MANUAL_SOURCE, MAX_NOTES, MAX_VALUE, emptyReadingForm, parseResultValue, validateReadingForm, type ReadingForm,
} from '../src/features/bloodwork/entry.ts';
import type { Biomarker } from '../src/db/queries.ts';

// Invented markers shaped like rows from the live table. They exercise the logic and say nothing about real ranges.
const marker = (over: Partial<Biomarker> & Pick<Biomarker, 'id' | 'code'>): Biomarker => ({
  name: over.code.toUpperCase(), unit: 'u', category: 'Group A', organ_systems: [], ref_low: null, ref_high: null,
  optimal_low: null, optimal_high: null, description: null, sort_order: 0, created_at: '2026-01-01T00:00:00Z',
  critical_low: null, critical_high: null, threshold_source: null,
  ...over,
});
const potassium = marker({ id: 'k', code: 'potassium', name: 'Potassium', unit: 'mmol/L', ref_low: 3.5, ref_high: 5.1 });
const albumin = marker({ id: 'a', code: 'albumin', name: 'Albumin', unit: 'g/dL' });
const biomarkers = [potassium, albumin];
const TODAY = '2026-10-05';

const form = (over: Partial<ReadingForm> = {}): ReadingForm => ({ ...emptyReadingForm(TODAY), biomarker_id: 'k', value: '4.2', ...over });
const check = (f: ReadingForm, existing: { biomarker_id: string; measured_at: string }[] = []) =>
  validateReadingForm(f, biomarkers, existing, TODAY);

test('a good form becomes a manual-source row with the value as a number and blank notes as null', () => {
  const result = check(form({ notes: '  fasting  ' }));
  assert.ok(result.ok);
  assert.deepEqual(result.value, { biomarker_id: 'k', measured_at: TODAY, value: 4.2, source: MANUAL_SOURCE, notes: 'fasting' });
  assert.equal(result.warning, null);
  const blank = check(form({ notes: '   ' }));
  assert.ok(blank.ok);
  assert.equal(blank.value.notes, null);
});

test('values: plain decimals only, with a point or a comma, and nothing is guessed', () => {
  for (const [text, expected] of [['4', 4], ['4.2', 4.2], ['4,2', 4.2], ['.5', 0.5], [' 0 ', 0], ['120', 120]] as const) {
    assert.equal(parseResultValue(text), expected, text);
  }
  for (const bad of ['', '  ', 'abc', '4.', '1e3', '0x10', '-1', '+1', '1,000.5', '1.2.3', '4 2', 'Infinity', 'NaN']) {
    assert.equal(parseResultValue(bad), null, bad);
  }
});

test('a missing or unreadable value is refused with a message, never saved as zero', () => {
  const blank = check(form({ value: '' }));
  assert.ok(!blank.ok);
  assert.match(blank.errors.value ?? '', /Enter the result/);
  const junk = check(form({ value: '4.2 mmol' }));
  assert.ok(!junk.ok);
  assert.match(junk.errors.value ?? '', /plain number/);
  const huge = check(form({ value: String(MAX_VALUE * 10) }));
  assert.ok(!huge.ok);
  assert.match(huge.errors.value ?? '', /too large/);
});

test('the marker must be one that exists', () => {
  for (const id of ['', 'ghost']) {
    const result = check(form({ biomarker_id: id }));
    assert.ok(!result.ok);
    assert.match(result.errors.biomarker_id ?? '', /Choose a marker/);
  }
});

test('dates: valid, not in the future, not absurdly old; today is fine', () => {
  assert.ok(check(form({ measured_at: TODAY })).ok);
  assert.ok(check(form({ measured_at: '1990-01-31' })).ok);
  for (const [text, message] of [
    ['', /Choose the date/],
    ['not a date', /Choose the date/],
    ['2026-02-30', /Choose the date/],
    ['2026-10-06', /future/],
    ['2999-01-01', /future/],
    ['1899-12-31', /too far back/],
  ] as const) {
    const result = check(form({ measured_at: text }));
    assert.ok(!result.ok, text);
    assert.match(result.errors.measured_at ?? '', message, text);
  }
});

test('a second result for the same marker on the same day is refused, but another marker or another day is fine', () => {
  const existing = [{ biomarker_id: 'k', measured_at: '2026-06-06' }];
  const dup = check(form({ measured_at: '2026-06-06' }), existing);
  assert.ok(!dup.ok);
  assert.match(dup.errors.measured_at ?? '', /already have a Potassium result/);
  assert.ok(check(form({ measured_at: '2026-06-07' }), existing).ok);
  assert.ok(check(form({ biomarker_id: 'a', measured_at: '2026-06-06' }), existing).ok);
  // a stored timestamp still counts as that day
  assert.ok(!check(form({ measured_at: '2026-06-06' }), [{ biomarker_id: 'k', measured_at: '2026-06-06T00:00:00Z' }]).ok);
});

test('notes are capped', () => {
  assert.ok(check(form({ notes: 'x'.repeat(MAX_NOTES) })).ok);
  const long = check(form({ notes: 'x'.repeat(MAX_NOTES + 1) }));
  assert.ok(!long.ok);
  assert.match(long.errors.notes ?? '', /under 500/);
});

test('every problem is reported at once, so the person fixes the form in one pass', () => {
  const result = check({ biomarker_id: '', value: 'x', measured_at: '', notes: 'x'.repeat(MAX_NOTES + 1) });
  assert.ok(!result.ok);
  assert.deepEqual(Object.keys(result.errors).sort(), ['biomarker_id', 'measured_at', 'notes', 'value']);
});

test('a value ten times outside the usual range is saved only with a unit warning attached', () => {
  // exactly ten times the top of the range (51) is not past it; just beyond is
  assert.equal((check(form({ value: '51' })) as { warning: string | null }).warning, null);
  const high = check(form({ value: '60' }));
  assert.ok(high.ok);
  assert.match(high.warning ?? '', /ten times above .*Potassium.*mmol\/L/);
  const low = check(form({ value: '0.2' }));
  assert.ok(low.ok);
  assert.match(low.warning ?? '', /ten times below/);
  // plainly abnormal but not a unit slip: no warning, the screen's own range flag handles it
  const abnormal = check(form({ value: '6.5' }));
  assert.ok(abnormal.ok);
  assert.equal(abnormal.warning, null);
  // no stored range, nothing to compare against
  const none = check(form({ biomarker_id: 'a', value: '4000' }));
  assert.ok(none.ok);
  assert.equal(none.warning, null);
});

test('a stored range that cannot be read disables the warning instead of breaking entry', () => {
  const broken = [marker({ id: 'k', code: 'potassium', ref_low: 'x' as unknown as number, ref_high: 5.1 })];
  const result = validateReadingForm(form(), broken, [], TODAY);
  assert.ok(result.ok);
  assert.equal(result.warning, null);
});
