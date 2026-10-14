// What Groq says each model is allowed, next to what this key was seen to get. Only tokens per minute and requests per day
// come back in the response headers (see readRate in groq.ts); the other figures are from Groq's rate-limits page, read on
// 14 Oct 2026, and are the base limits for the plan this key is on. Groq counts cached input tokens against none of them.

export interface Published {
  rpm: number;
  rpd: number;
  tpm: number;
  tpd: number;
}

export const PUBLISHED: Readonly<Record<string, Published>> = {
  'openai/gpt-oss-120b': { rpm: 30, rpd: 1000, tpm: 8000, tpd: 200_000 },
  'openai/gpt-oss-20b': { rpm: 30, rpd: 1000, tpm: 8000, tpd: 200_000 },
  'openai/gpt-oss-safeguard-20b': { rpm: 3, rpd: 1000, tpm: 2000, tpd: 200_000 },
  'qwen/qwen3.8-27b': { rpm: 30, rpd: 1000, tpm: 8000, tpd: 200_000 },
};

/** Limits met in the runs that are not on the page or in the headers. Each is the message Groq sent, in short. */
export const OBSERVED: Readonly<Record<string, string>> = {
  'qwen/qwen3.8-27b': 'Also capped at 1,000 output tokens a minute (a 429 naming OTPM). Not in the headers, so the only sign is the refusal.',
  'openai/gpt-oss-safeguard-20b': 'A 3,400-token request is refused outright: its limit is 2,000 tokens a minute.',
  'allam-2-7b': 'Context is 4,096 tokens, and it could not produce valid JSON for the reading prompt.',
};
