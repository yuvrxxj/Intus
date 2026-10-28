// What the Sleep screen shows. The night rules, the five-night average and the form checks stay in
// src/features/sleep. This file only decides which of those results the phone draws.
import { CLASS_LABEL, ageBand, classifyHours, type AgeBand } from '../../../src/features/sleep/ageBand.ts';
import { approx, clockRange, nightHeading, sourceLabel } from '../../../src/features/sleep/format.ts';
import type { SleepForm, SleepSession } from '../../../src/features/sleep/model.ts';
import { buildNights, type Flag, type Night } from '../../../src/features/sleep/nights.ts';
import { MIN_NIGHTS, summarize, type PeriodSummary } from '../../../src/features/sleep/summary.ts';
import { formatClock, formatDuration, localDate, roundTo5 } from '../../../src/features/sleep/time.ts';
import { dayNumber, isoDay } from '../../../src/lib/dates.ts';

/** The sentence iOS shows on the system sheet, and the first line of ours. It names the three reads and no medical use. */
export const HEALTH_SHARE_PURPOSE =
  'Intus reads your sleep, heart rate variability and resting heart rate from Apple Health to show them in your log. It never writes to Apple Health. Only you can see this data.';

export const HEALTH_SHEET = {
  title: 'Connect Apple Health',
  reads: ['Sleep', 'Heart rate variability', 'Resting heart rate'],
  aside: 'Steps, workouts and everything else stay in Apple Health. Intus does not read them.',
  denial: 'If you turn access off, or if there is no sleep to read, you can enter nights by hand. iOS does not tell Intus which one happened.',
} as const;

/** Same window the website uses for the averages. */
export const SLEEP_WINDOW_DAYS = 28;
/** How far back the screen reads. Enough for that window and a few months of nights. */
export const SLEEP_HISTORY_DAYS = 180;

const FLAG_TEXT: Record<Flag, string> = {
  sources_disagree: 'Two sources differ by an hour or more for this night.',
  possible_tz_error: 'Two sources differ by a whole number of hours, which can be a time zone mix-up.',
  short_main: 'Under 3 hours asleep. Worth a look in case a record is incomplete.',
  tz_uncertain: 'Bed and wake were in different time zones, so clock times here are approximate.',
};

const REASON_TEXT = {
  lower_priority: 'not used: another source ranks first',
  below_coverage_floor: 'not used: it covers less than half of the night',
} as const;

export interface AverageFigures {
  asleep: string;
  asleepNote: string;
  fellAsleep: string | null;
  fellAsleepNote: string | null;
  woke: string | null;
  wokeNote: string | null;
  nights: string;
  footnote: string;
}

export interface NightLine {
  heading: string;
  duration: string;
  basis: string;
  when: string;
  source: string;
  joined: string | null;
  detail: string | null;
  stages: string | null;
  extras: string[];
  alternatives: string[];
  flags: string[];
  range: string | null;
  /** a hand-entered night that is still one record, so it can be removed */
  editable: boolean;
  deleteId: string;
}

export interface SleepPresentation {
  nights: Night[];
  quarantined: { when: string; reason: string }[];
  summary: PeriodSummary;
  /** false below MIN_NIGHTS: the figures stay hidden */
  showAverages: boolean;
  /** manual entry, when Apple Health is missing on this device or has not supplied a night */
  showManual: boolean;
  band: AgeBand | null;
}

/** Local calendar day of `now`, for the average window. */
export function todayKey(now: Date): string {
  return localDate(now.getTime(), -now.getTimezoneOffset());
}

/**
 * A hand-entered night is the fallback when this device has no Health store, or when none of the stored nights
 * came from Apple Health on the phone. A night that did come from Health is shown from that source.
 */
export function showManualEntry(sessions: readonly Pick<SleepSession, 'sourceKind'>[], healthAvailable: boolean): boolean {
  if (!healthAvailable) return true;
  return !sessions.some((s) => s.sourceKind === 'healthkit');
}

/** The purpose sheet is first-run only, and only where Apple Health exists. */
export function shouldOfferHealthSheet(healthAvailable: boolean, alreadyAsked: boolean): boolean {
  return healthAvailable && !alreadyAsked;
}

/** Bed 23:00 the evening before `today`, up at 07:00. The person overwrites both. */
export function blankSleepForm(today: string): SleepForm {
  return {
    start: `${isoDay(dayNumber(today) - 1)}T${formatClock(23 * 60)}`,
    end: `${today}T${formatClock(7 * 60)}`,
    latency: '',
    awake: '',
    notes: '',
  };
}

/** Local date and clock on this device, with the offset that applied then. Null when the text is not a real moment. */
export function deviceResolver(date: string, clock: string): { utcMs: number; offsetMin: number } | null {
  const [y, m, d] = date.split('-').map(Number);
  const [h, mi] = clock.split(':').map(Number);
  if (![y, m, d, h, mi].every((n) => Number.isInteger(n))) return null;
  const when = new Date(y, m - 1, d, h, mi);
  if (Number.isNaN(when.getTime()) || when.getMonth() !== m - 1 || when.getDate() !== d) return null;
  return { utcMs: when.getTime(), offsetMin: -when.getTimezoneOffset() };
}

/** The averages, or null when there are fewer than {@link MIN_NIGHTS} nights in the window. */
export function averageFigures(summary: PeriodSummary, band: AgeBand | null): AverageFigures | null {
  if (!summary.enough || summary.medianAsleepMin === null) return null;
  const vary = (sd: number | null): string | null =>
    sd === null ? null : `varies by about ${roundTo5(sd)} min${summary.rough ? ', roughly' : ''}`;
  const typical = band ? CLASS_LABEL[classifyHours(roundTo5(summary.medianAsleepMin) / 60, band)].toLowerCase() : null;
  const footnote = [
    `Based on ${summary.nights} of the last ${summary.windowDays} nights. Nights with no data are left out, not counted as zero.`,
    summary.rough ? 'With fewer than 14 nights, how much your times vary is only a rough guide.' : '',
    typical ? `The middle night is ${typical}.` : '',
  ].filter((part) => part !== '').join(' ');
  return {
    asleep: `about ${formatDuration(roundTo5(summary.medianAsleepMin))}`,
    asleepNote: 'the middle night',
    fellAsleep: summary.usualAsleepClock === null ? null : formatClock(summary.usualAsleepClock),
    fellAsleepNote: vary(summary.asleepSdMin),
    woke: summary.usualWakeClock === null ? null : formatClock(summary.usualWakeClock),
    wokeNote: vary(summary.wakeSdMin),
    nights: `${summary.nights} of ${summary.windowDays}`,
    footnote,
  };
}

/** What to say while the averages are withheld. */
export function waitingCopy(summary: PeriodSummary): string {
  if (summary.enough) return '';
  if (summary.nights === 0) {
    return `No nights yet. Add one below, or sync Apple Health. Averages appear once ${MIN_NIGHTS} nights fall in a ${summary.windowDays} day stretch.`;
  }
  return `${summary.nights} of the last ${summary.windowDays} nights recorded. Averages need at least ${MIN_NIGHTS}, so none are shown yet.`;
}

/** One night as a list row. The duration is the chosen source only. */
export function nightLine(night: Night, band: AgeBand | null): NightLine {
  const { main } = night;
  const m = main.metrics;
  const device = main.session.sourceKind !== 'manual';
  const durationText = formatDuration(m.tstMin);
  const hours = (band?.includesNaps ? night.totalAsleep24Min : m.tstMin) / 60;
  let detail: string | null = null;
  if (m.basis === 'diary' || m.basis === 'stages') {
    const bits = [`${formatDuration(m.tibMin)} in bed`];
    if (m.latencyMin !== null) bits.push(`${m.latencyMin} min to fall asleep`);
    if (m.wasoMin !== null) bits.push(`${m.wasoMin} min awake in the night`);
    const efficiency = m.efficiency !== null ? `, ${Math.round(m.efficiency)}% of the time in bed asleep` : '';
    detail = `${bits.join(', ')}${efficiency}.`;
  }
  return {
    heading: nightHeading(night.key),
    duration: device ? approx(durationText) : durationText,
    basis: m.basis === 'bed_to_wake' ? 'bed to wake' : 'asleep',
    when: clockRange(main.session),
    source: sourceLabel(main.session),
    joined: main.session.members.length > 1 ? `${main.session.members.length} records joined` : null,
    detail,
    stages: m.stageMinutes
      ? `Estimated by the device: light ${formatDuration(m.stageMinutes.light)}, deep ${formatDuration(m.stageMinutes.deep)}, REM ${formatDuration(m.stageMinutes.rem)}. Stages are a rough guess.`
      : null,
    extras: night.additional.map((extra) =>
      `${extra.kind === 'nap' ? 'Nap' : 'Second sleep'}: ${formatDuration(extra.metrics.tstMin)} (${clockRange(extra.session)})`),
    alternatives: main.alternatives.map((alt) =>
      `Also recorded by ${sourceLabel(alt)}: ${approx(formatDuration(alt.tstMin))} (${REASON_TEXT[alt.reason]}).`),
    flags: main.flags.map((flag) => FLAG_TEXT[flag]),
    range: band ? CLASS_LABEL[classifyHours(hours, band)] : null,
    editable: main.session.sourceKind === 'manual' && main.session.members.length === 1,
    deleteId: main.session.members[0],
  };
}

export function presentSleep(
  sessions: readonly SleepSession[],
  today: string,
  nowMs: number,
  age: number | null,
  healthAvailable: boolean,
): SleepPresentation {
  const built = buildNights(sessions, { nowMs });
  const summary = summarize(built.nights, today, SLEEP_WINDOW_DAYS);
  const band = ageBand(age);
  return {
    nights: built.nights,
    quarantined: built.quarantined.map((item) => ({ when: clockRange(item.session), reason: item.reason })),
    summary,
    showAverages: averageFigures(summary, band) !== null,
    showManual: showManualEntry(sessions, healthAvailable),
    band,
  };
}
