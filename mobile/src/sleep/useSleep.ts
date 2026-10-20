import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { ageBand, type AgeBand } from '../../../src/features/sleep/ageBand.ts';
import type { SleepSession } from '../../../src/features/sleep/model.ts';
import { buildNights, type BuildResult } from '../../../src/features/sleep/nights.ts';
import { currentAge } from '../../../src/lib/age.ts';
import { todayKey } from '../../../src/util/dates.ts';
import { useAuth } from '../auth/AuthContext';
import { flushBucket, queuedIn } from '../data/outbox';
import { fetchBirth, fetchSleepSince, sendSleep, type PendingSleep } from '../data/sleep';
import { outboxStore } from '../data/storage';
import { sessionFromValues } from './entry';

/** How far back the screen reads: enough for the 28-night window and a few months of history. */
export const HISTORY_DAYS = 180;
export const SLEEP_BUCKET = 'sleep';

export interface SleepState {
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  /** stored sessions, plus nights typed on this phone and not sent yet */
  sessions: SleepSession[];
  built: BuildResult;
  band: AgeBand | null;
  /** ids of the nights waiting to be sent */
  unsentIds: ReadonlySet<string>;
  sendError: string | null;
  reload: () => Promise<void>;
}

const EMPTY: BuildResult = { nights: [], quarantined: [] };

export function useSleep(): SleepState {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const [state, setState] = useState<Omit<SleepState, 'reload'>>({
    status: 'loading',
    error: null,
    sessions: [],
    built: EMPTY,
    band: null,
    unsentIds: new Set(),
    sendError: null,
  });
  const live = useRef(true);

  const reload = useCallback(async () => {
    if (userId === null) return;
    try {
      // a night typed offline goes first, so the read below sees it
      const flushed = await flushBucket<PendingSleep>(outboxStore, SLEEP_BUCKET, userId, sendSleep);
      const now = Date.now();
      const [stored, birth, pending] = await Promise.all([
        fetchSleepSince(now - HISTORY_DAYS * 86_400_000),
        fetchBirth().catch(() => null),
        queuedIn<PendingSleep>(outboxStore, SLEEP_BUCKET, userId),
      ]);
      const waiting = pending.map((p) => sessionFromValues(p.id, p.values, now));
      const sessions = [...stored, ...waiting];
      const age = birth ? currentAge(birth, todayKey()) : null;
      if (live.current) {
        setState({
          status: 'ready',
          error: null,
          sessions,
          built: buildNights(sessions, { nowMs: now }),
          band: ageBand(age),
          unsentIds: new Set(pending.map((p) => p.id)),
          sendError: flushed.error,
        });
      }
    } catch (e) {
      if (live.current) setState((s) => ({ ...s, status: 'error', error: e instanceof Error ? e.message : String(e) }));
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
