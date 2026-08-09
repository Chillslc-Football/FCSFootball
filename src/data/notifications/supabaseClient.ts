// Required for supabase-js Auth/REST URL handling on React Native / Expo.
import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type SupabaseExtra = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

let client: SupabaseClient | null = null;

function readExtra(): SupabaseExtra {
  const extra = Constants.expoConfig?.extra;
  if (!extra || typeof extra !== 'object') return {};
  return extra as SupabaseExtra;
}

/**
 * Resolve URL from the same EXPO_PUBLIC_* names used project-wide.
 * Falls back to app.config `extra` (populated from those same env vars).
 */
export function resolveSupabaseUrl(): string | null {
  const fromEnv = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  if (fromEnv) return fromEnv;
  const fromExtra = readExtra().supabaseUrl?.trim();
  return fromExtra || null;
}

export function resolveSupabaseAnonKey(): string | null {
  const fromEnv = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (fromEnv) return fromEnv;
  const fromExtra = readExtra().supabaseAnonKey?.trim();
  return fromExtra || null;
}

/**
 * Dev-only presence check — never logs URL/key values.
 * Useful after EAS builds to confirm env inlining without leaking secrets.
 */
export function debugLogSupabaseConfig(source?: string): void {
  if (!__DEV__) return;

  const url = resolveSupabaseUrl();
  const urlPresent = Boolean(url);
  const anonKeyPresent = Boolean(resolveSupabaseAnonKey());
  let host: string | null = null;
  try {
    host = url ? new URL(url).host : null;
  } catch {
    host = 'invalid_url';
  }
  const prefix = source ? `[${source}] ` : '';

  console.log(`${prefix}Supabase config:`);
  console.log(`URL present: ${urlPresent}`);
  console.log(`URL host: ${host ?? 'n/a'}`);
  console.log(`Anon key present: ${anonKeyPresent}`);
}

export function isSupabaseConfigured(): boolean {
  return Boolean(resolveSupabaseUrl() && resolveSupabaseAnonKey());
}

export function getSupabaseUrl(): string | null {
  return resolveSupabaseUrl();
}

export function getSupabaseAnonKey(): string | null {
  return resolveSupabaseAnonKey();
}

/**
 * Shared Supabase client for device RPCs and admin auth sessions.
 * Auth session is persisted so administrators stay signed in.
 */
export function getSupabaseClient(): SupabaseClient | null {
  const supabaseUrl = resolveSupabaseUrl();
  const supabaseAnonKey = resolveSupabaseAnonKey();
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  if (!client) {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  }

  return client;
}
