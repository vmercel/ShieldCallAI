/**
 * Supabase Client for ShieldCall AI
 * Configured with cross-platform session storage and PKCE auth flow.
 */

import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import type { Database } from './database.types';

const extra = (Constants.expoConfig?.extra ?? {}) as {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

export const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL
  || extra.supabaseUrl
  || 'https://cnrgrivqmuivxpnstaom.supabase.co';

export const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  || extra.supabaseAnonKey
  || '';

const createStorageAdapter = () => {
  if (Platform.OS === 'web') {
    return {
      getItem: (key: string) => {
        if (typeof window !== 'undefined' && window.localStorage) {
          return Promise.resolve(window.localStorage.getItem(key));
        }
        return Promise.resolve(null);
      },
      setItem: (key: string, value: string) => {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(key, value);
        }
        return Promise.resolve();
      },
      removeItem: (key: string) => {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(key);
        }
        return Promise.resolve();
      },
    };
  }
  return AsyncStorage;
};

// Lazy singleton — defers client creation until first access so the module
// can be imported during SSR/render without throwing when env vars are not
// yet injected (they are always present at runtime on the device).
let _client: ReturnType<typeof createClient<Database>> | null = null;

function getSupabaseClient() {
  if (!_client) {
    const key = SUPABASE_ANON_KEY;
    if (!key) {
      // During SSR render the env vars are not yet available; return a
      // minimal stub so the import does not throw.
      console.warn('[supabase] EXPO_PUBLIC_SUPABASE_ANON_KEY is not set — using stub client');
    }
    _client = createClient<Database>(SUPABASE_URL, key || 'placeholder-key-not-set', {
      auth: {
        storage: createStorageAdapter(),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }
  return _client;
}

// Named export for direct usage (Proxy delegates all calls to the lazy client)
export const supabase = new Proxy({} as ReturnType<typeof createClient<Database>>, {
  get(_target, prop) {
    return (getSupabaseClient() as any)[prop];
  },
});
