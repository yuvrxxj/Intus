import type { AuthMode } from '../auth/credentials.ts';

/** The public addresses. Anything else is treated as the homepage. */
export type Route = 'home' | 'signin' | 'privacy' | 'terms';

export const HOME_PATH = '/';
export const SIGN_IN_PATH = '/signin';
export const PRIVACY_PATH = '/privacy';
export const TERMS_PATH = '/terms';
export const SIGN_UP_URL = `${SIGN_IN_PATH}?mode=signup`;

export function routeFor(pathname: string): Route {
  const clean = pathname.replace(/\/+$/, '') || HOME_PATH;
  if (clean === SIGN_IN_PATH) return 'signin';
  if (clean === PRIVACY_PATH) return 'privacy';
  if (clean === TERMS_PATH) return 'terms';
  return 'home';
}

/** "Create account" links open the sign-in screen on its create-account tab. */
export function initialModeFor(search: string): AuthMode {
  return new URLSearchParams(search).get('mode') === 'signup' ? 'sign-up' : 'sign-in';
}
