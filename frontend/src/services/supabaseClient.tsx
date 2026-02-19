import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// ⚠️ PRODUCTION SECURITY NOTE ⚠️
// The ANON key is safe to expose in the frontend as long as Row Level Security (RLS) 
// is enabled on the database. However, providing the Service Role Key here is FATAL.
// Always Ensure this is the ANON key.

const SUPABASE_URL = 'https://xwuijkusykpszobxnkmh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_U5RibkRY-5s0CIpOB8Dplw_PdN_UQuf';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});
