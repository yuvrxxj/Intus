#!/usr/bin/env node
// Checks the files for the ten-panel lab exercise (docs/product/lab-panel-exercise.md) and works out the gate.
//
//   node scripts/lab-panels.ts panels.csv scores.csv
//
// panels.csv is one row per marker, scores.csv one row per panel. Templates for both are in docs/product/lab-panels/.
// Nothing here reads or sends the files anywhere: it parses them, lists what is wrong, and prints the gate result.
// Keep the real files out of this repository unless they are fully de-identified and the people agreed.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const PANEL_COLUMNS = ['panel_id', 'marker', 'value', 'unit', 'lab_ref_low', 'lab_ref_high', 'sex', 'age_band', 'test_date', 'context'] as const;
export const SCORE_COLUMNS = [
  'panel_id', 'clinician_mark', 'clinician_notes', 'adds_beyond_lab_flags', 'narrator_facts_match', 'narrator_invented_numbers',
  'narrator_unsafe', 'units_ok', 'narration_cost_cents', 'scored_by', 'scored_on',
] as const;

/** The four marks a clinician gives a hand interpretation, as the exercise defines them. Only the last counts as useful. */
export const MARKS = ['wrong', 'unsafe', 'true_but_useless', 'would_say'] as const;
export type Mark = (typeof MARKS)[number];

/** The working cost target from the exercise, in cents per panel. An assumption until real unit economics replace it. */
export const COST_TARGET_CENTS = 2;
export const PANELS_NEEDED = 10;

export type Row = Record<string, string>;

/** RFC 4180 CSV: commas, double quotes around a field, "" for a quote inside one, CRLF or LF line ends. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === '') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (quoted) throw new Error('A quoted field is never closed');
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // blank lines carry nothing
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ''));
}

/** Rows as objects keyed by the header. A header that is not exactly the expected columns is an error, not a guess. */
export function readTable(text: string, columns: readonly string[], label: string): { rows: Row[]; problems: string[] } {
  const [header, ...body] = parseCsv(text);
  const problems: string[] = [];
  if (!header) return { rows: [], problems: [`${label}: the file is empty`] };
  const got = header.map((h) => h.trim());
  if (got.join(',') !== columns.join(',')) {
    return { rows: [], problems: [`${label}: the header must be exactly ${columns.join(',')}`] };
  }
  const rows: Row[] = [];
  body.forEach((cells, i) => {
    if (cells.length !== columns.length) {
      problems.push(`${label} line ${i + 2}: ${cells.length} fields, expected ${columns.length}`);
      return;
    }
    rows.push(Object.fromEntries(columns.map((c, j) => [c, cells[j].trim()])));
  });
  return { rows, problems };
}

const DECIMAL = /^-?\d+(\.\d+)?$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const AGE_BAND = /^\d{2}-\d{2}$/;

function isRealDate(text: string): boolean {
  if (!DATE.test(text)) return false;
  const d = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === text;
}

/**
 * What a transcription check can catch: missing fields, numbers that are not plain decimals, a range the wrong way
 * round, a marker entered twice in one panel, and a panel whose sex, age band or date changes between its rows.
 * It cannot catch a misread number, which is why the exercise says to check every value twice by hand.
 */
export function checkPanels(rows: readonly Row[]): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  const perPanel = new Map<string, { sex: string; age_band: string; test_date: string }>();
  rows.forEach((r, i) => {
    const at = `panels line ${i + 2} (${r.panel_id || 'no panel id'}, ${r.marker || 'no marker'})`;
    for (const c of ['panel_id', 'marker', 'value', 'unit', 'sex', 'age_band', 'test_date'] as const) {
      if (r[c] === '') problems.push(`${at}: ${c} is empty`);
    }
    if (r.value !== '' && !DECIMAL.test(r.value)) problems.push(`${at}: value "${r.value}" is not a plain decimal (write "<5" results in context)`);
    for (const c of ['lab_ref_low', 'lab_ref_high'] as const) {
      if (r[c] !== '' && !DECIMAL.test(r[c])) problems.push(`${at}: ${c} "${r[c]}" is not a plain decimal`);
    }
    if (DECIMAL.test(r.lab_ref_low) && DECIMAL.test(r.lab_ref_high) && Number(r.lab_ref_low) > Number(r.lab_ref_high)) {
      problems.push(`${at}: lab_ref_low is above lab_ref_high`);
    }
    if (r.sex !== '' && !['F', 'M', 'X'].includes(r.sex)) problems.push(`${at}: sex must be F, M or X`);
    if (r.age_band !== '' && !AGE_BAND.test(r.age_band)) problems.push(`${at}: age_band must look like 30-39`);
    if (r.test_date !== '' && !isRealDate(r.test_date)) problems.push(`${at}: test_date must be a real date as YYYY-MM-DD`);
    const key = `${r.panel_id}\u0000${r.marker.toLowerCase()}`;
    if (seen.has(key)) problems.push(`${at}: this marker is already in the panel`);
    seen.add(key);
    const first = perPanel.get(r.panel_id);
    if (!first) perPanel.set(r.panel_id, { sex: r.sex, age_band: r.age_band, test_date: r.test_date });
    else {
      for (const c of ['sex', 'age_band', 'test_date'] as const) {
        if (first[c] !== r[c]) problems.push(`${at}: ${c} differs from the panel's first row`);
      }
    }
  });
  return problems;
}

export interface Score {
  panelId: string;
  mark: Mark;
  addsBeyondFlags: boolean;
  factsMatch: boolean;
  inventedNumbers: number;
  narratorUnsafe: boolean;
  unitsOk: boolean;
  costCents: number;
}

function yesNo(value: string): boolean | null {
  const v = value.toLowerCase();
  return v === 'yes' ? true : v === 'no' ? false : null;
}

export function checkScores(rows: readonly Row[], panelIds: ReadonlySet<string>): { scores: Score[]; problems: string[] } {
  const problems: string[] = [];
  const scores: Score[] = [];
  const seen = new Set<string>();
  rows.forEach((r, i) => {
    const at = `scores line ${i + 2} (${r.panel_id || 'no panel id'})`;
    const before = problems.length;
    if (r.panel_id === '') problems.push(`${at}: panel_id is empty`);
    else if (!panelIds.has(r.panel_id)) problems.push(`${at}: no panel with this id in panels.csv`);
    if (seen.has(r.panel_id)) problems.push(`${at}: this panel is scored twice`);
    seen.add(r.panel_id);
    if (!(MARKS as readonly string[]).includes(r.clinician_mark)) problems.push(`${at}: clinician_mark must be one of ${MARKS.join(', ')}`);
    const flags = {
      adds: yesNo(r.adds_beyond_lab_flags),
      facts: yesNo(r.narrator_facts_match),
      unsafe: yesNo(r.narrator_unsafe),
      units: yesNo(r.units_ok),
    };
    for (const [name, value] of [['adds_beyond_lab_flags', flags.adds], ['narrator_facts_match', flags.facts], ['narrator_unsafe', flags.unsafe], ['units_ok', flags.units]] as const) {
      if (value === null) problems.push(`${at}: ${name} must be yes or no`);
    }
    if (!/^\d+$/.test(r.narrator_invented_numbers)) problems.push(`${at}: narrator_invented_numbers must be a whole number`);
    if (!DECIMAL.test(r.narration_cost_cents) || Number(r.narration_cost_cents) < 0) problems.push(`${at}: narration_cost_cents must be a decimal of zero or more`);
    if (r.scored_by === '') problems.push(`${at}: scored_by is empty (who verified this)`);
    if (!isRealDate(r.scored_on)) problems.push(`${at}: scored_on must be a real date as YYYY-MM-DD`);
    if (problems.length > before) return;
    scores.push({
      panelId: r.panel_id,
      mark: r.clinician_mark as Mark,
      addsBeyondFlags: flags.adds as boolean,
      factsMatch: flags.facts as boolean,
      inventedNumbers: Number(r.narrator_invented_numbers),
      narratorUnsafe: flags.unsafe as boolean,
      unitsOk: flags.units as boolean,
      costCents: Number(r.narration_cost_cents),
    });
  });
  return { scores, problems };
}

export type Outcome = 'go' | 'stop' | 'not_yet';

export interface GateResult {
  outcome: Outcome;
  /** each line is one gate condition, with whether it held */
  lines: { ok: boolean; text: string }[];
}

/**
 * The gates from the exercise, word for word as numbers. A stop condition wins over everything. Go needs all ten panels
 * scored and every go condition met. Anything in between is "not yet": either panels are missing, or the result is a
 * miss that is not a stop (for example only 7 useful), which the exercise leaves to a judgement call.
 */
export function gate(scores: readonly Score[], costTarget = COST_TARGET_CENTS): GateResult {
  const useful = scores.filter((s) => s.mark === 'would_say').length;
  const unsafe = scores.filter((s) => s.mark === 'unsafe' || s.narratorUnsafe).map((s) => s.panelId);
  const factsOk = scores.filter((s) => s.factsMatch && s.inventedNumbers === 0).length;
  const invented = scores.reduce((n, s) => n + s.inventedNumbers, 0);
  const overCost = scores.filter((s) => s.costCents >= costTarget).map((s) => s.panelId);
  const addsNothing = scores.filter((s) => !s.addsBeyondFlags).length;
  const unitMisses = scores.filter((s) => !s.unitsOk).map((s) => s.panelId);

  const stops = [
    { ok: unsafe.length === 0, text: `No unsafe statement in any panel${unsafe.length ? ` (unsafe: ${unsafe.join(', ')})` : ''}` },
    { ok: addsNothing < 5, text: `Fewer than 5 panels where the clinician says it adds nothing beyond the lab's flags (${addsNothing})` },
  ];
  const goes = [
    { ok: scores.length >= PANELS_NEEDED, text: `All ${PANELS_NEEDED} panels scored (${scores.length})` },
    { ok: useful >= 8, text: `At least 8 hand interpretations judged useful (${useful})` },
    { ok: factsOk >= 9 && invented === 0, text: `Narrator matches every fact on at least 9 panels with zero invented numbers (${factsOk} panels, ${invented} invented)` },
    { ok: overCost.length === 0, text: `Narration under ${costTarget} cents on every panel${overCost.length ? ` (over: ${overCost.join(', ')})` : ''}` },
    { ok: unitMisses.length === 0, text: `Units correct and mismatches caught on every panel${unitMisses.length ? ` (missed: ${unitMisses.join(', ')})` : ''}` },
  ];
  const outcome: Outcome = stops.some((l) => !l.ok) ? 'stop' : goes.every((l) => l.ok) ? 'go' : 'not_yet';
  return { outcome, lines: [...stops, ...goes] };
}

const OUTCOME_TEXT: Record<Outcome, string> = {
  go: 'GO: the gate is passed. Build the lab feature.',
  stop: 'STOP: shrink to "enter and chart results only", or fix what the rules cannot prevent.',
  not_yet: 'NOT YET: panels are missing, or a go condition is missed without hitting a stop. Decide by hand.',
};

function main(argv: readonly string[]): number {
  const [panelsPath, scoresPath] = argv;
  if (!panelsPath) {
    console.error('Usage: node scripts/lab-panels.ts panels.csv [scores.csv]');
    return 2;
  }
  const panels = readTable(readFileSync(panelsPath, 'utf8'), PANEL_COLUMNS, 'panels');
  const problems = [...panels.problems, ...checkPanels(panels.rows)];
  const ids = new Set(panels.rows.map((r) => r.panel_id).filter((id) => id !== ''));
  console.log(`${panels.rows.length} marker rows across ${ids.size} panels`);
  let scores: Score[] = [];
  if (scoresPath) {
    const table = readTable(readFileSync(scoresPath, 'utf8'), SCORE_COLUMNS, 'scores');
    const checked = checkScores(table.rows, ids);
    problems.push(...table.problems, ...checked.problems);
    scores = checked.scores;
  }
  for (const p of problems) console.log(`  problem: ${p}`);
  if (problems.length > 0) {
    console.log(`${problems.length} problem${problems.length === 1 ? '' : 's'}. Fix them before reading the gate.`);
    return 1;
  }
  if (!scoresPath) {
    console.log('Panels look clean.');
    return 0;
  }
  const result = gate(scores);
  for (const l of result.lines) console.log(`  ${l.ok ? 'ok  ' : 'MISS'} ${l.text}`);
  console.log(OUTCOME_TEXT[result.outcome]);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main(process.argv.slice(2)));
