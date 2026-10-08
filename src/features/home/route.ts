import type { AuthMode } from '../auth/credentials.ts';

/** The two public addresses. Anything else is treated as the homepage. */
export type Route = 'home' | 'signin';

export const HOME_PATH = '/';
export const SIGN_IN_PATH = '/signin';
export const SIGN_UP_URL = `${SIGN_IN_PATH}?mode=signup`;

export function routeFor(pathname: string): Route {
  const clean = pathname.replace(/\/+$/, '') || HOME_PATH;
  return clean === SIGN_IN_PATH ? 'signin' : 'home';
}

/** "Create account" links open the sign-in screen on its create-account tab. */
export function initialModeFor(search: string): AuthMode {
  return new URLSearchParams(search).get('mode') === 'signup' ? 'sign-up' : 'sign-in';
}
