import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchLog, saveLog } from '../../db/dailyLogs.ts';
import type { Habit } from '../../db/habits.ts';
import { todayKey } from '../../util/dates.ts';
import { EMPTY_DRAFT, draftFromLog, recordFromDraft, type TodayDraft } from './draft.ts';

export type { TodayDraft } from './draft.ts';

export interface TodayForm {
  draft: TodayDraft;
  loading: boolean;
  /** set when today's saved entry could not be read; saving then would overwrite it with blanks, so it is blocked */
  loadError: string | null;
  saving: boolean;
  /** true while the form differs from what was loaded or last saved */
  dirty: boolean;
  set: <K extends keyof TodayDraft>(key: K, value: TodayDraft[K]) => void;
  save: () => Promise<void>;
}

/** Today's form lives at the top of the page so the overview tiles can follow it live. */
export function useToday(onSaved: () => void, habits: readonly Habit[]): TodayForm {
  const [draft, setDraft] = useState<TodayDraft>(EMPTY_DRAFT);
  const [saved, setSaved] = useState<TodayDraft>(EMPTY_DRAFT);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchLog(todayKey()).then(
      (log) => {
        if (cancelled) return;
        if (log) {
          const loaded = draftFromLog(log);
          setDraft(loaded);
          setSaved(loaded);
        }
        setLoading(false);
      },
      (e: unknown) => {
        if (cancelled) return;
        setLoadError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const set = useCallback(<K extends keyof TodayDraft>(key: K, value: TodayDraft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await saveLog(recordFromDraft(draft, todayKey(), new Date().toISOString(), habits));
      setSaved(draft);
      onSaved();
    } finally {
      setSaving(false);
    }
  }, [draft, onSaved, habits]);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);

  return { draft, loading, loadError, saving, dirty, set, save };
}
