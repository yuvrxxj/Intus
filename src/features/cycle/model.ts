// Cycles from the days a person logged bleeding. Pure: no network. Nothing is predicted: no next period, no ovulation,
// no fertile days. Only what already happened is summarised, and nothing until there is enough of it.
import { dayNumber, isoDay } from '../../lib/dates.ts';
import { normalizeSex } from '../screening/model.ts';

export type Flow = 'spotting' | 'light' | 'medium' | 'heavy';
export const FLOWS: readonly Flow[] = ['spotting', 'light', 'medium', 'heavy'];
export const FLOW_LABEL: Record<Flow, string> = { spotting: 'Spotting', light: 'Light', medium: 'Medium', heavy: 'Heavy' };

export const SYMPTOMS = ['cramps', 'headache', 'bloating', 'tender_breasts', 'mood', 'tiredness', 'acne', 'back_pain'] as const;
export type Symptom = (typeof SYMPTOMS)[number];
export const SYMPTOM_LABEL: Record<Symptom, string> = {
  cramps: 'Cramps', headache: 'Headache', bloating: 'Bloating', tender_breasts: 'Tender breasts', mood: 'Mood changes',
  tiredness: 'Tiredness', acne: 'Acne', back_pain: 'Back pain',
};

export const CONDITIONS = ['pcos', 'endometriosis', 'thyroid', 'hormonal_contraception', 'pregnant', 'breastfeeding', 'perimenopause', 'menopause'] as const;
export type ConditionCode = (typeof CONDITIONS)[number];
export const CONDITION_LABEL: Record<ConditionCode, string> = {
  pcos: 'PCOS', endometriosis: 'Endometriosis', thyroid: 'A thyroid condition', hormonal_contraception: 'Hormonal contraception',
  pregnant: 'Pregnant', breastfeeding: 'Breastfeeding', perimenopause: 'Perimenopause', menopause: 'Menopause',
};

/** Up to this many days without bleeding inside one period still counts as the same period (a day off between). */
export const PERIOD_GAP_DAYS = 1;
/** Summaries need at least this many complete cycles, and use at most the latest this many. */
export const MIN_CYCLES = 3;
export const RECENT_CYCLES = 6;
/** Spotting alone does not start a period. */
const STARTS_A_PERIOD: ReadonlySet<string> = new Set(['light', 'medium', 'heavy']);

export interface Period {
  start: string;
  end: string;
  days: number;
}

/**
 * Periods from logged days: runs of bleeding days, where spotting can extend a period but not start one. When two
 * sources logged the same day (typed in and imported), the day counts once.
 */
export function periodsOf(days: readonly { day: string; flow: string }[]): Period[] {
  const byDay = new Map<number, string>();
  for (const d of days) {
    let n: number;
    try {
      n = dayNumber(d.day);
    } catch {
      continue;
    }
    const prev = byDay.get(n);
    // keep the heavier reading of a day logged twice
    if (!prev || FLOWS.indexOf(d.flow as Flow) > FLOWS.indexOf(prev as Flow)) byDay.set(n, d.flow);
  }
  const sorted = [...byDay.entries()].sort((a, b) => a[0] - b[0]);
  const periods: { start: number; end: number }[] = [];
  for (const [n, flow] of sorted) {
    const last = periods.at(-1);
    if (last && n - last.end <= PERIOD_GAP_DAYS + 1) last.end = n;
    else if (STARTS_A_PERIOD.has(flow)) periods.push({ start: n, end: n });
  }
  return periods.map((p) => ({ start: isoDay(p.start), end: isoDay(p.end), days: p.end - p.start + 1 }));
}

export interface CycleSummary {
  /** completed cycles counted, newest last */
  lengths: number[];
  /** null until there are MIN_CYCLES complete cycles */
  median: number | null;
  shortest: number | null;
  longest: number | null;
  /** median period length over the same periods, or null */
  periodMedian: number | null;
}

function median(values: readonly number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function summarize(periods: readonly Period[]): CycleSummary {
  const lengths: number[] = [];
  for (let i = 1; i < periods.length; i++) lengths.push(dayNumber(periods[i].start) - dayNumber(periods[i - 1].start));
  const recent = lengths.slice(-RECENT_CYCLES);
  const enough = recent.length >= MIN_CYCLES;
  const recentPeriods = periods.slice(-(RECENT_CYCLES + 1)).map((p) => p.days);
  return {
    lengths: recent,
    median: enough ? median(recent) : null,
    shortest: enough ? Math.min(...recent) : null,
    longest: enough ? Math.max(...recent) : null,
    periodMedian: enough ? median(recentPeriods) : null,
  };
}

/** Day 1 is the first day of the most recent period that started on or before the date; null before any period. */
export function cycleDayOn(periods: readonly Period[], date: string): number | null {
  let target: number;
  try {
    target = dayNumber(date.slice(0, 10));
  } catch {
    return null;
  }
  let best: number | null = null;
  for (const p of periods) {
    const start = dayNumber(p.start);
    if (start <= target) best = start;
  }
  if (best === null) return null;
  const day = target - best + 1;
  // more than about three months since the last logged period says more about logging than about the cycle
  return day > 90 ? null : day;
}

export const isFemale = (sex: string | null | undefined): boolean => normalizeSex(sex) === 'female';
