import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import * as Sharing from 'expo-sharing';
import { LAST_SYNC_KEY } from '../sync/run';
import { SUPABASE_URL } from '../env';
import { flowsIndexKey, keysToClear } from './authKeys';
import { clearDevice } from './clearDevice';

/** Deletes every file in the cache. The cache directory itself stays, because the system owns it. */
export function clearCacheDirectory(): void {
  const cache = Paths.cache;
  if (!cache.exists) return;
  for (const entry of cache.list()) {
    try {
      entry.delete();
    } catch {
      // a file the system is holding can stay; the account deletion does not depend on it
    }
  }
}

/** The sync cursor and anything kept outside the keychain. The session itself is removed after sign-out. */
export async function clearAppData(): Promise<void> {
  await clearDevice({
    secureKeys: [LAST_SYNC_KEY],
    deleteSecure: (key) => SecureStore.deleteItemAsync(key),
    clearAsync: () => AsyncStorage.clear(),
    clearCache: async () => {
      clearCacheDirectory();
    },
  });
}

/** Keychain entries the Supabase client writes, including any sign-in verifier slots recorded before sign-out. */
export async function clearSessionKeys(flowsIndexRaw: string | null): Promise<void> {
  await clearDevice({
    secureKeys: keysToClear(SUPABASE_URL, flowsIndexRaw, [LAST_SYNC_KEY]),
    deleteSecure: (key) => SecureStore.deleteItemAsync(key),
    clearAsync: async () => {},
    clearCache: async () => {},
  });
}

export async function readFlowsIndex(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(flowsIndexKey(SUPABASE_URL));
  } catch {
    return null;
  }
}

/**
 * Writes the export into the cache and opens the iOS share sheet. The copy in the cache is removed once the sheet
 * closes; the copy the person keeps is the one they chose in the sheet.
 */
export async function shareJsonFile(name: string, body: string): Promise<void> {
  const file = new File(Paths.cache, name);
  try {
    file.create({ overwrite: true });
    file.write(body);
    if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device');
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json' });
  } finally {
    try {
      if (file.exists) file.delete();
    } catch {
      // the sheet has the copy it needs; a leftover cache file is cleared with the account
    }
  }
}
