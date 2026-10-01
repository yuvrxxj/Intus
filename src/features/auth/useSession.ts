import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../db/client.ts';

export type SessionState =
  | { status: 'loading' }
  | { status: 'signed_out' }
  | { status: 'signed_in'; session: Session };

/**
 * The session lives in Supabase Auth; the app only renders while one exists. Real protection is the row-level
 * security on the database, not this screen. onAuthStateChange fires once with the stored session on subscribe,
 * and again on every sign-in and sign-out. Nothing here calls Supabase from inside the callback, which can deadlock.
 */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ status: 'loading' });
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState(session ? { status: 'signed_in', session } : { status: 'signed_out' });
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return state;
}
