import * as SecureStore from 'expo-secure-store';
import { loadExport, type ExportLoad } from '../../../src/features/export/load.ts';
import { LAST_SYNC_KEY } from '../sync/run';
import { supabase } from '../supabase';
import { PHOTOS_BUCKET, REPORTS_BUCKET } from './buckets';
import { clearAppData, clearSessionKeys, readFlowsIndex } from './deviceIO';
import { emptyStorageFolder } from './emptyFolder';
import { finishDeletion } from './finish';

/** The same words the website uses when the session is gone, so the failure reads the same. */
const SIGNED_OUT_PHOTOS = 'You are signed out. Sign in again to add photos';
const SIGNED_OUT_REPORTS = 'You are signed out. Sign in again to keep the report';

async function userId(signedOut: string): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (error || !id) throw new Error(signedOut);
  return id;
}

async function listFolder(bucket: string, folder: string): Promise<{ names: string[]; error: string | null }> {
  const { data, error } = await supabase.storage.from(bucket).list(folder, { limit: 1000, offset: 0 });
  return { names: (data ?? []).map((file) => file.name), error: error?.message ?? null };
}

async function removePaths(bucket: string, paths: string[]): Promise<{ error: string | null }> {
  const { error } = await supabase.storage.from(bucket).remove(paths);
  return { error: error?.message ?? null };
}

export async function removeAllCheckInPhotos(): Promise<void> {
  const folder = await userId(SIGNED_OUT_PHOTOS);
  await emptyStorageFolder(folder, {
    list: () => listFolder(PHOTOS_BUCKET, folder),
    remove: (paths) => removePaths(PHOTOS_BUCKET, paths),
  });
}

export async function removeAllReports(): Promise<void> {
  const folder = await userId(SIGNED_OUT_REPORTS);
  await emptyStorageFolder(folder, {
    missingBucketIsEmpty: true,
    list: () => listFolder(REPORTS_BUCKET, folder),
    remove: (paths) => removePaths(REPORTS_BUCKET, paths),
  });
}

export async function deleteAccountRow(): Promise<void> {
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw new Error(error.message);
}

/** Photos, then reports, then the database function, then this phone, then the local session. */
export async function deleteAccountAndSignOut(): Promise<void> {
  const flowsIndex = await readFlowsIndex();
  await finishDeletion({
    removePhotos: removeAllCheckInPhotos,
    removeReports: removeAllReports,
    deleteAccount: deleteAccountRow,
    clearDevice: clearAppData,
    signOutLocal: async () => {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw new Error(error.message);
    },
    clearSessionKeys: () => clearSessionKeys(flowsIndex),
  });
}

/** Ends the session on the server as well, the same call the website's Sign out button makes. */
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
  try {
    await SecureStore.deleteItemAsync(LAST_SYNC_KEY);
  } catch {
    // the session is already ended; the sync cursor is only a convenience
  }
}

/** The rows the shared export is built from. The same read the website does. */
export async function fetchExport(): Promise<ExportLoad> {
  const { data } = await supabase.auth.getSession();
  return loadExport({
    userId: data.session?.user.id ?? null,
    photosBucket: PHOTOS_BUCKET,
    reportsBucket: REPORTS_BUCKET,
    pageTable: async (table, from, to) => {
      const { data: rows, error } = await supabase.from(table).select('*').range(from, to);
      return { data: (rows as Record<string, unknown>[] | null) ?? null, error: error ? { message: error.message } : null };
    },
    biomarkers: async () => {
      const { data: rows, error } = await supabase.from('biomarkers').select('id,code,name,unit');
      return {
        data: (rows as { id: string; code: string; name: string; unit: string }[] | null) ?? null,
        error: error ? { message: error.message } : null,
      };
    },
    list: async (bucket, folder) => {
      const { data: files, error } = await supabase.storage.from(bucket).list(folder, { limit: 1000 });
      return { names: (files ?? []).map((file) => file.name), error: error?.message ?? null };
    },
  });
}
