import AsyncStorage from '@react-native-async-storage/async-storage';
import type { KeyValueStore } from './outbox';

/** The outbox lives in plain app storage; only the session goes in the keychain. */
export const outboxStore: KeyValueStore = AsyncStorage;

/** Forgets everything the app keeps on this device: the outbox and the last sync. The session is the keychain's, and signing out clears it. */
export async function clearDeviceData(): Promise<void> {
  await AsyncStorage.clear();
}
