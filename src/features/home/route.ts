import type { AuthMode } from '../auth/credentials.ts';

/** The public addresses. Anything else is treated as the homepage. */
export type Route = 'home' | 'signin' | 'privacy' | 'terms' | 'pricing' | 'confirmed';

export const HOME_PATH = '/';
export const SIGN_IN_PATH = '/signin';
export const PRIVACY_PATH = '/privacy';
export const TERMS_PATH = '/terms';
export const PRICING_PATH = '/pricing';
/** A confirmation link lands here. The token is a query parameter and is not part of the route. */
export const CONFIRMED_PATH = '/waitlist/confirmed';
export const SIGN_UP_URL = `${SIGN_IN_PATH}?mode=signup`;

export function routeFor(pathname: string): Route {
  const clean = pathname.replace(/\/+$/, '') || HOME_PATH;
  if (clean === SIGN_IN_PATH) return 'signin';
  if (clean === PRIVACY_PATH) return 'privacy';
  if (clean === TERMS_PATH) return 'terms';
  if (clean === PRICING_PATH) return 'pricing';
  if (clean === CONFIRMED_PATH) return 'confirmed';
  return 'home';
}

/** "Create account" links open the sign-in screen on its create-account tab. */
export function initialModeFor(search: string): AuthMode {
  return new URLSearchParams(search).get('mode') === 'signup' ? 'sign-up' : 'sign-in';
}
