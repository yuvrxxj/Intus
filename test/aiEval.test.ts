import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evalRequest, score } from '../scripts/ai-eval.ts';
import { parseReport, type MarkerRef, type ParsedRow } from '../src/features/reports/parse.ts';

const row = (biomarkerId: string | null, value: number): ParsedRow => ({ line: `${biomarkerId} ${value}`, biomarkerId, label: biomarkerId ?? 'other', value, unit: null, refLow: null, refHigh: null, unitMismatch: false });
const name = (id: string) => id.toUpperCase();

test('a model is scored on tracked markers it reproduced, disagreed on, missed and added, and on tests Intus does not track', () => {
  const device = [row('hdl', 54), row('ldl', 72), row('tsh', 2), row('ast', 21), row(null, 5)];
  const ai = [row('hdl', 54), row('ldl', 99), row('crp', 0.6), row(null, 7), row(null, 8)];
  const s = score(ai, device, 7, 2, name);
  assert.deepEqual([s.deviceKnown, s.aiKnown, s.agree], [4, 3, 1]);
  assert.deepEqual(s.conflicts, [{ marker: 'LDL', ai: 99, device: 72 }]);
  assert.deepEqual(s.deviceOnly.sort(), ['AST', 'TSH']);
  assert.deepEqual(s.aiOnly, ['CRP']);
  assert.deepEqual([s.extraUntracked, s.returned, s.kept, s.dropped], [2, 7, 5, 2]);
});

test('a marker read twice with different numbers agrees if the model has either of them', () => {
  const s = score([row('hdl', 54)], [row('hdl', 60), row('hdl', 54)], 1, 0, name);
  assert.deepEqual([s.agree, s.conflicts.length], [1, 0]);
});

const MARKERS = [{ code: 'alt', name: 'ALT', unit: 'U/L' }];
const RUN = { provider: 'openrouter' as const, mode: 'schema' as const, maxTokens: 100 };

test('a chat request keeps the rule that refuses hosts that keep or train on prompts, unless the run opts out of it', () => {
  const kept = evalRequest({ ...RUN, allowTraining: false }, 'vendor/model', 'report text', MARKERS) as Record<string, unknown>;
  assert.deepEqual(kept.provider, { data_collection: 'deny', require_parameters: true });
  const open = evalRequest({ ...RUN, allowTraining: true }, 'vendor/model', 'report text', MARKERS) as Record<string, unknown>;
  assert.equal('provider' in open, false);
  assert.equal(open.model, 'vendor/model');
  assert.deepEqual(open.messages, kept.messages);
  assert.deepEqual(open.response_format, kept.response_format);
});

test('a Gemini request has no routing rule to leave out and is the same either way', () => {
  const gemini = { ...RUN, provider: 'gemini' as const };
  assert.deepEqual(evalRequest({ ...gemini, allowTraining: true }, 'm', 'text', MARKERS), evalRequest({ ...gemini, allowTraining: false }, 'm', 'text', MARKERS));
});

test('the sample report says it is invented, and the on-device reader finds most of what it holds', () => {
  const text = readFileSync(new URL('../scripts/ai-eval-sample-report.txt', import.meta.url), 'utf8').trim();
  assert.match(text.split('\n').slice(0, 3).join(' '), /invented report for testing/i);
  const markers = JSON.parse(readFileSync(new URL('../scripts/ai-eval-markers.json', import.meta.url), 'utf8')) as { code: string; name: string; unit: string }[];
  const refs: MarkerRef[] = markers.map((m) => ({ id: m.code, ...m }));
  const rows = parseReport(text.split('\n'), refs).rows.filter((r) => r.biomarkerId !== null);
  assert.ok(rows.length >= 28, `found ${rows.length}`);
});

test('extra body fields are added to the request, and cannot replace the privacy rule', () => {
  const asked = evalRequest({ ...RUN, allowTraining: false, extraBody: { reasoning_effort: 'low' } }, 'vendor/model', 'report text', MARKERS) as Record<string, unknown>;
  assert.equal(asked.reasoning_effort, 'low');
  assert.deepEqual(asked.provider, { data_collection: 'deny', require_parameters: true });
  const gemini = evalRequest({ ...RUN, provider: 'gemini', allowTraining: true, extraBody: { x: 1 } }, 'm', 'text', MARKERS) as Record<string, unknown>;
  assert.equal(gemini.x, 1);
});
