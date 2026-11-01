// What the Activity screen shows: steps and active calories, day by day. Pure, so the web repo's tests run it.
//
// No score, no goal and no good-or-bad colour. A day is the numbers Apple Health reported, nothing more. Two sources for
// one day stay two stored rows; the screen shows one of them (Apple Health first) and says the other exists.

export interface ActivityDayRow {
  day: string;
  steps: number | null;
  active_kcal: number | null;
  source: string;
}

export interface ActivityLine {
  day: string;
  /** "Today so far", "Yesterday", or "Sat 10 Oct" */
  heading: string;
  steps: string | null;
  kcal: string | null;
  /** present only when another source also reported this day */
  note: string | null;
}

export interface ActivityAverages {
  /** the days that went into each average, so the screen can say "5 days" */
  stepDays: number;
  kcalDays: number;
  steps: string | null;
  kcal: string | null;
}

export interface ActivityPresentation {
  today: ActivityLine | null;
  lines: ActivityLine[];
  averages: ActivityAverages | null;
}

/** How far back the screen reads, and how many days the average looks at (full days: today is not finished). */
export const ACTIVITY_HISTORY_DAYS = 30;
export const AVERAGE_DAYS = 7;
/** An average is shown from this many full days of data, so one day is never called an average. */
export const MIN_AVERAGE_DAYS = 3;

export const ACTIVITY_COPY = {
  title: 'Activity',
  todayLabel: 'Today so far',
  averageLabel: 'Last 7 full days',
  averageHint: 'Daily average over the days Apple Health had a number. Today is left out because it is not over.',
  averageWaiting: 'Averages appear once three full days have a record.',
  daysLabel: 'Days',
  daysHint: 'Steps and active calories as Apple Health reports them for each day. Missing days stay missing.',
  emptyTitle: 'No steps or active calories yet',
  empty: 'Open the Sleep tab and tap Sync now to read them from Apple Health. The first sync reads the last 90 days.',
  noHealth: 'This device has no Health data store, so there is nothing to show here.',
  load: 'Your activity could not be loaded. Check your connection and try again.',
  stepsLabel: 'Steps',
  kcalLabel: 'Active calories',
  footnote: 'Active calories are the energy from moving. They do not include resting energy.',
} as const;

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const DAY_MS = 86_400_000;

/** 12345 as "12,345", the same on every phone setting. */
export function formatSteps(value: number): string {
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Whole kilocalories: 412.5 as "413 kcal". The stored decimal is Apple's precision, not something to read out. */
export function formatKcal(value: number): string {
  return `${formatSteps(value)} kcal`;
}

function dayMs(day: string): number {
  return Date.parse(`${day}T00:00:00Z`);
}

/** The day before `day`, as 'YYYY-MM-DD'. */
export function previousDay(day: string): string {
  return new Date(dayMs(day) - DAY_MS).toISOString().slice(0, 10);
}

/** The first day the screen reads from, `days` days before today. */
export function historyStart(today: string, days: number = ACTIVITY_HISTORY_DAYS): string {
  return new Date(dayMs(today) - days * DAY_MS).toISOString().slice(0, 10);
}

export function dayHeading(day: string, today: string): string {
  if (day === today) return ACTIVITY_COPY.todayLabel;
  if (day === previousDay(today)) return 'Yesterday';
  const d = new Date(dayMs(day));
  return `${WEEKDAY[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH[d.getUTCMonth()]}`;
}

const SOURCE_ORDER = ['healthkit', 'health_connect', 'manual', 'other'] as const;
const SOURCE_NAME: Record<string, string> = {
  healthkit: 'Apple Health',
  health_connect: 'Health Connect',
  manual: 'entered by hand',
  other: 'another source',
};

/** One row per day: Apple Health first, then Health Connect, then the rest. Others for the day are named, not added in. */
export function pickPerDay(rows: readonly ActivityDayRow[]): { row: ActivityDayRow; others: string[] }[] {
  const byDay = new Map<string, ActivityDayRow[]>();
  for (const row of rows) {
    const list = byDay.get(row.day) ?? [];
    list.push(row);
    byDay.set(row.day, list);
  }
  const rank = (source: string) => {
    const i = (SOURCE_ORDER as readonly string[]).indexOf(source);
    return i === -1 ? SOURCE_ORDER.length : i;
  };
  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([, list]) => {
      const sorted = [...list].sort((a, b) => rank(a.source) - rank(b.source));
      return { row: sorted[0], others: sorted.slice(1).map((r) => SOURCE_NAME[r.source] ?? SOURCE_NAME.other) };
    });
}

function line(row: ActivityDayRow, others: string[], today: string): ActivityLine {
  return {
    day: row.day,
    heading: dayHeading(row.day, today),
    steps: row.steps === null ? null : formatSteps(row.steps),
    kcal: row.active_kcal === null ? null : formatKcal(row.active_kcal),
    note: others.length === 0 ? null : `Also reported by ${others.join(' and ')}. Not added in.`,
  };
}

/**
 * Newest day first. The average covers the AVERAGE_DAYS full days before today and counts only days that have the
 * number, steps and calories separately; it is left out under MIN_AVERAGE_DAYS days. Numbers may arrive from the API as
 * strings (numeric columns), so each is read through Number and anything that is not a finite number is treated as missing.
 */
export function presentActivity(rows: readonly ActivityDayRow[], today: string): ActivityPresentation {
  const clean = rows.map((r) => ({
    ...r,
    steps: r.steps === null ? null : Number.isFinite(Number(r.steps)) ? Number(r.steps) : null,
    active_kcal: r.active_kcal === null ? null : Number.isFinite(Number(r.active_kcal)) ? Number(r.active_kcal) : null,
  }));
  const picked = pickPerDay(clean).filter(({ row }) => row.steps !== null || row.active_kcal !== null);
  const lines = picked.map(({ row, others }) => line(row, others, today));
  const todayLine = lines.find((l) => l.day === today) ?? null;

  const from = historyStart(today, AVERAGE_DAYS);
  const window = picked.filter(({ row }) => row.day >= from && row.day < today).map(({ row }) => row);
  const stepValues = window.flatMap((r) => (r.steps === null ? [] : [r.steps]));
  const kcalValues = window.flatMap((r) => (r.active_kcal === null ? [] : [r.active_kcal]));
  const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
  const averages =
    stepValues.length >= MIN_AVERAGE_DAYS || kcalValues.length >= MIN_AVERAGE_DAYS
      ? {
          stepDays: stepValues.length,
          kcalDays: kcalValues.length,
          steps: stepValues.length >= MIN_AVERAGE_DAYS ? formatSteps(mean(stepValues)) : null,
          kcal: kcalValues.length >= MIN_AVERAGE_DAYS ? formatKcal(mean(kcalValues)) : null,
        }
      : null;
  return { today: todayLine, lines, averages };
}
