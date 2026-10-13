import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fetchProfile, type Profile } from '../../db/profile.ts';
import { currentAge } from '../../lib/age.ts';
import { programmeFromProfile, type Programme } from '../../lib/programme.ts';
import { todayKey } from '../../util/dates.ts';

export interface ProfileState {
  status: 'loading' | 'ready' | 'error';
  profile: Profile | null;
  /** the person's current goal, or null until they have set one */
  programme: Programme | null;
  error: string | null;
  reload: () => void;
}

const ProfileContext = createContext<ProfileState | null>(null);

/** Today's date as text, changing by itself at midnight, so an age worked out from a birthday rolls over while the app is open. */
function useDayKey(): string {
  const [key, setKey] = useState(() => todayKey());
  useEffect(() => {
    const id = window.setInterval(() => setKey((k) => { const now = todayKey(); return now === k ? k : now; }), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return key;
}

/** The profile with its age worked out from the date of birth, when there is one. Nothing downstream reads the stored age. */
function withLiveAge(profile: Profile | null, today: string): Profile | null {
  if (profile === null) return null;
  const age = currentAge(profile, today);
  return age === profile.age ? profile : { ...profile, age };
}

/**
 * Loads the signed-in person's profile once and shares it, so the header, Today, Progress and the Goals screen all
 * read the same goal. After a save, reload() makes every screen follow.
 */
export function ProfileProvider({ children }: { children: ReactNode }) {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<{ profile: Profile | null } | { error: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchProfile().then(
      (profile) => !cancelled && setLoaded({ profile }),
      (e: unknown) => !cancelled && setLoaded({ error: e instanceof Error ? e.message : String(e) }),
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const day = useDayKey();

  const value = useMemo<ProfileState>(() => {
    if (loaded === null) return { status: 'loading', profile: null, programme: null, error: null, reload };
    if ('error' in loaded) return { status: 'error', profile: null, programme: null, error: loaded.error, reload };
    return { status: 'ready', profile: withLiveAge(loaded.profile, day), programme: programmeFromProfile(loaded.profile), error: null, reload };
  }, [loaded, reload, day]);

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileState {
  const value = useContext(ProfileContext);
  if (!value) throw new Error('useProfile must be used inside ProfileProvider');
  return value;
}

export function useProgramme(): Programme | null {
  return useProfile().programme;
}
