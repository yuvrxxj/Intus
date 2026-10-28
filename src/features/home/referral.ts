// The referral code a friend's link carries (intus.fit/?ref=CODE), kept for the visit so it survives scrolling to the
// waitlist form or a reload. Storage can be missing or blocked, so every read and write is allowed to fail.

import { referralCodeFrom } from './waitlist.ts';

export const REFERRAL_KEY = 'intus.ref';

type Store = Pick<Storage, 'getItem' | 'setItem'>;

function sessionStore(): Store | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

/** The valid code in a query string such as "?ref=ab12cd34ef", or null. */
export function referralFromSearch(search: string): string | null {
  return referralCodeFrom(new URLSearchParams(search).get('ref'));
}

/** Keeps a code from the link. A link with no code leaves any earlier one alone. */
export function rememberReferral(search: string, store: Store | null = sessionStore()): string | null {
  const code = referralFromSearch(search);
  if (code && store) {
    try {
      store.setItem(REFERRAL_KEY, code);
    } catch {
      // Private window: the code still rides along on this page load.
    }
  }
  return code;
}

/** The code on this page's link, else the one kept from earlier in the visit. */
export function currentReferral(search: string, store: Store | null = sessionStore()): string | null {
  const fromLink = referralFromSearch(search);
  if (fromLink) return fromLink;
  try {
    return referralCodeFrom(store?.getItem(REFERRAL_KEY));
  } catch {
    return null;
  }
}
