import type { BiomarkerReading, ReadingInput } from '../../../src/db/rows.ts';

/** A result typed on the phone and not yet sent. The id is made on the phone. */
export interface WaitingReading {
  id: string;
  input: ReadingInput;
  queuedAt: string;
}

/** A waiting result shaped like a stored row, so it is range-checked and critical-checked exactly like any other. */
export function asReading(p: WaitingReading): BiomarkerReading {
  return {
    id: p.id,
    user_id: '',
    created_at: p.queuedAt,
    biomarker_id: p.input.biomarker_id,
    measured_at: p.input.measured_at,
    value: p.input.value,
    source: p.input.source,
    notes: p.input.notes ?? null,
    ref_low: p.input.ref_low ?? null,
    ref_high: p.input.ref_high ?? null,
  } as BiomarkerReading;
}

/**
 * Stored results plus the ones still waiting, each once: a result that was sent between the two reads is already
 * stored, so the waiting copy is dropped rather than shown twice.
 */
export function withWaiting(stored: readonly BiomarkerReading[], waiting: readonly WaitingReading[]): { readings: BiomarkerReading[]; unsentIds: Set<string> } {
  const storedIds = new Set(stored.map((r) => r.id));
  const still = waiting.filter((w) => !storedIds.has(w.id));
  return { readings: [...stored, ...still.map(asReading)], unsentIds: new Set(still.map((w) => w.id)) };
}
