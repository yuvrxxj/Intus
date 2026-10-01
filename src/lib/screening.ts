import { dayNumber, isoDay } from './dates.ts';

export const SCREENING_STATUS = Object.freeze({
  DUE: 'due',
  OVERDUE: 'overdue',
  UP_TO_DATE: 'up_to_date',
  NOT_YET: 'not_yet',
});

export type ScreeningStatus = (typeof SCREENING_STATUS)[keyof typeof SCREENING_STATUS];

/** A screening_rules row. */
export interface ScreeningRule {
  code: string;
  label: string;
  min_age: number | null;
  max_age: number | null;
  sex: string | null;
  interval_years: number | null;
  requires_flag: string | null;
  rationale: string | null;
  sort_order?: number;
}

export interface ScreeningHistoryRow {
  screening_code: string;
  done_date: string;
}

/** Profile booleans (family_* / noise_*) keyed by column name. */
export type ScreeningFlags = Record<string, boolean | null | undefined>;

export interface ScreeningItem {
  code: string;
  label: string;
  status: ScreeningStatus;
  detail: string;
  lastDone: string | null;
}

export interface ScreeningCalendarInput {
  rules: readonly ScreeningRule[];
  sex: string | null | undefined;
  age: number;
  flags?: ScreeningFlags;
  lastDone?: Record<string, string>;
  today?: Date | string;
}

const SEX_ALIASES: Record<string, 'male' | 'female'> = { m: 'male', male: 'male', f: 'female', female: 'female' };
const APPLIES = 'applies';
const TOO_EARLY = 'too_early';
const SKIP = 'skip';
type Gate = typeof APPLIES | typeof TOO_EARLY | typeof SKIP;

/** historyRows: screening_history rows; returns { code: latest done_date } */
export function latestDoneByCode(historyRows: readonly ScreeningHistoryRow[]): Record<string, string> {
  const latest: Record<string, string> = {};
  for (const { screening_code: code, done_date: date } of historyRows) {
    if (!Object.hasOwn(latest, code) || dayNumber(date) > dayNumber(latest[code])) {
      latest[code] = date;
    }
  }
  return latest;
}

function gate(rule: ScreeningRule, sex: string | null, age: number, flags: ScreeningFlags): Gate {
  if (rule.sex && rule.sex !== sex) return SKIP;
  const flagOn = rule.requires_flag ? Boolean(flags[rule.requires_flag]) : false;
  // with min_age the flag bypasses the age gate; without min_age the flag is required
  if (rule.min_age == null && rule.requires_flag) return flagOn ? APPLIES : SKIP;
  if (rule.max_age != null && age > rule.max_age) return SKIP;
  if (rule.min_age == null || age >= rule.min_age || flagOn) return APPLIES;
  // only rules a risk flag can pull earlier say "too early"; other age misses are omitted
  return rule.requires_flag ? TOO_EARLY : SKIP;
}

function describe(text: string, rationale: string | null): string {
  return rationale ? `${text} ${rationale}` : text;
}

function evaluateStatus(
  rule: ScreeningRule,
  doneDate: string | null,
  todayDay: number,
): Pick<ScreeningItem, 'status' | 'detail' | 'lastDone'> {
  if (doneDate == null) {
    return { status: SCREENING_STATUS.DUE, detail: describe('No record yet.', rule.rationale), lastDone: null };
  }
  const doneDay = dayNumber(doneDate);
  const lastDone = isoDay(doneDay);
  if (rule.interval_years == null) {
    return {
      status: SCREENING_STATUS.UP_TO_DATE,
      detail: describe(`Done ${lastDone}, one-time screening.`, rule.rationale),
      lastDone,
    };
  }
  const years = (todayDay - doneDay) / 365.25;
  const every = `every ${rule.interval_years} year${rule.interval_years === 1 ? '' : 's'}`;
  return {
    status: years >= rule.interval_years ? SCREENING_STATUS.OVERDUE : SCREENING_STATUS.UP_TO_DATE,
    detail: describe(`Last done ${lastDone}, about ${years.toFixed(1)} years ago (${every}).`, rule.rationale),
    lastDone,
  };
}

/**
 * rules: screening_rules rows in display order; flags: profile row (family_* / noise_* booleans);
 * lastDone: { code: 'YYYY-MM-DD' } from latestDoneByCode
 */
export function buildScreeningCalendar({
  rules,
  sex,
  age,
  flags = {},
  lastDone = {},
  today,
}: ScreeningCalendarInput): ScreeningItem[] {
  if (!Number.isFinite(age) || age < 0) throw new TypeError('age must be a non-negative number');
  const normalizedSex = SEX_ALIASES[String(sex ?? '').trim().toLowerCase()] ?? null;
  const todayDay = dayNumber(today ?? new Date());
  const items: ScreeningItem[] = [];
  for (const rule of rules) {
    const verdict = gate(rule, normalizedSex, age, flags);
    if (verdict === SKIP) continue;
    const base = { code: rule.code, label: rule.label };
    if (verdict === TOO_EARLY) {
      items.push({
        ...base,
        status: SCREENING_STATUS.NOT_YET,
        detail: describe('Not needed yet.', rule.rationale),
        lastDone: null,
      });
      continue;
    }
    const doneDate = Object.hasOwn(lastDone, rule.code) ? lastDone[rule.code] : null;
    items.push({ ...base, ...evaluateStatus(rule, doneDate, todayDay) });
  }
  return items;
}
