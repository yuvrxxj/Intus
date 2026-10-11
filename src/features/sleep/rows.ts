// Stored rows to the sessions the rest of the code works with. Pure: no network, no clock.
import type { Row } from '../../db/types.ts';
import { SOURCE_KINDS, STAGES, type SleepSession, type SourceKind, type Stage, type StageSegment } from './model.ts';

/** Reads a stored stage list, keeping only well-formed segments. A bad one is dropped, the session is kept. */
export function parseStages(value: unknown): StageSegment[] {
  if (!Array.isArray(value)) return [];
  const out: StageSegment[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null) continue;
    const { s, e, t } = item as { s?: unknown; e?: unknown; t?: unknown };
    if (typeof s !== 'number' || typeof e !== 'number' || !Number.isFinite(s) || !Number.isFinite(e) || e <= s) continue;
    if (typeof t !== 'string' || !(STAGES as readonly string[]).includes(t)) continue;
    out.push({ s, e, t: t as Stage });
  }
  return out;
}

export function sessionFromRow(row: Row<'sleep_sessions'>): SleepSession {
  const kind = (SOURCE_KINDS as readonly string[]).includes(row.source_kind) ? (row.source_kind as SourceKind) : 'other';
  return {
    id: row.id,
    sourceKind: kind,
    sourceName: row.source_name === '' ? null : row.source_name,
    externalId: row.external_id,
    start: Date.parse(row.start_at),
    end: Date.parse(row.end_at),
    startOffsetMin: row.start_offset_min,
    endOffsetMin: row.end_offset_min,
    tzId: row.tz_id,
    latencyMin: row.latency_min,
    awakeMin: row.awake_min,
    stages: parseStages(row.stages),
    startIsInBed: row.start_is_in_bed,
    notes: row.notes,
    recordedAt: Date.parse(row.recorded_at),
  };
}
