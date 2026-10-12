import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState } from 'react-native';

// Public by design, as on the web: the publishable key ships in the app and row-level security keeps each person's
// rows to themselves (supabase/README.md in the web repo). The defaults point at the production project.
const URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://zfyeqfnretrrmtevczrc.supabase.co';
const KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_1vuya6LuGu-aWTr-xDW29Q_vfhbwfIM';

/** The session lives in the iOS keychain, not in plain storage. */
const keychain = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(URL, KEY, {
  auth: { storage: keychain, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});

// refresh the token only while the app is in front, as Supabase recommends for React Native
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
