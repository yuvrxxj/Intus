import { useCallback, useEffect, useState } from 'react';
import { fetchCheckIns, signedLinks } from '../../db/photos.ts';
import { newestFirst, type CheckIn } from './model.ts';

export interface PhotoState {
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  /** every row, newest first, including old rows that never had a picture */
  entries: CheckIn[];
  /** signed link for each picture, by its path */
  links: Map<string, string>;
  reload: () => void;
}

export function usePhotoCheckIns(): PhotoState {
  const [state, setState] = useState<Omit<PhotoState, 'reload'>>({ status: 'loading', error: null, entries: [], links: new Map() });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const entries = newestFirst(await fetchCheckIns());
        const links = await signedLinks(entries.flatMap((e) => (e.storage_path ? [e.storage_path] : [])));
        if (live) setState({ status: 'ready', error: null, entries, links });
      } catch (e) {
        if (live) setState((s) => ({ ...s, status: 'error', error: e instanceof Error ? e.message : String(e) }));
      }
    })();
    return () => { live = false; };
  }, [tick]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { ...state, reload };
}
