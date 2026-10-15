import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configName, costOf } from '../src/features/ailab/groq.ts';
import { buildVertexRequest, parseVertexPlan, readVertexUsage, thinkingConfig, tidyVertexError, vertexFinish, vertexHost, vertexPrice, vertexUrl, VERTEX_MODELS } from '../src/features/ailab/vertex.ts';
import { parseGeminiResponse } from '../supabase/functions/read-report/prompt.ts';

const markers = [{ code: 'tsh', name: 'TSH', unit: 'mIU/L' }];

test('the endpoint is the region for a region and the multi-region host for global', () => {
  assert.equal(vertexHost('us-central1'), 'us-central1-aiplatform.googleapis.com');
  assert.equal(vertexHost('global'), 'aiplatform.googleapis.com');
  assert.equal(vertexUrl('p', 'global', 'gemini-3.5-flash'), 'https://aiplatform.googleapis.com/v1/projects/p/locations/global/publishers/google/models/gemini-3.5-flash:generateContent');
  assert.equal(vertexUrl('p', 'us-central1', 'gemini-2.5-pro'), 'https://us-central1-aiplatform.googleapis.com/v1/projects/p/locations/us-central1/publishers/google/models/gemini-2.5-pro:generateContent');
});

test('thinking is a token budget on 2.5 and a named level on 3 and later, and left out by default', () => {
  assert.equal(thinkingConfig('gemini-2.5-flash', null), null);
  assert.equal(thinkingConfig('gemini-3.5-flash', 'default'), null);
  assert.deepEqual(thinkingConfig('gemini-2.5-flash', 'none'), { thinkingBudget: 0 });
  assert.deepEqual(thinkingConfig('gemini-2.5-flash-lite', 'none'), { thinkingBudget: 0 });
  assert.deepEqual(thinkingConfig('gemini-2.5-pro', 'none'), { thinkingBudget: 128 });
  assert.deepEqual(thinkingConfig('gemini-2.5-flash', 'low'), { thinkingBudget: 1024 });
  assert.deepEqual(thinkingConfig('gemini-2.5-flash', 'high'), { thinkingBudget: 16384 });
  assert.deepEqual(thinkingConfig('gemini-3.5-flash', 'none'), { thinkingLevel: 'minimal' });
  assert.deepEqual(thinkingConfig('gemini-3.1-pro-preview', 'none'), { thinkingLevel: 'low' });
  assert.deepEqual(thinkingConfig('gemini-3.8-flash', 'none'), { thinkingLevel: 'low' });
  assert.deepEqual(thinkingConfig('gemini-3.1-flash-lite', 'none'), { thinkingLevel: 'minimal' });
  assert.deepEqual(thinkingConfig('gemini-3.8-flash', 'medium'), { thinkingLevel: 'medium' });
});

test('the Vertex request is the app Gemini request, with thinking added only when asked for', () => {
  const plain = buildVertexRequest({ model: 'gemini-2.5-flash', effort: null, mode: 'schema' }, 'report text', markers, 16384) as { generationConfig: Record<string, unknown>; contents: { parts: { text: string }[] }[]; systemInstruction: unknown };
  assert.equal('thinkingConfig' in plain.generationConfig, false);
  assert.equal(plain.generationConfig.temperature, 0);
  assert.equal(plain.generationConfig.maxOutputTokens, 16384);
  assert.equal(plain.generationConfig.responseMimeType, 'application/json');
  assert.match(plain.contents[0].parts[0].text, /Tracked markers[\s\S]*tsh: TSH, mIU\/L[\s\S]*Report text:\nreport text$/);

  const thinking = buildVertexRequest({ model: 'gemini-3.5-flash', effort: 'low', mode: 'schema' }, 'x', markers, 100) as { generationConfig: Record<string, unknown> };
  assert.deepEqual(thinking.generationConfig.thinkingConfig, { thinkingLevel: 'low' });
  assert.equal(thinking.generationConfig.responseMimeType, 'application/json');
});

test('requiring every field changes only the schema: the app asks for name, value and line, the variant for all seven', () => {
  type Schema = { properties: { rows: { items: { required: string[] } } } };
  const app = buildVertexRequest({ model: 'gemini-2.5-flash', effort: 'none', mode: 'schema' }, 'x', markers, 100).generationConfig as { responseSchema: Schema; thinkingConfig: unknown };
  assert.deepEqual(app.responseSchema.properties.rows.items.required, ['name', 'value_text', 'line']);
  const strict = buildVertexRequest({ model: 'gemini-2.5-flash', effort: 'none', mode: 'schema', requireAll: true }, 'x', markers, 100).generationConfig as { responseSchema: Schema; thinkingConfig: unknown };
  assert.deepEqual(strict.responseSchema.properties.rows.items.required, ['name', 'marker', 'value_text', 'unit', 'ref_low', 'ref_high', 'line']);
  assert.deepEqual(strict.thinkingConfig, app.thinkingConfig);
  assert.equal(configName({ model: 'm', effort: 'none', mode: 'schema', requireAll: true }), 'm (none) + all fields required');
});

test('usage adds thinking to the output and keeps it visible as reasoning; cached tokens are part of the prompt', () => {
  const reply = { usageMetadata: { promptTokenCount: 10_000, candidatesTokenCount: 5000, thoughtsTokenCount: 1200, cachedContentTokenCount: 2000, totalTokenCount: 16_200 } };
  assert.deepEqual(readVertexUsage(reply), { promptTokens: 10_000, completionTokens: 6200, reasoningTokens: 1200, cachedTokens: 2000, queueS: 0, promptS: 0, completionS: 0, totalS: 0 });
  assert.equal(readVertexUsage({ usageMetadata: { promptTokenCount: 7, candidatesTokenCount: 1 } })!.reasoningTokens, 0);
  assert.equal(readVertexUsage({}), null);
  assert.equal(readVertexUsage(null), null);
});

test('the same usage parses the same way the app parses it, so the lab and the app count output alike', () => {
  const reply = {
    candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"rows":[]}' }] } }],
    usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 4, thoughtsTokenCount: 30 },
  };
  assert.equal(parseGeminiResponse(reply).outputTokens, readVertexUsage(reply)!.completionTokens);
  assert.equal(vertexFinish(reply), 'STOP');
  assert.equal(vertexFinish({ candidates: [] }), null);
});

test('cost bills thinking as output and cached input at the cache price', () => {
  const price = vertexPrice('gemini-2.5-flash')!;
  assert.deepEqual(price, { prompt: 0.3 / 1e6, completion: 2.5 / 1e6, cacheRead: 0.03 / 1e6 });
  const usage = readVertexUsage({ usageMetadata: { promptTokenCount: 10_000, candidatesTokenCount: 5000, thoughtsTokenCount: 1000, cachedContentTokenCount: 0 } })!;
  assert.ok(Math.abs(costOf(usage, price)! - (10_000 * 0.3 + 6000 * 2.5) / 1e6) < 1e-12);
  assert.equal(vertexPrice('gemini-nope'), null);
});

test('every model has a price, a place to call it and a cache price below its input price', () => {
  assert.ok(VERTEX_MODELS.length >= 6);
  assert.equal(new Set(VERTEX_MODELS.map((m) => m.id)).size, VERTEX_MODELS.length);
  for (const m of VERTEX_MODELS) {
    assert.ok(m.prompt > 0 && m.completion > m.prompt, m.id);
    assert.ok(m.cachedPrompt > 0 && m.cachedPrompt < m.prompt, m.id);
    assert.ok(m.location === 'global' || /^[a-z]+-[a-z]+\d+$/.test(m.location), m.id);
  }
});

test('a plan names a model, then the thinking setting, then the location, and defaults the location to where the model lives', () => {
  assert.deepEqual(parseVertexPlan('gemini-2.5-flash:none'), [{ model: 'gemini-2.5-flash', effort: 'none', mode: 'schema', provider: 'vertex', location: 'us-central1' }]);
  assert.deepEqual(parseVertexPlan('gemini-3.5-flash'), [{ model: 'gemini-3.5-flash', effort: null, mode: 'schema', provider: 'vertex', location: 'global' }]);
  assert.deepEqual(parseVertexPlan('gemini-2.5-pro:high@global, gemini-3.8-flash:low').map((c) => [c.model, c.effort, c.location]), [['gemini-2.5-pro', 'high', 'global'], ['gemini-3.8-flash', 'low', 'global']]);
  assert.throws(() => parseVertexPlan('gemini-9-ultra:low'), /not a model this lab has a Vertex price for/);
});

test('an error kept for the ledger does not name the project', () => {
  assert.equal(tidyVertexError('NOT_FOUND Publisher model `projects/example-project/locations/global/publishers/google/models/x` was not found'), 'NOT_FOUND Publisher model `projects/…/locations/global/publishers/google/models/x` was not found');
});
