import { test } from 'node:test';
import assert from 'node:assert/strict';
import { YES_NO_UNIT } from '../src/features/supplements/effect.ts';
import {
  MINUS,
  formatMarkerChange,
  formatMarkerValue,
  formatMarkerWithUnit,
  formatMetricChange,
  formatMetricValue,
  formatPercentChange,
  metricDecimals,
} from '../src/features/supplements/format.ts';

test('each measure is rounded to a precision that suits it', () => {
  assert.equal(metricDecimals('kg'), 1);
  for (const unit of ['g', 'kcal', 'ml', 'ms', 'bpm']) assert.equal(metricDecimals(unit), 0, unit);
  assert.equal(metricDecimals(YES_NO_UNIT), 1);
  assert.equal(metricDecimals(''), 1, 'mood has no unit');
  assert.equal(metricDecimals('cups'), 1, 'a habit with its own unit');
});

test('averages show the precision of their measure, with the unit', () => {
  assert.equal(formatMetricValue(69.97857142857143, 'kg'), '70.0 kg');
  assert.equal(formatMetricValue(2149.6, 'kcal'), '2150 kcal');
  assert.equal(formatMetricValue(61.25, 'bpm'), '61 bpm');
  assert.equal(formatMetricValue(62.5, YES_NO_UNIT), `62.5 ${YES_NO_UNIT}`);
  assert.equal(formatMetricValue(3.4285714, ''), '3.4', 'no unit, no trailing space');
});

test('a weight change reads with one decimal, the unit and a real minus sign', () => {
  assert.equal(formatMetricChange(-1, -1.4285714, 'kg'), `${MINUS}1.0 kg (${MINUS}1.4%)`);
  assert.equal(formatMetricChange(0.84, 1.2, 'kg'), '+0.8 kg (+1.2%)');
  assert.equal(formatMetricChange(-1.0000001, null, 'kg'), `${MINUS}1.0 kg`);
});

test('other measures carry their unit and their precision', () => {
  assert.equal(formatMetricChange(2.4, 3.9, 'bpm'), '+2 bpm (+3.9%)');
  assert.equal(formatMetricChange(-312.5, -14.2, 'kcal'), `${MINUS}313 kcal (${MINUS}14.2%)`);
  assert.equal(formatMetricChange(0.56, 12, ''), '+0.6 (+12.0%)', 'mood has no unit to show');
  assert.equal(formatMetricChange(6.25, 10, 'cups'), '+6.3 cups (+10.0%)');
});

test('a yes or no habit changes in percentage points, with no percent of a percent', () => {
  assert.equal(formatMetricChange(12.5, 25, YES_NO_UNIT), '+12.5 points');
  assert.equal(formatMetricChange(-7.14, -10, YES_NO_UNIT), `${MINUS}7.1 points`);
});

test('a change is never written as -0.0 or +0.0', () => {
  assert.equal(formatMetricChange(-0.04, -0.04, 'kg'), '<0.1 kg (0.0%)');
  assert.equal(formatMetricChange(0.04, 0.04, 'kg'), '<0.1 kg (0.0%)');
  assert.equal(formatMetricChange(-0.4, null, 'bpm'), '<1 bpm');
  assert.equal(formatMetricChange(0.001, null, YES_NO_UNIT), '<0.1 points');
  assert.equal(formatPercentChange(-0.04), ' (0.0%)');
  assert.equal(formatPercentChange(0.04), ' (0.0%)');
  for (const text of [formatMetricChange(-0.04, -0.04, 'kg'), formatPercentChange(-0.001), formatMetricChange(-0.2, null, 'bpm')]) {
    assert.doesNotMatch(text, /[−-]0(\.0+)?(?!\d)/, text);
  }
});

test('an exact zero is "No change", a missing change is a dash', () => {
  assert.equal(formatMetricChange(0, 0, 'kg'), 'No change');
  assert.equal(formatMetricChange(null, null, 'kg'), '—');
  assert.equal(formatMetricChange(2, null, 'kg'), '+2.0 kg', 'no percentage when the before average is zero');
});

test('percentages have one decimal and a sign', () => {
  assert.equal(formatPercentChange(null), '');
  assert.equal(formatPercentChange(3.456), ' (+3.5%)');
  assert.equal(formatPercentChange(-3.456), ` (${MINUS}3.5%)`);
  assert.equal(formatPercentChange(100), ' (+100.0%)');
});

test('lab results keep four significant figures and never drop digits left of the point', () => {
  assert.equal(formatMarkerValue(5.23456), '5.235');
  assert.equal(formatMarkerValue(0.0123456), '0.01235');
  assert.equal(formatMarkerValue(118), '118');
  assert.equal(formatMarkerValue(118.04), '118');
  assert.equal(formatMarkerValue(9012.3), '9012');
  assert.equal(formatMarkerValue(12345.678), '12346');
  assert.equal(formatMarkerValue(253456), '253456');
  assert.equal(formatMarkerValue(0), '0');
  assert.equal(formatMarkerValue(-4.5), '4.5', 'the sign is added by the caller');
  assert.equal(formatMarkerValue(0.0000001234), '0.0000001234', 'never exponent notation');
});

test('a blood marker change has the marker\'s own unit and a minus sign', () => {
  assert.equal(formatMarkerChange(-8.4, -7.1, 'mg/dL'), `${MINUS}8.4 mg/dL (${MINUS}7.1%)`);
  assert.equal(formatMarkerChange(0.35, 4.2, 'ng/mL'), '+0.35 ng/mL (+4.2%)');
  assert.equal(formatMarkerChange(12.2, null, ''), '+12.2', 'a marker with no unit has no trailing space');
  assert.equal(formatMarkerChange(0, 0, 'mg/dL'), 'No change');
  assert.equal(formatMarkerWithUnit(5.23456, 'mmol/L'), '5.235 mmol/L');
  assert.equal(formatMarkerWithUnit(7, ''), '7');
});
