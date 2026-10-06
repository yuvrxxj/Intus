import { useEffect, useState } from 'react';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../../db/client.ts';

export interface AuthSettings {
  /** Google is switched on under Authentication, Sign In / Providers */
  google: boolean;
}

const OFF: AuthSettings = { google: false };

/**
 * Asks Supabase Auth which sign-in providers are switched on, so a button only appears once its provider works.
 * Until the answer arrives, or if the request fails, every optional provider counts as off.
 */
export function useAuthSettings(): AuthSettings {
  const [settings, setSettings] = useState<AuthSettings>(OFF);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_PUBLISHABLE_KEY }, signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { external?: Record<string, unknown> } | null) => setSettings({ google: body?.external?.google === true }))
      .catch(() => {});
    return () => controller.abort();
  }, []);
  return settings;
}
