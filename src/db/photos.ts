import { removeAll } from '../features/photos/removeAll.ts';
import { BUCKET, isPose, objectPath, type CheckIn, type CheckInValues } from '../features/photos/model.ts';
import { supabase } from './client.ts';

const COLUMNS = 'id,log_date,pose,label,weight,storage_path';
/** A signed link is a short-lived key to one private file; an hour is long enough to browse and short enough to be safe. */
const LINK_SECONDS = 60 * 60;

async function userId(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (error || !id) throw new Error('You are signed out. Sign in again to add photos');
  return id;
}

/** Newest first. Rows from before photos existed (no picture) are included; the screen skips them. */
export async function fetchCheckIns(): Promise<CheckIn[]> {
  const { data, error } = await supabase.from('photo_log').select(COLUMNS).order('log_date', { ascending: false }).order('id');
  if (error) throw new Error(`Could not load your photos: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id,
    log_date: row.log_date,
    pose: row.pose !== null && isPose(row.pose) ? row.pose : null,
    label: row.label,
    weight: row.weight === null ? null : Number(row.weight),
    storage_path: row.storage_path,
  }));
}

/** One short-lived link per file, keyed by the file's path. A file that cannot be signed is left out. */
export async function signedLinks(paths: string[]): Promise<Map<string, string>> {
  const links = new Map<string, string>();
  if (paths.length === 0) return links;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, LINK_SECONDS);
  if (error) throw new Error(`Could not open your photos: ${error.message}`);
  for (const item of data ?? []) if (item.path && item.signedUrl) links.set(item.path, item.signedUrl);
  return links;
}

/** Uploads the picture, then records it. If the record cannot be saved the picture is taken back out again. */
export async function addCheckIn(blob: Blob, type: string, values: CheckInValues): Promise<void> {
  const id = crypto.randomUUID();
  const path = objectPath(await userId(), id, type);
  const up = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: type, upsert: false, cacheControl: '3600' });
  if (up.error) throw new Error(`Could not upload the photo: ${up.error.message}`);
  const { error } = await supabase.from('photo_log').insert({ id, storage_path: path, ...values });
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw new Error(error.message);
  }
}

/** The file first, then the row: a failed delete leaves a row that still points at the picture, never a picture nobody can see. */
export async function deleteCheckIn(entry: CheckIn): Promise<void> {
  if (entry.storage_path) {
    const { error } = await supabase.storage.from(BUCKET).remove([entry.storage_path]);
    if (error) throw new Error(`Could not delete the photo: ${error.message}`);
  }
  const { error } = await supabase.from('photo_log').delete().eq('id', entry.id);
  if (error) throw new Error(error.message);
}

/** Every photo the signed-in person has, gone from Storage. Throws if any cannot be removed. */
export async function removeAllCheckInPhotos(): Promise<void> {
  const folder = await userId();
  await removeAll({
    list: async () => {
      const { data, error } = await supabase.storage.from(BUCKET).list(folder, { limit: 1000, offset: 0 });
      if (error) throw new Error(error.message);
      return (data ?? []).map((f) => f.name);
    },
    remove: async (names) => {
      const { error } = await supabase.storage.from(BUCKET).remove(names.map((n) => `${folder}/${n}`));
      if (error) throw new Error(error.message);
    },
  });
}
