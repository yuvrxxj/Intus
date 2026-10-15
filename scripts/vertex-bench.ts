#!/usr/bin/env node
// Reads one lab report with each Google Vertex AI (Gemini) setting asked for and measures it the way scripts/groq-bench.ts
// does: tokens, seconds, cost at list prices, and how much of what the on-device reader finds the model finds too. For the
// Intus AI lab.
//
//   node scripts/report-text.ts report.pdf --name FirstName > report.txt         the redacted text that is sent
//   node scripts/vertex-bench.ts report.txt --plan gemini-2.5-flash:default,gemini-3.5-flash:low
//   node scripts/vertex-bench.ts --models                                        the models and prices this lab knows
//
// Credentials: a service account key, never read from this repository. In Claude's cloud session it is in the environment
// as GOOGLE_SERVICE_ACCOUNT_JSON_B64 (base64 of the key file); elsewhere set GOOGLE_SERVICE_ACCOUNT_JSON (the key file's
// text) or GOOGLE_APPLICATION_CREDENTIALS (its path). The key signs a one-hour token in memory; neither is printed or written.
// Node's fetch only uses the session's proxy when run with NODE_USE_ENV_PROXY=1.
//
// Unlike Groq's free key there is no 8,000 tokens a minute to stay under, so by default the whole report goes in one
// request, which is how the app sends it, with the app's 16,384-token output cap. --chunk-chars N sends it in pieces instead,
// to compare like for like with the Groq runs. Every call is added to the ledger (measurements only); the rows a model read
// go to a run file, which holds report lines, so it stays out of git.
import { createSign } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chunkLines, configName, costOf, type Price } from '../src/features/ailab/groq.ts';
import { scoreRows } from '../src/features/ailab/score.ts';
import type { CallRecord, RunFile, Totals } from '../src/features/ailab/types.ts';
import { buildVertexRequest, parseVertexPlan, readVertexUsage, tidyVertexError, vertexFinish, vertexModel, vertexPrice, vertexUrl, VERTEX_MODELS, type VertexConfig } from '../src/features/ailab/vertex.ts';
import { verifyAiRows, type AiRow } from '../src/features/reports/aiRows.ts';
import { parseReport, tidyRows, type MarkerRef, type ParsedRow } from '../src/features/reports/parse.ts';
import { parseGeminiResponse, ReadError, type MarkerInfo } from '../supabase/functions/read-report/prompt.ts';

const sleep = (s: number) => new Promise((r) => setTimeout(r, s * 1000));

interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri: string;
  project_id?: string;
}

function loadServiceAccount(): ServiceAccount {
  const env = process.env;
  const text = env.GOOGLE_SERVICE_ACCOUNT_JSON_B64
    ? Buffer.from(env.GOOGLE_SERVICE_ACCOUNT_JSON_B64, 'base64').toString('utf8')
    : env.GOOGLE_SERVICE_ACCOUNT_JSON ?? (env.GOOGLE_APPLICATION_CREDENTIALS ? readFileSync(env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8') : '');
  if (!text) throw new Error('no service account key: set GOOGLE_SERVICE_ACCOUNT_JSON_B64, GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS');
  const sa = JSON.parse(text) as Partial<ServiceAccount>;
  if (!sa.client_email || !sa.private_key || !sa.token_uri) throw new Error('the service account key is missing client_email, private_key or token_uri');
  return sa as ServiceAccount;
}

/** A one-hour access token, signed with the key in memory and renewed a few minutes before it ends. */
function tokenSource(sa: ServiceAccount) {
  let token = '';
  let expires = 0;
  return async (): Promise<string> => {
    if (token && Date.now() < expires - 5 * 60_000) return token;
    const now = Math.floor(Date.now() / 1000);
    const part = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const unsigned = `${part({ alg: 'RS256', typ: 'JWT' })}.${part({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/cloud-platform', aud: sa.token_uri, iat: now, exp: now + 3600 })}`;
    const assertion = `${unsigned}.${createSign('RSA-SHA256').update(unsigned).sign(sa.private_key).toString('base64url')}`;
    const res = await fetch(sa.token_uri, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }) });
    const json = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string };
    if (!res.ok || !json.access_token) throw new Error(`Google would not issue a token: HTTP ${res.status} ${json.error ?? ''}`);
    token = json.access_token;
    expires = Date.now() + (json.expires_in ?? 3600) * 1000;
    return token;
  };
}

interface Context {
  project: string;
  getToken: () => Promise<string>;
  refs: MarkerRef[];
  markers: MarkerInfo[];
  device: ParsedRow[];
  date: string | null;
  chunks: string[][];
  totalChunks: number;
  chunkChars: number;
  maxTokens: number;
  ledger: string;
  out: string;
  /** dollars one invocation may spend before it stops, as a guard against a loop */
  maxCost: number;
  spent: number;
}

async function callChunk(ctx: Context, c: VertexConfig, chunk: string[], index: number, price: Price | null): Promise<{ record: CallRecord; rows: ParsedRow[]; dropped: number; returned: number }> {
  const text = chunk.join('\n');
  const body = JSON.stringify(buildVertexRequest(c, text, ctx.markers, ctx.maxTokens));
  const record: CallRecord = { chunk: index + 1, inputChars: text.length, status: null, ok: false, failure: null, attempts: 0, limited: 0, waitedS: 0, wallS: 0, usage: null, costUsd: null, rate: null, finish: null, returnedRows: 0 };
  const fail = (failure: string) => ({ record: { ...record, failure }, rows: [] as ParsedRow[], dropped: 0, returned: 0 });

  for (let attempt = 1; attempt <= 4; attempt++) {
    record.attempts = attempt;
    const started = Date.now();
    const res = await fetch(vertexUrl(ctx.project, c.location, c.model), { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${await ctx.getToken()}` }, body, signal: AbortSignal.timeout(300_000) }).catch((e: Error) => e);
    record.wallS = (Date.now() - started) / 1000;
    if (res instanceof Error) {
      console.log(`    no answer (${res.message}), attempt ${attempt}`);
      record.failure = 'network';
      await sleep(5 * attempt);
      record.waitedS += 5 * attempt;
      continue;
    }
    record.status = res.status;
    const json: unknown = await res.json().catch(() => null);

    if (res.status === 200) {
      record.usage = readVertexUsage(json);
      record.costUsd = record.usage ? costOf(record.usage, price) : null;
      record.finish = vertexFinish(json);
      try {
        const parsed = parseGeminiResponse(json);
        record.returnedRows = parsed.rows.length;
        const verified = verifyAiRows(chunk, parsed.rows as AiRow[], ctx.refs);
        record.ok = true;
        record.failure = null;
        return { record, rows: verified.rows, dropped: verified.dropped + parsed.skipped, returned: parsed.rows.length };
      } catch (e) {
        // the usage is already on the record: Google did the work and charges for it, usable or not
        return fail(e instanceof ReadError ? e.code : 'unreadable');
      }
    }

    const error = (json as { error?: { message?: string; status?: string } } | null)?.error;
    record.error = tidyVertexError(`${error?.status ?? ''} ${error?.message ?? ''}`);
    console.log(`    HTTP ${res.status} ${record.error.slice(0, 260)}`);
    if (res.status === 429) {
      record.limited++;
      record.failure = 'rate_limited';
      const wait = Math.max(20, Number(res.headers.get('retry-after')) || 0) * attempt;
      console.log(`    rate limited, waiting ${wait}s`);
      await sleep(wait);
      record.waitedS += wait;
      continue;
    }
    if (res.status >= 500) {
      record.failure = 'http';
      await sleep(5 * attempt);
      record.waitedS += 5 * attempt;
      continue;
    }
    return fail(`http_${res.status}`);
  }
  return { record: { ...record, failure: record.failure ?? 'gave_up' }, rows: [], dropped: 0, returned: 0 };
}

async function runOne(ctx: Context, c: VertexConfig): Promise<RunFile | null> {
  const price = vertexPrice(c.model);
  if (ctx.spent >= ctx.maxCost) {
    console.log(`\n${configName(c)}: skipped, this invocation has already spent $${ctx.spent.toFixed(2)} of its $${ctx.maxCost.toFixed(2)} guard (--max-cost)`);
    return null;
  }
  const id = `${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}-vertex-${c.model.replace(/[^a-z0-9.]+/gi, '-')}-${c.effort ?? 'plain'}`;
  console.log(`\n${configName(c)} on Vertex ${c.location}  (${ctx.chunks.length} request${ctx.chunks.length === 1 ? '' : 's'})  run ${id}`);
  const started = Date.now();
  const calls: CallRecord[] = [];
  const rows: ParsedRow[] = [];
  let dropped = 0;
  let returned = 0;
  for (let i = 0; i < ctx.chunks.length; i++) {
    const r = await callChunk(ctx, c, ctx.chunks[i], i, price);
    calls.push(r.record);
    rows.push(...r.rows);
    dropped += r.dropped;
    returned += r.returned;
    const u = r.record.usage;
    console.log(`  request ${i + 1}/${ctx.chunks.length}: ${r.record.ok ? 'ok' : `FAILED ${r.record.failure}`}  ${r.record.wallS.toFixed(1)}s  in ${u?.promptTokens ?? '?'}  out ${u?.completionTokens ?? '?'} (thinking ${u?.reasoningTokens ?? 0})  finish ${r.record.finish ?? '?'}  rows ${r.record.returnedRows}`);
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
  ctx.spent += totals.costUsd ?? 0;
  const merged = tidyRows(rows);
  const nameOf = (rid: string) => ctx.refs.find((m) => m.id === rid)?.name ?? rid;
  const { score, detail } = calls.some((r) => r.ok) ? scoreRows(merged, ctx.device, returned, dropped, nameOf) : { score: null, detail: null };
  const m = vertexModel(c.model)!;
  const run: RunFile = {
    id, at: new Date().toISOString(), config: c, chunkChars: ctx.chunkChars, maxTokens: ctx.maxTokens, chunks: ctx.chunks.length, totalChunks: ctx.totalChunks,
    complete: ctx.chunks.length === ctx.totalChunks && calls.every((r) => r.ok), calls, totals, score, pricePerMillion: { prompt: m.prompt, completion: m.completion }, date: ctx.date, rows: merged, detail,
  };
  mkdirSync(ctx.out, { recursive: true });
  writeFileSync(join(ctx.out, `${id}.run.json`), JSON.stringify(run, null, 1));
  const { rows: _rows, detail: _detail, date: _date, ...metrics } = run;
  mkdirSync(dirname(ctx.ledger), { recursive: true });
  appendFileSync(ctx.ledger, `${JSON.stringify(metrics)}\n`);
  show(run);
  return run;
}

function show(r: RunFile) {
  const t = r.totals;
  const s = r.score;
  console.log(`  => ${r.complete ? 'complete' : 'INCOMPLETE'}  ${t.elapsedS.toFixed(0)}s in all (${t.requestS.toFixed(1)}s in requests, ${t.waitedS.toFixed(0)}s waiting on retries)  tokens in ${t.promptTokens} out ${t.completionTokens} (thinking ${t.reasoningTokens})  cost ${t.costUsd === null ? 'n/a' : `$${t.costUsd.toFixed(5)}`}`);
  if (s) console.log(`     found ${s.matched}/${s.reference} of the on-device reader's results (${Math.round(s.recall * 100)}%), ${s.extra} more, tracked ${s.trackedMatched}/${s.trackedReference}, marker differs on ${s.differentMarker}, tracked-number conflicts ${s.trackedConflicts}, dropped as not printed ${s.dropped}`);
}

async function main() {
  const args = process.argv.slice(2);
  const flag = (name: string, fallback = '') => {
    const i = args.indexOf(`--${name}`);
    return i === -1 ? fallback : (args[i + 1] ?? fallback);
  };
  if (args.includes('--models')) {
    for (const m of VERTEX_MODELS) console.log(`${m.id.padEnd(26)} ${m.location.padEnd(12)} $${m.prompt.toFixed(3)} in / $${m.completion.toFixed(3)} out / $${m.cachedPrompt.toFixed(3)} cached per M${m.note ? `  (${m.note})` : ''}`);
    return;
  }
  const file = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
  const plan = flag('plan');
  if (!file || !plan) {
    console.error('usage: node scripts/vertex-bench.ts report.txt --plan model:thinking@location,... [--repeats 1] [--chunk-chars 0] [--max-tokens 16384] [--first N] [--max-cost 2] [--require-all] [--out test-lab/local] [--ledger docs/ai-testing/ledger.jsonl] [--dry-run]\n       node scripts/vertex-bench.ts --models');
    process.exit(2);
  }
  const markersFile = JSON.parse(readFileSync(new URL('./ai-eval-markers.json', import.meta.url), 'utf8')) as MarkerInfo[];
  const refs: MarkerRef[] = markersFile.map((m) => ({ id: m.code, ...m }));
  const lines = readFileSync(file, 'utf8').trim().split('\n');
  const parsed = parseReport(lines, refs);
  // 0 sends the whole report in one request, which is how the app does it
  const requested = Number(flag('chunk-chars', '0'));
  const wholeChars = lines.reduce((n, l) => n + l.length + 1, 0);
  const chunkChars = requested > 0 ? requested : wholeChars;
  const everyChunk = chunkLines(lines, chunkChars);
  const first = Number(flag('first', '0'));
  // --require-all asks for every field of a row in the response schema, not only name, value and line
  const configs = parseVertexPlan(plan).map((c) => (args.includes('--require-all') ? { ...c, requireAll: true } : c));
  console.log(`${lines.length} lines in ${everyChunk.length} request${everyChunk.length === 1 ? '' : 's'}. The on-device reader finds ${parsed.rows.length} results, ${parsed.rows.filter((r) => r.biomarkerId).length} for tracked markers.`);
  if (args.includes('--dry-run')) {
    for (const c of configs) console.log(`would run ${configName(c)} on Vertex ${c.location}`);
    return;
  }
  const sa = loadServiceAccount();
  const project = process.env.GOOGLE_CLOUD_PROJECT ?? sa.project_id;
  if (!project) throw new Error('no project: set GOOGLE_CLOUD_PROJECT or use a key that names one');
  const ctx: Context = {
    project, getToken: tokenSource(sa), refs, markers: markersFile, device: parsed.rows, date: parsed.date,
    chunks: first > 0 ? everyChunk.slice(0, first) : everyChunk, totalChunks: everyChunk.length, chunkChars,
    maxTokens: Number(flag('max-tokens', '16384')), ledger: flag('ledger', 'docs/ai-testing/ledger.jsonl'), out: flag('out', 'test-lab/local'),
    maxCost: Number(flag('max-cost', '2')), spent: 0,
  };
  const repeats = Number(flag('repeats', '1'));
  for (const c of configs) for (let n = 0; n < repeats; n++) await runOne(ctx, c);
  if (existsSync(ctx.ledger)) console.log(`\nspent $${ctx.spent.toFixed(4)} at list price this time`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
