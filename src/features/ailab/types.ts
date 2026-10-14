// The shapes the benchmark writes and the AI lab page reads. The ledger and the results hold only measurements: tokens,
// seconds, dollars, counts. A run file also holds the rows read from a real report, so it stays on the machine that made
// it (test-lab/local/ is not in git) and is only ever opened from there or picked by hand.
import type { ParsedRow } from '../reports/parse.ts';
import type { Config, Rate, Usage } from './groq.ts';
import type { Detail, Score } from './score.ts';

export interface CallRecord {
  /** 1-based position in the report */
  chunk: number;
  inputChars: number;
  status: number | null;
  ok: boolean;
  /** why the call gave no usable rows: a limit (tpm, tpd, rpm, rpd, too_large), truncated, malformed, empty, network, http */
  failure: string | null;
  /** what Groq said when it did not answer, shortened and without the organization's id */
  error?: string;
  attempts: number;
  /** how many of the attempts were answered with a 429 */
  limited: number;
  /** seconds the harness held back to stay inside the token limit */
  waitedS: number;
  /** seconds from sending the request to its answer, for the last attempt */
  wallS: number;
  usage: Usage | null;
  costUsd: number | null;
  rate: Rate | null;
  finish: string | null;
  returnedRows: number;
}

export interface Totals {
  /** seconds from the first request to the last answer, waiting included */
  elapsedS: number;
  /** seconds spent in requests alone */
  requestS: number;
  waitedS: number;
  promptTokens: number;
  completionTokens: number;
  reasoningTokens: number;
  cachedTokens: number;
  /** at the listed pay-as-you-go prices; null when the model has none listed */
  costUsd: number | null;
  /** attempts beyond the first, and how many answers were a 429 */
  retries: number;
  rateLimited: number;
}

export interface RunMetrics {
  id: string;
  at: string;
  config: Config;
  chunkChars: number;
  maxTokens: number;
  /** chunks sent, and chunks in the whole report (fewer sent means a trial of one setting on the first part) */
  chunks: number;
  totalChunks: number;
  /** the whole report was sent and every chunk gave usable rows */
  complete: boolean;
  calls: CallRecord[];
  totals: Totals;
  score: Score | null;
  /** the list price per million tokens when the run was made */
  pricePerMillion: { prompt: number; completion: number } | null;
}

export interface RunFile extends RunMetrics {
  /** the report's date, as the on-device reader found it */
  date: string | null;
  rows: ParsedRow[];
  detail: Detail | null;
}

/** One model with the limits Groq reported for this key and what it lists for the model. */
export interface ModelFacts {
  id: string;
  contextWindow: number | null;
  maxCompletion: number | null;
  features: string[];
  pricePerMillion: { prompt: number; completion: number; cachedPrompt: number } | null;
  tokensPerMinute: number | null;
  requestsPerDay: number | null;
}
