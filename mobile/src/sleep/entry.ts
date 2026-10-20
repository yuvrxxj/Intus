import { isoDay, dayNumber } from '../../../src/lib/dates.ts';
import type { Resolver, SleepForm, SleepSession, SleepValues } from '../../../src/features/sleep/model.ts';

// Turning what a person types on the phone (a wake date and two clock times) into the web's sleep form, and back into a
// session to show. Pure: the time zone comes in as a resolver, never from the clock.

/** '23:00', '2300', '7:05' and '705' all mean a clock time; anything else is null. Returns 'HH:MM'. */
export function parseClock(text: string): string | null {
  const t = text.trim();
  const m = /^(\d{1,2}):?(\d{2})$/.exec(t);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh > 23 || mm > 59) return null;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/**
 * The form the web validates. The person gives the morning they got up and two clock times; getting into bed is on the
 * day before when its clock time is later than the wake time (23:00 then 07:00), and the same day otherwise (a nap, or
 * 01:00 then 08:00).
 */
export function sleepForm(input: { wakeDate: string; bed: string; wake: string; latency: string; awake: string; notes: string }): SleepForm {
  const bed = parseClock(input.bed);
  const wake = parseClock(input.wake);
  const bedDate = bed !== null && wake !== null && bed > wake ? isoDay(dayNumber(input.wakeDate) - 1) : input.wakeDate;
  return {
    start: bed === null ? '' : `${bedDate}T${bed}`,
    end: wake === null ? '' : `${input.wakeDate}T${wake}`,
    latency: input.latency,
    awake: input.awake,
    notes: input.notes,
  };
}

/** Local clock to instant, using the offset the phone applied on that date (so daylight saving is right). */
export const phoneResolver: Resolver = (date, clock) => {
  const [y, mo, d] = date.split('-').map(Number);
  const [hh, mm] = clock.split(':').map(Number);
  const at = new Date(y, mo - 1, d, hh, mm);
  // an impossible date (30 February) or a clock inside a skipped hour comes back as a different time
  if (at.getFullYear() !== y || at.getMonth() !== mo - 1 || at.getDate() !== d) return null;
  return { utcMs: at.getTime(), offsetMin: -at.getTimezoneOffset() };
};

/** The session a queued entry will become, so it can show in the list before it is sent. */
export function sessionFromValues(id: string, values: SleepValues, nowMs: number): SleepSession {
  return {
    id,
    sourceKind: 'manual',
    sourceName: null,
    externalId: null,
    start: Date.parse(values.start_at),
    end: Date.parse(values.end_at),
    startOffsetMin: values.start_offset_min,
    endOffsetMin: values.end_offset_min,
    tzId: values.tz_id,
    latencyMin: values.latency_min,
    awakeMin: values.awake_min,
    stages: [],
    startIsInBed: true,
    notes: values.notes,
    recordedAt: nowMs,
  };
}
