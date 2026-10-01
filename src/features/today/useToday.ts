import { useCallback, useEffect, useState } from 'react';
import { fetchLog, saveLog } from '../../db/dailyLogs.ts';
import { todayKey } from '../../util/dates.ts';
import { EMPTY_DRAFT, draftFromLog, recordFromDraft, type TodayDraft } from './draft.ts';

export type { TodayDraft, Toggle } from './draft.ts';

export interface TodayForm {
  draft: TodayDraft;
  loading: boolean;
  /** set when today's saved entry could not be read; saving then would overwrite it with blanks, so it is blocked */
  loadError: string | null;
  saving: boolean;
  set: <K extends keyof TodayDraft>(key: K, value: TodayDraft[K]) => void;
  save: () => Promise<void>;
}

/** Today's form lives above the tabs so the header stats can follow it live and switching tabs keeps what was typed. */
export function useToday(onSaved: () => void): TodayForm {
  const [draft, setDraft] = useState<TodayDraft>(EMPTY_DRAFT);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchLog(todayKey()).then(
      (log) => {
        if (cancelled) return;
        if (log) setDraft(draftFromLog(log));
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
      await saveLog(recordFromDraft(draft, todayKey(), new Date().toISOString()));
      onSaved();
    } finally {
      setSaving(false);
    }
  }, [draft, onSaved]);

  return { draft, loading, loadError, saving, set, save };
}
