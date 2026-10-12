// Supabase Edge Function: reads a lab report's text with an AI model. Deployed by hand, see supabase/README.md.
// Needs a secret for whichever provider is set in public.ai_settings: GEMINI_API_KEY or OPENROUTER_API_KEY.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase itself.
// Whether it is on, the provider, the model, the limits and the prices are rows in public.ai_settings, not code.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { createHandler, type SlotResult } from './handler.ts';
import type { Provider } from './prompt.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const KEYS: Record<Provider, string> = { gemini: Deno.env.get('GEMINI_API_KEY') ?? '', openrouter: Deno.env.get('OPENROUTER_API_KEY') ?? '' };

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await admin.rpc(name, args);
  if (error) throw new Error(name);
  return data as T;
}

Deno.serve(createHandler({
  hasKey: (provider) => KEYS[provider] !== '',
  getUserId: async (jwt) => (await admin.auth.getUser(jwt)).data.user?.id ?? null,
  takeSlot: (userId, inputChars) => rpc<SlotResult>('ai_take_slot', { p_user: userId, p_input_chars: inputChars }),
  finish: async (usageId, inputTokens, outputTokens, ok) => {
    await rpc('ai_finish', { p_id: usageId, p_input_tokens: inputTokens, p_output_tokens: outputTokens, p_ok: ok });
  },
  status: (userId) => rpc('ai_status', { p_user: userId }),
  call: async (provider, model, body, signal) => {
    const res = provider === 'gemini'
      ? await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': KEYS.gemini },
        body: JSON.stringify(body),
        signal,
      })
      : await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${KEYS.openrouter}`, 'http-referer': 'https://intus.fit', 'x-title': 'Intus' },
        body: JSON.stringify(body),
        signal,
      });
    return { status: res.status, json: await res.json().catch(() => null) };
  },
  log: (message) => console.error(message),
}));
