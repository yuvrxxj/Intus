// Reading the ledger the benchmark writes: one line of measurements per run. Pure: the page and the tests hand it text.
import type { RunMetrics } from './types.ts';

export function parseLedger(text: string): RunMetrics[] {
  const runs: RunMetrics[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      const run = JSON.parse(line) as RunMetrics;
      if (run && typeof run.id === 'string' && run.config && Array.isArray(run.calls) && run.totals) runs.push(run);
    } catch {
      // a half-written line at the end of the file is skipped, not a reason to lose the rest
    }
  }
  return runs.sort((a, b) => a.at.localeCompare(b.at));
}

export type Outcome = 'complete' | 'partial' | 'failed' | 'trial';

export interface Summary {
  outcome: Outcome;
  /** why calls gave nothing, counted: { too_large: 1, truncated: 3 } */
  failures: Record<string, number>;
  okChunks: number;
}

/**
 * complete: the whole report was read. partial: some chunks gave nothing. failed: no chunk gave anything. trial: only
 * the first part of the report was sent, to try a setting.
 */
export function summarise(run: RunMetrics): Summary {
  const failures: Record<string, number> = {};
  for (const call of run.calls) if (!call.ok) failures[call.failure ?? 'unknown'] = (failures[call.failure ?? 'unknown'] ?? 0) + 1;
  const okChunks = run.calls.filter((c) => c.ok).length;
  const outcome: Outcome = run.chunks < run.totalChunks ? 'trial' : okChunks === 0 ? 'failed' : okChunks < run.calls.length ? 'partial' : 'complete';
  return { outcome, failures, okChunks };
}

/** Tokens and requests a model used in the 24 hours before `now`: what Groq's daily limits count. Cached input is not counted by Groq. */
export function usedInLastDay(runs: readonly RunMetrics[], model: string, now: number): { tokens: number; requests: number } {
  let tokens = 0;
  let requests = 0;
  for (const run of runs) {
    if (run.config.model !== model || Date.parse(run.at) < now - 24 * 3600 * 1000) continue;
    for (const call of run.calls) {
      requests += call.attempts;
      tokens += Math.max(0, (call.usage?.promptTokens ?? 0) - (call.usage?.cachedTokens ?? 0)) + (call.usage?.completionTokens ?? 0);
    }
  }
  return { tokens, requests };
}

/** Dollars as a person reads them: four decimals under a cent, otherwise two. */
export function money(usd: number | null): string {
  if (usd === null) return 'not listed';
  if (usd === 0) return '$0';
  return usd < 0.01 ? `$${usd.toFixed(4)}` : `$${usd.toFixed(2)}`;
}

export function seconds(s: number): string {
  if (s < 90) return `${s.toFixed(1)}s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}
