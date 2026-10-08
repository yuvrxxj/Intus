import { useSyncExternalStore } from 'react';
import { redirectError } from '../auth/credentials.ts';
import { routeFor, SIGN_IN_PATH, type Route } from './route.ts';

// pushState does not fire popstate, so our own navigations announce themselves with this event
const NAVIGATED = 'intus:navigate';

/** Moves to another address without reloading the page. `replace` swaps the current history entry instead of adding one. */
export function navigate(to: string, replace = false): void {
  window.history[replace ? 'replaceState' : 'pushState'](null, '', to);
  window.dispatchEvent(new Event(NAVIGATED));
  if (!replace) window.scrollTo(0, 0);
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('popstate', onChange);
  window.addEventListener(NAVIGATED, onChange);
  return () => {
    window.removeEventListener('popstate', onChange);
    window.removeEventListener(NAVIGATED, onChange);
  };
}

export function useRoute(): Route {
  return routeFor(useSyncExternalStore(subscribe, () => window.location.pathname, () => '/'));
}

/**
 * Google and email links can send someone back with an error in the address. That belongs on the sign-in screen,
 * which shows it, and not on the homepage. Call once, before the first render.
 */
export function routeAuthErrorToSignIn(): void {
  if (routeFor(window.location.pathname) === 'signin' || !redirectError(window.location.href)) return;
  window.history.replaceState(null, '', `${SIGN_IN_PATH}${window.location.search}${window.location.hash}`);
}
