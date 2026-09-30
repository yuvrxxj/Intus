import { dayNumber, isoDay } from './dates.js';

export const SCREENING_STATUS = Object.freeze({
  DUE: 'due',
  OVERDUE: 'overdue',
  UP_TO_DATE: 'up_to_date',
  NOT_YET: 'not_yet',
});

const APPLIES = 'applies';
const TOO_EARLY = 'too_early';
const SKIP = 'skip';

/** historyRows: screening_history rows; returns { code: latest done_date } */
export function latestDoneByCode(historyRows) {
  const latest = {};
  for (const { screening_code: code, done_date: date } of historyRows) {
    if (!Object.hasOwn(latest, code) || dayNumber(date) > dayNumber(latest[code])) {
      latest[code] = date;
    }
  }
  return latest;
}

function gate(rule, sex, age, flags) {
  if (rule.sex && rule.sex !== sex) return SKIP;
  const flagOn = rule.requires_flag ? Boolean(flags[rule.requires_flag]) : false;
  // with min_age the flag bypasses the age gate; without min_age the flag is required
  if (rule.min_age == null && rule.requires_flag) return flagOn ? APPLIES : SKIP;
  if (rule.max_age != null && age > rule.max_age) return SKIP;
  if (rule.min_age == null || age >= rule.min_age || flagOn) return APPLIES;
  // only rules a risk flag can pull earlier say "too early"; other age misses are omitted
  return rule.requires_flag ? TOO_EARLY : SKIP;
}

function describe(text, rationale) {
  return rationale ? `${text} ${rationale}` : text;
}

function evaluateStatus(rule, doneDate, todayDay) {
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
export function buildScreeningCalendar({ rules, sex, age, flags = {}, lastDone = {}, today }) {
  if (!Number.isFinite(age) || age < 0) throw new TypeError('age must be a non-negative number');
  const normalizedSex = typeof sex === 'string' ? sex.toLowerCase() : null;
  const todayDay = dayNumber(today ?? new Date());
  const items = [];
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
