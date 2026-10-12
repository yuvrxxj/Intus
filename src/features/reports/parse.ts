// Reading a lab report's text into rows the person then checks. Pure: no PDF, no network.
//
// It never decides anything on its own: every row it finds goes to a review table, where the person confirms or fixes
// it before anything is saved. So it errs towards showing a row with a question over guessing quietly:
//   - the value and the printed range are read as written; nothing is converted between units
//   - a unit that differs from the one Intus stores for that marker is shown as a mismatch, and the row is left out
//     until the person deals with it
//   - a date that could be day-first or month-first is marked as unsure
import { ALIASES, LINE_RULES, NOT_A_RESULT, NOT_THE_MARKER } from './aliases.ts';

export interface MarkerRef {
  id: string;
  code: string;
  name: string;
  unit: string;
}

export interface ParsedRow {
  /** the line as it was read, so the person can compare */
  line: string;
  biomarkerId: string | null;
  /** the text that matched a marker, or the start of the line when nothing did */
  label: string;
  value: number | null;
  /** as printed, or null when the line had none */
  unit: string | null;
  refLow: number | null;
  refHigh: number | null;
  /** the printed unit is not one Intus treats as the same as the marker's stored unit */
  unitMismatch: boolean;
}

export interface ParsedReport {
  /** 'YYYY-MM-DD' when a sample or report date was found */
  date: string | null;
  /** the date could be read day-first or month-first, so the person must confirm it */
  dateUnsure: boolean;
  rows: ParsedRow[];
}

const NUMBER = String.raw`\d+(?:[.,]\d+)?`;
const RANGE_PATTERNS: readonly { re: RegExp; read: (m: RegExpMatchArray) => [number | null, number | null] }[] = [
  { re: new RegExp(String.raw`(${NUMBER})\s*(?:-|–|—|to)\s*(${NUMBER})`, 'i'), read: (m) => [num(m[1]), num(m[2])] },
  { re: new RegExp(String.raw`(?:<=?|≤|upto|up to|less than|below)\s*(${NUMBER})`, 'i'), read: (m) => [null, num(m[1])] },
  { re: new RegExp(String.raw`(?:>=?|≥|more than|above|greater than)\s*(${NUMBER})`, 'i'), read: (m) => [num(m[1]), null] },
];

/** A decimal as printed, with a point or a comma. Thousands separators are not guessed at. */
function num(text: string): number | null {
  if (!/^\d+([.,]\d+)?$/.test(text)) return null;
  const n = Number(text.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

const UNIT_TEXT = String.raw`(?:10\^?\d|x\s?10\^?\d|10³|x10³|10\*3)?\s*\/?\s*[a-zA-Zµμ%][a-zA-Zµμ%\/\.²³0-9]*`;
const KNOWN_UNIT = /^(%|mg\/dl|g\/dl|gm\/dl|g\/l|mg\/l|mmol\/l|µmol\/l|umol\/l|nmol\/l|pmol\/l|u\/l|iu\/l|miu\/l|µiu\/ml|uiu\/ml|miu\/ml|ng\/ml|pg\/ml|ng\/dl|µg\/dl|ug\/dl|mcg\/dl|µg\/l|ug\/l|ml\/min(\/1\.73m²|\/1\.73m2)?|fl|pg|(x\s?)?10\^?3\/(µl|ul|mm3|mm³)|10³\/(µl|ul)|thou\/(µl|ul|mm3)|lakhs?\/(cumm|µl|ul)|\/(cumm|µl|ul|mm3))$/i;

/** Lowercase, µ and μ as u, no spaces, so "mIU/L" and "µIU/mL" can be compared. */
function unitKey(unit: string): string {
  return unit.toLowerCase().replace(/[µμ]/g, 'u').replace(/mcg/g, 'ug').replace(/\s+/g, '').replace(/³/g, '3').replace(/\^/g, '').replace(/^x/, '');
}

/** Units that are the same quantity under another name. Nothing here is a conversion. */
const SAME_UNIT: readonly (readonly string[])[] = [
  ['miu/l', 'uiu/ml'],
  ['ug/dl', 'mcg/dl'],
  ['u/l', 'iu/l'],
  ['103/ul', '103/mm3', 'thou/ul', 'thou/mm3', 'k/ul'],
  ['ml/min', 'ml/min/1.73m2'],
  ['g/dl', 'gm/dl'],
];

export function sameUnit(printed: string, stored: string): boolean {
  const a = unitKey(printed);
  const b = unitKey(stored);
  if (a === b) return true;
  return SAME_UNIT.some((group) => group.includes(a) && group.includes(b));
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface Matcher {
  ref: MarkerRef;
  re: RegExp;
  length: number;
}

/** One regex per name a marker goes by, matched on whole words. */
export function matchersFor(markers: readonly MarkerRef[]): Matcher[] {
  const out: Matcher[] = [];
  for (const ref of markers) {
    const names = new Set([ref.name.toLowerCase(), ref.code.replace(/_/g, ' ').toLowerCase(), ...(ALIASES[ref.code] ?? [])]);
    for (const name of names) {
      if (name.trim() === '') continue;
      out.push({ ref, re: new RegExp(String.raw`(?:^|[^a-z0-9])(${escape(name)})(?=$|[^a-z0-9])`, 'i'), length: name.length });
    }
  }
  return out;
}

/** The longest name that appears on the line, if any, and where it ends. */
function findMarker(line: string, matchers: readonly Matcher[]): { ref: MarkerRef; end: number; label: string } | null {
  let best: { ref: MarkerRef; end: number; label: string; length: number; start: number } | null = null;
  for (const m of matchers) {
    const hit = m.re.exec(line);
    if (!hit) continue;
    const rule = LINE_RULES[m.ref.code];
    if (rule && ((rule.not && rule.not.test(line)) || (rule.only && !rule.only.test(line)))) continue;
    const start = hit.index + hit[0].length - hit[1].length;
    // prefer the longest name; on a tie, the one nearest the start of the line
    if (!best || m.length > best.length || (m.length === best.length && start < best.start)) {
      best = { ref: m.ref, end: start + hit[1].length, label: hit[1], length: m.length, start };
    }
  }
  return best;
}

/** The number at `at` is one end of a range ("100 - 125"), so it is a limit, not a result. */
function partOfRange(text: string, at: number, length: number): boolean {
  return /^\s*(?:-|–|—|to)\s*\d/i.test(text.slice(at + length)) || /(?:-|–|—|\bto)\s*$/i.test(text.slice(0, at));
}

/** Value, unit and printed range from the text after a marker's name. */
export function readValues(rest: string): { value: number | null; unit: string | null; refLow: number | null; refHigh: number | null } {
  let text = ` ${rest} `;
  let refLow: number | null = null;
  let refHigh: number | null = null;
  // the range is found first and taken out, so its numbers are never read as the value
  for (const { re, read } of RANGE_PATTERNS) {
    const all = [...text.matchAll(new RegExp(re.source, 'gi'))];
    // the printed range is usually the last range-like thing on the line, after the value
    const m = all.at(-1);
    if (!m || m.index === undefined) continue;
    // a range needs something before it, or it is the value itself written as "<5"
    const before = text.slice(0, m.index);
    if (!/\d/.test(before)) continue;
    [refLow, refHigh] = read(m);
    text = text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length);
    break;
  }
  // an aside in brackets ("(25 - OH VITAMIN D)") is part of the name, so its numbers are never the value
  text = text.replace(/\([^()]*[A-Za-z][^()]*\)/g, ' ');
  let valueMatch: RegExpExecArray | null = null;
  const valueRe = new RegExp(String.raw`(?:^|[\s:=(])(${NUMBER})(?=[\s)A-Za-zµμ%*/]|$)`, 'g');
  for (let m = valueRe.exec(text); m; m = valueRe.exec(text)) {
    const at = m.index + m[0].length - m[1].length;
    if (!partOfRange(text, at, m[1].length)) {
      valueMatch = m;
      break;
    }
    valueRe.lastIndex = at + m[1].length;
  }
  const value = valueMatch ? num(valueMatch[1]) : null;
  let unit: string | null = null;
  if (valueMatch && valueMatch.index !== undefined) {
    const after = text.slice(valueMatch.index + valueMatch[0].length);
    for (const candidate of after.match(new RegExp(UNIT_TEXT, 'g')) ?? []) {
      const trimmed = candidate.trim().replace(/[.,;:]+$/, '');
      if (KNOWN_UNIT.test(trimmed)) {
        unit = trimmed;
        break;
      }
    }
  }
  return { value, unit, refLow, refHigh };
}

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

function iso(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString().slice(0, 10);
}

/** A date written on a line, and whether its day and month could be swapped. */
export function readDate(line: string): { date: string; unsure: boolean } | null {
  let m = /\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/.exec(line);
  if (m) {
    const d = iso(Number(m[1]), Number(m[2]), Number(m[3]));
    if (d) return { date: d, unsure: false };
  }
  m = /\b(\d{1,2})[\s-/.]([a-z]{3,9})[\s-/.,]+(\d{2,4})\b/i.exec(line);
  const named = m ? MONTHS[m[2].slice(0, 3).toLowerCase()] : undefined;
  if (m && named) {
    const d = iso(Number(m[3]), named, Number(m[1]));
    if (d) return { date: d, unsure: false };
  }
  m = /\b([a-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})\b/i.exec(line);
  if (m && MONTHS[m[1].slice(0, 3).toLowerCase()]) {
    const d = iso(Number(m[3]), MONTHS[m[1].slice(0, 3).toLowerCase()], Number(m[2]));
    if (d) return { date: d, unsure: false };
  }
  m = /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/.exec(line);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const y = Number(m[3]);
    if (a > 12) {
      const d = iso(y, b, a);
      return d ? { date: d, unsure: false } : null;
    }
    if (b > 12) {
      const d = iso(y, a, b);
      return d ? { date: d, unsure: false } : null;
    }
    // both could be a month: read day first (most of the world) and say it is unsure
    const d = iso(y, b, a);
    return d ? { date: d, unsure: a !== b } : null;
  }
  return null;
}

const SAMPLE_WORDS = /\b(collect|collected|collection|sample|sampled|drawn|specimen)\b/i;
const OTHER_DATE_WORDS = /\b(registered|received|reported|report date|date)\b/i;
const NOT_A_TEST_DATE = /\b(birth|dob|d\.o\.b|printed)\b/i;

/** The sample date if the report gives one, otherwise the report date; never a date of birth. */
export function findDate(lines: readonly string[]): { date: string | null; unsure: boolean } {
  let fallback: { date: string; unsure: boolean } | null = null;
  for (const line of lines) {
    if (NOT_A_TEST_DATE.test(line)) continue;
    const found = readDate(line);
    if (!found) continue;
    if (SAMPLE_WORDS.test(line)) return found;
    if (!fallback && OTHER_DATE_WORDS.test(line)) fallback = found;
  }
  return fallback ?? { date: null, unsure: false };
}

/** A range as printed, either side of a dash or one bound: "70 - 100", "< 200". */
const ANY_RANGE = new RegExp(String.raw`${NUMBER}\s*(?:-|–|—|to)\s*${NUMBER}|(?:<=?|≤|>=?|≥)\s*${NUMBER}`, 'gi');

/** A line that looks like a result for a marker Intus does not know: words, then a number, then a printed range. */
const LOOKS_LIKE_RESULT = new RegExp(String.raw`^[A-Za-z][A-Za-z0-9 ,()\-/.%+]{2,60}?\s+(${NUMBER})\s+.*?(?:${NUMBER}\s*(?:-|–|—|to)\s*${NUMBER}|(?:<=?|≤|>=?|≥)\s*${NUMBER})`);

const words = (text: string) => text.replace(/\([^()]*\)/g, ' ').match(/[A-Za-z]{3,}/g)?.length ?? 0;

/**
 * Whether a line that names a marker reads like a table row rather than a sentence: the name starts the line (a
 * number or two before it is fine), and not much text sits between it and the number. Reports carry paragraphs
 * about each test, and "Vitamin B12 is a coenzyme that is involved in 2 reactions" is not a result.
 */
function looksLikeRow(line: string, nameStart: number, nameEnd: number): boolean {
  if (words(line.slice(0, nameStart)) > 2) return false;
  const rest = line.slice(nameEnd).replace(/\([^()]*[A-Za-z][^()]*\)/g, ' ');
  const firstDigit = rest.search(/\d/);
  return firstDigit === -1 || words(rest.slice(0, firstDigit)) <= 3;
}

/** Same value and unit means the same reading, however many times the report prints it. */
const sameReading = (a: ParsedRow, b: ParsedRow) => a.value === b.value && (a.unit ?? '').toLowerCase() === (b.unit ?? '').toLowerCase();
const strength = (r: ParsedRow) => (r.unit !== null ? 1 : 0) + (r.refLow !== null || r.refHigh !== null ? 2 : 0) + (r.unitMismatch ? -4 : 0);

/**
 * A report names a result in several places: a summary page, a comparison table, then the full result. Keep the one
 * that carries a unit and a printed range, and drop the bare copies and the unit mismatches that sit beside a good
 * one. When no copy is good, everything stays for the person to look at.
 */
export function tidyRows(rows: readonly ParsedRow[]): ParsedRow[] {
  const keep = new Set<ParsedRow>();
  const groups = new Map<string, ParsedRow[]>();
  for (const r of rows) {
    const key = r.biomarkerId ?? `?${r.label.toLowerCase()}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  for (const group of groups.values()) {
    const good = group.filter((r) => !r.unitMismatch && (r.unit !== null || r.refLow !== null || r.refHigh !== null));
    for (const r of good.length > 0 ? good : group) {
      const twin = [...keep].find((k) => group.includes(k) && sameReading(k, r));
      if (!twin) keep.add(r);
      else if (strength(r) > strength(twin)) {
        keep.delete(twin);
        keep.add(r);
      }
    }
  }
  return rows.filter((r) => keep.has(r));
}

export function parseReport(lines: readonly string[], markers: readonly MarkerRef[]): ParsedReport {
  const matchers = matchersFor(markers);
  const rows: ParsedRow[] = [];
  for (const raw of lines) {
    const line = raw.replace(/\s+/g, ' ').trim();
    if (line.length < 3 || line.length > 300) continue;
    if (NOT_A_RESULT.test(line)) continue;
    let marker = NOT_THE_MARKER.test(line) ? null : findMarker(line, matchers);
    // a sentence that happens to name a marker is not that marker's result
    if (marker && !looksLikeRow(line, marker.end - marker.label.length, marker.end)) marker = null;
    if (marker) {
      const read = readValues(line.slice(marker.end));
      // a heading or a note that names a marker but carries no number is not a result
      if (read.value === null) continue;
      rows.push({
        line,
        biomarkerId: marker.ref.id,
        label: marker.label,
        ...read,
        unitMismatch: read.unit !== null && !sameUnit(read.unit, marker.ref.unit),
      });
      continue;
    }
    if (LOOKS_LIKE_RESULT.test(line)) {
      // the value is the last number before the printed range, so a number in the test's name ("Interleukin 6") stays in the name
      const range = [...line.matchAll(ANY_RANGE)].at(-1);
      const head = range?.index !== undefined ? line.slice(0, range.index) : line;
      const numbers = [...head.matchAll(new RegExp(String.raw`(?:^|\s)(${NUMBER})(?=\s|$)`, 'g'))].filter(
        (n) => n.index !== undefined && !partOfRange(head, n.index + n[0].length - n[1].length, n[1].length),
      );
      const last = numbers.at(-1);
      if (last?.index === undefined) continue;
      const label = line.slice(0, last.index).trim();
      if (words(label) > 6) continue;
      const read = readValues(line.slice(last.index));
      if (label !== '' && read.value !== null) rows.push({ line, biomarkerId: null, label, ...read, unitMismatch: false });
    }
  }
  const { date, unsure } = findDate(lines);
  return { date, dateUnsure: unsure, rows: tidyRows(rows) };
}
