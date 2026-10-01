import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildScreeningCalendar, latestDoneByCode, SCREENING_STATUS as S,
  type ScreeningCalendarInput, type ScreeningItem, type ScreeningRule,
} from '../src/lib/screening.ts';
import { dayNumber, isoDay } from '../src/lib/dates.ts';

const rules: ScreeningRule[] = JSON.parse(readFileSync(new URL('./fixtures/screening-rules.json', import.meta.url), 'utf8'));
const today = '2026-09-30';
const build = (args: Omit<ScreeningCalendarInput, 'rules' | 'today'> & { today?: string }) => buildScreeningCalendar({ rules, today, ...args });
const codes = (items: ScreeningItem[]) => items.map((i) => i.code);
const statusOf = (items: ScreeningItem[], code: string) => items.find((i) => i.code === code)?.status;

test('adult male with no history: everything applicable is due, risk-gated rules say not yet', () => {
  const items = build({ sex: 'male', age: 30 });
  assert.deepEqual(codes(items), [
    'bp', 'lipids', 'glucose_hba1c', 'hiv', 'hcv', 'hbsag_hepb', 'tdap', 'dental', 'checkup',
    'testicular', 'skin', 'mental', 'colonoscopy', 'psa',
  ]);
  const notYet = items.filter((i) => i.status === S.NOT_YET).map((i) => i.code);
  assert.deepEqual(notYet, ['colonoscopy', 'psa']);
  assert.ok(items.filter((i) => !notYet.includes(i.code)).every((i) => i.status === S.DUE));
});

test('adult female gets no male-only rules', () => {
  const items = build({ sex: 'female', age: 30 });
  assert.equal(codes(items).includes('testicular'), false);
  assert.equal(codes(items).includes('psa'), false);
  assert.equal(items.length, 12);
});

test('children only see age-free rules plus risk-gated not-yet notes', () => {
  assert.deepEqual(codes(build({ sex: 'male', age: 10 })), ['dental', 'skin', 'colonoscopy', 'psa']);
});

test('colonoscopy starts at 45, or earlier with family history', () => {
  assert.equal(statusOf(build({ sex: 'female', age: 44 }), 'colonoscopy'), S.NOT_YET);
  assert.equal(statusOf(build({ sex: 'female', age: 45 }), 'colonoscopy'), S.DUE);
  const early = build({ sex: 'female', age: 44, flags: { family_colorectal_cancer: true } });
  assert.equal(statusOf(early, 'colonoscopy'), S.DUE);
  const nullFlag = build({ sex: 'female', age: 44, flags: { family_colorectal_cancer: null } });
  assert.equal(statusOf(nullFlag, 'colonoscopy'), S.NOT_YET);
});

test('PSA is male only and starts at 50, or earlier with family history', () => {
  assert.equal(statusOf(build({ sex: 'male', age: 49 }), 'psa'), S.NOT_YET);
  assert.equal(statusOf(build({ sex: 'male', age: 50 }), 'psa'), S.DUE);
  assert.equal(statusOf(build({ sex: 'male', age: 49, flags: { family_prostate_cancer: true } }), 'psa'), S.DUE);
  assert.equal(statusOf(build({ sex: 'female', age: 60, flags: { family_prostate_cancer: true } }), 'psa'), undefined);
});

test('testicular self-check covers males 15 to 40 only', () => {
  const has = (sex: string, age: number) => codes(build({ sex, age })).includes('testicular');
  assert.deepEqual([has('male', 14), has('male', 15), has('male', 40), has('male', 41), has('female', 20)], [false, true, true, false, false]);
});

test('hearing test appears only when the exposure flag is set, at any age', () => {
  for (const age of [20, 70]) {
    assert.equal(statusOf(build({ sex: 'male', age }), 'audiometry'), undefined);
    assert.equal(statusOf(build({ sex: 'male', age, flags: { noise_or_blast_exposure: true } }), 'audiometry'), S.DUE);
  }
});

test('interval rules flip to overdue once a full interval has passed', () => {
  const at = (done: string) => statusOf(build({ sex: 'male', age: 30, lastDone: { bp: done } }), 'bp');
  assert.equal(at('2025-09-30'), S.UP_TO_DATE);
  assert.equal(at('2025-09-29'), S.OVERDUE);
});

test('one-time screenings stay up to date once done', () => {
  const [hiv] = build({ sex: 'male', age: 60, lastDone: { hiv: '2010-01-01' } }).filter((i) => i.code === 'hiv');
  assert.equal(hiv.status, S.UP_TO_DATE);
  assert.equal(hiv.lastDone, '2010-01-01');
  assert.match(hiv.detail, /one-time/);
});

test('latestDoneByCode keeps the most recent date whatever the row order', () => {
  const latest = latestDoneByCode([
    { screening_code: 'bp', done_date: '2024-05-01' },
    { screening_code: 'bp', done_date: '2025-11-20' },
    { screening_code: 'bp', done_date: '2023-01-01' },
    { screening_code: 'tdap', done_date: '2018-03-03' },
  ]);
  assert.deepEqual(latest, { bp: '2025-11-20', tdap: '2018-03-03' });
});

test('detail text carries the date and the rule rationale', () => {
  const items = build({ sex: 'male', age: 30, lastDone: { lipids: '2024-09-30' } });
  const lipids = items.find((i) => i.code === 'lipids');
  assert.ok(lipids);
  assert.equal(lipids.lastDone, '2024-09-30');
  assert.match(lipids.detail, /2024-09-30.*2\.0 years ago \(every 5 years\)/);
  assert.ok(lipids.detail.endsWith(rules.find((r) => r.code === 'lipids')?.rationale ?? ''));
  assert.match(items.find((i) => i.code === 'bp')?.detail ?? '', /^No record yet\./);
});

test('sex accepts M/F and any case, and unknown sex drops sex-specific rules', () => {
  for (const alias of ['Male', 'M', 'm', ' male ']) {
    assert.deepEqual(build({ sex: alias, age: 30 }), build({ sex: 'male', age: 30 }));
  }
  assert.deepEqual(build({ sex: 'F', age: 30 }), build({ sex: 'female', age: 30 }));
  assert.equal(codes(build({ sex: 'M', age: 60 })).includes('psa'), true);
  for (const unknown of [null, undefined, 'x', '']) {
    assert.equal(codes(build({ sex: unknown, age: 60 })).includes('psa'), false);
  }
});

test('output follows the order of the rules passed in', () => {
  const reversed = buildScreeningCalendar({ rules: [...rules].reverse(), today, sex: 'male', age: 30 });
  assert.deepEqual(codes(reversed), codes(build({ sex: 'male', age: 30 })).reverse());
});

test('a missing profile fails loudly instead of returning an empty calendar', () => {
  for (const age of [undefined, null, NaN, -1, '30']) {
    assert.throws(() => build({ sex: 'male', age: age as number }), TypeError);
  }
  assert.throws(() => build({ sex: 'male', age: 30, today: 'not-a-date' }), TypeError);
});

test('date helpers reject impossible dates and round-trip valid ones', () => {
  assert.equal(isoDay(dayNumber('2026-02-28')), '2026-02-28');
  assert.equal(dayNumber('2026-03-01') - dayNumber('2026-02-28'), 1);
  assert.equal(dayNumber('2026-03-01T10:00:00Z'), dayNumber('2026-03-01'));
  for (const bad of ['2026-13-01', '2026-02-30', 'abc', '']) assert.throws(() => dayNumber(bad), TypeError);
  assert.equal(dayNumber(new Date(2026, 2, 1)), dayNumber('2026-03-01'));
});
