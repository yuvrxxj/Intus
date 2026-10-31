import * as SecureStore from 'expo-secure-store';
import { identity, readHrv, readRestingHr, readSleep } from '../health/provider';
import { supabase } from '../supabase';
import { cardioRows, sleepRows, syncWindowStart } from './mapping';

/** The first sync reads this far back; later ones re-read a few days so late-arriving watch data is caught. */
export const FIRST_SYNC_DAYS = 90;
export const RESYNC_DAYS = 3;
export const LAST_SYNC_KEY = 'intus.lastSync';

export interface SyncResult {
  at: string;
  nights: number;
  heartDays: number;
  skipped: number;
}

export async function lastSync(): Promise<SyncResult | null> {
  const raw = await SecureStore.getItemAsync(LAST_SYNC_KEY);
  try {
    return raw ? (JSON.parse(raw) as SyncResult) : null;
  } catch {
    return null;
  }
}

/** Reads the phone's health store (Apple Health, or Health Connect on Android), maps it, and upserts it. Throws with a plain message on any failure; nothing is half-written per table. */
export async function syncNow(now = new Date()): Promise<SyncResult> {
  const previous = await lastSync();
  const from = syncWindowStart(now, previous ? RESYNC_DAYS : FIRST_SYNC_DAYS);
  const [sleep, hrv, resting] = await Promise.all([readSleep(from), readHrv(from), readRestingHr(from)]);
  const tzId = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  const nights = sleepRows(sleep, { tzId, recordedAt: now, sourceKind: identity.sleepSourceKind });
  const heart = cardioRows(hrv, resting, undefined, identity.cardioSource);
  // TODO(INT-147): daily steps and active energy. Android already has the reader (healthconnect.readDailyActivity) and
  // the mapping (healthConnectMapping.activityDays); switch them on here once INT-147 adds the table, with the column
  // names taken from that migration. Nothing is written for them until then.

  if (nights.rows.length > 0) {
    const { error } = await supabase.from('sleep_sessions').upsert(nights.rows, { onConflict: 'user_id,source_kind,source_name,external_id' });
    if (error) throw new Error(`Sleep could not be saved: ${error.message}`);
  }
  if (heart.length > 0) {
    const { error } = await supabase.from('cardio_metrics').upsert(heart, { onConflict: 'user_id,measured_at,source' });
    if (error) throw new Error(`Heart readings could not be saved: ${error.message}`);
  }
  const result: SyncResult = { at: now.toISOString(), nights: nights.rows.length, heartDays: heart.length, skipped: nights.skipped };
  await SecureStore.setItemAsync(LAST_SYNC_KEY, JSON.stringify(result));
  return result;
}
