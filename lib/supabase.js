import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dijllaixwfoevnpwmcwd.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_H-DyvobUmBBm0iMGsY6fEg_sZULm4r3';

/** Expo / React Native: provide AsyncStorage for session persistence. */
const storage = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

