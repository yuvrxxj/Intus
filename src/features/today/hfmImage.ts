// The HealthifyMe screenshot stays on this device, one per day, in localStorage. It never goes to the database.
import { useCallback, useState } from 'react';
import { todayKey } from '../../util/dates.ts';

const KEY = 'yuvraaj_hfm_v2';

function readAll(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

export function useHfmImage(): { image: string | null; set: (dataUrl: string) => boolean } {
  const [image, setImage] = useState<string | null>(() => readAll()[todayKey()] ?? null);
  const set = useCallback((dataUrl: string) => {
    setImage(dataUrl);
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...readAll(), [todayKey()]: dataUrl }));
      return true;
    } catch {
      // quota or blocked storage: the picture shows for this visit but will not be remembered
      return false;
    }
  }, []);
  return { image, set };
}
