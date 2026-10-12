// Reading Apple Health's own export (Health app, profile, Export All Health Data) in the browser: the fallback for
// anyone without the Intus iPhone app (INT-86). Pure: text in, rows out; the zip and the network are elsewhere.
//
// export.xml can be hundreds of megabytes, so it is scanned a chunk at a time and only three record types are kept:
// sleep analysis, heart rate variability and resting heart rate, from a chosen number of days back. They are turned
// into rows by the same mapping the iPhone app uses (mobile/src/sync/mapping.ts), so both routes store the same shape.
import { cardioRows, sleepRows, SLEEP_VALUE, type CardioRow, type QuantitySampleIn, type SleepRow, type SleepSampleIn } from '../../../mobile/src/sync/mapping.ts';

const SLEEP = 'HKCategoryTypeIdentifierSleepAnalysis';
const HRV = 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN';
const RESTING = 'HKQuantityTypeIdentifierRestingHeartRate';

const SLEEP_NAMES: Record<string, number> = {
  HKCategoryValueSleepAnalysisInBed: SLEEP_VALUE.inBed,
  HKCategoryValueSleepAnalysisAsleep: SLEEP_VALUE.asleepUnspecified,
  HKCategoryValueSleepAnalysisAsleepUnspecified: SLEEP_VALUE.asleepUnspecified,
  HKCategoryValueSleepAnalysisAwake: SLEEP_VALUE.awake,
  HKCategoryValueSleepAnalysisAsleepCore: SLEEP_VALUE.asleepCore,
  HKCategoryValueSleepAnalysisAsleepDeep: SLEEP_VALUE.asleepDeep,
  HKCategoryValueSleepAnalysisAsleepREM: SLEEP_VALUE.asleepREM,
};

/** "2026-10-01 23:12:00 +0530" as an instant and its offset in minutes east of UTC. */
export function parseExportDate(text: string): { at: Date; offsetMin: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}) ([+-])(\d{2})(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const offsetMin = (m[7] === '-' ? -1 : 1) * (Number(m[8]) * 60 + Number(m[9]));
  const utc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6])) - offsetMin * 60_000;
  const at = new Date(utc);
  return Number.isNaN(at.getTime()) ? null : { at, offsetMin };
}

function attr(line: string, name: string): string | null {
  const m = new RegExp(`\\s${name}="([^"]*)"`).exec(line);
  if (!m) return null;
  return m[1].replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

export interface ScanResult {
  sleep: SleepSampleIn[];
  hrv: QuantitySampleIn[];
  resting: QuantitySampleIn[];
  /** each instant's offset as the export recorded it, so local days follow where the person was, not this device */
  offsets: Map<number, number>;
  /** records read of each kind, including ones too old to keep */
  seen: number;
}

/** Feeds export.xml text in chunks of any size; keeps the three record types from `since` onwards. */
export class ExportScanner {
  private rest = '';
  private readonly since: Date;
  readonly result: ScanResult = { sleep: [], hrv: [], resting: [], offsets: new Map(), seen: 0 };

  constructor(since: Date) {
    this.since = since;
  }

  feed(chunk: string): void {
    const text = this.rest + chunk;
    const lines = text.split('\n');
    this.rest = lines.pop() ?? '';
    for (const line of lines) this.line(line);
  }

  end(): ScanResult {
    if (this.rest) this.line(this.rest);
    this.rest = '';
    return this.result;
  }

  private line(line: string): void {
    if (!line.includes('<Record ')) return;
    const type = attr(line, 'type');
    if (type !== SLEEP && type !== HRV && type !== RESTING) return;
    this.result.seen++;
    const start = parseExportDate(attr(line, 'startDate') ?? '');
    const end = parseExportDate(attr(line, 'endDate') ?? '');
    if (!start || !end || end.at < this.since) return;
    const sourceName = attr(line, 'sourceName') ?? 'Apple Health';
    const raw = attr(line, 'value') ?? '';
    this.result.offsets.set(start.at.getTime(), start.offsetMin);
    this.result.offsets.set(end.at.getTime(), end.offsetMin);
    // the export has no record ids, so a record is known by its source and times
    const uuid = `${sourceName}|${start.at.toISOString()}|${end.at.toISOString()}`;
    if (type === SLEEP) {
      const value = SLEEP_NAMES[raw];
      if (value === undefined) return;
      this.result.sleep.push({ uuid, start: start.at, end: end.at, value, sourceName });
      return;
    }
    const value = Number(raw);
    if (!Number.isFinite(value)) return;
    (type === HRV ? this.result.hrv : this.result.resting).push({ uuid, start: start.at, end: end.at, value, sourceName });
  }
}

export interface ImportRows {
  sleep: SleepRow[];
  cardio: CardioRow[];
  skippedNights: number;
}

/**
 * Rows to store. Sleep is kept as from 'apple_health_export', apart from the phone app's own 'healthkit' rows (the web
 * app picks one source per night when it reads). Heart readings use the 'healthkit' source, because they are the same
 * readings the phone app would sync, and one row per day and source then keeps them from being stored twice.
 */
export function toRows(scan: ScanResult, recordedAt: Date, tzId: string | null): ImportRows {
  const offsetAt = (d: Date) => scan.offsets.get(d.getTime()) ?? -d.getTimezoneOffset();
  const nights = sleepRows(scan.sleep, { offsetAt, tzId, recordedAt });
  return {
    sleep: nights.rows.map((r) => ({ ...r, source_kind: 'apple_health_export' as const })),
    cardio: cardioRows(scan.hrv, scan.resting, offsetAt),
    skippedNights: nights.skipped,
  };
}
