#!/usr/bin/env node
// Reads one lab report with each Groq model setting asked for and measures it: tokens, seconds, cost at list prices, the
// limits Groq reports, and how much of what the on-device reader finds the model finds too. For the Intus AI lab.
//
//   node scripts/report-text.ts report.pdf --name FirstName > report.txt         the redacted text that is sent
//   node scripts/groq-bench.ts report.txt --plan openai/gpt-oss-20b:low,qwen/qwen3.8-27b:default
//   node scripts/groq-bench.ts --models                                        what Groq lists, with prices
//
// The Groq key is not read from this repository. In Claude's cloud session the network proxy adds it to requests for
// api.groq.com, and Node's fetch only uses that proxy when run with NODE_USE_ENV_PROXY=1 (without it Groq answers 401);
// anywhere else, set GROQ_API_KEY. The report is sent in chunks, because this key's limit is 8,000 tokens a
// minute and a whole report does not fit in one request. Requests are paced from the headers Groq sends back, a
// per-minute limit is waited out and retried, and a per-day limit stops the run. Every call is added to the ledger
// (measurements only). The rows a model read go to a run file, which holds report lines, so it stays out of git.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildGroqRequest, chunkLines, configName, costOf, GROQ_BASE, guessTokens, limitKind, priceOf, readRate, readUsage, secondsToWait, tidyError, type Config, type Effort, type Price, type Rate } from '../src/features/ailab/groq.ts';
import { scoreRows } from '../src/features/ailab/score.ts';
import type { CallRecord, ModelFacts, RunFile, Totals } from '../src/features/ailab/types.ts';
import { verifyAiRows, type AiRow } from '../src/features/reports/aiRows.ts';
import { parseReport, tidyRows, type MarkerRef, type ParsedRow } from '../src/features/reports/parse.ts';
import { parseChatResponse, ReadError, SYSTEM_PROMPT, type MarkerInfo } from '../supabase/functions/read-report/prompt.ts';

interface CatalogueEntry {
  id: string;
  context_window?: number;
  max_completion_tokens?: number;
  active?: boolean;
  supported_features?: string[];
  pricing?: { prompt?: string; completion?: string; input_cache_read?: string } | null;
  output_modalities?: string[];
}

const sleep = (s: number) => new Promise((r) => setTimeout(r, s * 1000));
const EFFORTS = new Set<string>(['none', 'default', 'low', 'medium', 'high']);

class QuotaExhausted extends Error {}

const authHeaders = (): Record<string, string> => (process.env.GROQ_API_KEY ? { authorization: `Bearer ${process.env.GROQ_API_KEY}` } : {});

async function catalogue(): Promise<CatalogueEntry[]> {
  const res = await fetch(`${GROQ_BASE}/models`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`could not list models: HTTP ${res.status}`);
  return ((await res.json()) as { data: CatalogueEntry[] }).data;
}

const perMillion = (p: Price | null) => (p ? { prompt: p.prompt * 1e6, completion: p.completion * 1e6 } : null);

function parsePlan(text: string, models: readonly CatalogueEntry[]): Config[] {
  // model, then :effort, then @schema or @object to override the JSON mode: openai/gpt-oss-20b:medium@object
  return text.split(',').map((raw) => {
    const [item, forced] = raw.split('@');
    const i = item.lastIndexOf(':');
    const tail = i === -1 ? '' : item.slice(i + 1).trim();
    const hasEffort = EFFORTS.has(tail);
    const model = (hasEffort ? item.slice(0, i) : item).trim();
    const entry = models.find((m) => m.id === model);
    if (!entry) throw new Error(`Groq does not list a model called "${model}"`);
    const mode = forced === 'object' || forced === 'schema' ? forced : entry.supported_features?.includes('structured_outputs') ? 'schema' : 'object';
    return { model, effort: hasEffort ? (tail as Effort) : null, mode } satisfies Config;
  });
}

/** Tokens already spent on a model in the last 24 hours, from the ledger, to stay inside the daily limit. */
function spentToday(ledger: string, model: string): number {
  if (!existsSync(ledger)) return 0;
  const since = Date.now() - 24 * 3600 * 1000;
  let total = 0;
  for (const line of readFileSync(ledger, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const run = JSON.parse(line) as { at: string; config: Config; totals: Totals };
    if (run.config.model === model && Date.parse(run.at) >= since) total += run.totals.promptTokens + run.totals.completionTokens;
  }
  return total;
}

interface Context {
  refs: MarkerRef[];
  markers: MarkerInfo[];
  lines: string[];
  device: ParsedRow[];
  date: string | null;
  chunks: string[][];
  /** how many there are in the whole report, when only the first few are sent */
  totalChunks: number;
  chunkChars: number;
  maxTokens: number;
  catalogue: CatalogueEntry[];
  ledger: string;
  out: string;
  dayBudget: number;
  /** what the last answer said about the limits, per model, and when */
  last: Map<string, { rate: Rate; at: number }>;
  facts: Map<string, ModelFacts>;
}

/** Seconds to hold back before sending `need` tokens' worth, counting what has refilled since the last answer. */
function holdBack(ctx: Context, model: string, need: number): number {
  const last = ctx.last.get(model);
  if (!last || last.rate.tokensLeft === null || last.rate.tokensPerMinute === null) return 0;
  const refilled = ((Date.now() - last.at) / 1000) * (last.rate.tokensPerMinute / 60);
  return secondsToWait({ ...last.rate, tokensLeft: Math.min(last.rate.tokensPerMinute, last.rate.tokensLeft + refilled) }, need);
}

async function callChunk(ctx: Context, c: Config, chunk: string[], index: number, price: Price | null): Promise<{ record: CallRecord; rows: ParsedRow[]; dropped: number; returned: number; quota?: string }> {
  const text = chunk.join('\n');
  const body = JSON.stringify(buildGroqRequest(c, text, ctx.markers, ctx.maxTokens));
  const overhead = SYSTEM_PROMPT.length + ctx.markers.length * 40;
  const need = guessTokens(text.length + overhead) + ctx.maxTokens;
  const record: CallRecord = { chunk: index + 1, inputChars: text.length, status: null, ok: false, failure: null, attempts: 0, limited: 0, waitedS: 0, wallS: 0, usage: null, costUsd: null, rate: null, finish: null, returnedRows: 0 };
  const fail = (failure: string) => ({ record: { ...record, failure }, rows: [] as ParsedRow[], dropped: 0, returned: 0 });

  for (let attempt = 1; attempt <= 4; attempt++) {
    const hold = holdBack(ctx, c.model, need);
    if (hold > 0) {
      console.log(`    waiting ${hold}s for the token limit to refill`);
      await sleep(hold);
      record.waitedS += hold;
    }
    record.attempts = attempt;
    const started = Date.now();
    const res = await fetch(`${GROQ_BASE}/chat/completions`, { method: 'POST', headers: { 'content-type': 'application/json', ...authHeaders() }, body, signal: AbortSignal.timeout(180_000) }).catch((e: Error) => e);
    record.wallS = (Date.now() - started) / 1000;
    if (res instanceof Error) {
      console.log(`    no answer (${res.message}), attempt ${attempt}`);
      record.failure = 'network';
      await sleep(5);
      continue;
    }
    record.status = res.status;
    record.rate = readRate(res.headers);
    if (record.rate.tokensLeft !== null) ctx.last.set(c.model, { rate: record.rate, at: Date.now() });
    const json: unknown = await res.json().catch(() => null);

    if (res.status === 200) {
      record.usage = readUsage(json);
      record.costUsd = record.usage ? costOf(record.usage, price) : null;
      record.finish = ((json as { choices?: { finish_reason?: string }[] } | null)?.choices?.[0]?.finish_reason) ?? null;
      try {
        const parsed = parseChatResponse(json);
        record.returnedRows = parsed.rows.length;
        const verified = verifyAiRows(chunk, parsed.rows as AiRow[], ctx.refs);
        record.ok = true;
        record.failure = null;
        return { record, rows: verified.rows, dropped: verified.dropped + parsed.skipped, returned: parsed.rows.length };
      } catch (e) {
        // the usage is already on the record: the provider did the work and charges for it, usable or not
        return fail(e instanceof ReadError ? e.code : 'unreadable');
      }
    }

    const message = ((json as { error?: { message?: string } } | null)?.error?.message ?? '').slice(0, 600);
    const kind = limitKind(res.status, message);
    record.error = tidyError(message);
    console.log(`    HTTP ${res.status} ${kind !== 'unknown' ? `(${kind}) ` : ''}${record.error.slice(0, 260)}`);
    if (res.status === 413 || kind === 'too_large') return fail('too_large');
    if (res.status === 429) {
      record.limited++;
      record.failure = kind === 'unknown' ? 'rate_limited' : kind;
      // a daily limit does not clear by waiting: stop, and let the run be written with what it has
      if (kind === 'tpd' || kind === 'rpd') return { ...fail(kind), quota: `${c.model}: ${record.error}` };
      const wait = Math.ceil(record.rate.retryAfterS ?? 20) + 1;
      console.log(`    rate limited, waiting ${wait}s`);
      await sleep(wait);
      record.waitedS += wait;
      continue;
    }
    if (res.status >= 500) {
      record.failure = 'http';
      await sleep(5 * attempt);
      continue;
    }
    return fail(`http_${res.status}`);
  }
  return { record: { ...record, failure: record.failure ?? 'gave_up' }, rows: [], dropped: 0, returned: 0 };
}

async function runOne(ctx: Context, c: Config): Promise<RunFile | null> {
  const entry = ctx.catalogue.find((m) => m.id === c.model)!;
  const price = priceOf(entry);
  const spent = spentToday(ctx.ledger, c.model);
  if (spent + ctx.chunks.length * (ctx.maxTokens + 4000) * 0.5 > ctx.dayBudget) {
    console.log(`\n${configName(c)}: skipped, ${spent} tokens already used in the last 24 hours against a self-set budget of ${ctx.dayBudget}`);
    return null;
  }
  const id = `${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}-${c.model.replace(/[^a-z0-9.]+/gi, '-')}-${c.effort ?? 'plain'}`;
  console.log(`\n${configName(c)}  (${c.mode} mode, ${ctx.chunks.length} chunks)  run ${id}`);
  const started = Date.now();
  const calls: CallRecord[] = [];
  const rows: ParsedRow[] = [];
  let dropped = 0;
  let returned = 0;
  let quota: string | null = null;
  for (let i = 0; i < ctx.chunks.length; i++) {
    const r = await callChunk(ctx, c, ctx.chunks[i], i, price);
    calls.push(r.record);
    if (r.quota) {
      quota = r.quota;
      break;
    }
    rows.push(...r.rows);
    dropped += r.dropped;
    returned += r.returned;
    const u = r.record.usage;
    console.log(`  chunk ${i + 1}/${ctx.chunks.length}: ${r.record.ok ? 'ok' : `FAILED ${r.record.failure}`}  ${r.record.wallS.toFixed(1)}s  in ${u?.promptTokens ?? '?'} (cached ${u?.cachedTokens ?? 0})  out ${u?.completionTokens ?? '?'} (reasoning ${u?.reasoningTokens ?? 0})  rows ${r.record.returnedRows}  left ${r.record.rate?.tokensLeft ?? '?'} tokens`);
    if (r.record.rate) {
      const f = ctx.facts.get(c.model);
      if (f) {
        f.tokensPerMinute = r.record.rate.tokensPerMinute ?? f.tokensPerMinute;
        f.requestsPerDay = r.record.rate.requestsPerDay ?? f.requestsPerDay;
      }
    }
  }
  const sum = (f: (r: CallRecord) => number) => calls.reduce((a, r) => a + f(r), 0);
  const costs = calls.map((r) => r.costUsd);
  const totals: Totals = {
    elapsedS: (Date.now() - started) / 1000,
    requestS: sum((r) => r.wallS),
    waitedS: sum((r) => r.waitedS),
    promptTokens: sum((r) => r.usage?.promptTokens ?? 0),
    completionTokens: sum((r) => r.usage?.completionTokens ?? 0),
    reasoningTokens: sum((r) => r.usage?.reasoningTokens ?? 0),
    cachedTokens: sum((r) => r.usage?.cachedTokens ?? 0),
    costUsd: costs.every((x) => x === null) ? null : costs.reduce<number>((a, x) => a + (x ?? 0), 0),
    retries: sum((r) => Math.max(0, r.attempts - 1)),
    rateLimited: sum((r) => r.limited),
  };
  const merged = tidyRows(rows);
  const nameOf = (rid: string) => ctx.refs.find((m) => m.id === rid)?.name ?? rid;
  const { score, detail } = calls.some((r) => r.ok) ? scoreRows(merged, ctx.device, returned, dropped, nameOf) : { score: null, detail: null };
  const run: RunFile = {
    id, at: new Date().toISOString(), config: c, chunkChars: ctx.chunkChars, maxTokens: ctx.maxTokens, chunks: ctx.chunks.length, totalChunks: ctx.totalChunks,
    complete: ctx.chunks.length === ctx.totalChunks && calls.every((r) => r.ok), calls, totals, score, pricePerMillion: perMillion(price), date: ctx.date, rows: merged, detail,
  };
  mkdirSync(ctx.out, { recursive: true });
  writeFileSync(join(ctx.out, `${id}.run.json`), JSON.stringify(run, null, 1));
  const { rows: _rows, detail: _detail, date: _date, ...metrics } = run;
  mkdirSync(dirname(ctx.ledger), { recursive: true });
  appendFileSync(ctx.ledger, `${JSON.stringify(metrics)}\n`);
  show(run);
  if (quota) throw new QuotaExhausted(quota);
  return run;
}

function show(r: RunFile) {
  const t = r.totals;
  const s = r.score;
  console.log(`  => ${r.complete ? 'complete' : 'INCOMPLETE'}  ${t.elapsedS.toFixed(0)}s in all (${t.requestS.toFixed(1)}s in requests, ${t.waitedS.toFixed(0)}s held back)  tokens in ${t.promptTokens} out ${t.completionTokens} (reasoning ${t.reasoningTokens})  cost ${t.costUsd === null ? 'n/a' : `$${t.costUsd.toFixed(5)}`}`);
  if (s) console.log(`     found ${s.matched}/${s.reference} of the on-device reader's results (${Math.round(s.recall * 100)}%), ${s.extra} more, tracked ${s.trackedMatched}/${s.trackedReference}, marker differs on ${s.differentMarker}, tracked-number conflicts ${s.trackedConflicts}, dropped as not printed ${s.dropped}`);
}

async function main() {
  const args = process.argv.slice(2);
  const flag = (name: string, fallback = '') => {
    const i = args.indexOf(`--${name}`);
    return i === -1 ? fallback : (args[i + 1] ?? fallback);
  };
  const models = await catalogue();
  if (args.includes('--models')) {
    for (const m of models.filter((x) => x.output_modalities?.includes('text')).sort((a, b) => a.id.localeCompare(b.id))) {
      const p = priceOf(m);
      console.log(`${m.id.padEnd(40)} context ${String(m.context_window).padStart(7)}  max out ${String(m.max_completion_tokens).padStart(6)}  ${p ? `$${(p.prompt * 1e6).toFixed(3)} in / $${(p.completion * 1e6).toFixed(3)} out per M` : 'no price listed'}  ${m.supported_features?.join(',') ?? ''}`);
    }
    return;
  }
  const file = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
  const plan = flag('plan');
  if (!file || !plan) {
    console.error('usage: node scripts/groq-bench.ts report.txt --plan model:effort,model:effort [--repeats 1] [--chunk-chars 7000] [--max-tokens 3600] [--out test-lab/local] [--ledger docs/ai-testing/ledger.jsonl] [--day-budget 150000]\n       node scripts/groq-bench.ts --models');
    process.exit(2);
  }
  const markersFile = JSON.parse(readFileSync(new URL('./ai-eval-markers.json', import.meta.url), 'utf8')) as MarkerInfo[];
  const refs: MarkerRef[] = markersFile.map((m) => ({ id: m.code, ...m }));
  const lines = readFileSync(file, 'utf8').trim().split('\n');
  const parsed = parseReport(lines, refs);
  const chunkChars = Number(flag('chunk-chars', '7000'));
  const everyChunk = chunkLines(lines, chunkChars);
  // --first 1 sends only the first chunk, to try a setting before spending a whole report's tokens on it
  const first = Number(flag('first', '0'));
  const ctx: Context = {
    refs, markers: markersFile, lines, device: parsed.rows, date: parsed.date, chunks: first > 0 ? everyChunk.slice(0, first) : everyChunk, totalChunks: everyChunk.length, chunkChars,
    maxTokens: Number(flag('max-tokens', '3600')), catalogue: models, ledger: flag('ledger', 'docs/ai-testing/ledger.jsonl'), out: flag('out', 'test-lab/local'),
    dayBudget: Number(flag('day-budget', '150000')), last: new Map(),
    facts: new Map(models.map((m) => {
      const p = priceOf(m);
      return [m.id, { id: m.id, contextWindow: m.context_window ?? null, maxCompletion: m.max_completion_tokens ?? null, features: m.supported_features ?? [], pricePerMillion: p ? { prompt: p.prompt * 1e6, completion: p.completion * 1e6, cachedPrompt: p.cacheRead * 1e6 } : null, tokensPerMinute: null, requestsPerDay: null }];
    })),
  };
  const configs = parsePlan(plan, models);
  console.log(`${lines.length} lines in ${ctx.chunks.length} chunks of up to ${chunkChars} characters. The on-device reader finds ${ctx.device.length} results, ${ctx.device.filter((r) => r.biomarkerId).length} for tracked markers.`);
  if (args.includes('--dry-run')) {
    for (const c of configs) console.log(`would run ${configName(c)} (${c.mode})`);
    return;
  }
  const repeats = Number(flag('repeats', '1'));
  try {
    for (const c of configs) for (let n = 0; n < repeats; n++) await runOne(ctx, c);
  } catch (e) {
    if (!(e instanceof QuotaExhausted)) throw e;
    console.error(`\nSTOPPED: a daily limit was reached. ${e.message}`);
    process.exitCode = 3;
  }
  const factsFile = flag('facts', join(dirname(ctx.ledger), 'models.json'));
  const known = existsSync(factsFile) ? (JSON.parse(readFileSync(factsFile, 'utf8')) as ModelFacts[]) : [];
  const touched = new Set(configs.map((c) => c.model));
  const next = [...known.filter((k) => !touched.has(k.id)), ...[...touched].map((id) => ctx.facts.get(id)!)].sort((a, b) => a.id.localeCompare(b.id));
  writeFileSync(factsFile, JSON.stringify(next, null, 1));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
