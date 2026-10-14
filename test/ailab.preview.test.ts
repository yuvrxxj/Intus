import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BIOMARKERS } from '../src/features/ailab/biomarkers.ts';
import { money, parseLedger, seconds, summarise, usedInLastDay } from '../src/features/ailab/ledger.ts';
import { previewRows } from '../src/features/ailab/preview.ts';
import type { CallRecord, RunMetrics } from '../src/features/ailab/types.ts';
import type { ParsedRow } from '../src/features/reports/parse.ts';

// Invented lines and numbers. They exercise the steps and say nothing about a real report.
const row = (label: string, code: string | null, value: number, unit: string | null, refLow: number | null, refHigh: number | null, unitMismatch = false): ParsedRow => ({
  line: `${label} ${value} ${unit ?? ''}`.trim(), label, biomarkerId: code, value, unit, refLow, refHigh, unitMismatch,
});

test('the reference table copy matches what the report reader tracks', () => {
  assert.equal(BIOMARKERS.length, 39);
  assert.equal(new Set(BIOMARKERS.map((b) => b.code)).size, 39);
  assert.equal(new Set(BIOMARKERS.map((b) => b.id)).size, 39);
});

test('rows go through the review table rules and the per-row checks, and what passes is drawn like the Bloodwork screen', () => {
  const p = previewRows([
    row('TSH', 'tsh', 2.5, 'mIU/L', 0.4, 4),
    row('Creatinine', 'creatinine', 1.23, 'mg/dL', 0.2, 1.2),
    row('Haemoglobin', 'hemoglobin', 15, 'g/dL', 13, 17),
    row('Mystery test', null, 5, 'mg/dL', null, null),
    row('Calcium', 'calcium', 2.4, 'mmol/L', null, null, true),
    row('TSH again', 'tsh', 2.6, 'mIU/L', 0.4, 4),
  ], '2026-06-06', '2026-10-14');

  assert.equal(p.date, '2026-06-06');
  assert.equal(p.shown, 3);
  assert.equal(p.view.readingCount, 3);
  assert.deepEqual(p.view.groups.map((g) => g.category).sort(), ['hematologic', 'renal', 'thyroid']);
  const creatinine = p.view.groups.flatMap((g) => g.rows).find((r) => r.biomarker.code === 'creatinine')!;
  // the range printed on the report is the one used, so 1.23 is above 1.2 even though the default range is 0.7 to 1.3
  assert.equal(creatinine.range, 'above');
  assert.equal(creatinine.rangeUsed.source, 'printed');

  assert.equal(p.left.length, 3);
  const why = Object.fromEntries(p.left.map((r) => [r.label, r.issue]));
  assert.match(why['Mystery test']!, /Not a marker Intus tracks/);
  assert.match(why['Calcium']!, /Intus stores Calcium in mg\/dl/);
  assert.match(why['TSH again']!, /appears twice/);
});

test('with no date on the report the results are dated today, and an empty answer shows an empty screen', () => {
  const dated = previewRows([row('TSH', 'tsh', 2.5, 'mIU/L', 0.4, 4)], null, '2026-10-14');
  assert.equal(dated.date, '2026-10-14');
  assert.equal(dated.shown, 1);
  const empty = previewRows([], '2026-06-06', '2026-10-14');
  assert.equal(empty.shown, 0);
  assert.equal(empty.view.readingCount, 0);
});

test('a report dated in the future shows nothing and says why on every row', () => {
  const p = previewRows([row('TSH', 'tsh', 2.5, 'mIU/L', 0.4, 4)], '2027-01-01', '2026-10-14');
  assert.equal(p.shown, 0);
  assert.equal(p.left.length, 1);
  assert.match(p.left[0].issue!, /future/);
});

const call = (over: Partial<CallRecord> = {}): CallRecord => ({
  chunk: 1, inputChars: 100, status: 200, ok: true, failure: null, attempts: 1, limited: 0, waitedS: 0, wallS: 1, usage: { promptTokens: 1000, completionTokens: 200, reasoningTokens: 50, cachedTokens: 400, queueS: 0, promptS: 0, completionS: 0, totalS: 1 },
  costUsd: 0.001, rate: null, finish: 'stop', returnedRows: 3, ...over,
});
const run = (over: Partial<RunMetrics> & { calls?: CallRecord[] } = {}): RunMetrics => ({
  id: 'r', at: '2026-10-14T10:00:00.000Z', config: { model: 'm', effort: null, mode: 'schema' }, chunkChars: 7000, maxTokens: 3600, chunks: 2, totalChunks: 2, complete: true,
  calls: [call(), call({ chunk: 2 })], totals: { elapsedS: 5, requestS: 2, waitedS: 3, promptTokens: 2000, completionTokens: 400, reasoningTokens: 100, cachedTokens: 800, costUsd: 0.002, retries: 0, rateLimited: 0 },
  score: null, pricePerMillion: null, ...over,
});

test('the ledger is read line by line, a broken line is skipped, and runs come out oldest first', () => {
  const text = [JSON.stringify(run({ id: 'b', at: '2026-10-14T11:00:00.000Z' })), '{"id":"half', '', JSON.stringify(run({ id: 'a' })), '{"id":"x"}'].join('\n');
  assert.deepEqual(parseLedger(text).map((r) => r.id), ['a', 'b']);
});

test('a run is complete, partial, failed or a trial of the first part', () => {
  assert.equal(summarise(run()).outcome, 'complete');
  const partial = summarise(run({ calls: [call(), call({ chunk: 2, ok: false, failure: 'truncated' })] }));
  assert.equal(partial.outcome, 'partial');
  assert.deepEqual(partial.failures, { truncated: 1 });
  const failed = summarise(run({ calls: [call({ ok: false, failure: 'http_400' }), call({ ok: false, failure: 'http_400' })] }));
  assert.equal(failed.outcome, 'failed');
  assert.deepEqual(failed.failures, { http_400: 2 });
  assert.equal(summarise(run({ chunks: 1, totalChunks: 5, calls: [call()] })).outcome, 'trial');
});

test('what a model used in the last day leaves out cached input and older runs', () => {
  const now = Date.parse('2026-10-14T12:00:00.000Z');
  const runs = [run(), run({ at: '2026-10-12T10:00:00.000Z' }), run({ config: { model: 'other', effort: null, mode: 'schema' } })];
  // two calls of (1000 - 400) in plus 200 out
  assert.deepEqual(usedInLastDay(runs, 'm', now), { tokens: 1600, requests: 2 });
  assert.deepEqual(usedInLastDay([], 'm', now), { tokens: 0, requests: 0 });
});

test('money and time read plainly', () => {
  assert.equal(money(null), 'not listed');
  assert.equal(money(0), '$0');
  assert.equal(money(0.00041), '$0.0004');
  assert.equal(money(0.04013), '$0.04');
  assert.equal(seconds(16.84), '16.8s');
  assert.equal(seconds(158), '2m 38s');
});
