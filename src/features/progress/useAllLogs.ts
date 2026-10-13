import { useEffect, useState } from 'react';
import { fetchLogsSince, type EffectLog } from '../../db/dailyLogs.ts';

/**
 * Every daily log the person has, oldest first, read once when the Progress page opens (paged, so a long history is
 * never cut short). It feeds the habit streaks and the dive deeper on each chart.
 */
export function useAllLogs(): { logs: EffectLog[]; loading: boolean; error: string | null } {
  const [state, setState] = useState<{ logs: EffectLog[]; loading: boolean; error: string | null }>({ logs: [], loading: true, error: null });
  useEffect(() => {
    let live = true;
    fetchLogsSince('1990-01-01').then(
      (logs) => live && setState({ logs, loading: false, error: null }),
      (e: unknown) => live && setState({ logs: [], loading: false, error: e instanceof Error ? e.message : String(e) }),
    );
    return () => { live = false; };
  }, []);
  return state;
}
