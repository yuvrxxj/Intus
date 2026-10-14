// Groq, for the AI lab: the request, what came back, what it cost and what the limits said. Pure: no network, so Node
// tests can run it. The request is the one the app's Edge Function builds (supabase/functions/read-report/prompt.ts),
// with the OpenRouter-only routing field taken out and Groq's reasoning setting added, so a model that does well here
// is doing the same job the app would ask of it.
import { buildChatRequest, type JsonMode, type MarkerInfo } from '../../../supabase/functions/read-report/prompt.ts';

export const GROQ_BASE = 'https://api.groq.com/openai/v1';

/** Groq's reasoning_effort: gpt-oss takes low, medium, high; Qwen 3.8 takes none, default (no reasoning tokens), low, medium, high. */
export type Effort = 'none' | 'default' | 'low' | 'medium' | 'high';

export interface Config {
  model: string;
  /** null leaves the setting out, which is the model's own default */
  effort: Effort | null;
  /** schema where the model supports structured outputs, object (plain JSON mode) where it does not */
  mode: JsonMode;
}

export const configName = (c: Config) => `${c.model}${c.effort ? ` (${c.effort})` : ''}`;

export function buildGroqRequest(c: Config, text: string, markers: readonly MarkerInfo[], maxTokens: number) {
  const { provider: _routing, ...request } = buildChatRequest(c.model, text, markers, maxTokens, c.mode);
  return c.effort ? { ...request, reasoning_effort: c.effort } : request;
}

/** Whole lines only, so a result is never cut in half. A line longer than the limit is a chunk of its own. */
export function chunkLines(lines: readonly string[], maxChars: number): string[][] {
  const chunks: string[][] = [];
  let current: string[] = [];
  let size = 0;
  for (const line of lines) {
    const add = line.length + 1;
    if (current.length > 0 && size + add > maxChars) {
      chunks.push(current);
      current = [];
      size = 0;
    }
    current.push(line);
    size += add;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

/** US dollars per token, as Groq lists them. */
export interface Price {
  prompt: number;
  completion: number;
  cacheRead: number;
}

export function priceOf(entry: { pricing?: { prompt?: string; completion?: string; input_cache_read?: string } | null }): Price | null {
  const p = entry.pricing;
  if (!p || p.prompt === undefined || p.completion === undefined) return null;
  const prompt = Number(p.prompt);
  const completion = Number(p.completion);
  if (!Number.isFinite(prompt) || !Number.isFinite(completion)) return null;
  const cacheRead = p.input_cache_read === undefined ? prompt : Number(p.input_cache_read);
  return { prompt, completion, cacheRead: Number.isFinite(cacheRead) ? cacheRead : prompt };
}

export interface Usage {
  promptTokens: number;
  completionTokens: number;
  /** part of completionTokens, billed as output */
  reasoningTokens: number;
  /** part of promptTokens, billed at the cache price and not counted against the limits */
  cachedTokens: number;
  /** seconds, as Groq measured them */
  queueS: number;
  promptS: number;
  completionS: number;
  totalS: number;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);

export function readUsage(reply: unknown): Usage | null {
  const usage = isRecord(reply) && isRecord(reply.usage) ? reply.usage : null;
  if (!usage || usage.prompt_tokens === undefined) return null;
  const out = isRecord(usage.completion_tokens_details) ? usage.completion_tokens_details : {};
  const inn = isRecord(usage.prompt_tokens_details) ? usage.prompt_tokens_details : {};
  return {
    promptTokens: num(usage.prompt_tokens),
    completionTokens: num(usage.completion_tokens),
    reasoningTokens: num(out.reasoning_tokens),
    cachedTokens: num(inn.cached_tokens),
    queueS: num(usage.queue_time),
    promptS: num(usage.prompt_time),
    completionS: num(usage.completion_time),
    totalS: num(usage.total_time),
  };
}

/** What the call cost at the listed prices, or null when the model has no listed price. */
export function costOf(u: Usage, price: Price | null): number | null {
  if (!price) return null;
  const fresh = Math.max(0, u.promptTokens - u.cachedTokens);
  return fresh * price.prompt + u.cachedTokens * price.cacheRead + u.completionTokens * price.completion;
}

/** Groq's durations: "7.66s", "2m59.56s", "1h2m3s", "250ms". */
export function parseDuration(text: string | null): number | null {
  if (!text) return null;
  let seconds = 0;
  let any = false;
  for (const m of text.matchAll(/(\d+(?:\.\d+)?)(ms|h|m|s)/g)) {
    any = true;
    const n = Number(m[1]);
    seconds += m[2] === 'h' ? n * 3600 : m[2] === 'm' ? n * 60 : m[2] === 'ms' ? n / 1000 : n;
  }
  return any ? seconds : null;
}

/** The rate-limit headers Groq sends on every answer. Requests are per day, tokens are per minute. */
export interface Rate {
  requestsPerDay: number | null;
  tokensPerMinute: number | null;
  requestsLeft: number | null;
  tokensLeft: number | null;
  requestsResetS: number | null;
  tokensResetS: number | null;
  /** only set on a 429 */
  retryAfterS: number | null;
  region: string | null;
}

const header = (h: Pick<Headers, 'get'>, name: string) => h.get(name);
const numberOrNull = (text: string | null) => (text !== null && text !== '' && Number.isFinite(Number(text)) ? Number(text) : null);

export function readRate(h: Pick<Headers, 'get'>): Rate {
  return {
    requestsPerDay: numberOrNull(header(h, 'x-ratelimit-limit-requests')),
    tokensPerMinute: numberOrNull(header(h, 'x-ratelimit-limit-tokens')),
    requestsLeft: numberOrNull(header(h, 'x-ratelimit-remaining-requests')),
    tokensLeft: numberOrNull(header(h, 'x-ratelimit-remaining-tokens')),
    requestsResetS: parseDuration(header(h, 'x-ratelimit-reset-requests')),
    tokensResetS: parseDuration(header(h, 'x-ratelimit-reset-tokens')),
    retryAfterS: numberOrNull(header(h, 'retry-after')),
    region: header(h, 'x-groq-region'),
  };
}

/** Per minute, per day, input only and output only. The input and output ones are not in the headers; only the message says. */
export type LimitKind = 'tpm' | 'rpm' | 'tpd' | 'rpd' | 'itpm' | 'otpm' | 'too_large' | 'unknown';

/** Which limit a 413 or 429 message is about. Groq names it in brackets: "tokens per day (TPD)". */
export function limitKind(status: number, message: string): LimitKind {
  const m = /\((TPM|RPM|TPD|RPD|ITPM|OTPM)\)/i.exec(message);
  const kind = m ? (m[1].toLowerCase() as LimitKind) : 'unknown';
  if (status === 413) return 'too_large';
  return kind;
}

/** An error message for the ledger: short, and without the organization's id. */
export const tidyError = (message: string) => message.replace(/org_[a-z0-9]+/gi, 'org_…').replace(/\s+/g, ' ').trim().slice(0, 300);

/**
 * Seconds to wait before a request that will use about `need` tokens, given what the last answer said was left. The
 * bucket refills at limit/60 tokens a second. A second is added so the wait is never a hair short.
 */
export function secondsToWait(rate: Rate | null, need: number): number {
  if (!rate || rate.tokensLeft === null || rate.tokensPerMinute === null) return 0;
  if (need <= rate.tokensLeft) return 0;
  return Math.ceil((need - rate.tokensLeft) / (rate.tokensPerMinute / 60)) + 1;
}

/** A cheap upper guess at the tokens in some text, for pacing only. Real counts come back in the usage. */
export const guessTokens = (chars: number) => Math.ceil(chars / 2.6);
