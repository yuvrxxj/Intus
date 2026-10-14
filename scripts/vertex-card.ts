#!/usr/bin/env node
// The report card of the Vertex runs: for each setting tried, what it cost, how long it took, how much of the report it
// found, and how well the Bloodwork screen it would fill matches the one the app's own reader fills from the same report.
//
//   node scripts/vertex-card.ts report.txt [--runs test-lab/local] [--json]
//
// The report text is only used to run the app's own reader for the baseline. What is printed is measurements and marker
// codes: no values and no report text. Runs of the same setting are grouped and shown as a range.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compareScreens } from '../src/features/ailab/card.ts';
import { previewRows } from '../src/features/ailab/preview.ts';
import type { RunFile } from '../src/features/ailab/types.ts';
import { parseReport, type MarkerRef } from '../src/features/reports/parse.ts';
import type { MarkerInfo } from '../supabase/functions/read-report/prompt.ts';

const args = process.argv.slice(2);
const flag = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : (args[i + 1] ?? fallback);
};
const file = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
if (!file) {
  console.error('usage: node scripts/vertex-card.ts report.txt [--runs test-lab/local] [--json]');
  process.exit(2);
}
const dir = flag('runs', 'test-lab/local');
const markers = JSON.parse(readFileSync(new URL('./ai-eval-markers.json', import.meta.url), 'utf8')) as MarkerInfo[];
const refs: MarkerRef[] = markers.map((m) => ({ id: m.code, ...m }));
const device = parseReport(readFileSync(file, 'utf8').trim().split('\n'), refs);
const today = new Date().toISOString().slice(0, 10);
const reference = previewRows(device.rows, device.date, today);

interface Line {
  setting: string;
  group: string;
  complete: boolean;
  failure: string | null;
  seconds: number;
  tokensIn: number;
  tokensOut: number;
  thinking: number;
  cost: number;
  found: number;
  reference: number;
  invented: number;
  identical: number;
  trackedTotal: number;
  concernsFlagged: number;
  concerns: number;
  missing: number;
  wrongNumber: number;
  falseAlarms: number;
}

const runs = readdirSync(dir)
  .filter((f) => f.endsWith('.run.json') && f.includes('vertex'))
  .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as RunFile)
  .sort((a, b) => a.at.localeCompare(b.at));

const lines: Line[] = runs.map((run) => {
  const t = run.totals;
  const s = run.score;
  const screen = compareScreens(reference, previewRows(run.rows, run.date, today));
  const c = run.config;
  const thinking = c.effort === 'none' ? 'thinking off' : 'thinking default';
  const cap = run.maxTokens === 16384 ? '' : `, ${run.maxTokens.toLocaleString('en-GB')} token cap`;
  return {
    setting: `${c.model}`,
    group: `${thinking}${c.requireAll ? ', all fields required' : ''}${cap}`,
    complete: run.complete,
    failure: run.calls[0]?.failure ?? null,
    seconds: t.requestS,
    tokensIn: t.promptTokens,
    tokensOut: t.completionTokens,
    thinking: t.reasoningTokens,
    cost: t.costUsd ?? 0,
    found: s?.matched ?? 0,
    reference: s?.reference ?? 0,
    invented: s?.dropped ?? 0,
    identical: screen.sameFlag,
    trackedTotal: screen.reference,
    concernsFlagged: screen.concernsFlagged,
    concerns: screen.concerns,
    missing: screen.missing.length,
    wrongNumber: screen.differentValue.length,
    falseAlarms: screen.falseAlarms.length,
  };
});

if (args.includes('--json')) {
  for (const l of lines) console.log(JSON.stringify(l));
  process.exit(0);
}

const range = (xs: number[], f: (n: number) => string = String) => {
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  return lo === hi ? f(lo) : `${f(lo)} to ${f(hi)}`;
};
const usd = (n: number) => `$${n.toFixed(n < 0.1 ? 4 : 3)}`;
const sec = (n: number) => `${n < 10 ? n.toFixed(1) : Math.round(n)} s`;
const num = (n: number) => Math.round(n).toLocaleString('en-GB');

console.log(`Baseline: the app's own reader fills ${reference.view.groups.reduce((n, g) => n + g.rows.length, 0)} tracked markers on the Bloodwork screen from this report, ${lines[0]?.concerns ?? 0} of them out of range, and finds ${lines[0]?.reference ?? 0} results in all.\n`);
const groups = [...new Set(lines.map((l) => l.group))];
for (const group of groups) {
  console.log(`\n### ${group}\n`);
  console.log('| Model | Runs | Finished | Time per read | Tokens in / out | Thinking tokens | Cost per read | Found of 69 | Invented rows | Bloodwork markers identical | Exact screens | Concerns flagged | False alarms |');
  console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const model of [...new Set(lines.filter((l) => l.group === group).map((l) => l.setting))]) {
    const rs = lines.filter((l) => l.group === group && l.setting === model);
    const done = rs.filter((r) => r.complete);
    const failed = rs.length - done.length;
    const finished = failed === 0 ? `${done.length} of ${rs.length}` : `${done.length} of ${rs.length} (${[...new Set(rs.filter((r) => !r.complete).map((r) => r.failure))].join(', ')})`;
    const of = (f: (l: Line) => number) => (done.length ? done.map(f) : rs.map(f));
    console.log(`| ${model} | ${rs.length} | ${finished} | ${range(rs.map((r) => r.seconds), sec)} | ${num(Math.max(...rs.map((r) => r.tokensIn)))} / ${range(rs.map((r) => r.tokensOut), num)} | ${range(rs.map((r) => r.thinking), num)} | ${range(rs.map((r) => r.cost), usd)} | ${done.length ? range(of((r) => r.found)) : 'none'} | ${done.length ? range(of((r) => r.invented)) : 'n/a'} | ${done.length ? range(of((r) => r.identical)) + ` of ${rs[0].trackedTotal}` : '0'} | ${done.filter((r) => r.identical === r.trackedTotal && r.concernsFlagged === r.concerns).length} of ${rs.length} | ${done.length ? range(of((r) => r.concernsFlagged)) + ` of ${rs[0].concerns}` : '0'} | ${done.length ? range(of((r) => r.falseAlarms)) : 'n/a'} |`);
  }
}
const total = lines.reduce((n, l) => n + l.cost, 0);
console.log(`\nAll ${lines.length} runs in test-lab/local: ${usd(total)} at list price, from the tokens Google counted.`);
