// From what several sources reported to one list of nights, each number coming from exactly one source.
//
// The rules (see docs/product/sleep/research-metrics.md, sections 3 and 4):
//   1. Sessions that cannot be right are set aside and reported, never silently dropped.
//   2. The same record sent twice is one record.
//   3. Within one source, sessions closer than 60 minutes are one sleep with a wake in the middle.
//   4. Sessions from different sources that overlap by half or more describe the same sleep. They are never added,
//      averaged or blended: one source is chosen, by a visible rule, and the others are listed beside it.
//   5. The chosen sleep is filed under the date the person woke. The longest sleep that day is the main one; the rest are
//      naps (up to 3 hours asleep) or second sleeps.
import { sessionMetrics, type SessionMetrics } from './metrics.ts';
import { sessionProblem, type SleepSession } from './model.ts';
import { MINUTE_MS, nightKey } from './time.ts';

export interface NightsConfig {
  nowMs: number;
  /** two sessions of one source closer than this are one sleep */
  mergeGapMin: number;
  /** a higher-priority automatic source that recorded under this share of the best candidate loses the night */
  coverageFloor: number;
  /** sessions overlapping by at least this share of the shorter one describe the same sleep */
  overlapEdge: number;
  /** sources whose time asleep differs by this much are flagged */
  disagreeMin: number;
  /** the hour at which the sleep day rolls over; 24 is midnight */
  cutoffHour: number;
  /** an additional sleep with this much asleep time or less is a nap */
  napMaxAsleepMin: number;
  /** source ids in the person's order, first wins; sources not listed rank by tier */
  sourceOrder?: readonly string[];
}

export const DEFAULTS = {
  mergeGapMin: 60,
  coverageFloor: 0.5,
  overlapEdge: 0.5,
  disagreeMin: 60,
  cutoffHour: 24,
  napMaxAsleepMin: 180,
} as const;

export const sourceId = (s: Pick<SleepSession, 'sourceKind' | 'sourceName'>): string => `${s.sourceKind}:${s.sourceName ?? ''}`;

/** A sleep as one source reported it, after neighbours were joined. `members` are the stored rows it was made from. */
export interface Resolved extends SleepSession {
  members: string[];
}

export interface Alternative {
  sourceId: string;
  sourceName: string | null;
  sourceKind: SleepSession['sourceKind'];
  tstMin: number;
  reason: 'lower_priority' | 'below_coverage_floor';
}

export type Flag = 'sources_disagree' | 'possible_tz_error' | 'short_main' | 'tz_uncertain';

export interface Sleep {
  session: Resolved;
  metrics: SessionMetrics;
  alternatives: Alternative[];
  flags: Flag[];
}

export interface Night {
  /** the date the person woke up, 'YYYY-MM-DD' */
  key: string;
  main: Sleep;
  additional: (Sleep & { kind: 'nap' | 'second' })[];
  /** main plus every nap and second sleep, for children under 6 whose range counts naps */
  totalAsleep24Min: number;
}

export interface Quarantined {
  session: SleepSession;
  reason: string;
}

/** A source that named light, deep or REM sleep, not one that only said "asleep". */
const hasNamedStages = (s: SleepSession): boolean => s.stages.some((g) => g.t === 'light' || g.t === 'deep' || g.t === 'rem');

function tierOf(s: SleepSession): number {
  if (s.sourceKind === 'manual') return 0;
  return hasNamedStages(s) ? 1 : 2;
}

/** Lower wins. A saved order beats tiers; a source new to the person goes below the ones they have already ordered. */
export function rankOf(s: SleepSession, order: readonly string[] | undefined): number {
  const listed = order ? order.indexOf(sourceId(s)) : -1;
  return listed >= 0 ? listed : 1000 + tierOf(s);
}

function dedupe(sessions: SleepSession[]): SleepSession[] {
  const byKey = new Map<string, SleepSession>();
  for (const s of sessions) {
    // a hand-entered night is its own record; only imports can arrive twice
    const key = s.sourceKind === 'manual'
      ? `id:${s.id}`
      : s.externalId !== null
        ? `ext:${s.sourceKind}:${s.sourceName ?? ''}:${s.externalId}`
        : `fp:${sourceId(s)}:${Math.floor(s.start / MINUTE_MS)}:${Math.floor(s.end / MINUTE_MS)}`;
    const kept = byKey.get(key);
    // the newer write wins; if two are equally new the larger id does, so the result never depends on input order
    if (!kept || s.recordedAt > kept.recordedAt || (s.recordedAt === kept.recordedAt && s.id > kept.id)) byKey.set(key, s);
  }
  return [...byKey.values()];
}

function join(a: Resolved, b: Resolved): Resolved {
  const gapMin = (b.start - a.end) / MINUTE_MS;
  const stages = a.stages.length > 0 || b.stages.length > 0
    ? [...a.stages, ...(gapMin > 0 ? [{ s: a.end, e: b.start, t: 'awake' as const }] : []), ...b.stages]
    : [];
  const awake = a.awakeMin !== null || b.awakeMin !== null || gapMin > 0
    ? (a.awakeMin ?? 0) + (b.awakeMin ?? 0) + Math.max(0, Math.round(gapMin))
    : null;
  return {
    ...a,
    end: Math.max(a.end, b.end),
    endOffsetMin: b.end >= a.end ? b.endOffsetMin : a.endOffsetMin,
    stages,
    // with stages the gap is an explicit awake segment; without them the person's total absorbs it
    awakeMin: stages.length > 0 ? null : awake,
    recordedAt: Math.max(a.recordedAt, b.recordedAt),
    members: [...a.members, ...b.members],
  };
}

function joinWithinSources(sessions: SleepSession[], gapMin: number): Resolved[] {
  const out: Resolved[] = [];
  const groups = new Map<string, Resolved[]>();
  for (const s of sessions) {
    const list = groups.get(sourceId(s)) ?? [];
    list.push({ ...s, members: [s.id] });
    groups.set(sourceId(s), list);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
    let current = list[0];
    for (const next of list.slice(1)) {
      if ((next.start - current.end) / MINUTE_MS <= gapMin) current = join(current, next);
      else { out.push(current); current = next; }
    }
    out.push(current);
  }
  return out;
}

const overlapMin = (a: SleepSession, b: SleepSession): number => Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start)) / MINUTE_MS;
const durationMin = (s: SleepSession): number => (s.end - s.start) / MINUTE_MS;

function clusterSources(sessions: Resolved[], edge: number): Resolved[][] {
  const parent = sessions.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < sessions.length; i += 1) {
    for (let j = i + 1; j < sessions.length; j += 1) {
      if (sourceId(sessions[i]) === sourceId(sessions[j])) continue;
      if (overlapMin(sessions[i], sessions[j]) >= edge * Math.min(durationMin(sessions[i]), durationMin(sessions[j]))) parent[find(i)] = find(j);
    }
  }
  const groups = new Map<number, Resolved[]>();
  sessions.forEach((s, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), s]));
  return [...groups.values()];
}

function choose(cluster: Resolved[], cfg: NightsConfig): Sleep {
  // one candidate per source: its longest sleep in this cluster
  const perSource = new Map<string, { s: Resolved; m: SessionMetrics }>();
  for (const s of cluster) {
    const m = sessionMetrics(s);
    const have = perSource.get(sourceId(s));
    if (!have || m.tstMin > have.m.tstMin || (m.tstMin === have.m.tstMin && s.id < have.s.id)) perSource.set(sourceId(s), { s, m });
  }
  const candidates = [...perSource.values()];
  const best = Math.max(...candidates.map((c) => c.m.tstMin));
  const eligible = (c: { s: Resolved; m: SessionMetrics }) => c.s.sourceKind === 'manual' || c.m.tstMin >= cfg.coverageFloor * best;
  const hasStages = (c: { s: Resolved; m: SessionMetrics }) => (hasNamedStages(c.s) ? 0 : 1);
  const ordered = candidates.filter(eligible).sort((a, b) =>
    rankOf(a.s, cfg.sourceOrder) - rankOf(b.s, cfg.sourceOrder)
    || hasStages(a) - hasStages(b)
    || b.m.tstMin - a.m.tstMin
    || b.s.recordedAt - a.s.recordedAt
    || sourceId(a.s).localeCompare(sourceId(b.s)));
  const win = ordered[0];

  const alternatives: Alternative[] = candidates.filter((c) => c !== win)
    .sort((a, b) => rankOf(a.s, cfg.sourceOrder) - rankOf(b.s, cfg.sourceOrder) || sourceId(a.s).localeCompare(sourceId(b.s)))
    .map((c) => ({
      sourceId: sourceId(c.s), sourceName: c.s.sourceName, sourceKind: c.s.sourceKind, tstMin: c.m.tstMin,
      reason: eligible(c) ? 'lower_priority' : 'below_coverage_floor',
    }));

  const flags: Flag[] = [];
  if (candidates.some((c) => c !== win && Math.abs(c.m.tstMin - win.m.tstMin) >= cfg.disagreeMin)) flags.push('sources_disagree');
  // the same sleep an exact number of hours apart is almost always one source with the wrong time zone
  if (candidates.some((c) => {
    if (c === win) return false;
    const shiftH = (c.s.start - win.s.start) / 3_600_000;
    return Math.abs(durationMin(c.s) - durationMin(win.s)) <= 10 && Math.abs(Math.abs(shiftH) - Math.round(Math.abs(shiftH))) < 1 / 6 && Math.round(Math.abs(shiftH)) >= 1 && Math.round(Math.abs(shiftH)) <= 14;
  })) flags.push('possible_tz_error');
  if (win.m.tstMin < 180) flags.push('short_main');
  if (win.m.tzUncertain) flags.push('tz_uncertain');
  return { session: win.s, metrics: win.m, alternatives, flags };
}

export interface BuildResult {
  nights: Night[];
  quarantined: Quarantined[];
}

/** Newest night first. */
export function buildNights(sessions: readonly SleepSession[], config: Partial<NightsConfig> & { nowMs: number }): BuildResult {
  const cfg: NightsConfig = { ...DEFAULTS, ...config };
  const quarantined: Quarantined[] = [];
  const usable: SleepSession[] = [];
  for (const s of sessions) {
    const reason = sessionProblem(s, cfg.nowMs);
    if (reason) quarantined.push({ session: s, reason }); else usable.push(s);
  }

  const resolved = joinWithinSources(dedupe(usable), cfg.mergeGapMin);
  // joining can make a session longer than a day or one that crosses into the future; set those aside too
  const sound: Resolved[] = [];
  for (const r of resolved) {
    const reason = sessionProblem(r, cfg.nowMs);
    if (reason) quarantined.push({ session: r, reason: `${reason} once its neighbours were joined` }); else sound.push(r);
  }

  sound.sort((a, b) => a.start - b.start || a.end - b.end || a.id.localeCompare(b.id));
  const events = clusterSources(sound, cfg.overlapEdge).map((cluster) => choose(cluster, cfg));

  const byKey = new Map<string, Sleep[]>();
  for (const e of events) {
    const key = nightKey(e.session.end, e.session.endOffsetMin, cfg.cutoffHour);
    byKey.set(key, [...(byKey.get(key) ?? []), e]);
  }
  const nights: Night[] = [];
  for (const [key, list] of byKey) {
    const sorted = [...list].sort((a, b) =>
      b.metrics.tstMin - a.metrics.tstMin || b.session.end - a.session.end
      || rankOf(a.session, cfg.sourceOrder) - rankOf(b.session, cfg.sourceOrder) || a.session.id.localeCompare(b.session.id));
    const [main, ...rest] = sorted;
    nights.push({
      key,
      main,
      additional: rest.map((r) => ({ ...r, kind: r.metrics.tstMin <= cfg.napMaxAsleepMin ? 'nap' as const : 'second' as const })),
      totalAsleep24Min: sorted.reduce((a, e) => a + e.metrics.tstMin, 0),
    });
  }
  nights.sort((a, b) => b.key.localeCompare(a.key));
  quarantined.sort((a, b) => a.session.start - b.session.start);
  return { nights, quarantined };
}
