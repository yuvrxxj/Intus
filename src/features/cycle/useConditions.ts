import { useCallback, useEffect, useState } from 'react';
import { fetchConditions, type Condition } from '../../db/cycle.ts';

/** The person's recorded conditions. A failure to load reads as none, so the screens that only adjust ranges still work. */
export function useConditions(): { conditions: Condition[]; pregnant: boolean; reload: () => void } {
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    fetchConditions().then((c) => live && setConditions(c), () => live && setConditions([]));
    return () => { live = false; };
  }, [attempt]);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { conditions, pregnant: conditions.some((c) => c.condition === 'pregnant'), reload };
}
