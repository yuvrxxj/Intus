import * as Haptics from 'expo-haptics';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import type { DailyLog, Habit, Medication } from '../../../src/db/rows.ts';
import { activeHabits, type HabitEntry } from '../../../src/features/habits/model.ts';
import { EMPTY_DRAFT, draftFromLog, recordFromDraft, type TodayDraft } from '../../../src/features/today/draft.ts';
import { todayKey } from '../../../src/util/dates.ts';
import { useAuth } from '../auth/AuthContext';
import { fetchLog, fetchRecentLogs, saveLog } from '../data/dailyLogs';
import { fetchHabits } from '../data/habits';
import { fetchMedications } from '../data/medications';
import { flushLogs, pendingFor, queueLog } from '../data/outbox';
import { outboxStore } from '../data/storage';

const STREAK_DAYS = 120;

interface Today {
  date: string;
  draft: TodayDraft;
  habits: Habit[];
  medications: Medication[];
  /** recent saved days, newest first, for the streaks */
  recent: DailyLog[];
  loading: boolean;
  /** set when today's saved entry could not be read; saving then would overwrite it with blanks, so it is blocked */
  loadError: string | null;
  saving: boolean;
  /** true while the form differs from what was loaded or last saved */
  dirty: boolean;
  /** an entry is saved on the phone and has not reached the server yet */
  unsent: boolean;
  /** why the last send failed, for the line under "not sent yet" */
  sendError: string | null;
  set: <K extends keyof TodayDraft>(key: K, value: TodayDraft[K]) => void;
  setHabit: (id: string, entry: HabitEntry | null) => void;
  setSupplement: (key: string, taken: boolean) => void;
  save: () => Promise<void>;
  reload: () => Promise<void>;
}

const TodayContext = createContext<Today | null>(null);

export function TodayProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const [date, setDate] = useState(todayKey());
  const [draft, setDraft] = useState<TodayDraft>(EMPTY_DRAFT);
  const [saved, setSaved] = useState<TodayDraft>(EMPTY_DRAFT);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [recent, setRecent] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [unsent, setUnsent] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  /** Sends whatever is queued. Returns whether the queue is empty afterwards. */
  const flush = useCallback(async (): Promise<boolean> => {
    if (userId === null) return true;
    const result = await flushLogs(outboxStore, userId, saveLog);
    setUnsent(result.failed > 0);
    setSendError(result.error);
    return result.failed === 0;
  }, [userId]);

  const reload = useCallback(async () => {
    if (userId === null) return;
    const day = todayKey();
    setDate(day);
    setLoading(true);
    setLoadError(null);
    // a failed send from an earlier launch goes first, so the read below sees it
    await flush();
    const [pending, logResult, habitsResult, medsResult, recentResult] = await Promise.all([
      pendingFor(outboxStore, userId, day),
      fetchLog(day).then((log) => ({ log }), (e: unknown) => ({ error: e instanceof Error ? e.message : String(e) })),
      fetchHabits().catch(() => null),
      fetchMedications().catch(() => null),
      fetchRecentLogs(STREAK_DAYS).catch(() => null),
    ]);
    if (habitsResult) setHabits(habitsResult);
    if (medsResult) setMedications(medsResult);
    if (recentResult) setRecent(recentResult);
    if (pending) {
      // typed on this phone and not sent: it is newer than anything the server holds
      setDraft(pending.draft);
      setSaved(EMPTY_DRAFT);
      setUnsent(true);
    } else if ('log' in logResult) {
      const loaded = logResult.log ? draftFromLog(logResult.log) : EMPTY_DRAFT;
      setDraft(loaded);
      setSaved(loaded);
    } else {
      setLoadError(logResult.error);
    }
    setLoading(false);
  }, [userId, flush]);

  useEffect(() => {
    if (userId === null) {
      setDraft(EMPTY_DRAFT);
      setSaved(EMPTY_DRAFT);
      setHabits([]);
      setMedications([]);
      setRecent([]);
      setUnsent(false);
      setLoading(true);
      return;
    }
    void reload();
  }, [userId, reload]);

  // coming back to the app: a new day starts fresh, and anything unsent is tried again
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || userId === null) return;
      if (todayKey() !== date) void reload();
      else void flush();
    });
    return () => sub.remove();
  }, [userId, date, reload, flush]);

  const set = useCallback(<K extends keyof TodayDraft>(key: K, value: TodayDraft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  const setHabit = useCallback((id: string, entry: HabitEntry | null) => {
    setDraft((prev) => {
      const next = { ...prev.habits };
      if (entry === null) delete next[id];
      else next[id] = entry;
      return { ...prev, habits: next };
    });
  }, []);

  const setSupplement = useCallback((key: string, taken: boolean) => {
    setDraft((prev) => ({ ...prev, supplements: { ...prev.supplements, [key]: taken } }));
  }, []);

  const save = useCallback(async () => {
    if (userId === null || loadError !== null) return;
    setSaving(true);
    try {
      const current = draftRef.current;
      const queuedAt = new Date().toISOString();
      const record = recordFromDraft(current, date, queuedAt, activeHabits(habits));
      // on the phone first, so a closed app or a lost connection never loses the entry
      await queueLog(outboxStore, userId, { date, draft: current, record, queuedAt });
      setUnsent(true);
      if (await flush()) {
        setSaved(current);
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        void fetchRecentLogs(STREAK_DAYS).then(setRecent, () => undefined);
      }
    } finally {
      setSaving(false);
    }
  }, [userId, loadError, date, habits, flush]);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);

  const value = useMemo<Today>(
    () => ({ date, draft, habits, medications, recent, loading, loadError, saving, dirty, unsent, sendError, set, setHabit, setSupplement, save, reload }),
    [date, draft, habits, medications, recent, loading, loadError, saving, dirty, unsent, sendError, set, setHabit, setSupplement, save, reload],
  );
  return <TodayContext.Provider value={value}>{children}</TodayContext.Provider>;
}

export function useToday(): Today {
  const value = useContext(TodayContext);
  if (value === null) throw new Error('useToday must be used inside TodayProvider');
  return value;
}
