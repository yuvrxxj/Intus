// The sleep session as the app holds it, and the rules for what a person may enter by hand. No browser, no network.
import { instantFor, MINUTE_MS } from './time.ts';

export type Stage = 'asleep' | 'light' | 'deep' | 'rem' | 'awake';
export const STAGES: readonly Stage[] = ['asleep', 'light', 'deep', 'rem', 'awake'];

/** One stretch of one stage, in epoch milliseconds. */
export interface StageSegment {
  s: number;
  e: number;
  t: Stage;
}

export type SourceKind = 'manual' | 'apple_health_export' | 'healthkit' | 'health_connect' | 'other';
export const SOURCE_KINDS: readonly SourceKind[] = ['manual', 'apple_health_export', 'healthkit', 'health_connect', 'other'];

/** What one source said about one stretch of sleep. Several sources can describe the same night. */
export interface SleepSession {
  id: string;
  sourceKind: SourceKind;
  /** the device or app: "Apple Watch", "Oura" */
  sourceName: string | null;
  /** the source's own id for the record, so importing again updates instead of duplicating */
  externalId: string | null;
  /** epoch ms; for a diary entry this is when they got into bed */
  start: number;
  /** epoch ms; when they got up */
  end: number;
  /** minutes east of UTC at start and at end, so local clock times can be rebuilt */
  startOffsetMin: number;
  endOffsetMin: number;
  tzId: string | null;
  /** minutes to fall asleep, as the person estimated it (or the source reported it) */
  latencyMin: number | null;
  /** minutes awake in the night, as a total with no positions */
  awakeMin: number | null;
  /** stage segments from a device; empty for a diary entry */
  stages: StageSegment[];
  /** whether start is a real in-bed time (a diary entry, or a source that reported in-bed). Without it, efficiency cannot be worked out */
  startIsInBed: boolean;
  notes: string | null;
  /** when the source wrote the record, to break ties between sources */
  recordedAt: number;
}

/** The limits on one session. The database enforces the same ones; see supabase/migrations/20261011000100_sleep_sessions.sql. */
export const LIMITS = {
  minSessionMin: 15,
  /** the longest single sleep accepted; anything longer is almost always a wrong AM or PM or date */
  maxSessionMin: 20 * 60,
  /** longer than this is accepted but the person is asked to check it */
  softMaxSessionMin: 14 * 60,
  maxLatencyMin: 600,
  maxAwakeMin: 720,
  notesChars: 200,
  /** a sleep that ends more than this far in the future is a typo */
  futureSlackMin: 5,
  /** nothing before this can be real data */
  earliest: Date.UTC(2000, 0, 1),
} as const;

export interface SleepForm {
  /** 'YYYY-MM-DDTHH:MM', as a datetime-local input gives it */
  start: string;
  end: string;
  latency: string;
  awake: string;
  notes: string;
}

export interface SleepValues {
  source_kind: 'manual';
  start_at: string;
  end_at: string;
  start_offset_min: number;
  end_offset_min: number;
  tz_id: string | null;
  latency_min: number | null;
  awake_min: number | null;
  start_is_in_bed: true;
  notes: string | null;
}

export type SleepErrors = Partial<Record<keyof SleepForm, string>>;
export type SleepResult = { ok: true; value: SleepValues; warnings: string[] } | { ok: false; errors: SleepErrors };

/** Turns a local date and time into the instant it means and the offset that applied then. The browser supplies this; tests pass a fixed one. */
export type Resolver = (date: string, clock: string) => { utcMs: number; offsetMin: number } | null;

/** A resolver for a fixed offset, for tests and for anything that already knows the zone. */
export const fixedOffset = (offsetMin: number): Resolver => (date, clock) => {
  const utcMs = instantFor(date, clock, offsetMin);
  return utcMs === null ? null : { utcMs, offsetMin };
};

function splitLocal(value: string): [string, string] | null {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(value.trim());
  return m ? [m[1], m[2]] : null;
}

function wholeMinutes(raw: string, max: number, label: string): { value: number | null; error?: string } {
  const text = raw.trim();
  if (text === '') return { value: null };
  const n = Number(text);
  if (!Number.isInteger(n) || n < 0 || n > max) return { value: null, error: `${label} must be a whole number of minutes from 0 to ${max}` };
  return { value: n };
}

/**
 * Turns the entry form into a session's values, or says what is wrong. `existing` are the person's other entered
 * sessions, so two nights that overlap are caught; `editingId` leaves the one being edited out of that check.
 */
export function validateSleepForm(
  form: SleepForm,
  ctx: { nowMs: number; resolve: Resolver; tzId: string | null; existing: readonly SleepSession[]; editingId?: string | null },
): SleepResult {
  const errors: SleepErrors = {};

  const startParts = splitLocal(form.start);
  const endParts = splitLocal(form.end);
  const start = startParts ? ctx.resolve(startParts[0], startParts[1]) : null;
  const end = endParts ? ctx.resolve(endParts[0], endParts[1]) : null;
  if (!start) errors.start = 'Choose when you got into bed';
  if (!end) errors.end = 'Choose when you got up';

  if (start && end) {
    const minutes = (end.utcMs - start.utcMs) / MINUTE_MS;
    if (start.utcMs < LIMITS.earliest) errors.start = 'That date is too far back';
    else if (end.utcMs <= start.utcMs) errors.end = 'Getting up has to be after getting into bed';
    else if (minutes < LIMITS.minSessionMin) errors.end = `Shorter than ${LIMITS.minSessionMin} minutes is not recorded as sleep`;
    else if (minutes > LIMITS.maxSessionMin) errors.end = `That is longer than ${LIMITS.maxSessionMin / 60} hours. Check the dates and AM or PM`;
    else if (end.utcMs > ctx.nowMs + LIMITS.futureSlackMin * MINUTE_MS) errors.end = 'That is in the future';
    else {
      const clash = ctx.existing.find((o) => o.id !== ctx.editingId && o.sourceKind === 'manual' && o.start < end.utcMs && start.utcMs < o.end);
      if (clash) errors.start = 'You already have an entry that overlaps this time. Edit that one instead';
    }
  }

  const latency = wholeMinutes(form.latency, LIMITS.maxLatencyMin, 'Time to fall asleep');
  const awake = wholeMinutes(form.awake, LIMITS.maxAwakeMin, 'Time awake in the night');
  if (latency.error) errors.latency = latency.error;
  if (awake.error) errors.awake = awake.error;
  if (start && end && !errors.end && !errors.latency && !errors.awake) {
    const minutes = (end.utcMs - start.utcMs) / MINUTE_MS;
    if ((latency.value ?? 0) + (awake.value ?? 0) >= minutes) errors.awake = 'Time to fall asleep and time awake have to add up to less than the time in bed';
  }

  const notes = form.notes.trim();
  if (notes.length > LIMITS.notesChars) errors.notes = `Keep the note to ${LIMITS.notesChars} characters or fewer`;

  if (Object.keys(errors).length > 0 || !start || !end) return { ok: false, errors };
  const warnings: string[] = [];
  if ((end.utcMs - start.utcMs) / MINUTE_MS > LIMITS.softMaxSessionMin) {
    warnings.push(`That is more than ${LIMITS.softMaxSessionMin / 60} hours in bed. Check the dates and AM or PM before saving.`);
  }
  return {
    ok: true,
    warnings,
    value: {
      source_kind: 'manual',
      start_at: new Date(start.utcMs).toISOString(),
      end_at: new Date(end.utcMs).toISOString(),
      start_offset_min: start.offsetMin,
      end_offset_min: end.offsetMin,
      tz_id: ctx.tzId,
      latency_min: latency.value,
      awake_min: awake.value,
      start_is_in_bed: true,
      notes: notes === '' ? null : notes,
    },
  };
}

/** Why a session from anywhere (an import, a database row) cannot be used, or null. Quarantined, never silently dropped. */
export function sessionProblem(s: SleepSession, nowMs: number): string | null {
  if (!Number.isFinite(s.start) || !Number.isFinite(s.end)) return 'its times are not valid';
  if (s.end <= s.start) return 'it ends before it starts';
  const minutes = (s.end - s.start) / MINUTE_MS;
  if (minutes < LIMITS.minSessionMin) return `it is shorter than ${LIMITS.minSessionMin} minutes`;
  if (minutes > LIMITS.maxSessionMin) return `it is longer than ${LIMITS.maxSessionMin / 60} hours`;
  if (s.start < LIMITS.earliest) return 'it is dated before 2000';
  if (s.end > nowMs + LIMITS.futureSlackMin * MINUTE_MS) return 'it ends in the future';
  if ((s.latencyMin ?? 0) + (s.awakeMin ?? 0) >= minutes) return 'its minutes to fall asleep and awake do not fit inside it';
  return null;
}
