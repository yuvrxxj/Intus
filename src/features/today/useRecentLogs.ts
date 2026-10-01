import { useCallback, useEffect, useState } from 'react';
import { fetchRecentLogs, type DailyLog } from '../../db/dailyLogs.ts';

/** One read of the newest 40 entries feeds the header stats, the charts and the history table. */
export function useRecentLogs(limit = 40): { logs: DailyLog[]; loading: boolean; error: string | null; reload: () => void } {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ logs: DailyLog[]; loading: boolean; error: string | null }>({
    logs: [], loading: true, error: null,
  });

  useEffect(() => {
    let cancelled = false;
    fetchRecentLogs(limit).then(
      (logs) => !cancelled && setState({ logs, loading: false, error: null }),
      (e: unknown) => !cancelled && setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : String(e) })),
    );
    return () => {
      cancelled = true;
    };
  }, [limit, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, reload };
}
