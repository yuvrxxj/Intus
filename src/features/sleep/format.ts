// Words and times for the sleep screens. Pure, and never reads the browser's time zone.
import type { SleepSession } from './model.ts';
import { formatClock, localDate, minutesIntoDay } from './time.ts';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const parts = (key: string): { weekday: string; day: number; month: string } => {
  const d = new Date(`${key}T00:00:00Z`);
  return { weekday: WEEKDAYS[d.getUTCDay()], day: d.getUTCDate(), month: MONTHS[d.getUTCMonth()] };
};

/** 'Fri 9 Oct'. */
export function dayLabel(key: string): string {
  const p = parts(key);
  return `${p.weekday} ${p.day} ${p.month}`;
}

/** 'Night ending Fri 9 Oct': the date is the one they woke on, which people read the same way whichever end they think of. */
export function nightHeading(key: string): string {
  return `Night ending ${dayLabel(key)}`;
}

/** '9 Oct', for an axis. */
export function shortDay(key: string): string {
  const p = parts(key);
  return `${p.day} ${p.month}`;
}

/** '23:00 Thu to 07:00 Fri', each end on the clock where the person was. */
export function clockRange(s: Pick<SleepSession, 'start' | 'end' | 'startOffsetMin' | 'endOffsetMin'>): string {
  const day = (ms: number, off: number) => WEEKDAYS[new Date(`${localDate(ms, off)}T00:00:00Z`).getUTCDay()];
  return `${formatClock(minutesIntoDay(s.start, s.startOffsetMin))} ${day(s.start, s.startOffsetMin)} to ${formatClock(minutesIntoDay(s.end, s.endOffsetMin))} ${day(s.end, s.endOffsetMin)}`;
}

const KIND_LABEL: Record<SleepSession['sourceKind'], string> = {
  manual: 'Entered by you',
  apple_health_export: 'Apple Health export',
  healthkit: 'Apple Health',
  health_connect: 'Health Connect',
  other: 'Other source',
};

/** Where a night came from, in words: "Entered by you", or "Apple Watch" with the route. */
export function sourceLabel(s: Pick<SleepSession, 'sourceKind' | 'sourceName'>): string {
  if (s.sourceKind === 'manual') return KIND_LABEL.manual;
  return s.sourceName ? `${s.sourceName} (${KIND_LABEL[s.sourceKind]})` : KIND_LABEL[s.sourceKind];
}

/** The text a datetime-local input wants ('2026-10-09T23:00') for an instant read on the clock of an offset. */
export function localInputValue(utcMs: number, offsetMin: number): string {
  return new Date(utcMs + offsetMin * 60_000).toISOString().slice(0, 16);
}

/** 'about 7 h 05', for a number a device estimated. */
export function approx(text: string): string {
  return `about ${text}`;
}
