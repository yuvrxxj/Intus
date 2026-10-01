import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchBloodwork, type BloodworkData } from '../../db/queries.ts';
import { buildBloodworkView, type BloodworkView } from './model.ts';

export type BloodworkState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; view: BloodworkView; data: BloodworkData };

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Loads the three tables and turns them into the screen's view. A failure to load and a failure to interpret
 * (a reading with no biomarker, a threshold that is not a number) both end in the error state, never in a
 * half-drawn screen, so a result that could not be checked is never shown as if it had been.
 */
export function useBloodwork(): BloodworkState & { reload: () => void } {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<{ data: BloodworkData } | { error: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoaded(null);
    fetchBloodwork().then(
      (data) => !cancelled && setLoaded({ data }),
      (error: unknown) => !cancelled && setLoaded({ error: messageOf(error) }),
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const state = useMemo<BloodworkState>(() => {
    if (loaded === null) return { status: 'loading' };
    if ('error' in loaded) return { status: 'error', message: loaded.error };
    try {
      return { status: 'ready', view: buildBloodworkView(loaded.data), data: loaded.data };
    } catch (error) {
      return { status: 'error', message: `Could not check these results safely: ${messageOf(error)}` };
    }
  }, [loaded]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, reload };
}
