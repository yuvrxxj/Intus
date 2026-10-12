import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PANEL_COLUMNS, SCORE_COLUMNS, checkPanels, checkScores, gate, parseCsv, readTable, type Score,
} from '../scripts/lab-panels.ts';

const at = (p: string) => new URL(`../${p}`, import.meta.url);

test('parseCsv: quotes, doubled quotes, commas inside a field, CRLF and a trailing newline', () => {
  assert.deepEqual(parseCsv('a,b\r\n"x, y","say ""hi"""\n\n1,\n'), [['a', 'b'], ['x, y', 'say "hi"'], ['1', '']]);
  assert.throws(() => parseCsv('a,"b\n'), /never closed/);
});

test('the templates parse with the expected headers and their example rows are clean', () => {
  const panels = readTable(readFileSync(at('docs/product/lab-panels/panels.template.csv'), 'utf8'), PANEL_COLUMNS, 'panels');
  assert.deepEqual(panels.problems, []);
  assert.deepEqual(checkPanels(panels.rows), []);
  const ids = new Set(panels.rows.map((r) => r.panel_id));
  const scores = readTable(readFileSync(at('docs/product/lab-panels/scores.template.csv'), 'utf8'), SCORE_COLUMNS, 'scores');
  assert.deepEqual(scores.problems, []);
  assert.deepEqual(checkScores(scores.rows, ids).problems, []);
});

test('readTable refuses a header that is not exactly the expected columns', () => {
  assert.match(readTable('panel_id,value\n', PANEL_COLUMNS, 'panels').problems[0], /header must be exactly/);
  assert.match(readTable(`${PANEL_COLUMNS.join(',')}\nP1,x\n`, PANEL_COLUMNS, 'panels').problems[0], /2 fields, expected 10/);
});

const row = (over: Record<string, string> = {}) => ({
  panel_id: 'P1', marker: 'Ferritin', value: '18', unit: 'ug/L', lab_ref_low: '30', lab_ref_high: '400', sex: 'F',
  age_band: '30-39', test_date: '2026-05-14', context: '', ...over,
});

test('checkPanels catches what a transcription check can', () => {
  assert.deepEqual(checkPanels([row(), row({ marker: 'LDL', lab_ref_low: '' })]), []);
  const problems = checkPanels([
    row({ value: '<5' }),
    row({ marker: 'ferritin' }), // same marker twice, case aside
    row({ marker: 'A', lab_ref_low: '10', lab_ref_high: '5' }),
    row({ marker: 'B', sex: 'female' }),
    row({ marker: 'C', age_band: '35' }),
    row({ marker: 'D', test_date: '2026-02-30' }),
    row({ marker: 'E', unit: '' }),
    row({ panel_id: 'P2', marker: 'G' }),
    row({ panel_id: 'P2', marker: 'H', age_band: '40-49' }),
  ]).join('\n');
  for (const want of ['not a plain decimal', 'already in the panel', 'above lab_ref_high', 'sex must be', 'age_band must', 'real date', 'unit is empty', "age_band differs from the panel's first row"]) {
    assert.ok(problems.includes(want), `expected "${want}" in:\n${problems}`);
  }
});

const score = (over: Record<string, string> = {}) => ({
  panel_id: 'P1', clinician_mark: 'would_say', clinician_notes: '', adds_beyond_lab_flags: 'yes', narrator_facts_match: 'yes',
  narrator_invented_numbers: '0', narrator_unsafe: 'no', units_ok: 'yes', narration_cost_cents: '0.5', scored_by: 'AB', scored_on: '2026-05-20', ...over,
});

test('checkScores: unknown panel, double score, bad mark, yes or no fields and who verified it', () => {
  const ids = new Set(['P1']);
  assert.equal(checkScores([score()], ids).scores.length, 1);
  const { scores, problems } = checkScores([
    score(), score(), score({ panel_id: 'P9' }), score({ clinician_mark: 'fine' }), score({ units_ok: 'y' }), score({ scored_by: '' }),
  ], ids);
  const text = problems.join('\n');
  for (const want of ['scored twice', 'no panel with this id', 'clinician_mark must', 'units_ok must be yes or no', 'scored_by is empty']) {
    assert.ok(text.includes(want), `expected "${want}" in:\n${text}`);
  }
  assert.equal(scores.length, 1);
});

const good = (i: number, over: Partial<Score> = {}): Score => ({
  panelId: `P${i}`, mark: 'would_say', addsBeyondFlags: true, factsMatch: true, inventedNumbers: 0, narratorUnsafe: false, unitsOk: true, costCents: 0.5, ...over,
});
const ten = (change: (i: number) => Partial<Score> = () => ({})) => Array.from({ length: 10 }, (_, i) => good(i + 1, change(i + 1)));

test('gate: the numbers from the exercise', () => {
  assert.equal(gate(ten()).outcome, 'go');
  // 8 useful is enough, 7 is not (and is not a stop either)
  assert.equal(gate(ten((i) => (i <= 2 ? { mark: 'true_but_useless' } : {}))).outcome, 'go');
  assert.equal(gate(ten((i) => (i <= 3 ? { mark: 'true_but_useless' } : {}))).outcome, 'not_yet');
  // a single unsafe statement, from the clinician's mark or the narrator, stops it
  assert.equal(gate(ten((i) => (i === 4 ? { mark: 'unsafe' } : {}))).outcome, 'stop');
  assert.equal(gate(ten((i) => (i === 4 ? { narratorUnsafe: true } : {}))).outcome, 'stop');
  // adds nothing on 5 panels stops it, on 4 does not
  assert.equal(gate(ten((i) => (i <= 5 ? { addsBeyondFlags: false } : {}))).outcome, 'stop');
  assert.equal(gate(ten((i) => (i <= 4 ? { addsBeyondFlags: false } : {}))).outcome, 'go');
  // facts on 9 of 10 is enough; any invented number anywhere is not
  assert.equal(gate(ten((i) => (i === 1 ? { factsMatch: false } : {}))).outcome, 'go');
  assert.equal(gate(ten((i) => (i <= 2 ? { factsMatch: false } : {}))).outcome, 'not_yet');
  assert.equal(gate(ten((i) => (i === 1 ? { inventedNumbers: 1 } : {}))).outcome, 'not_yet');
  // cost has to be under the target on every panel, and the target is a parameter
  assert.equal(gate(ten((i) => (i === 1 ? { costCents: 2 } : {}))).outcome, 'not_yet');
  assert.equal(gate(ten((i) => (i === 1 ? { costCents: 2 } : {})), 3).outcome, 'go');
  // nine panels is never a go
  assert.equal(gate(ten().slice(0, 9)).outcome, 'not_yet');
});
