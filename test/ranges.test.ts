import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseRange, rangeSourceLabel, statusIn } from '../src/lib/ranges.ts';

// Invented ranges. They exercise the rule and say nothing about real limits.
const hb = { code: 'hb', ref_low: 13.5, ref_high: 17.5, ref_sex: 'male' };
const k = { code: 'k', ref_low: '3.5', ref_high: '5.1', ref_sex: null };

test('the printed range comes first, for anyone, and partial printed ranges count', () => {
  assert.deepEqual(chooseRange(hb, { ref_low: 12, ref_high: 15.5 }, 'female'), { low: 12, high: 15.5, source: 'printed' });
  assert.deepEqual(chooseRange(k, { ref_low: null, ref_high: '5.0' }, null), { low: null, high: 5, source: 'printed' });
  // a row read before the columns existed has neither key
  assert.equal(chooseRange(k, {}, 'male').source, 'default');
});

test('a default for one sex is used only for that sex, and never when sex is unknown', () => {
  assert.deepEqual(chooseRange(hb, null, 'male'), { low: 13.5, high: 17.5, source: 'default' });
  assert.deepEqual(chooseRange(hb, null, 'M'), { low: 13.5, high: 17.5, source: 'default' });
  assert.deepEqual(chooseRange(hb, null, 'female'), { low: null, high: null, source: 'none', reason: 'default_other_sex' });
  assert.deepEqual(chooseRange(hb, null, null), { low: null, high: null, source: 'none', reason: 'sex_unknown' });
  assert.deepEqual(chooseRange(k, null, 'female'), { low: 3.5, high: 5.1, source: 'default' });
  assert.deepEqual(chooseRange({ code: 'x', ref_low: null, ref_high: null }, null, 'male'), { low: null, high: null, source: 'none', reason: 'none_set' });
});

test('a broken range throws rather than being used', () => {
  assert.throws(() => chooseRange(k, { ref_low: 6, ref_high: 5 }, 'male'), RangeError);
  assert.throws(() => chooseRange({ code: 'x', ref_low: 'abc', ref_high: 2 }, null, 'male'), TypeError);
});

test('status is inclusive at both ends, and no range means no flag', () => {
  const r = { low: 3.5, high: 5.1 };
  assert.deepEqual([3.5, 5.1, 3.49, 5.11].map((v) => statusIn(r, v)), ['in_range', 'in_range', 'below', 'above']);
  assert.equal(statusIn({ low: null, high: null }, 1), 'no_range');
  assert.equal(statusIn({ low: null, high: 5 }, -1), 'in_range');
});

test('the screen says where a range came from', () => {
  assert.equal(rangeSourceLabel(chooseRange(hb, { ref_low: 12, ref_high: 15.5 }, 'female')), 'as printed on your report');
  assert.match(rangeSourceLabel(chooseRange(hb, null, 'female')), /other sex/);
});
