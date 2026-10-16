import type { DailyLogInsert } from '../../../src/db/rows.ts';
import type { TodayDraft } from '../../../src/features/today/draft.ts';

/** The three calls a store needs; AsyncStorage has them, and a Map stands in for it in tests. */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/** A day's entry that has been typed but not yet confirmed saved. The draft is kept so Today can show it again. */
export interface PendingLog {
  date: string;
  draft: TodayDraft;
  record: DailyLogInsert;
  queuedAt: string;
}

const keyFor = (userId: string) => `intus.outbox.daily_logs.${userId}`;

async function read(store: KeyValueStore, userId: string): Promise<Record<string, PendingLog>> {
  const raw = await store.getItem(keyFor(userId));
  if (raw === null) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as Record<string, PendingLog>;
  } catch {
    return {};
  }
}

async function write(store: KeyValueStore, userId: string, pending: Record<string, PendingLog>): Promise<void> {
  if (Object.keys(pending).length === 0) await store.removeItem(keyFor(userId));
  else await store.setItem(keyFor(userId), JSON.stringify(pending));
}

/** Oldest first. */
export async function pendingLogs(store: KeyValueStore, userId: string): Promise<PendingLog[]> {
  const all = await read(store, userId);
  return Object.values(all).sort((a, b) => a.date.localeCompare(b.date));
}

export async function pendingFor(store: KeyValueStore, userId: string, date: string): Promise<PendingLog | null> {
  return (await read(store, userId))[date] ?? null;
}

/** A record carries the whole day, so a newer one for the same date replaces the older. */
export async function queueLog(store: KeyValueStore, userId: string, entry: PendingLog): Promise<void> {
  const all = await read(store, userId);
  all[entry.date] = entry;
  await write(store, userId, all);
}

export interface FlushResult {
  sent: number;
  failed: number;
  /** the first failure's message, for "not sent yet" copy */
  error: string | null;
}

/**
 * Sends each queued day, oldest first, and drops it from the queue only once the send succeeds. A day that was
 * re-queued while its send was in flight stays queued: only the entry that was sent is removed.
 */
export async function flushLogs(
  store: KeyValueStore,
  userId: string,
  send: (record: DailyLogInsert) => Promise<void>,
): Promise<FlushResult> {
  const result: FlushResult = { sent: 0, failed: 0, error: null };
  for (const entry of await pendingLogs(store, userId)) {
    try {
      await send(entry.record);
    } catch (e) {
      result.failed++;
      result.error ??= e instanceof Error ? e.message : String(e);
      continue;
    }
    const latest = await read(store, userId);
    if (latest[entry.date]?.queuedAt === entry.queuedAt) delete latest[entry.date];
    await write(store, userId, latest);
    result.sent++;
  }
  return result;
}
