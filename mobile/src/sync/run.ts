import * as SecureStore from 'expo-secure-store';
import { readHrv, readRestingHr, readSleep } from '../healthkit';
import { supabase } from '../supabase';
import { cardioRows, sleepRows, syncWindowStart } from './mapping';

/** The first sync reads this far back; later ones re-read a few days so late-arriving watch data is caught. */
export const FIRST_SYNC_DAYS = 90;
export const RESYNC_DAYS = 3;
const LAST_SYNC_PREFIX = 'intus.lastSync';

/** The record of the last sync is the person's own: another account on the same phone starts with a full first sync. */
async function syncKey(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return `${LAST_SYNC_PREFIX}.${data.session?.user.id ?? 'nobody'}`;
}

/** Forgets the last sync for whoever is signed in. Called when the account is deleted. */
export async function forgetLastSync(): Promise<void> {
  await SecureStore.deleteItemAsync(await syncKey());
}

export interface SyncResult {
  at: string;
  nights: number;
  heartDays: number;
  skipped: number;
}

export async function lastSync(): Promise<SyncResult | null> {
  const raw = await SecureStore.getItemAsync(await syncKey());
  try {
    return raw ? (JSON.parse(raw) as SyncResult) : null;
  } catch {
    return null;
  }
}

/** Reads Apple Health, maps it, and upserts it. Throws with a plain message on any failure; nothing is half-written per table. */
export async function syncNow(now = new Date()): Promise<SyncResult> {
  const previous = await lastSync();
  const from = syncWindowStart(now, previous ? RESYNC_DAYS : FIRST_SYNC_DAYS);
  const [sleep, hrv, resting] = await Promise.all([readSleep(from), readHrv(from), readRestingHr(from)]);
  const tzId = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  const nights = sleepRows(sleep, { tzId, recordedAt: now });
  const heart = cardioRows(hrv, resting);

  if (nights.rows.length > 0) {
    const { error } = await supabase.from('sleep_sessions').upsert(nights.rows, { onConflict: 'user_id,source_kind,source_name,external_id' });
    if (error) throw new Error(`Sleep could not be saved: ${error.message}`);
  }
  if (heart.length > 0) {
    const { error } = await supabase.from('cardio_metrics').upsert(heart, { onConflict: 'user_id,measured_at,source' });
    if (error) throw new Error(`Heart readings could not be saved: ${error.message}`);
  }
  const result: SyncResult = { at: now.toISOString(), nights: nights.rows.length, heartDays: heart.length, skipped: nights.skipped };
  await SecureStore.setItemAsync(await syncKey(), JSON.stringify(result));
  return result;
}
