import { createClient } from '@supabase/supabase-js';
import type { Database } from './types.ts';

// Public by design: the publishable key ships in every browser, and row-level security (see supabase/README.md)
// is what keeps the data private. The defaults point at the production project.
const URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://zfyeqfnretrrmtevczrc.supabase.co';
const PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_1vuya6LuGu-aWTr-xDW29Q_vfhbwfIM';

export const supabase = createClient<Database>(URL, PUBLISHABLE_KEY);
