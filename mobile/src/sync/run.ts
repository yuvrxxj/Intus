import * as SecureStore from 'expo-secure-store';
import { readDailyActiveEnergy, readDailySteps, readHrv, readRestingHr, readSleep } from '../healthkit';
import { supabase } from '../supabase';
import { activityRows, cardioRows, sleepRows, syncWindowStart } from './mapping';

/** The first sync reads this far back; later ones re-read a few days so late-arriving watch data is caught. */
export const FIRST_SYNC_DAYS = 90;
export const RESYNC_DAYS = 3;
export const LAST_SYNC_KEY = 'intus.lastSync';

export interface SyncResult {
  at: string;
  nights: number;
  heartDays: number;
  /** Days with steps or active calories. A sync saved before steps were read has none, and reads back as 0. */
  activityDays: number;
  skipped: number;
}

export async function lastSync(): Promise<SyncResult | null> {
  const raw = await SecureStore.getItemAsync(LAST_SYNC_KEY);
  try {
    return raw ? { activityDays: 0, ...(JSON.parse(raw) as Omit<SyncResult, 'activityDays'> & Partial<Pick<SyncResult, 'activityDays'>>) } : null;
  } catch {
    return null;
  }
}

/** Reads Apple Health, maps it, and upserts it. Throws with a plain message on any failure; nothing is half-written per table. */
export async function syncNow(now = new Date()): Promise<SyncResult> {
  const previous = await lastSync();
  const from = syncWindowStart(now, previous ? RESYNC_DAYS : FIRST_SYNC_DAYS);
  const [sleep, hrv, resting, steps, energy] = await Promise.all([
    readSleep(from),
    readHrv(from),
    readRestingHr(from),
    readDailySteps(from),
    readDailyActiveEnergy(from),
  ]);
  const tzId = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  const nights = sleepRows(sleep, { tzId, recordedAt: now });
  const heart = cardioRows(hrv, resting);
  const activity = activityRows(steps, energy);

  if (nights.rows.length > 0) {
    const { error } = await supabase.from('sleep_sessions').upsert(nights.rows, { onConflict: 'user_id,source_kind,source_name,external_id' });
    if (error) throw new Error(`Sleep could not be saved: ${error.message}`);
  }
  if (heart.length > 0) {
    const { error } = await supabase.from('cardio_metrics').upsert(heart, { onConflict: 'user_id,measured_at,source' });
    if (error) throw new Error(`Heart readings could not be saved: ${error.message}`);
  }
  if (activity.length > 0) {
    const { error } = await supabase.from('activity_days').upsert(activity, { onConflict: 'user_id,day,source' });
    if (error) throw new Error(`Steps and active calories could not be saved: ${error.message}`);
  }
  const result: SyncResult = { at: now.toISOString(), nights: nights.rows.length, heartDays: heart.length, activityDays: activity.length, skipped: nights.skipped };
  await SecureStore.setItemAsync(LAST_SYNC_KEY, JSON.stringify(result));
  return result;
}
