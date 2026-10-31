import type { AuthMode } from '../auth/credentials.ts';

/** The public addresses. Anything else is treated as the homepage. */
export type Route = 'home' | 'signin' | 'privacy' | 'terms' | 'pricing' | 'confirmed' | 'unsubscribe';

export const HOME_PATH = '/';
export const SIGN_IN_PATH = '/signin';
export const PRIVACY_PATH = '/privacy';
export const TERMS_PATH = '/terms';
export const PRICING_PATH = '/pricing';
/** A confirmation link lands here. The token is a query parameter and is not part of the route. */
export const CONFIRMED_PATH = '/waitlist/confirmed';
/** The unsubscribe link in the place-ready and launch emails. The id and signature are query parameters. */
export const UNSUBSCRIBE_PATH = '/waitlist/unsubscribe';
export const SIGN_UP_URL = `${SIGN_IN_PATH}?mode=signup`;

export function routeFor(pathname: string): Route {
  const clean = pathname.replace(/\/+$/, '') || HOME_PATH;
  if (clean === SIGN_IN_PATH) return 'signin';
  if (clean === PRIVACY_PATH) return 'privacy';
  if (clean === TERMS_PATH) return 'terms';
  if (clean === PRICING_PATH) return 'pricing';
  if (clean === CONFIRMED_PATH) return 'confirmed';
  if (clean === UNSUBSCRIBE_PATH) return 'unsubscribe';
  return 'home';
}

/** "Create account" links open the sign-in screen on its create-account tab. */
export function initialModeFor(search: string): AuthMode {
  return new URLSearchParams(search).get('mode') === 'signup' ? 'sign-up' : 'sign-in';
}
