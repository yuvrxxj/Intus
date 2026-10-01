import { useCallback, useEffect, useState } from 'react';
import { fetchMedications, type Medication } from '../../db/medications.ts';

export interface MedicationsState {
  meds: Medication[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useMedications(): MedicationsState {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ meds: Medication[]; loading: boolean; error: string | null }>({
    meds: [], loading: true, error: null,
  });
  useEffect(() => {
    let cancelled = false;
    fetchMedications().then(
      (meds) => !cancelled && setState({ meds, loading: false, error: null }),
      (e: unknown) => !cancelled && setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : String(e) })),
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, reload };
}
