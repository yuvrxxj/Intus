// How a model's checked rows compare with what the app's own on-device reader finds in the same text. The on-device
// reader is a fixed set of rules, so it is a steady yardstick, not the truth: rows only the model found are counted
// and listed so a person can look at them, and rows the two read differently are listed too.
import type { ParsedRow } from '../reports/parse.ts';

const squash = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
/** The same printed line with the same number is the same result, however each reader named it. */
const keyOf = (r: ParsedRow) => `${squash(r.line)}|${r.value}`;
const unitKey = (u: string | null) => (u ?? '').toLowerCase().replace(/[µμ]/g, 'u').replace(/\s+/g, '');

export interface Score {
  /** results the on-device reader found */
  reference: number;
  /** the model's checked results */
  model: number;
  /** reference results the model also found on the same line with the same number */
  matched: number;
  missed: number;
  /** model results the reader did not find: real results it missed, or repeats of a number printed elsewhere */
  extra: number;
  recall: number;
  precision: number;
  /** among matched results */
  sameMarker: number;
  differentMarker: number;
  sameUnit: number;
  differentUnit: number;
  sameRange: number;
  differentRange: number;
  /** tracked markers the reader found, and how many of them the model gave the same number, on whatever line */
  trackedReference: number;
  trackedMatched: number;
  /** the model gave a tracked marker a number the reader did not find for it */
  trackedConflicts: number;
  /** rows the model returned, rows left after checking them against the text, rows dropped as not on the report */
  returned: number;
  kept: number;
  dropped: number;
}

export interface Detail {
  /** labels only, for looking at by hand: what each side read differently */
  missed: string[];
  extra: string[];
  differentMarker: { label: string; model: string | null; reference: string | null }[];
}

const same = (a: number | null, b: number | null) => a === b;

export function scoreRows(model: readonly ParsedRow[], reference: readonly ParsedRow[], returned: number, dropped: number, nameOf: (id: string) => string): { score: Score; detail: Detail } {
  const byKey = new Map(model.map((r) => [keyOf(r), r]));
  const refKeys = new Set(reference.map(keyOf));
  const detail: Detail = { missed: [], extra: [], differentMarker: [] };
  let matched = 0;
  let sameMarker = 0, differentMarker = 0, sameUnit = 0, differentUnit = 0, sameRange = 0, differentRange = 0;

  for (const r of reference) {
    const m = byKey.get(keyOf(r));
    if (!m) {
      detail.missed.push(r.label);
      continue;
    }
    matched++;
    if (m.biomarkerId === r.biomarkerId) {
      sameMarker++;
    } else {
      differentMarker++;
      detail.differentMarker.push({ label: r.label, model: m.biomarkerId ? nameOf(m.biomarkerId) : null, reference: r.biomarkerId ? nameOf(r.biomarkerId) : null });
    }
    if (unitKey(m.unit) === unitKey(r.unit)) sameUnit++;
    else differentUnit++;
    if (same(m.refLow, r.refLow) && same(m.refHigh, r.refHigh)) sameRange++;
    else differentRange++;
  }
  for (const m of model) if (!refKeys.has(keyOf(m))) detail.extra.push(m.label);

  // tracked markers are compared by marker and number, on any line: a model that reads HbA1c from the summary page
  // and not the full result has still found HbA1c
  const referenceTracked = new Map<string, number[]>();
  for (const r of reference) if (r.biomarkerId && r.value !== null) referenceTracked.set(r.biomarkerId, [...(referenceTracked.get(r.biomarkerId) ?? []), r.value]);
  const modelTracked = new Map<string, number[]>();
  for (const m of model) if (m.biomarkerId && m.value !== null) modelTracked.set(m.biomarkerId, [...(modelTracked.get(m.biomarkerId) ?? []), m.value]);
  let trackedFound = 0;
  for (const [id, values] of referenceTracked) if (values.some((v) => modelTracked.get(id)?.includes(v))) trackedFound++;
  let trackedConflicts = 0;
  for (const m of model) {
    const theirs = m.biomarkerId ? referenceTracked.get(m.biomarkerId) : undefined;
    if (theirs && m.value !== null && !theirs.includes(m.value)) trackedConflicts++;
  }

  const extra = detail.extra.length;
  return {
    score: {
      reference: reference.length,
      model: model.length,
      matched,
      missed: reference.length - matched,
      extra,
      recall: reference.length === 0 ? 0 : matched / reference.length,
      precision: model.length === 0 ? 0 : (model.length - extra) / model.length,
      sameMarker, differentMarker, sameUnit, differentUnit, sameRange, differentRange,
      trackedReference: referenceTracked.size,
      trackedMatched: trackedFound,
      trackedConflicts,
      returned,
      kept: model.length,
      dropped,
    },
    detail,
  };
}
