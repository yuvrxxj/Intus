// The Edge Function's request handling, with everything outside it (sign-in check, database, Gemini) passed in, so
// Node tests can run it with fakes. Nothing here logs report text, and nothing here decides a limit: the database does.
import { buildChatRequest, buildGeminiRequest, parseReply, ReadError, type JsonMode, type MarkerInfo, type Provider, type RawRow } from './prompt.ts';

export type SlotResult =
  | { ok: true; usage_id: string; provider: Provider; model: string; json_mode: JsonMode; max_output_tokens: number; used_today: number; per_user_daily: number }
  | { ok: false; reason: 'off' | 'too_big' | 'user_limit' | 'busy' | 'budget' };

export interface Deps {
  hasKey(provider: Provider): boolean;
  /** the signed-in person's id for this token, or null */
  getUserId(jwt: string): Promise<string | null>;
  takeSlot(userId: string, inputChars: number): Promise<SlotResult>;
  finish(usageId: string, inputTokens: number | null, outputTokens: number | null, ok: boolean): Promise<void>;
  status(userId: string): Promise<{ available: boolean; provider: Provider | null; used_today: number; per_user_daily: number }>;
  /** sends the request to the provider and returns what came back; the model is already in a chat request's body */
  call(provider: Provider, model: string, body: unknown, signal: AbortSignal): Promise<{ status: number; json: unknown }>;
  log(message: string): void;
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
};

const MAX_BODY_CHARS = 450_000;
const MAX_TEXT_CHARS = 400_000;
const GEMINI_TIMEOUT_MS = 90_000;

export type ErrorCode = 'unauthorized' | 'bad_request' | 'too_big' | 'off' | 'user_limit' | 'busy' | 'upstream' | 'model' | 'truncated' | 'blocked';

/** What the person is told. Plain words; the app shows them as they are. */
export const MESSAGES: Record<ErrorCode, string> = {
  unauthorized: 'Sign in again to use AI reading.',
  bad_request: 'The report could not be sent for AI reading.',
  too_big: 'This report is too long for AI reading.',
  off: 'AI reading is not switched on.',
  user_limit: 'You have used today\'s AI readings. Try again tomorrow.',
  busy: 'AI reading has reached its limit for today. Try again tomorrow.',
  upstream: 'The AI service did not answer. Try again in a minute.',
  model: 'AI reading is not working right now.',
  truncated: 'This report is too long for the AI to finish.',
  blocked: 'The AI declined to read this report.',
};

const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });
const fail = (status: number, code: ErrorCode) => reply(status, { error: { code, message: MESSAGES[code] } });
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function readMarkers(value: unknown): MarkerInfo[] | null {
  if (!Array.isArray(value) || value.length > 200) return null;
  const out: MarkerInfo[] = [];
  for (const m of value) {
    if (!isRecord(m) || typeof m.code !== 'string' || typeof m.name !== 'string' || typeof m.unit !== 'string') return null;
    if (m.code.length > 60 || m.name.length > 100 || m.unit.length > 30) return null;
    out.push({ code: m.code, name: m.name, unit: m.unit });
  }
  return out;
}

export function createHandler(deps: Deps) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (req.method !== 'POST') return fail(405, 'bad_request');

    const header = req.headers.get('authorization') ?? '';
    const jwt = /^bearer /i.test(header) ? header.slice(7).trim() : '';
    const userId = jwt ? await deps.getUserId(jwt).catch(() => null) : null;
    if (!userId) return fail(401, 'unauthorized');

    let body: unknown;
    try {
      const raw = await req.text();
      if (raw.length > MAX_BODY_CHARS) return fail(413, 'too_big');
      body = JSON.parse(raw);
    } catch {
      return fail(400, 'bad_request');
    }
    if (!isRecord(body)) return fail(400, 'bad_request');

    if (body.action === 'status') {
      try {
        const s = await deps.status(userId);
        return reply(200, { available: s.available && s.provider !== null && deps.hasKey(s.provider), provider: s.provider, usedToday: s.used_today, perUserDaily: s.per_user_daily });
      } catch {
        deps.log('status failed');
        return reply(200, { available: false, provider: null, usedToday: 0, perUserDaily: 0 });
      }
    }
    if (body.action !== 'read') return fail(400, 'bad_request');

    const text = body.text;
    const markers = readMarkers(body.markers);
    if (typeof text !== 'string' || text.trim().length < 20 || !markers) return fail(400, 'bad_request');
    if (text.length > MAX_TEXT_CHARS) return fail(413, 'too_big');
    // Is it on, and is there a key for the provider that is set? Asked before a slot is taken, so a missing key does not use up anyone's day.
    const pre = await deps.status(userId).catch(() => null);
    if (!pre || pre.provider === null || !deps.hasKey(pre.provider)) return fail(503, 'off');

    let slot: SlotResult;
    try {
      slot = await deps.takeSlot(userId, text.length);
    } catch {
      deps.log('could not check the limits');
      return fail(502, 'upstream');
    }
    if (!slot.ok) {
      switch (slot.reason) {
        case 'off': return fail(503, 'off');
        case 'too_big': return fail(413, 'too_big');
        case 'user_limit': return fail(429, 'user_limit');
        default: return fail(429, 'busy');
      }
    }
    // the model name comes from the settings table and goes into a URL or a request, so it is checked, and so is the key
    if (!/^[A-Za-z0-9._:/-]+$/.test(slot.model) || slot.model.includes('..')) {
      await finish(deps, slot.usage_id, null, null, false);
      return fail(502, 'model');
    }
    if (!deps.hasKey(slot.provider)) {
      await finish(deps, slot.usage_id, null, null, false);
      return fail(503, 'off');
    }

    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), GEMINI_TIMEOUT_MS);
    try {
      let answer: { status: number; json: unknown };
      try {
        const request = slot.provider === 'gemini'
          ? buildGeminiRequest(text, markers, slot.max_output_tokens)
          : buildChatRequest(slot.model, text, markers, slot.max_output_tokens, slot.json_mode);
        answer = await deps.call(slot.provider, slot.model, request, abort.signal);
      } catch {
        deps.log(`${slot.provider} did not answer`);
        await finish(deps, slot.usage_id, null, null, false);
        return fail(502, 'upstream');
      }
      if (answer.status !== 200) {
        deps.log(`${slot.provider} answered ${answer.status}`);
        await finish(deps, slot.usage_id, null, null, false);
        if (answer.status === 404 || answer.status === 400) return fail(502, 'model');
        if (answer.status === 429) return fail(503, 'busy');
        return fail(502, 'upstream');
      }
      try {
        const parsed = parseReply(slot.provider, answer.json);
        await finish(deps, slot.usage_id, parsed.inputTokens, parsed.outputTokens, true);
        const rows: RawRow[] = parsed.rows;
        return reply(200, { rows, skipped: parsed.skipped, usedToday: slot.used_today, perUserDaily: slot.per_user_daily });
      } catch (e) {
        if (e instanceof ReadError) {
          deps.log(`could not use the answer: ${e.code}`);
          // the provider did the work and may charge for it, so the real tokens are recorded even though the answer is not used
          await finish(deps, slot.usage_id, e.inputTokens, e.outputTokens, false);
          return fail(502, e.code === 'truncated' ? 'truncated' : e.code === 'blocked' ? 'blocked' : 'upstream');
        }
        throw e;
      }
    } finally {
      clearTimeout(timer);
    }
  };
}

async function finish(deps: Deps, id: string, input: number | null, output: number | null, ok: boolean) {
  try {
    await deps.finish(id, input, output, ok);
  } catch {
    // The reserved cost stays on the books, which errs towards stopping early.
    deps.log('could not record the cost');
  }
}
