import { useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../db/client.ts';

export type SessionState =
  | { status: 'loading' }
  | { status: 'signed_out' }
  | { status: 'signed_in'; session: Session }
  /** arrived from a password reset link: signed in, but must choose a new password before the app opens */
  | { status: 'recovery'; session: Session };

/**
 * The session lives in Supabase Auth; the app only renders while one exists. Real protection is the row-level
 * security on the database, not this screen. onAuthStateChange fires once with the stored session on subscribe,
 * and again on every sign-in and sign-out. Nothing here calls Supabase from inside the callback, which can deadlock.
 */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ status: 'loading' });
  // other events (a token refresh, the initial session) can follow the recovery one, so it is remembered
  const recovering = useRef(false);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') recovering.current = true;
      if (event === 'USER_UPDATED' || event === 'SIGNED_OUT') recovering.current = false;
      if (!session) setState({ status: 'signed_out' });
      else setState(recovering.current ? { status: 'recovery', session } : { status: 'signed_in', session });
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return state;
}
