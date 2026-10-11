import { useCallback, useEffect, useState } from 'react';
import { fetchSleepSince } from '../../db/sleep.ts';
import type { SleepSession } from './model.ts';
import { buildNights, type BuildResult } from './nights.ts';

/** How far back the screen reads. Enough for the 28-night windows and a few months of chart. */
export const HISTORY_DAYS = 180;

export interface SleepState {
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  sessions: SleepSession[];
  built: BuildResult;
  reload: () => void;
}

const EMPTY: BuildResult = { nights: [], quarantined: [] };

export function useSleep(): SleepState {
  const [state, setState] = useState<Omit<SleepState, 'reload'>>({ status: 'loading', error: null, sessions: [], built: EMPTY });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const now = Date.now();
        const sessions = await fetchSleepSince(now - HISTORY_DAYS * 86_400_000);
        if (live) setState({ status: 'ready', error: null, sessions, built: buildNights(sessions, { nowMs: now }) });
      } catch (e) {
        if (live) setState((s) => ({ ...s, status: 'error', error: e instanceof Error ? e.message : String(e) }));
      }
    })();
    return () => { live = false; };
  }, [tick]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { ...state, reload };
}
