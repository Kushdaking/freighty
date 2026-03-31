import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ruyulhpkuxcjoylxrfyz.supabase.co';
const supabaseAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1eXVsaHBrdXhjam95bHhyZnl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4ODY0MTgsImV4cCI6MjA5MDQ2MjQxOH0.83RMuNlboUetr_16j9BCZ8-xjDtjpnK9MaKJxQoBBgg';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
