import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { activityRows, type DayTotalIn } from '../mobile/src/sync/mapping.ts';
import {
  ACTIVITY_COPY,
  dayHeading,
  formatKcal,
  formatSteps,
  historyStart,
  pickPerDay,
  presentActivity,
  type ActivityDayRow,
} from '../mobile/src/activity/rules.ts';
import { PERSONAL_TABLES, buildExport } from '../src/features/export/model.ts';

// healthkit.ts imports the native library, which Node cannot load, so its read list is taken from the source text.
const readList = /READ_TYPES = \[([^\]]*)\]/.exec(readFileSync('mobile/src/healthkit.ts', 'utf8'))?.[1] ?? '';
const READ_TYPES_FOR_TEST = [...readList.matchAll(/'(HK[A-Za-z]+)'/g)].map((m) => m[1]);

// Invented days. A fixed offset (UTC+5:30, India) stands in for the phone's time zone so the tests do not depend on where they run.
const IST = () => 330;
const total = (startUtc: string, value: number | undefined): DayTotalIn => {
  const start = new Date(startUtc);
  return { start, end: new Date(start.getTime() + 86_400_000), value };
};
// Apple's daily buckets start at local midnight: 2026-10-09T18:30:00Z is 00:00 on the 10th in India.

test('a day of steps and active energy becomes one row for the local day, with steps whole and energy to a decimal', () => {
  const rows = activityRows(
    [total('2026-10-09T18:30:00Z', 8123.4), total('2026-10-10T18:30:00Z', 10456.6)],
    [total('2026-10-09T18:30:00Z', 412.449), total('2026-10-10T18:30:00Z', 530.06)],
    IST,
  );
  assert.deepEqual(rows, [
    { day: '2026-10-10', steps: 8123, active_kcal: 412.4, source: 'healthkit' },
    { day: '2026-10-11', steps: 10457, active_kcal: 530.1, source: 'healthkit' },
  ]);
});

test('a day with only one of the two keeps the other empty, and a day with neither is dropped', () => {
  const rows = activityRows(
    [total('2026-10-09T18:30:00Z', 5000), total('2026-10-10T18:30:00Z', undefined)],
    [total('2026-10-10T18:30:00Z', undefined), total('2026-10-11T18:30:00Z', 250)],
    IST,
  );
  assert.deepEqual(rows, [
    { day: '2026-10-10', steps: 5000, active_kcal: null, source: 'healthkit' },
    { day: '2026-10-12', steps: null, active_kcal: 250, source: 'healthkit' },
  ]);
});

test('zero and glitch totals are not readings and are left out, at the database limits', () => {
  const rows = activityRows(
    [
      total('2026-10-01T18:30:00Z', 0),
      total('2026-10-02T18:30:00Z', 0.4),
      total('2026-10-03T18:30:00Z', 200_000),
      total('2026-10-04T18:30:00Z', 200_001),
      total('2026-10-05T18:30:00Z', Number.NaN),
      total('2026-10-06T18:30:00Z', -5),
    ],
    [
      total('2026-10-01T18:30:00Z', 0),
      total('2026-10-03T18:30:00Z', 20_000),
      total('2026-10-04T18:30:00Z', 20_000.5),
      total('2026-10-05T18:30:00Z', Number.POSITIVE_INFINITY),
    ],
    IST,
  );
  assert.deepEqual(rows, [{ day: '2026-10-04', steps: 200_000, active_kcal: 20_000, source: 'healthkit' }]);
});

test('every row it makes fits the activity_days table', () => {
  const sql = readFileSync('supabase/migrations/20261101000200_activity_days.sql', 'utf8');
  assert.match(sql, /steps between 0 and 200000/);
  assert.match(sql, /active_kcal between 0 and 20000/);
  assert.match(sql, /source in \('manual', 'healthkit', 'health_connect', 'other'\)/);
  const rows = activityRows([total('2026-10-09T18:30:00Z', 12000.5)], [total('2026-10-09T18:30:00Z', 99999)], IST);
  for (const row of rows) {
    assert.ok(row.steps === null || (Number.isInteger(row.steps) && row.steps >= 0 && row.steps <= 200000));
    assert.ok(row.active_kcal === null || (row.active_kcal >= 0 && row.active_kcal <= 20000));
    assert.equal(row.source, 'healthkit');
  }
});

test('the sync asks Apple for steps and active energy, read only, and the export includes the table', () => {
  assert.deepEqual(
    READ_TYPES_FOR_TEST.filter((t) => /StepCount|ActiveEnergyBurned/.test(t)),
    ['HKQuantityTypeIdentifierStepCount', 'HKQuantityTypeIdentifierActiveEnergyBurned'],
  );
  assert.ok((PERSONAL_TABLES as readonly string[]).includes('activity_days'));
  const empty = Object.fromEntries(PERSONAL_TABLES.map((t) => [t, []])) as unknown as Parameters<typeof buildExport>[0]['tables'];
  const out = buildExport({
    email: null,
    exportedAt: new Date('2026-11-01T00:00:00Z'),
    tables: { ...empty, activity_days: [{ id: 'a', user_id: 'u', day: '2026-10-10', steps: 8000, active_kcal: 400, source: 'healthkit' }] },
    biomarkers: [],
    files: { photos: [], reports: [] },
  }) as { tables: Record<string, Record<string, unknown>[]>; counts: Record<string, number> };
  assert.deepEqual(out.tables.activity_days, [{ id: 'a', day: '2026-10-10', steps: 8000, active_kcal: 400, source: 'healthkit' }]);
  assert.equal(out.counts.activity_days, 1);
});

test('numbers are written the same on every phone, whole kilocalories, and days read plainly', () => {
  assert.equal(formatSteps(0), '0');
  assert.equal(formatSteps(999), '999');
  assert.equal(formatSteps(12345), '12,345');
  assert.equal(formatSteps(1234567.4), '1,234,567');
  assert.equal(formatKcal(412.5), '413 kcal');
  assert.equal(formatKcal(1204), '1,204 kcal');
  assert.equal(dayHeading('2026-10-10', '2026-10-10'), 'Today so far');
  assert.equal(dayHeading('2026-10-09', '2026-10-10'), 'Yesterday');
  assert.equal(dayHeading('2026-10-03', '2026-10-10'), 'Sat 3 Oct');
  assert.equal(dayHeading('2026-03-01', '2026-10-10'), 'Sun 1 Mar');
  assert.equal(historyStart('2026-03-05', 30), '2026-02-03');
});

const day = (d: string, steps: number | null, kcal: number | null, source = 'healthkit'): ActivityDayRow => ({ day: d, steps, active_kcal: kcal, source });

test('one source is shown per day, Apple Health first, and the other is named and not added in', () => {
  const picked = pickPerDay([day('2026-10-09', 5000, 200, 'health_connect'), day('2026-10-09', 7000, 300, 'healthkit'), day('2026-10-08', 100, 1, 'manual')]);
  assert.deepEqual(picked.map((p) => [p.row.day, p.row.source, p.others]), [
    ['2026-10-09', 'healthkit', ['Health Connect']],
    ['2026-10-08', 'manual', []],
  ]);
  const view = presentActivity([day('2026-10-09', 5000, 200, 'health_connect'), day('2026-10-09', 7000, 300)], '2026-10-10');
  assert.equal(view.lines[0].steps, '7,000');
  assert.equal(view.lines[0].note, 'Also reported by Health Connect. Not added in.');
});

test('today is its own line, newest first, and the average is the seven full days before today with a number', () => {
  const rows = [
    day('2026-10-10', 3000, 100),
    day('2026-10-09', 9000, 400),
    day('2026-10-08', 6000, null),
    day('2026-10-07', 12000, 600),
    day('2026-10-05', 3000, 200),
    day('2026-10-02', 99999, 9999),
  ];
  const view = presentActivity(rows, '2026-10-10');
  assert.equal(view.today?.heading, 'Today so far');
  assert.equal(view.today?.steps, '3,000');
  assert.deepEqual(view.lines.map((l) => l.day), ['2026-10-10', '2026-10-09', '2026-10-08', '2026-10-07', '2026-10-05', '2026-10-02']);
  // window is 2026-10-03 to 2026-10-09: steps 9000, 6000, 12000, 3000; calories 400, 600, 200
  assert.equal(view.averages?.stepDays, 4);
  assert.equal(view.averages?.steps, '7,500');
  assert.equal(view.averages?.kcalDays, 3);
  assert.equal(view.averages?.kcal, '400 kcal');
});

test('no average under three days, an empty state with no rows, and a day with no numbers does not appear', () => {
  assert.equal(presentActivity([day('2026-10-09', 9000, 400), day('2026-10-08', 8000, 300)], '2026-10-10').averages, null);
  assert.equal(presentActivity([day('2026-10-10', 9000, 400)], '2026-10-10').averages, null, 'today alone is not an average');
  const none = presentActivity([], '2026-10-10');
  assert.deepEqual(none, { today: null, lines: [], averages: null });
  assert.equal(presentActivity([day('2026-10-09', null, null)], '2026-10-10').lines.length, 0);
  const oneKind = presentActivity([day('2026-10-09', 9000, null), day('2026-10-08', 8000, null), day('2026-10-07', 7000, null)], '2026-10-10');
  assert.equal(oneKind.averages?.steps, '8,000');
  assert.equal(oneKind.averages?.kcal, null);
});

test('numbers that arrive as strings are read, and ones that are not numbers are treated as missing', () => {
  const view = presentActivity(
    [
      { day: '2026-10-09', steps: '8000' as unknown as number, active_kcal: '350.5' as unknown as number, source: 'healthkit' },
      { day: '2026-10-08', steps: 'oops' as unknown as number, active_kcal: 100, source: 'healthkit' },
    ],
    '2026-10-10',
  );
  assert.equal(view.lines[0].steps, '8,000');
  assert.equal(view.lines[0].kcal, '351 kcal');
  assert.equal(view.lines[1].steps, null);
  assert.equal(view.lines[1].kcal, '100 kcal');
});

test('the Activity copy has no score, no medical claim, no emoji and no raw error text', () => {
  const copy = Object.values(ACTIVITY_COPY).join(' ');
  assert.doesNotMatch(copy, /diagnos|treat|cure|prescri|clinical|disorder|goal|score|great|good|bad|well done/i);
  assert.doesNotMatch(copy, /\p{Extended_Pictographic}/u);
  assert.equal(copy.includes('TypeError'), false);
  assert.match(ACTIVITY_COPY.footnote, /do not include resting energy/);
});
