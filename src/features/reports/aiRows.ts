// Turning what the AI returned into rows for the review table, without trusting it. Pure: no network.
//
// The AI is a reader, not a source of numbers. A row is kept only if its value is printed, as a whole number, on a line
// of the text that was sent. Units and printed ranges are kept only if they are printed on that line too, and a marker
// match is dropped if the line is one of the look-alikes the on-device reader also refuses. Whatever survives goes to
// the same review table as before, where the person checks every row, so a wrong guess costs a click and never a wrong
// number in their record.
import { LINE_RULES, NOT_A_RESULT, NOT_THE_MARKER } from './aliases.ts';
import { sameUnit, tidyRows, type MarkerRef, type ParsedRow } from './parse.ts';

/** One result as the Edge Function returns it, fields as strings exactly as the model wrote them. */
export interface AiRow {
  name: string;
  marker: string | null;
  value_text: string;
  unit: string | null;
  ref_low: string | null;
  ref_high: string | null;
  line: string;
}

const squash = (s: string) => s.replace(/\s+/g, ' ').trim();

/** A plain decimal, with a point or a comma, nothing else. */
function number(text: string | null): number | null {
  if (text === null) return null;
  const t = text.trim();
  if (!/^\d+(?:[.,]\d+)?$/.test(t)) return null;
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/**
 * The number is printed on the line as a number of its own, not the end or middle of a longer one. It is compared as a
 * number, so "4.6" matches a printed "4.60", but never "6.0" inside "116.0" or "16" inside "1.16".
 */
function printed(line: string, text: string): boolean {
  const wanted = number(text);
  if (wanted === null) return false;
  for (const m of line.matchAll(/(?<![\d.,])\d+(?:[.,]\d+)?(?!\d|[.,]\d)/g)) {
    if (number(m[0]) === wanted) return true;
  }
  return false;
}

const compact = (s: string) => s.toLowerCase().replace(/\s+/g, '');

export interface Verified {
  rows: ParsedRow[];
  /** rows the AI returned that were left out because they could not be checked against the report */
  dropped: number;
}

export function verifyAiRows(sent: readonly string[], raw: readonly AiRow[], markers: readonly MarkerRef[]): Verified {
  const lines = sent.map(squash);
  const lower = lines.map((l) => l.toLowerCase());
  const rows: ParsedRow[] = [];
  let dropped = 0;

  for (const r of raw) {
    const value = number(r.value_text);
    const claimed = squash(r.line).toLowerCase();
    const head = squash(r.name).toLowerCase().slice(0, 10);
    // the line the model says it came from; failing that, a line that holds both the number and the start of the name
    let at = claimed === '' ? -1 : lower.findIndex((l) => l.includes(claimed));
    if (at === -1 && head.length >= 4) at = lines.findIndex((l, i) => lower[i].includes(head) && printed(l, r.value_text));
    if (value === null || at === -1 || !printed(lines[at], r.value_text) || NOT_A_RESULT.test(lines[at])) {
      dropped++;
      continue;
    }
    const line = lines[at];

    let refLow = number(r.ref_low);
    let refHigh = number(r.ref_high);
    if (refLow !== null && !printed(line, r.ref_low ?? '')) refLow = null;
    if (refHigh !== null && !printed(line, r.ref_high ?? '')) refHigh = null;
    if (refLow !== null && refHigh !== null && refLow > refHigh) [refLow, refHigh] = [null, null];

    const unit = r.unit && compact(line).includes(compact(r.unit)) ? r.unit.trim() : null;

    let marker = markers.find((m) => m.code === r.marker) ?? null;
    if (marker) {
      const rule = LINE_RULES[marker.code];
      const text = `${r.name} ${line}`;
      if (NOT_THE_MARKER.test(text) || (rule?.not && rule.not.test(text)) || (rule?.only && !rule.only.test(text))) marker = null;
    }
    rows.push({
      line,
      biomarkerId: marker?.id ?? null,
      label: squash(r.name),
      value,
      unit,
      refLow,
      refHigh,
      unitMismatch: marker !== null && unit !== null && !sameUnit(unit, marker.unit),
    });
  }
  return { rows: tidyRows(rows), dropped };
}

/**
 * The AI's checked rows first, then whatever the on-device reader found that the AI did not: the same line with the
 * same number is the same result, however each reader named it. Two readers that disagree about a marker both stay, so
 * the review table shows the second as a duplicate and the person chooses.
 */
export function mergeReadings(ai: readonly ParsedRow[], device: readonly ParsedRow[]): ParsedRow[] {
  const key = (r: ParsedRow) => `${squash(r.line).toLowerCase()}|${r.value}`;
  const have = new Set(ai.map(key));
  return tidyRows([...ai, ...device.filter((r) => !have.has(key(r)))]);
}
