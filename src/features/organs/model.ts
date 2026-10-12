import type { AsciiShape } from '../../components/ui/ascii-engine.ts';
import type { Habit } from '../../db/habits.ts';
import type { Biomarker, BiomarkerReading } from '../../db/queries.ts';
import { dayNumber } from '../../lib/dates.ts';
import { toNumberOrNull } from '../../lib/numbers.ts';
import { rangeStatus } from '../bloodwork/model.ts';
import { activeHabits, betterOf, goalOf, type Entries } from '../habits/model.ts';
import type { DurationClass } from '../sleep/ageBand.ts';

/*
 * The body panel: an organ drawn in characters for each group of things a person logs, fading from red towards grey
 * as those things move away from the person's own goal or the lab's printed range. There is no score. Every step of
 * the fade comes from one of the rules below, and the panel lists which reading set it.
 *
 *   full   on track: in the lab's range, at or past the habit goal, sleep in the recommended range
 *   light  close: within 10% past a lab limit, a habit within reach of its goal, sleep in the "may be appropriate" band
 *   pale   off: 10 to 25% past a lab limit, a habit past reach, sleep outside the recommended bands
 *   grey   far: more than 25% past a lab limit, or a lower-is-better habit more than twice its slack over the goal
 *
 * An organ takes the furthest of its readings. An organ with nothing logged is drawn faintly and says so, rather than
 * being drawn as healthy.
 */

export type Level = 'full' | 'light' | 'pale' | 'grey';
export const LEVELS: readonly Level[] = ['full', 'light', 'pale', 'grey'];

export const LEVEL_LABEL: Record<Level, string> = {
  full: 'On track',
  light: 'Close',
  pale: 'Off track',
  grey: 'Far off',
};

/** How far past a lab limit, as a share of that limit, each step of the fade starts. */
export const LIGHT_UP_TO = 0.1;
export const PALE_UP_TO = 0.25;

export type OrganId = 'lungs' | 'liver' | 'heart' | 'pancreas' | 'kidneys' | 'thyroid' | 'brain' | 'bones' | 'blood';

export interface OrganDef {
  id: OrganId;
  label: string;
  shape: AsciiShape;
  /** biomarker codes, as stored in the biomarkers table */
  markers: readonly string[];
  /** a habit whose name matches one of these is read for this organ */
  habitWords: readonly RegExp[];
  /** sleep is read for the brain */
  sleep?: boolean;
}

/**
 * The map from the Sprint 2 plan. Resting heart rate and blood pressure (heart) have no goal or printed range in the
 * app yet, and legs and muscle groups need a body drawing, so they wait.
 */
export const ORGANS: readonly OrganDef[] = [
  { id: 'lungs', label: 'Lungs', shape: 'lungs', markers: [], habitWords: [/cig/i, /smok/i, /vape/i, /nicotine/i] },
  { id: 'liver', label: 'Liver', shape: 'liver', markers: ['alt', 'ast', 'ggt'], habitWords: [/alcohol/i, /drink/i, /beer/i, /wine/i] },
  { id: 'heart', label: 'Heart', shape: 'heart', markers: ['ldl', 'hdl', 'triglycerides'], habitWords: [/step/i, /cardio/i, /walk/i, /\brun/i] },
  { id: 'pancreas', label: 'Pancreas', shape: 'pancreas', markers: ['hba1c', 'glucose'], habitWords: [] },
  { id: 'kidneys', label: 'Kidneys', shape: 'kidneys', markers: ['creatinine', 'blood_urea', 'uric_acid'], habitWords: [/water/i] },
  { id: 'thyroid', label: 'Thyroid', shape: 'thyroid', markers: ['tsh', 't3_free', 't4_free'], habitWords: [] },
  { id: 'brain', label: 'Brain', shape: 'brain', markers: [], habitWords: [], sleep: true },
  { id: 'bones', label: 'Bones', shape: 'bone', markers: ['vitamin_d', 'calcium'], habitWords: [] },
  { id: 'blood', label: 'Blood', shape: 'drop', markers: ['hemoglobin', 'ferritin', 'serum_iron', 'vitamin_b12'], habitWords: [] },
];

export interface Signal {
  label: string;
  level: Level;
  /** one line on where the reading sits, in plain words */
  detail: string;
}

export interface OrganState {
  def: OrganDef;
  /** null when nothing for this organ has been logged */
  level: Level | null;
  signals: Signal[];
}

const worse = (a: Level, b: Level): Level => (LEVELS.indexOf(a) >= LEVELS.indexOf(b) ? a : b);

/** Four significant figures, no float noise. */
const fmt = (v: number) => String(Number(v.toPrecision(4)));

/** Where a lab result sits: in range, or how far past the nearer limit as a share of that limit. */
export function markerLevel(biomarker: Biomarker, value: number): { level: Level; detail: string } | null {
  let status;
  try {
    status = rangeStatus(biomarker, value);
  } catch {
    return null;
  }
  if (status === 'no_range') return null;
  const unit = biomarker.unit ? ` ${biomarker.unit}` : '';
  if (status === 'in_range') return { level: 'full', detail: `${fmt(value)}${unit}, in the lab's range` };
  const limit = toNumberOrNull(status === 'above' ? biomarker.ref_high : biomarker.ref_low, 'reference limit');
  if (limit === null) return null;
  const past = limit === 0 ? Infinity : Math.abs(value - limit) / Math.abs(limit);
  const level: Level = past <= LIGHT_UP_TO ? 'light' : past <= PALE_UP_TO ? 'pale' : 'grey';
  const share = Number.isFinite(past) ? ` (${Math.round(past * 100)}% past)` : '';
  return { level, detail: `${fmt(value)}${unit}, ${status === 'above' ? 'above' : 'below'} the lab's range of ${fmt(limit)}${share}` };
}

/** The latest result for each marker code asked for. Readings that cannot be read as numbers are skipped. */
function latestByCode(biomarkers: readonly Biomarker[], readings: readonly BiomarkerReading[], codes: readonly string[]) {
  const out: { biomarker: Biomarker; value: number; day: number }[] = [];
  for (const code of codes) {
    const biomarker = biomarkers.find((b) => b.code === code);
    if (!biomarker) continue;
    let best: { value: number; day: number } | null = null;
    for (const r of readings) {
      if (r.biomarker_id !== biomarker.id) continue;
      try {
        const value = toNumberOrNull(r.value, 'reading');
        const day = dayNumber(r.measured_at);
        if (value !== null && (best === null || day > best.day)) best = { value, day };
      } catch {
        continue;
      }
    }
    if (best) out.push({ biomarker, ...best });
  }
  return out;
}

/**
 * A habit's entry for the day against its goal. Higher-is-better: at the goal is full, half way light, less pale.
 * Lower-is-better: at or under the goal is full; within the slack the habit list already uses (a quarter over, or 3 for
 * a count) light; up to twice that pale; beyond grey. So with a goal of none, each cigarette past the third fades it.
 */
export function habitLevel(habit: Pick<Habit, 'kind' | 'goal' | 'better' | 'unit'>, value: number | boolean): { level: Level; detail: string } {
  const better = betterOf(habit);
  if (habit.kind === 'yesno') {
    const yes = value === true || (typeof value === 'number' && value > 0);
    const good = yes === (better === 'higher');
    return { level: good ? 'full' : 'pale', detail: yes ? 'Yes today' : 'No today' };
  }
  const n = typeof value === 'number' ? value : value ? 1 : 0;
  const goal = goalOf(habit);
  const unit = habit.unit ? ` ${habit.unit}` : '';
  if (better === 'higher') {
    if (goal === null || goal <= 0) return { level: n > 0 ? 'full' : 'pale', detail: `${fmt(n)}${unit} today` };
    const level: Level = n >= goal ? 'full' : n >= goal / 2 ? 'light' : 'pale';
    return { level, detail: `${fmt(n)}${unit} today, goal ${fmt(goal)}` };
  }
  const target = goal ?? 0;
  const slack = Math.max(habit.kind === 'count' ? 3 : 0, target * 0.25);
  const level: Level = n <= target ? 'full' : n <= target + slack ? 'light' : n <= target + 2 * slack ? 'pale' : 'grey';
  return { level, detail: `${fmt(n)}${unit} today, goal ${goal === null ? 'none' : `at most ${fmt(target)}`}` };
}

const SLEEP_LEVEL: Record<DurationClass, Level> = {
  within: 'full',
  'shorter-possible': 'light',
  'longer-possible': 'light',
  shorter: 'pale',
  longer: 'pale',
};

export interface SleepInput {
  /** the middle night's time asleep over the recent window, or null when there are too few nights */
  medianAsleepMin: number | null;
  /** where that sits against the recommended range for the person's age, or null with no age */
  durationClass: DurationClass | null;
  windowDays: number;
}

export interface OrganInputs {
  biomarkers: readonly Biomarker[];
  readings: readonly BiomarkerReading[];
  habits: readonly Habit[];
  /** today's habit entries */
  entries: Entries;
  sleep: SleepInput | null;
}

export function organStates({ biomarkers, readings, habits, entries, sleep }: OrganInputs): OrganState[] {
  const active = activeHabits(habits);
  return ORGANS.map((def) => {
    const signals: Signal[] = [];
    for (const { biomarker, value } of latestByCode(biomarkers, readings, def.markers)) {
      const read = markerLevel(biomarker, value);
      if (read) signals.push({ label: biomarker.name, ...read });
    }
    for (const habit of active) {
      if (!def.habitWords.some((w) => w.test(habit.name))) continue;
      const entry = entries[habit.id];
      if (entry === undefined) continue;
      signals.push({ label: habit.name, ...habitLevel(habit, entry.value) });
    }
    if (def.sleep && sleep && sleep.medianAsleepMin !== null && sleep.durationClass !== null) {
      const h = Math.floor(sleep.medianAsleepMin / 60);
      const m = Math.round(sleep.medianAsleepMin % 60);
      signals.push({
        label: 'Sleep',
        level: SLEEP_LEVEL[sleep.durationClass],
        detail: `${h} h ${String(m).padStart(2, '0')} min on a usual night over ${sleep.windowDays} days`,
      });
    }
    const level = signals.length === 0 ? null : signals.map((s) => s.level).reduce(worse);
    return { def, level, signals };
  });
}
