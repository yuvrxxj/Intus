import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { Biomarker, BiomarkerReading } from '../../../src/db/rows.ts';
import { buildBloodworkView, type BloodworkView } from '../../../src/features/bloodwork/model.ts';
import { useAuth } from '../auth/AuthContext';
import { fetchBloodwork, fetchWho, sendReading, type PendingReading } from '../data/bloodwork';
import { flushBucket, queuedIn } from '../data/outbox';
import { outboxStore } from '../data/storage';
import { withWaiting } from './pending';

export const READINGS_BUCKET = 'readings';

export type BloodworkState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      view: BloodworkView;
      biomarkers: Biomarker[];
      /** every result the screen is built from, including any typed here and not sent yet */
      readings: BiomarkerReading[];
      unsentIds: ReadonlySet<string>;
      sendError: string | null;
    };

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Loads the markers and results, sends anything waiting, and builds the screen's view with the web's own rules. A
 * failure to load and a failure to interpret (a result with no marker, a limit that is not a number) both end in the
 * error state, never in a half-drawn screen, so a result that could not be checked is never shown as if it had been.
 */
export function useBloodwork(): BloodworkState & { reload: () => Promise<void> } {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const [state, setState] = useState<BloodworkState>({ status: 'loading' });
  const live = useRef(true);

  const reload = useCallback(async () => {
    if (userId === null) return;
    try {
      const flushed = await flushBucket<PendingReading>(outboxStore, READINGS_BUCKET, userId, sendReading);
      const [data, who, pending] = await Promise.all([fetchBloodwork(), fetchWho(), queuedIn<PendingReading>(outboxStore, READINGS_BUCKET, userId)]);
      const { readings, unsentIds } = withWaiting(data.readings, pending);
      let view: BloodworkView;
      try {
        view = buildBloodworkView({ biomarkers: data.biomarkers, readings, sex: who.sex, pregnant: who.pregnant });
      } catch (e) {
        if (live.current) setState({ status: 'error', message: `Could not check these results safely: ${messageOf(e)}` });
        return;
      }
      if (live.current) setState({ status: 'ready', view, biomarkers: data.biomarkers, readings, unsentIds, sendError: flushed.error });
    } catch (e) {
      if (live.current) setState({ status: 'error', message: messageOf(e) });
    }
  }, [userId]);

  // every time the screen comes back into view, so a result added on a screen above it shows at once
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  useEffect(() => {
    live.current = true;
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void reload();
    });
    return () => {
      live.current = false;
      sub.remove();
    };
  }, [reload]);

  return { ...state, reload };
}
