import * as SecureStore from 'expo-secure-store';
import { lastSync } from '../sync/run';

const KEY = 'intus.healthAsked';

/**
 * True once this phone has shown the Health sheet, or a sync has already run here. A previous sync counts, because
 * permission was asked then.
 */
export async function healthAsked(): Promise<boolean> {
  const flag = await SecureStore.getItemAsync(KEY);
  if (flag === '1') return true;
  return (await lastSync()) !== null;
}

export async function markHealthAsked(): Promise<void> {
  await SecureStore.setItemAsync(KEY, '1');
}
