import type { DailyLogInsert } from '../../../src/db/rows.ts';
import type { TodayDraft } from '../../../src/features/today/draft.ts';

/** The three calls a store needs; AsyncStorage has them, and a Map stands in for it in tests. */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

// ── a queue per kind of entry ────────────────────────────────────────────────────────────────────

/** Anything queued says when it was queued, so a send can tell whether the entry changed while it was in flight. */
export interface Queued {
  queuedAt: string;
}

const keyFor = (bucket: string, userId: string) => `intus.outbox.${bucket}.${userId}`;

async function read<T>(store: KeyValueStore, bucket: string, userId: string): Promise<Record<string, T>> {
  const raw = await store.getItem(keyFor(bucket, userId));
  if (raw === null) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as Record<string, T>;
  } catch {
    return {};
  }
}

async function write<T>(store: KeyValueStore, bucket: string, userId: string, entries: Record<string, T>): Promise<void> {
  if (Object.keys(entries).length === 0) await store.removeItem(keyFor(bucket, userId));
  else await store.setItem(keyFor(bucket, userId), JSON.stringify(entries));
}

/** Every queued entry in a bucket, in key order. */
export async function queuedIn<T>(store: KeyValueStore, bucket: string, userId: string): Promise<T[]> {
  const all = await read<T>(store, bucket, userId);
  return Object.keys(all).sort().map((k) => all[k]);
}

export async function queuedEntry<T>(store: KeyValueStore, bucket: string, userId: string, key: string): Promise<T | null> {
  return (await read<T>(store, bucket, userId))[key] ?? null;
}

/** A newer entry under the same key replaces the older. */
export async function queueIn<T>(store: KeyValueStore, bucket: string, userId: string, key: string, entry: T): Promise<void> {
  const all = await read<T>(store, bucket, userId);
  all[key] = entry;
  await write(store, bucket, userId, all);
}

export interface FlushResult {
  sent: number;
  failed: number;
  /** the first failure's message, for "not sent yet" copy */
  error: string | null;
}

/**
 * Sends each queued entry, in key order, and drops it from the queue only once the send succeeds. An entry that was
 * queued again while its send was in flight stays queued: only the entry that was sent is removed.
 */
export async function flushBucket<T extends Queued>(
  store: KeyValueStore,
  bucket: string,
  userId: string,
  send: (entry: T) => Promise<void>,
): Promise<FlushResult> {
  const result: FlushResult = { sent: 0, failed: 0, error: null };
  const first = await read<T>(store, bucket, userId);
  for (const key of Object.keys(first).sort()) {
    const entry = first[key];
    try {
      await send(entry);
    } catch (e) {
      result.failed++;
      result.error ??= e instanceof Error ? e.message : String(e);
      continue;
    }
    const latest = await read<T>(store, bucket, userId);
    if (latest[key]?.queuedAt === entry.queuedAt) delete latest[key];
    await write(store, bucket, userId, latest);
    result.sent++;
  }
  return result;
}

// ── the daily log's queue, keyed by date ─────────────────────────────────────────────────────────

/** A day's entry that has been typed but not yet confirmed saved. The draft is kept so Today can show it again. */
export interface PendingLog extends Queued {
  date: string;
  draft: TodayDraft;
  record: DailyLogInsert;
}

const LOGS = 'daily_logs';

/** Oldest first. */
export const pendingLogs = (store: KeyValueStore, userId: string) => queuedIn<PendingLog>(store, LOGS, userId);
export const pendingFor = (store: KeyValueStore, userId: string, date: string) => queuedEntry<PendingLog>(store, LOGS, userId, date);
/** A record carries the whole day, so a newer one for the same date replaces the older. */
export const queueLog = (store: KeyValueStore, userId: string, entry: PendingLog) => queueIn(store, LOGS, userId, entry.date, entry);
export const flushLogs = (store: KeyValueStore, userId: string, send: (record: DailyLogInsert) => Promise<void>) =>
  flushBucket<PendingLog>(store, LOGS, userId, (entry) => send(entry.record));
