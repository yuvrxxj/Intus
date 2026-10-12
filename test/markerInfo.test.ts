import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MARKER_INFO, medlinePlusUrl } from '../src/features/bloodwork/markerInfo.ts';
import { ALIASES } from '../src/features/reports/aliases.ts';

// The codes in the live biomarkers table on 12 Oct 2026, plus those added by migrations in this repository. A new marker needs an entry here and in MARKER_INFO.
const LIVE = [
  'alt', 'ast', 'creatinine', 'egfr', 'hemoglobin', 'ferritin', 'tsh', 't3_free', 't4_free', 'testosterone', 'cortisol', 'glucose', 'hba1c',
  'ldl', 'hdl', 'crp', 'vitamin_d', 'nt_probnp', 'vitamin_b12', 'serum_iron', 'calcium', 'transferrin_sat', 'total_cholesterol',
  'triglycerides', 'blood_urea', 'uric_acid', 'ggt', 'albumin', 'wbc_tlc', 'platelets', 't4_total', 'potassium', 'sodium',
  // added by 20261012000400_cycle_and_conditions.sql
  'oestradiol', 'progesterone', 'lh', 'fsh', 'prolactin', 'shbg',
];

test('every live marker has a popover entry and report aliases', () => {
  for (const code of LIVE) {
    assert.ok(MARKER_INFO[code], `${code} has no popover entry`);
    assert.ok(ALIASES[code], `${code} has no report aliases`);
  }
});

test('entries follow the wording rules: no doses, no drug names, a LOINC code for the link', () => {
  const DOSE = /\b\d+(\.\d+)?\s*(mg|mcg|µg|iu|g)\b/i;
  const DRUGS = /\b(statin|metformin|levothyroxine|aspirin|ibuprofen|paracetamol|insulin(?! resistance)|warfarin|steroid|prednisone)s?\b/i;
  for (const [code, info] of Object.entries(MARKER_INFO)) {
    const text = [info.what, info.high, info.low ?? '', info.habits].join(' ');
    assert.ok(!DOSE.test(text), `${code} mentions a dose`);
    assert.ok(!DRUGS.test(text), `${code} names a medicine`);
    assert.match(info.loinc, /^\d{1,6}-\d$/, `${code} LOINC`);
  }
});

test('the MedlinePlus link looks the test up by its LOINC code', () => {
  const url = new URL(medlinePlusUrl('2276-4'));
  assert.equal(url.host, 'connect.medlineplus.gov');
  assert.equal(url.searchParams.get('mainSearchCriteria.v.c'), '2276-4');
  assert.equal(url.searchParams.get('mainSearchCriteria.v.cs'), '2.16.840.1.113883.6.1');
});

/** LOINC's Mod 10 check digit: double the digits in odd places from the right, then sum every digit. */
function loincCheck(body: string): number {
  const digits = body.split('').reverse();
  const odd = digits.filter((_, i) => i % 2 === 0).reverse().join('');
  const even = digits.filter((_, i) => i % 2 === 1).reverse().join('');
  const sum = (even + String(Number(odd) * 2)).split('').reduce((n, d) => n + Number(d), 0);
  return (10 - (sum % 10)) % 10;
}

test('every LOINC code has a valid check digit, so a typo cannot open the wrong page', () => {
  assert.equal(loincCheck('2276'), 4);
  for (const [code, info] of Object.entries(MARKER_INFO)) {
    const [body, check] = info.loinc.split('-');
    assert.equal(loincCheck(body), Number(check), `${code}: ${info.loinc}`);
  }
});
