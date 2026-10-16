import AsyncStorage from '@react-native-async-storage/async-storage';
import type { KeyValueStore } from './outbox';

/** The outbox lives in plain app storage; only the session goes in the keychain. */
export const outboxStore: KeyValueStore = AsyncStorage;
