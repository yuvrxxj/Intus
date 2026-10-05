import { useCallback, useEffect, useState } from 'react';
import { fetchMedications, type Medication as Supplement } from '../../db/medications.ts';

export interface SupplementsState {
  items: Supplement[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useSupplements(): SupplementsState {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ items: Supplement[]; loading: boolean; error: string | null }>({
    items: [], loading: true, error: null,
  });
  useEffect(() => {
    let cancelled = false;
    fetchMedications().then(
      (items) => !cancelled && setState({ items, loading: false, error: null }),
      (e: unknown) => !cancelled && setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : String(e) })),
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, reload };
}
