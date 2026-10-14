import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGroqRequest, chunkLines, configName, costOf, guessTokens, limitKind, parseDuration, priceOf, readRate, readUsage, secondsToWait, tidyError } from '../src/features/ailab/groq.ts';
import { scoreRows } from '../src/features/ailab/score.ts';
import type { ParsedRow } from '../src/features/reports/parse.ts';

const markers = [{ code: 'tsh', name: 'TSH', unit: 'mIU/L' }];

test('chunks hold whole lines, in order, and none is longer than the limit unless one line is', () => {
  const lines = ['aaaa', 'bbbb', 'cccc', 'dddd', 'eeeeeeeeeeeeeeee', 'ff'];
  const chunks = chunkLines(lines, 10);
  assert.deepEqual(chunks, [['aaaa', 'bbbb'], ['cccc', 'dddd'], ['eeeeeeeeeeeeeeee'], ['ff']]);
  assert.deepEqual(chunks.flat(), lines);
  assert.deepEqual(chunkLines([], 10), []);
});

test('the Groq request is the app request without the OpenRouter routing, plus the reasoning setting', () => {
  const plain = buildGroqRequest({ model: 'm', effort: null, mode: 'schema' }, 'text', markers, 1000) as Record<string, unknown>;
  assert.equal('provider' in plain, false);
  assert.equal('reasoning_effort' in plain, false);
  assert.equal(plain.model, 'm');
  assert.equal(plain.temperature, 0);
  assert.equal(plain.max_tokens, 1000);
  assert.equal((plain.response_format as { type: string }).type, 'json_schema');

  const high = buildGroqRequest({ model: 'm', effort: 'high', mode: 'object' }, 'text', markers, 500) as Record<string, unknown>;
  assert.equal(high.reasoning_effort, 'high');
  assert.equal((high.response_format as { type: string }).type, 'json_object');
  const messages = high.messages as { role: string; content: string }[];
  assert.match(messages[1].content, /Tracked markers[\s\S]*tsh: TSH, mIU\/L[\s\S]*Report text:\ntext$/);
});

test('a config is named by its model and effort', () => {
  assert.equal(configName({ model: 'a/b', effort: 'low', mode: 'schema' }), 'a/b (low)');
  assert.equal(configName({ model: 'a/b', effort: null, mode: 'object' }), 'a/b');
});

test('usage is read the way Groq reports it, reasoning and cache included', () => {
  const u = readUsage({ usage: { queue_time: 0.1, prompt_tokens: 3437, prompt_time: 0.02, completion_tokens: 235, completion_time: 0.5, total_tokens: 3672, total_time: 0.52, completion_tokens_details: { reasoning_tokens: 65 }, prompt_tokens_details: { cached_tokens: 1000 } } });
  assert.deepEqual(u, { promptTokens: 3437, completionTokens: 235, reasoningTokens: 65, cachedTokens: 1000, queueS: 0.1, promptS: 0.02, completionS: 0.5, totalS: 0.52 });
  assert.equal(readUsage({}), null);
  assert.equal(readUsage({ usage: {} }), null);
  assert.equal(readUsage(null), null);
});

test('cost counts cached input at the cache price and reasoning as output, and is null without a price', () => {
  const price = priceOf({ pricing: { prompt: '0.000001', completion: '0.000004', input_cache_read: '0.0000005' } });
  assert.deepEqual(price, { prompt: 1e-6, completion: 4e-6, cacheRead: 5e-7 });
  const usage = { promptTokens: 1000, completionTokens: 100, reasoningTokens: 60, cachedTokens: 400, queueS: 0, promptS: 0, completionS: 0, totalS: 0 };
  assert.ok(Math.abs(costOf(usage, price)! - (600e-6 + 400 * 5e-7 + 100 * 4e-6)) < 1e-12);
  assert.equal(costOf(usage, null), null);
  assert.equal(priceOf({ pricing: null }), null);
  assert.equal(priceOf({ pricing: { prompt: 'x', completion: '1' } }), null);
});

test('Groq durations are read in seconds', () => {
  assert.equal(parseDuration('7.66s'), 7.66);
  assert.ok(Math.abs(parseDuration('2m59.56s')! - 179.56) < 1e-9);
  assert.equal(parseDuration('1h2m3s'), 3723);
  assert.equal(parseDuration('250ms'), 0.25);
  assert.equal(parseDuration(null), null);
  assert.equal(parseDuration('soon'), null);
});

test('the rate headers are read: requests per day, tokens per minute', () => {
  const h = new Headers({ 'x-ratelimit-limit-requests': '1000', 'x-ratelimit-limit-tokens': '8000', 'x-ratelimit-remaining-requests': '999', 'x-ratelimit-remaining-tokens': '7522', 'x-ratelimit-reset-requests': '1m26.4s', 'x-ratelimit-reset-tokens': '3.585s', 'x-groq-region': 'yul' });
  assert.deepEqual(readRate(h), { requestsPerDay: 1000, tokensPerMinute: 8000, requestsLeft: 999, tokensLeft: 7522, requestsResetS: 86.4, tokensResetS: 3.585, retryAfterS: null, region: 'yul' });
  assert.equal(readRate(new Headers({ 'retry-after': '12' })).retryAfterS, 12);
  assert.equal(readRate(new Headers()).tokensLeft, null);
});

test('a limit message says which limit it is', () => {
  assert.equal(limitKind(413, 'Request too large ... on tokens per minute (TPM): Limit 2000, Requested 4107'), 'too_large');
  assert.equal(limitKind(429, 'Rate limit reached ... on tokens per day (TPD): Limit 200000'), 'tpd');
  assert.equal(limitKind(429, 'Rate limit reached ... on requests per minute (RPM): Limit 30'), 'rpm');
  assert.equal(limitKind(429, 'Request too large ... on output tokens per minute (OTPM): Limit 1000, Requested 1263.'), 'otpm');
  assert.equal(limitKind(429, 'slow down'), 'unknown');
});

test('an error kept in the ledger is short and has no organization id', () => {
  const kept = tidyError(`Rate limit reached for model \`m\` in organization \`org_01m4wshvhpe0pb4qxxcsk2yk2r\`\n service tier on_demand ${'x'.repeat(400)}`);
  assert.ok(!kept.includes('org_01m4'));
  assert.ok(kept.includes('org_…'));
  assert.ok(kept.length <= 300);
});

test('the wait before a request is the time the bucket needs to refill the shortfall', () => {
  const rate = { requestsPerDay: 1000, tokensPerMinute: 6000, requestsLeft: 900, tokensLeft: 1000, requestsResetS: 1, tokensResetS: 1, retryAfterS: null, region: null };
  assert.equal(secondsToWait(rate, 900), 0);
  assert.equal(secondsToWait(rate, 1000), 0);
  // 3000 short at 100 tokens a second is 30 seconds, and one more
  assert.equal(secondsToWait(rate, 4000), 31);
  assert.equal(secondsToWait(null, 4000), 0);
  assert.equal(secondsToWait({ ...rate, tokensLeft: null }, 4000), 0);
  assert.ok(guessTokens(2600) >= 1000);
});

const row = (line: string, value: number, biomarkerId: string | null, unit: string | null = null, refLow: number | null = null, refHigh: number | null = null): ParsedRow => ({ line, label: line.split(' ')[0], biomarkerId, value, unit, refLow, refHigh, unitMismatch: false });

test('a model is scored against the on-device reader: found, missed, extra, and what each read differently', () => {
  const reference = [
    row('TSH 1.9 mIU/L 0.4 - 4', 1.9, 'tsh', 'mIU/L', 0.4, 4),
    row('ALT 16 U/L 10 - 49', 16, 'alt', 'U/L', 10, 49),
    row('Urea 30 mg/dl 19 - 49', 30, 'blood_urea', 'mg/dl', 19, 49),
    row('Sodium 140 mmol/L', 140, 'sodium', 'mmol/L'),
  ];
  const model = [
    row('tsh  1.9 miu/l 0.4 - 4', 1.9, 'tsh', 'mIU/L', 0.4, 4),
    row('ALT 16 U/L 10 - 49', 16, 'alt', 'U/L', 10, 40),
    row('Urea 30 mg/dl 19 - 49', 30, null, 'mg/dl', 19, 49),
    row('Chloride 100 mmol/L', 100, null, 'mmol/L'),
    row('Potassium 4.1 mmol/L', 4.1, 'sodium', 'mmol/L'),
  ];
  const { score, detail } = scoreRows(model, reference, 6, 1, (id) => id);
  assert.equal(score.reference, 4);
  assert.equal(score.matched, 3);
  assert.equal(score.missed, 1);
  assert.equal(score.extra, 2);
  assert.equal(score.recall, 3 / 4);
  assert.equal(score.precision, 3 / 5);
  assert.equal(score.sameMarker, 2);
  assert.equal(score.differentMarker, 1);
  assert.equal(score.sameRange, 2);
  assert.equal(score.differentRange, 1);
  assert.equal(score.sameUnit, 3);
  assert.equal(score.trackedReference, 4);
  assert.equal(score.trackedMatched, 2);
  // the model gave sodium 4.1 where the reader found 140
  assert.equal(score.trackedConflicts, 1);
  assert.equal(score.returned, 6);
  assert.equal(score.dropped, 1);
  assert.deepEqual(detail.missed, ['Sodium']);
  assert.deepEqual(detail.extra, ['Chloride', 'Potassium']);
  assert.deepEqual(detail.differentMarker, [{ label: 'Urea', model: null, reference: 'blood_urea' }]);
});

test('a tracked marker read from another line of the report still counts as found, by marker and number', () => {
  const reference = [row('HbA1c 4.60 % 4.2 - 5.7', 4.6, 'hba1c', '%', 4.2, 5.7), row('ALT 16 U/L', 16, 'alt', 'U/L')];
  const model = [row('Glycated Hemoglobin 4.6 %', 4.6, 'hba1c', '%'), row('ALT 16 U/L', 16, 'alt', 'U/L')];
  const { score } = scoreRows(model, reference, 2, 0, (id) => id);
  assert.equal(score.matched, 1);
  assert.equal(score.trackedReference, 2);
  assert.equal(score.trackedMatched, 2);
  assert.equal(score.trackedConflicts, 0);
});

test('scoring an empty answer or an empty reference does not divide by zero', () => {
  const { score } = scoreRows([], [], 0, 0, (id) => id);
  assert.equal(score.recall, 0);
  assert.equal(score.precision, 0);
});
