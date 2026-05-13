import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dijllaixwfoevnpwmcwd.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_H-DyvobUmBBm0iMGsY6fEg_sZULm4r3';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
