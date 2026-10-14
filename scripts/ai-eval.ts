#!/usr/bin/env node
// Tries models on a lab report and scores them, so the choice of model is made on a real report and not on a hunch.
//
//   node scripts/report-text.ts report.pdf --name FirstName > report.txt      the text that would be sent
//   node scripts/ai-eval.ts --list-free                                    OpenRouter's free models (public list, no key)
//   OPENROUTER_API_KEY=... node scripts/ai-eval.ts report.txt --models vendor/model-a:free,vendor/model-b:free
//   GEMINI_API_KEY=...     node scripts/ai-eval.ts report.txt --provider gemini --models gemini-flash-lite-latest
//
// It sends the request the app's Edge Function sends (supabase/functions/read-report/prompt.ts), so a model that scores
// well here behaves the same in the app. OpenRouter requests carry `data_collection: deny`: a model with no host that
// promises not to keep or train on prompts fails with "no endpoints" and is reported as unusable, which is the answer.
//
// Trying hosts that are free because they may keep or train on prompts (OpenRouter's `:free` models, any other free
// tier) takes `--allow-training`, which leaves that rule out. Use it with scripts/ai-eval-sample-report.txt, an invented
// report, and never with a real one. Any other host that speaks the chat-completions format works with `--base-url`
// and `--key-env`, and needs `--allow-training`, because only OpenRouter can be told to refuse hosts that keep prompts:
//
//   OPENROUTER_API_KEY=... node scripts/ai-eval.ts scripts/ai-eval-sample-report.txt --allow-training --json-mode object \
//     --models google/gemma-4-31b-it:free,nvidia/nemotron-3-super-120b-a12b:free
//   GROQ_API_KEY=... node scripts/ai-eval.ts scripts/ai-eval-sample-report.txt --allow-training --max-tokens 4096 \
//     --base-url https://api.groq.com/openai/v1 --key-env GROQ_API_KEY --models openai/gpt-oss-120b,openai/gpt-oss-20b
//   (Groq's base limits are 8K tokens a minute, so keep --max-tokens small and the report short.)
//   CLOUDFLARE_API_KEY=... node scripts/ai-eval.ts scripts/ai-eval-sample-report.txt --allow-training --json-mode object \
//     --base-url https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/ai/v1 --key-env CLOUDFLARE_API_KEY \
//     --models @cf/openai/gpt-oss-120b
// The report is read the way the on-device reader reads it, and a model is scored on how many of those results it
// reproduces, how many extra it finds that the report really prints, and how many it gets wrong or invents.
// Only marker names and numbers are printed, never lines of the report.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { verifyAiRows, type AiRow } from '../src/features/reports/aiRows.ts';
import { parseReport, type MarkerRef, type ParsedRow } from '../src/features/reports/parse.ts';
import { buildChatRequest, buildGeminiRequest, parseReply, ReadError, type JsonMode, type MarkerInfo, type Provider } from '../supabase/functions/read-report/prompt.ts';

export interface Score {
  /** results the on-device reader found for tracked markers */
  deviceKnown: number;
  /** the model's checked results for tracked markers */
  aiKnown: number;
  agree: number;
  conflicts: { marker: string; ai: number; device: number }[];
  /** tracked markers only the model found, and results for tests Intus does not track */
  aiOnly: string[];
  deviceOnly: string[];
  extraUntracked: number;
  returned: number;
  kept: number;
  dropped: number;
}

/** How a model's checked rows compare with the on-device reader's. */
export function score(ai: readonly ParsedRow[], device: readonly ParsedRow[], returned: number, dropped: number, name: (id: string) => string): Score {
  const known = (rows: readonly ParsedRow[]) => rows.filter((r) => r.biomarkerId !== null);
  const aiBy = new Map<string, number[]>();
  for (const r of known(ai)) aiBy.set(r.biomarkerId!, [...(aiBy.get(r.biomarkerId!) ?? []), r.value!]);
  const devBy = new Map<string, number[]>();
  for (const r of known(device)) devBy.set(r.biomarkerId!, [...(devBy.get(r.biomarkerId!) ?? []), r.value!]);
  let agree = 0;
  const conflicts: Score['conflicts'] = [];
  const deviceOnly: string[] = [];
  for (const [id, values] of devBy) {
    const theirs = aiBy.get(id);
    if (!theirs) deviceOnly.push(name(id));
    else if (values.some((v) => theirs.includes(v))) agree++;
    else conflicts.push({ marker: name(id), ai: theirs[0], device: values[0] });
  }
  const aiOnly = [...aiBy.keys()].filter((id) => !devBy.has(id)).map(name);
  return {
    deviceKnown: devBy.size, aiKnown: aiBy.size, agree, conflicts, aiOnly, deviceOnly,
    extraUntracked: ai.filter((r) => r.biomarkerId === null).length,
    returned, kept: ai.length, dropped,
  };
}

const DEFAULT_BASE = 'https://openrouter.ai/api/v1';

interface Options {
  provider: Provider;
  models: string[];
  mode: JsonMode;
  base: string;
  maxTokens: number;
  priceIn: number;
  priceOut: number;
  /** the environment variable that holds the key; the provider's usual one when empty */
  keyEnv: string;
  /** leave out `data_collection: deny`, to try hosts that may keep or train on prompts. Invented reports only. */
  allowTraining: boolean;
}

const keyName = (o: Pick<Options, 'provider' | 'keyEnv'>) => o.keyEnv || (o.provider === 'gemini' ? 'GEMINI_API_KEY' : 'OPENROUTER_API_KEY');

/** The request for one model. Chat requests carry the privacy rule from prompt.ts unless the run opted out of it. */
export function evalRequest(o: Pick<Options, 'provider' | 'mode' | 'maxTokens' | 'allowTraining'>, model: string, text: string, markers: readonly MarkerInfo[]) {
  if (o.provider === 'gemini') return buildGeminiRequest(text, markers, o.maxTokens);
  const request = buildChatRequest(model, text, markers, o.maxTokens, o.mode);
  if (!o.allowTraining) return request;
  const { provider: _privacyRule, ...withoutIt } = request;
  return withoutIt;
}

async function runModel(model: string, text: string, markers: MarkerInfo[], refs: MarkerRef[], device: ParsedRow[], o: Options) {
  const started = Date.now();
  const key = process.env[keyName(o)];
  if (!key) return { model, error: `set ${keyName(o)}` };
  const sentLines = text.split('\n');
  const request = evalRequest(o, model, text, markers);
  const res = await fetch(
    o.provider === 'gemini' ? `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent` : `${o.base}/chat/completions`,
    {
      method: 'POST',
      headers: o.provider === 'gemini' ? { 'content-type': 'application/json', 'x-goog-api-key': key } : { 'content-type': 'application/json', authorization: `Bearer ${key}`, 'x-title': 'Intus model test' },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(180_000),
    },
  ).catch((e: Error) => e);
  if (res instanceof Error) return { model, error: `no answer: ${res.message}` };
  const json: unknown = await res.json().catch(() => null);
  const seconds = (Date.now() - started) / 1000;
  if (res.status !== 200) {
    const message = (json as { error?: { message?: string } } | null)?.error?.message ?? '';
    return { model, error: `HTTP ${res.status}${message ? `: ${message.slice(0, 160)}` : ''}`, seconds };
  }
  try {
    const parsed = parseReply(o.provider, json);
    const verified = verifyAiRows(sentLines, parsed.rows as AiRow[], refs);
    const name = (id: string) => refs.find((r) => r.id === id)?.name ?? id;
    const cost = parsed.inputTokens !== null && parsed.outputTokens !== null ? (parsed.inputTokens * o.priceIn + parsed.outputTokens * o.priceOut) / 1e6 : null;
    return { model, seconds, inputTokens: parsed.inputTokens, outputTokens: parsed.outputTokens, cost, score: score(verified.rows, device, parsed.rows.length, verified.dropped + parsed.skipped, name) };
  } catch (e) {
    return { model, error: e instanceof ReadError ? `answer not usable: ${e.code}` : String(e), seconds };
  }
}

function show(r: Awaited<ReturnType<typeof runModel>>) {
  if ('error' in r) return console.log(`\n${r.model}\n  UNUSABLE  ${r.error}${r.seconds ? `  (${r.seconds.toFixed(1)}s)` : ''}`);
  const s = r.score;
  const pct = (a: number, b: number) => (b === 0 ? 'n/a' : `${Math.round((100 * a) / b)}%`);
  console.log(`\n${r.model}`);
  console.log(`  ${r.seconds.toFixed(1)}s  tokens in/out ${r.inputTokens ?? '?'}/${r.outputTokens ?? '?'}${r.cost === null ? '' : `  cost about $${r.cost.toFixed(4)} at the prices given`}`);
  console.log(`  returned ${s.returned}, kept after checking against the text ${s.kept}, dropped as not on the report ${s.dropped}`);
  console.log(`  tracked markers: the on-device reader found ${s.deviceKnown}; the model reproduced ${s.agree} (${pct(s.agree, s.deviceKnown)}), disagreed on ${s.conflicts.length}, missed ${s.deviceOnly.length}, found ${s.aiOnly.length} more`);
  console.log(`  results for tests Intus does not track: ${s.extraUntracked}`);
  for (const c of s.conflicts) console.log(`    DISAGREES  ${c.marker}: model ${c.ai}, device ${c.device}`);
  if (s.deviceOnly.length) console.log(`    missed: ${s.deviceOnly.join(', ')}`);
  if (s.aiOnly.length) console.log(`    extra: ${s.aiOnly.join(', ')}`);
}

async function listFree(base: string) {
  const res = await fetch(`${base}/models`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const { data } = (await res.json()) as { data: { id: string; name: string; context_length: number; pricing: { prompt: string; completion: string }; supported_parameters?: string[]; architecture?: { input_modalities?: string[] } }[] };
  const free = data.filter((m) => m.id.endsWith(':free') || (Number(m.pricing.prompt) === 0 && Number(m.pricing.completion) === 0));
  free.sort((a, b) => b.context_length - a.context_length || a.id.localeCompare(b.id));
  console.log(`${free.length} free models of ${data.length}. "json" = the host lists structured outputs or JSON mode; models need it to be tried with --json-mode schema.\n`);
  for (const m of free) {
    const p = m.supported_parameters ?? [];
    const json = p.includes('structured_outputs') ? 'schema' : p.includes('response_format') ? 'object' : 'none';
    console.log(`${m.id.padEnd(60)} ${String(Math.round(m.context_length / 1000) + 'k').padStart(6)}  json:${json.padEnd(6)} ${(m.architecture?.input_modalities ?? []).includes('text') ? '' : 'NO TEXT INPUT'}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const flag = (name: string, fallback = '') => {
    const i = args.indexOf(`--${name}`);
    return i === -1 ? fallback : (args[i + 1] ?? fallback);
  };
  const base = flag('base-url', DEFAULT_BASE);
  if (args.includes('--list-free')) return listFree(base);
  const file = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
  const models = flag('models').split(',').map((m) => m.trim()).filter(Boolean);
  if (!file || models.length === 0) {
    console.error('usage: node scripts/ai-eval.ts report.txt --models a,b [--provider openrouter|gemini] [--json-mode schema|object] [--price-in 0.25 --price-out 1.5]\n         [--base-url URL --key-env NAME] [--allow-training]\n       node scripts/ai-eval.ts --list-free');
    process.exit(2);
  }
  const markersFile = JSON.parse(readFileSync(new URL('./ai-eval-markers.json', import.meta.url), 'utf8')) as MarkerInfo[];
  const refs: MarkerRef[] = markersFile.map((m) => ({ id: m.code, ...m }));
  const text = readFileSync(file, 'utf8').trim();
  const device = parseReport(text.split('\n'), refs).rows;
  const options: Options = {
    provider: flag('provider', 'openrouter') === 'gemini' ? 'gemini' : 'openrouter',
    models, base, mode: flag('json-mode', 'schema') === 'object' ? 'object' : 'schema',
    maxTokens: Number(flag('max-tokens', '16384')), priceIn: Number(flag('price-in', '0')), priceOut: Number(flag('price-out', '0')),
    keyEnv: flag('key-env'), allowTraining: args.includes('--allow-training'),
  };
  if (options.provider === 'openrouter' && base !== DEFAULT_BASE && !options.allowTraining) {
    console.error('Only OpenRouter can be told to refuse hosts that keep or train on prompts. For another host, pass --allow-training and use an invented report.');
    process.exit(2);
  }
  // A report that may be kept or trained on must be one nobody owns: the sample file says so on its first line.
  if (options.allowTraining && !/invented report for testing/i.test(text.split('\n').slice(0, 3).join(' '))) {
    console.error('--allow-training is only for invented reports, which say "INVENTED REPORT FOR TESTING" at the top (see scripts/ai-eval-sample-report.txt). This file does not, so nothing was sent.');
    process.exit(2);
  }
  if (options.allowTraining) console.log('TRAINING ALLOWED: the privacy rule is left out, so these hosts may keep or train on the invented report below. Not what the app does.');
  console.log(`${text.split('\n').length} lines, about ${Math.round(text.length / 3.5)} tokens. The on-device reader finds ${device.length} results, ${device.filter((r) => r.biomarkerId).length} for tracked markers.`);
  for (const model of models) show(await runModel(model, text, markersFile, refs, device, options));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
