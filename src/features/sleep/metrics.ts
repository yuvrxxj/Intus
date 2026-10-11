// The numbers worked out from one session, each with the rule that produced it. Nothing here is a score.
import type { SleepSession, Stage, StageSegment } from './model.ts';
import { MINUTE_MS, minutesIntoDay } from './time.ts';

export const isAsleep = (stage: Stage): boolean => stage !== 'awake';

// when two segments claim the same minute, the more specific one wins: a named stage beats awake beats "asleep"
const SPECIFICITY: Record<Stage, number> = { deep: 3, rem: 3, light: 3, awake: 2, asleep: 1 };

/**
 * One source's stage timeline made consistent: clipped to the session, overlaps resolved (the more specific stage
 * wins, a later segment wins a tie), neighbours of the same stage joined. Time no segment covers stays uncovered:
 * it is unknown, not awake.
 */
export function resolveStages(session: Pick<SleepSession, 'start' | 'end' | 'stages'>): StageSegment[] {
  const clipped = session.stages
    .map((g) => ({ s: Math.max(g.s, session.start), e: Math.min(g.e, session.end), t: g.t }))
    .filter((g) => g.e > g.s);
  if (clipped.length === 0) return [];
  const edges = [...new Set(clipped.flatMap((g) => [g.s, g.e]))].sort((a, b) => a - b);
  const out: StageSegment[] = [];
  for (let i = 0; i < edges.length - 1; i += 1) {
    const s = edges[i];
    const e = edges[i + 1];
    let stage: Stage | null = null;
    let rank = -1;
    for (const g of clipped) {
      // a later segment wins a tie, so iterating in order and using >= lets it overwrite
      if (g.s <= s && g.e >= e && SPECIFICITY[g.t] >= rank) { stage = g.t; rank = SPECIFICITY[g.t]; }
    }
    if (stage === null) continue;
    const last = out[out.length - 1];
    if (last && last.e === s && last.t === stage) last.e = e;
    else out.push({ s, e, t: stage });
  }
  return out;
}

export type Basis = 'stages' | 'diary' | 'bed_to_wake';

export interface StageMinutes {
  light: number;
  deep: number;
  rem: number;
  unspecified: number;
  awake: number;
}

export interface SessionMetrics {
  /** where the numbers come from: a device's stages, the person's own estimates, or only bed and wake times */
  basis: Basis;
  /** in bed to out of bed (or, for a device with no in-bed time, first to last record) */
  tibMin: number;
  /** from falling asleep to the final awakening */
  sptMin: number;
  /** time asleep. With only bed and wake times it equals the sleep period and cannot be separated from it */
  tstMin: number;
  wasoMin: number | null;
  latencyMin: number | null;
  /** awake episodes longer than 5 minutes (the National Sleep Foundation definition); needs stages */
  awakeningsOver5: number | null;
  /** 100 * asleep / in bed; null when it would mean nothing */
  efficiency: number | null;
  /** only when the source named light, deep or REM; always an estimate */
  stageMinutes: StageMinutes | null;
  /** clock times in minutes into the day, on the wall clock where the person was */
  asleepClock: number;
  wakeClock: number;
  midpointClock: number;
  /** start and end were in different offsets and no zone name resolves it, so the midpoint clock time is approximate */
  tzUncertain: boolean;
}

const minutes = (ms: number): number => ms / MINUTE_MS;

export function sessionMetrics(s: SleepSession): SessionMetrics {
  const timeline = resolveStages(s);
  const asleepSegments = timeline.filter((g) => isAsleep(g.t));
  const tzUncertain = s.startOffsetMin !== s.endOffsetMin && s.tzId === null;
  const tib = minutes(s.end - s.start);

  let basis: Basis;
  let onset: number;
  let finalWake: number;
  let tst: number;
  let waso: number | null;
  let latency: number | null;
  let awakenings: number | null = null;
  let stageMinutes: StageMinutes | null = null;

  if (asleepSegments.length > 0) {
    basis = 'stages';
    onset = asleepSegments[0].s;
    finalWake = asleepSegments[asleepSegments.length - 1].e;
    tst = minutes(asleepSegments.reduce((a, g) => a + (g.e - g.s), 0));
    const awakeSegments = timeline.filter((g) => g.t === 'awake' && g.s >= onset && g.e <= finalWake);
    waso = minutes(awakeSegments.reduce((a, g) => a + (g.e - g.s), 0));
    awakenings = awakeSegments.filter((g) => minutes(g.e - g.s) > 5).length;
    latency = s.latencyMin;
    const sum = (stage: Stage) => minutes(timeline.filter((g) => g.t === stage).reduce((a, g) => a + (g.e - g.s), 0));
    if (timeline.some((g) => g.t === 'light' || g.t === 'deep' || g.t === 'rem')) {
      stageMinutes = { light: sum('light'), deep: sum('deep'), rem: sum('rem'), unspecified: sum('asleep'), awake: waso };
    }
  } else {
    latency = s.latencyMin;
    onset = s.start + (latency ?? 0) * MINUTE_MS;
    finalWake = s.end;
    waso = s.awakeMin;
    tst = minutes(finalWake - onset) - (waso ?? 0);
    basis = latency !== null || waso !== null ? 'diary' : 'bed_to_wake';
  }

  const spt = minutes(finalWake - onset);
  const efficiency = s.startIsInBed && basis !== 'bed_to_wake' && tib > 0 ? Math.min(100, (100 * tst) / tib) : null;
  const mid = (onset + finalWake) / 2;
  return {
    basis,
    tibMin: tib,
    sptMin: spt,
    tstMin: tst,
    wasoMin: waso,
    latencyMin: latency,
    awakeningsOver5: awakenings,
    efficiency,
    stageMinutes,
    asleepClock: minutesIntoDay(onset, s.startOffsetMin),
    wakeClock: minutesIntoDay(finalWake, s.endOffsetMin),
    midpointClock: minutesIntoDay(mid, s.endOffsetMin),
    tzUncertain,
  };
}
