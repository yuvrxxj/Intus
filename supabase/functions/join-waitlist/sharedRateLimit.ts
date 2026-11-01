// The join limit shared by every function instance, with the old in-memory limiter as a fallback. The count lives in
// the database (migration 20261101000100, waitlist_allow_join), so a burst spread across instances is still counted
// once. If the database call fails, for any reason, the in-memory limiter answers instead: a database blip must never
// stop a real person from joining. No Deno or Node imports: index.ts passes the pieces in, so node:test can run this.

import type { RateLimiter } from './rateLimit.ts';

export interface SharedLimitDeps {
  /** Salted SHA-256 of the caller's address. The raw address is never stored. */
  hashKey(ip: string): Promise<string>;
  /** Calls waitlist_allow_join. Throws on any database or network error. */
  check(keyHash: string): Promise<boolean>;
  fallback: RateLimiter;
  log(message: string): void;
}

export function createSharedAllowJoin(deps: SharedLimitDeps): (ip: string, now: number) => Promise<boolean> {
  return async (ip, now) => {
    try {
      return await deps.check(await deps.hashKey(ip));
    } catch {
      deps.log('shared rate limit failed, using the in-memory limit');
      return deps.fallback.allow(ip, now);
    }
  };
}
