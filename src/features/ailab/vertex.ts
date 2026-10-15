// Google Vertex AI, for the AI lab: the request, what came back and what it cost. Pure: no network and no key, so Node tests
// can run it. The request is the one the app already sends to Gemini (supabase/functions/read-report/prompt.ts), with the
// thinking setting added, so a model that does well here is doing the same job the app would ask of it.
import { buildGeminiRequest, RESPONSE_SCHEMA, type MarkerInfo } from '../../../supabase/functions/read-report/prompt.ts';
import type { Config, Effort, Price, Usage } from './groq.ts';

export type Thinking = Effort;

/** `global` is Google's multi-region endpoint: the newest models are only there, and the request is not pinned to a region. */
export const vertexHost = (location: string) => (location === 'global' ? 'aiplatform.googleapis.com' : `${location}-aiplatform.googleapis.com`);

export const vertexUrl = (project: string, location: string, model: string) =>
  `https://${vertexHost(location)}/v1/projects/${encodeURIComponent(project)}/locations/${encodeURIComponent(location)}/publishers/google/models/${encodeURIComponent(model)}:generateContent`;

/** The model families differ in how thinking is asked for: a token budget (2.5) or a named level (3 and later). */
const usesLevel = (model: string) => /^gemini-3/.test(model);
const isPro = (model: string) => /-pro/.test(model);
/** Answered 400 "Thinking level is unsupported: THINKING_LEVEL_MINIMAL" on 14 Oct 2026; the Pro models never had it. */
const hasMinimal = (model: string) => !isPro(model) && !/^gemini-3\.8/.test(model);

/**
 * generationConfig.thinkingConfig for a setting, or null to leave it out, which is the model's own default.
 * `none` is as little as the model allows: a budget of 0 where that is allowed (Flash, Flash-Lite), the smallest one on 2.5 Pro,
 * and the `minimal` level on Gemini 3 where there is one (Pro and 3.8 Flash start at `low`).
 */
export function thinkingConfig(model: string, effort: Thinking | null): Record<string, number | string> | null {
  if (effort === null || effort === 'default') return null;
  if (usesLevel(model)) {
    const level = effort === 'none' ? (hasMinimal(model) ? 'minimal' : 'low') : effort;
    return { thinkingLevel: level };
  }
  const budget = { none: isPro(model) ? 128 : 0, low: 1024, medium: 4096, high: 16384 }[effort];
  return { thinkingBudget: budget };
}

export interface VertexConfig extends Config {
  provider: 'vertex';
  location: string;
}

/**
 * The app's schema requires only name, value_text and line, so a model may leave out marker, unit and the printed range. On a
 * whole report some do, for every row (seen on 14 Oct 2026: no marker on any of 119 rows). Requiring every field closes that.
 */
const ALL_FIELDS = ['name', 'marker', 'value_text', 'unit', 'ref_low', 'ref_high', 'line'];
const allRequired = {
  ...RESPONSE_SCHEMA,
  properties: { rows: { ...RESPONSE_SCHEMA.properties.rows, items: { ...RESPONSE_SCHEMA.properties.rows.items, required: ALL_FIELDS } } },
};

export function buildVertexRequest(c: Config, text: string, markers: readonly MarkerInfo[], maxOutputTokens: number) {
  const request = buildGeminiRequest(text, markers, maxOutputTokens);
  const thinking = thinkingConfig(c.model, c.effort);
  const generationConfig = {
    ...request.generationConfig,
    ...(c.requireAll ? { responseSchema: allRequired } : {}),
    ...(thinking ? { thinkingConfig: thinking } : {}),
  };
  return { ...request, generationConfig };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);

/**
 * Vertex's usageMetadata. Thinking tokens are reported apart from the answer and billed as output, so they are added to the
 * output count and also shown as reasoning, the way Groq's usage reads. Cached tokens are part of the prompt count.
 */
export function readVertexUsage(reply: unknown): Usage | null {
  const meta = isRecord(reply) && isRecord(reply.usageMetadata) ? reply.usageMetadata : null;
  if (!meta || meta.promptTokenCount === undefined) return null;
  const thoughts = num(meta.thoughtsTokenCount);
  return {
    promptTokens: num(meta.promptTokenCount),
    completionTokens: num(meta.candidatesTokenCount) + thoughts,
    reasoningTokens: thoughts,
    cachedTokens: num(meta.cachedContentTokenCount),
    queueS: 0,
    promptS: 0,
    completionS: 0,
    totalS: 0,
  };
}

/** Why the model stopped, if it said: STOP, MAX_TOKENS, SAFETY. */
export function vertexFinish(reply: unknown): string | null {
  const candidate = isRecord(reply) && Array.isArray(reply.candidates) && isRecord(reply.candidates[0]) ? reply.candidates[0] : null;
  return candidate && typeof candidate.finishReason === 'string' ? candidate.finishReason : null;
}

export interface VertexModel {
  id: string;
  /** where the project can reach it; the newest are global only */
  location: string;
  /** US dollars per million tokens, Standard (pay as you go) tier, prompts up to 200,000 tokens */
  prompt: number;
  completion: number;
  cachedPrompt: number;
  /** what to know about the number */
  note?: string;
}

/**
 * Vertex AI list prices, read from https://cloud.google.com/vertex-ai/generative-ai/pricing on 14 Oct 2026. Output includes
 * thinking. The 2.5 models are priced the same in a region as globally; the later ones carry a 10% surcharge when called
 * through a region, which the global endpoint avoids.
 */
export const VERTEX_MODELS: readonly VertexModel[] = [
  { id: 'gemini-2.5-flash-lite', location: 'us-central1', prompt: 0.1, completion: 0.4, cachedPrompt: 0.01 },
  { id: 'gemini-2.5-flash', location: 'us-central1', prompt: 0.3, completion: 2.5, cachedPrompt: 0.03 },
  { id: 'gemini-2.5-pro', location: 'us-central1', prompt: 1.25, completion: 10, cachedPrompt: 0.125 },
  { id: 'gemini-3.1-flash-lite', location: 'global', prompt: 0.25, completion: 1.5, cachedPrompt: 0.025 },
  { id: 'gemini-3.5-flash-lite', location: 'global', prompt: 0.3, completion: 2.5, cachedPrompt: 0.03 },
  { id: 'gemini-3-flash-preview', location: 'global', prompt: 0.5, completion: 3, cachedPrompt: 0.05, note: 'The Standard table prints no output price for this model; $3.00 is what its Priority ($5.40) and Batch ($1.50) rows imply.' },
  { id: 'gemini-3.5-flash', location: 'global', prompt: 1.5, completion: 9, cachedPrompt: 0.15 },
  { id: 'gemini-3.8-flash', location: 'global', prompt: 1.5, completion: 7.5, cachedPrompt: 0.15, note: 'Google charges half ($0.75 in, $3.75 out) through 31 Dec 2026 and this from 1 Jan 2027; costs here use the later price.' },
  { id: 'gemini-3.1-pro-preview', location: 'global', prompt: 2, completion: 12, cachedPrompt: 0.2 },
];

export const vertexModel = (id: string) => VERTEX_MODELS.find((m) => m.id === id) ?? null;

/** Per-token prices for costOf, or null for a model that is not on the list. */
export function vertexPrice(id: string): Price | null {
  const m = vertexModel(id);
  return m ? { prompt: m.prompt / 1e6, completion: m.completion / 1e6, cacheRead: m.cachedPrompt / 1e6 } : null;
}

const EFFORTS = new Set<string>(['none', 'default', 'low', 'medium', 'high']);

/** model, then :thinking, then @location: gemini-3.5-flash:low@global. The location defaults to where the model can be reached. */
export function parseVertexPlan(text: string): VertexConfig[] {
  return text.split(',').map((raw) => {
    const [item, location] = raw.trim().split('@');
    const i = item.lastIndexOf(':');
    const tail = i === -1 ? '' : item.slice(i + 1).trim();
    const hasEffort = EFFORTS.has(tail);
    const model = (hasEffort ? item.slice(0, i) : item).trim();
    const known = vertexModel(model);
    if (!known) throw new Error(`"${model}" is not a model this lab has a Vertex price for (${VERTEX_MODELS.map((m) => m.id).join(', ')})`);
    return { model, effort: hasEffort ? (tail as Effort) : null, mode: 'schema', provider: 'vertex', location: (location ?? known.location).trim() };
  });
}

/** An error message for the ledger: short, and without the project that made the call. */
export const tidyVertexError = (message: string) => message.replace(/projects\/[^/\s]+/gi, 'projects/…').replace(/\s+/g, ' ').trim().slice(0, 300);
