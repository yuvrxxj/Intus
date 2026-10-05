import { useCallback, useEffect, useState } from 'react';
import { fetchProfile, type Profile } from '../../db/profile.ts';
import { fetchScreening, type ScreeningHistoryRow, type ScreeningRuleRow } from '../../db/screening.ts';

export type ScreeningState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; profile: Profile | null; rules: ScreeningRuleRow[]; history: ScreeningHistoryRow[] };

export function useScreening(): ScreeningState & { reload: () => void } {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<ScreeningState>({ status: 'loading' });
  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchProfile(), fetchScreening()]).then(
      ([profile, { rules, history }]) => !cancelled && setState({ status: 'ready', profile, rules, history }),
      (e: unknown) => !cancelled && setState({ status: 'error', message: e instanceof Error ? e.message : String(e) }),
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, reload };
}
