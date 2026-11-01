// Public by design, as on the web: the publishable key ships in the app and row-level security keeps each person's
// rows to themselves (supabase/README.md). The defaults point at the production project.
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://zfyeqfnretrrmtevczrc.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_1vuya6LuGu-aWTr-xDW29Q_vfhbwfIM';
