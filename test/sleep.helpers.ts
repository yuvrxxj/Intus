import type { SleepSession, SourceKind, StageSegment, Stage } from '../src/features/sleep/model.ts';

/** '2026-10-08 23:10' read as UTC (offset 0) unless a minutes-east offset is given, in epoch ms. */
export const at = (text: string, offsetMin = 0): number => Date.parse(`${text.replace(' ', 'T')}:00Z`) - offsetMin * 60_000;

let counter = 0;

/** What a test can say about a session: any field, plus times as 'YYYY-MM-DD HH:MM' in an offset. */
export type Over = Partial<SleepSession> & { from?: string; to?: string; offset?: number };

/** A session with sensible defaults: an 8 hour night entered by hand. */
export function session(over: Over = {}): SleepSession {
  const { from = '2026-10-08 23:00', to = '2026-10-09 07:00', offset = 0, ...rest } = over;
  counter += 1;
  return {
    id: `s${counter}`,
    sourceKind: 'manual' as SourceKind,
    sourceName: null,
    externalId: null,
    start: at(from, offset),
    end: at(to, offset),
    startOffsetMin: offset,
    endOffsetMin: offset,
    tzId: null,
    latencyMin: null,
    awakeMin: null,
    stages: [],
    startIsInBed: true,
    notes: null,
    recordedAt: at('2026-10-10 08:00'),
    ...rest,
  };
}

export const seg = (from: string, to: string, t: Stage, offset = 0): StageSegment => ({ s: at(from, offset), e: at(to, offset), t });

export const NOW = at('2026-10-12 12:00');
