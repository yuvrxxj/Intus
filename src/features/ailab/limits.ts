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

/** What was met in the runs that is in neither the headers nor the page. Each note is what Groq's answer said, in short. */
export const OBSERVED: Readonly<Record<string, string>> = {
  'qwen/qwen3.8-27b': 'Also capped at 1,000 output tokens a minute. Not in the headers: the only sign is a 429 naming OTPM, which refuses a request whose expected output is over it and says to reduce max_tokens.',
  'openai/gpt-oss-safeguard-20b': 'A chunk of a report (about 3,400 tokens) is refused outright: Groq counted 4,107 requested against a limit of 2,000 a minute.',
  'allam-2-7b': 'Answered 400, failed to generate JSON, on the first chunk. Its context is 4,096 tokens, which leaves little room for the prompt and a reply. Not tried with smaller chunks.',
};
