/**
 * Public web sign-in and account creation.
 *
 * Off unless `VITE_WEB_AUTH_ENABLED` is the string `true`. The screens in this folder stay in the repo.
 * To open them again: set that variable in the Vercel project and in `.env` for local, then redeploy.
 * One flag brings the header and pricing links back and stops the auth-route redirect. Supabase settings
 * are not part of the switch. See the README section "Web sign-in".
 */

/** Where a closed auth address sends a person: the waitlist section on the homepage. */
export const WAITLIST_HREF = '/#waitlist';

/** Exact path or a path under it. `/author` is not `/auth`. */
const AUTH_ROOTS = ['/signin', '/login', '/signup', '/register', '/auth'] as const;

/**
 * Query keys a Supabase email or OAuth return puts on the address. The hash is not visible to the server,
 * so a token that arrives only as `#access_token` is handled in the browser. Live emails do not use these
 * paths: confirm, reset and Google land on `/` (the site origin), and the waitlist lands on `/waitlist/confirmed`.
 */
const RETURN_KEYS = ['code', 'token', 'token_hash', 'access_token', 'refresh_token', 'error', 'error_code', 'error_description'] as const;

const RETURN_TYPES = new Set(['signup', 'recovery', 'magiclink', 'invite', 'email_change']);

export function webAuthEnabled(value: string | undefined): boolean {
  return value === 'true';
}

export function isAuthEntryPath(pathname: string): boolean {
  const clean = pathname.split('?')[0].replace(/\/+$/, '') || '/';
  return AUTH_ROOTS.some((root) => clean === root || clean.startsWith(`${root}/`));
}

/** True when the address already carries a Supabase session hand-off, so the app has to see it. */
export function carriesSupabaseReturn(search: string, hash = ''): boolean {
  const query = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  if (RETURN_KEYS.some((key) => query.has(key))) return true;
  const type = query.get('type');
  if (type && RETURN_TYPES.has(type)) return true;
  const fragment = new URLSearchParams(hash.replace(/^#/, ''));
  if (RETURN_KEYS.some((key) => fragment.has(key))) return true;
  const fragmentType = fragment.get('type');
  return fragmentType !== null && RETURN_TYPES.has(fragmentType);
}

/**
 * Where an auth entry URL should go, or null to leave the request alone.
 * Null when web auth is on, the path is not an auth entry, or the address is a Supabase return.
 */
export function authEntryRedirect(pathname: string, search: string, enabled: boolean, hash = ''): string | null {
  if (enabled || !isAuthEntryPath(pathname) || carriesSupabaseReturn(search, hash)) return null;
  return WAITLIST_HREF;
}
