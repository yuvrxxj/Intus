import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchLogsSince, type EffectLog } from '../../db/dailyLogs.ts';
import type { Medication as Supplement } from '../../db/medications.ts';
import { fetchBloodwork, type BloodworkData } from '../../db/queries.ts';
import { dayNumber, isoDay } from '../../lib/dates.ts';
import { BEFORE_DAYS, effectReport, type EffectReport } from './effect.ts';

export interface SupplementEffect {
  item: Supplement;
  report: EffectReport;
}

export type EffectsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; effects: SupplementEffect[] };

/** The oldest day any comparison needs, or null when no supplement has a start date to compare from. */
export function earliestNeeded(items: readonly Pick<Supplement, 'start_date'>[]): string | null {
  let earliest: number | null = null;
  for (const item of items) {
    if (item.start_date == null) continue;
    const day = dayNumber(item.start_date) - BEFORE_DAYS;
    if (earliest === null || day < earliest) earliest = day;
  }
  return earliest === null ? null : isoDay(earliest);
}

/**
 * Loads the daily logs and bloodwork a comparison needs, once, and builds a report per supplement. It reads only
 * what the supplements' own start dates call for, and nothing at all while none has a start date.
 */
export function useSupplementEffects(items: readonly Supplement[], today: string): EffectsState & { reload: () => void } {
  const from = useMemo(() => earliestNeeded(items), [items]);
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<{ logs: EffectLog[]; blood: BloodworkData } | { error: string } | null>(null);

  useEffect(() => {
    if (from === null) {
      setLoaded(null);
      return;
    }
    let cancelled = false;
    setLoaded(null);
    Promise.all([fetchLogsSince(from), fetchBloodwork()]).then(
      ([logs, blood]) => !cancelled && setLoaded({ logs, blood }),
      (e: unknown) => !cancelled && setLoaded({ error: e instanceof Error ? e.message : String(e) }),
    );
    return () => {
      cancelled = true;
    };
  }, [from, attempt]);

  const state = useMemo<EffectsState>(() => {
    if (from === null) return { status: 'idle' };
    if (loaded === null) return { status: 'loading' };
    if ('error' in loaded) return { status: 'error', message: loaded.error };
    try {
      const effects = items
        .filter((item) => item.start_date != null)
        .map((item) => ({ item, report: effectReport(item, items, loaded.logs, loaded.blood.biomarkers, loaded.blood.readings, today) }));
      return { status: 'ready', effects };
    } catch (e) {
      return { status: 'error', message: e instanceof Error ? e.message : String(e) };
    }
  }, [from, loaded, items, today]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, reload };
}
