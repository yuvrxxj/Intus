import { dayNumber } from './dates.ts';
import { toNumber, toNumberOrNull, type NumericInput } from './numbers.ts';

export const CRITICAL = Object.freeze({
  LOW: 'critical_low',
  HIGH: 'critical_high',
  OK: 'ok',
  NO_THRESHOLD: 'no_threshold',
});

export type CriticalStatus = (typeof CRITICAL)[keyof typeof CRITICAL];

/** The slice of a biomarkers row that the safety checks read. */
export interface BiomarkerLimits {
  id?: string;
  code?: string;
  name?: string;
  unit?: string;
  critical_low: NumericInput;
  critical_high: NumericInput;
}

export interface CriticalResult {
  status: CriticalStatus;
  value: number;
  critical_low: number | null;
  critical_high: number | null;
  checkedLow: boolean;
  checkedHigh: boolean;
}

export interface ReadingLike {
  id?: string;
  biomarker_id: string;
  measured_at: string;
  value: NumericInput;
}

export interface CriticalFinding extends CriticalResult {
  biomarker_id: string;
  code: string | undefined;
  name: string | undefined;
  unit: string | undefined;
  measured_at: string;
}

/**
 * biomarker: a biomarkers row (critical_low / critical_high may be null or numeric strings).
 * A threshold counts as crossed when the value reaches it, so a value exactly on the line is critical.
 * With no threshold at all the answer is no_threshold, never ok: absence of a limit is not reassurance.
 * checkedLow / checkedHigh say which sides actually had a limit, so a UI can avoid implying more.
 */
export function checkCritical(biomarker: BiomarkerLimits, value: unknown): CriticalResult {
  const label = biomarker?.code ?? 'biomarker';
  const reading = toNumber(value, `${label} value`);
  const low = toNumberOrNull(biomarker.critical_low, `${label} critical_low`);
  const high = toNumberOrNull(biomarker.critical_high, `${label} critical_high`);
  if (low !== null && high !== null && low >= high) {
    throw new RangeError(`${label}: critical_low (${low}) must be below critical_high (${high})`);
  }
  const checkedLow = low !== null;
  const checkedHigh = high !== null;
  let status: CriticalStatus = CRITICAL.OK;
  if (!checkedLow && !checkedHigh) status = CRITICAL.NO_THRESHOLD;
  else if (low !== null && reading <= low) status = CRITICAL.LOW;
  else if (high !== null && reading >= high) status = CRITICAL.HIGH;
  return { status, value: reading, critical_low: low, critical_high: high, checkedLow, checkedHigh };
}

/**
 * Every critical reading across the history, newest first.
 * An orphaned reading throws rather than being skipped, because a skipped reading could be the dangerous one.
 */
export function criticalFindings(
  biomarkers: readonly (BiomarkerLimits & { id: string })[],
  readings: readonly ReadingLike[],
): CriticalFinding[] {
  const byId = new Map(biomarkers.map((b) => [b.id, b]));
  const findings: CriticalFinding[] = [];
  for (const reading of readings) {
    const biomarker = byId.get(reading.biomarker_id);
    if (!biomarker) throw new TypeError(`reading ${reading.id ?? '?'} points at unknown biomarker ${reading.biomarker_id}`);
    const result = checkCritical(biomarker, reading.value);
    if (result.status === CRITICAL.LOW || result.status === CRITICAL.HIGH) {
      findings.push({
        biomarker_id: biomarker.id,
        code: biomarker.code,
        name: biomarker.name,
        unit: biomarker.unit,
        measured_at: reading.measured_at,
        ...result,
      });
    }
  }
  return findings.sort((a, b) => dayNumber(b.measured_at) - dayNumber(a.measured_at));
}

/** Biomarkers that can never raise a critical flag, so the UI can say they are not being watched. */
export function markersWithoutThreshold(biomarkers: readonly BiomarkerLimits[]): (string | undefined)[] {
  return biomarkers.filter((b) => b.critical_low == null && b.critical_high == null).map((b) => b.code);
}
