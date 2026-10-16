import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_DRAFT, recordFromDraft } from '../src/features/today/draft.ts';
import { flushLogs, pendingFor, pendingLogs, queueLog, type KeyValueStore, type PendingLog } from '../mobile/src/data/outbox.ts';

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => void data.set(k, v),
    removeItem: async (k) => void data.delete(k),
  };
}

function entry(date: string, weight: string, queuedAt = '2026-10-17T08:00:00Z'): PendingLog {
  const draft = { ...EMPTY_DRAFT, weight };
  return { date, draft, record: recordFromDraft(draft, date, queuedAt), queuedAt };
}

test('a queued day is read back, and a newer one for the same date replaces it', async () => {
  const store = memoryStore();
  await queueLog(store, 'u1', entry('2026-10-17', '80'));
  await queueLog(store, 'u1', entry('2026-10-17', '81', '2026-10-17T09:00:00Z'));
  const all = await pendingLogs(store, 'u1');
  assert.equal(all.length, 1);
  assert.equal(all[0].draft.weight, '81');
  assert.equal((await pendingFor(store, 'u1', '2026-10-17'))?.record.weight, 81);
  assert.equal(await pendingFor(store, 'u1', '2026-10-16'), null);
});

test('each person has their own queue', async () => {
  const store = memoryStore();
  await queueLog(store, 'u1', entry('2026-10-17', '80'));
  assert.deepEqual(await pendingLogs(store, 'u2'), []);
});

test('a send that works empties the queue and the key', async () => {
  const store = memoryStore();
  await queueLog(store, 'u1', entry('2026-10-16', '79'));
  await queueLog(store, 'u1', entry('2026-10-17', '80'));
  const sentDates: string[] = [];
  const result = await flushLogs(store, 'u1', async (r) => void sentDates.push(r.log_date));
  assert.deepEqual(sentDates, ['2026-10-16', '2026-10-17']);
  assert.deepEqual(result, { sent: 2, failed: 0, error: null });
  assert.equal(store.data.size, 0);
});

test('a send that fails keeps the entry, and the others still go', async () => {
  const store = memoryStore();
  await queueLog(store, 'u1', entry('2026-10-16', '79'));
  await queueLog(store, 'u1', entry('2026-10-17', '80'));
  const result = await flushLogs(store, 'u1', async (r) => {
    if (r.log_date === '2026-10-16') throw new Error('offline');
  });
  assert.deepEqual(result, { sent: 1, failed: 1, error: 'offline' });
  assert.deepEqual((await pendingLogs(store, 'u1')).map((p) => p.date), ['2026-10-16']);
});

test('a day typed again while its send was in flight stays queued', async () => {
  const store = memoryStore();
  await queueLog(store, 'u1', entry('2026-10-17', '80'));
  const result = await flushLogs(store, 'u1', async () => {
    await queueLog(store, 'u1', entry('2026-10-17', '82', '2026-10-17T10:00:00Z'));
  });
  assert.equal(result.sent, 1);
  assert.equal((await pendingFor(store, 'u1', '2026-10-17'))?.draft.weight, '82');
});

test('a damaged queue reads as empty rather than throwing', async () => {
  const store = memoryStore();
  store.data.set('intus.outbox.daily_logs.u1', '{not json');
  assert.deepEqual(await pendingLogs(store, 'u1'), []);
});
