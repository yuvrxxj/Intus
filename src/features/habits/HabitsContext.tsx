import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fetchHabits, type Habit } from '../../db/habits.ts';
import { activeHabits } from './model.ts';

export interface HabitsState {
  status: 'loading' | 'ready' | 'error';
  /** every habit the person has made, archived ones included */
  habits: Habit[];
  /** the ones shown on Today and counted */
  active: Habit[];
  error: string | null;
  reload: () => void;
}

const HabitsContext = createContext<HabitsState | null>(null);

/** Loads the person's habits once and shares them with Today, the header, History, Progress and the habit editor. */
export function HabitsProvider({ children }: { children: ReactNode }) {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<{ habits: Habit[] } | { error: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchHabits().then(
      (habits) => !cancelled && setLoaded({ habits }),
      (e: unknown) => !cancelled && setLoaded({ error: e instanceof Error ? e.message : String(e) }),
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  const value = useMemo<HabitsState>(() => {
    if (loaded === null) return { status: 'loading', habits: [], active: [], error: null, reload };
    if ('error' in loaded) return { status: 'error', habits: [], active: [], error: loaded.error, reload };
    return { status: 'ready', habits: loaded.habits, active: activeHabits(loaded.habits), error: null, reload };
  }, [loaded, reload]);

  return <HabitsContext.Provider value={value}>{children}</HabitsContext.Provider>;
}

export function useHabits(): HabitsState {
  const value = useContext(HabitsContext);
  if (!value) throw new Error('useHabits must be used inside HabitsProvider');
  return value;
}
