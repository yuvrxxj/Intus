// A sliding window kept in memory. Each edge isolate has its own, so a burst that lands on several instances can slip
// past it. It is only the fallback now: the real count is shared in the database (sharedRateLimit.ts), and this answers
// when that call fails, so a database blip never stops anyone from joining.

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
