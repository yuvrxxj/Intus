// A sliding window kept in memory. Each edge isolate has its own, so the limit is real for one instance and a
// burst that lands on several instances can slip past it. A shared store can replace this later without changing callers.

export interface RateLimiter {
  allow(key: string, now: number): boolean;
}

export function createMemoryRateLimit(limit: number, windowMs: number): RateLimiter {
  const hits = new Map<string, number[]>();
  return {
    allow(key, now) {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return false;
      }
      recent.push(now);
      hits.set(key, recent);
      if (hits.size > 5000) {
        for (const [name, times] of hits) {
          if (times.every((t) => now - t >= windowMs)) hits.delete(name);
        }
      }
      return true;
    },
  };
}
