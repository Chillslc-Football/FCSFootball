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

/** TEMP DEBUG — remove after diagnosing Suggest Media Supabase config. */
export function debugLogSupabaseConfig(source: string): void {
  const envUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const envKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const extra = Constants.expoConfig?.extra;
  const resolvedUrl = resolveSupabaseUrl();
  const resolvedKey = resolveSupabaseAnonKey();
  const configured = isSupabaseConfigured();
  const client = getSupabaseClient();

  console.log(`[SupabaseDebug:${source}] ========== START ==========`);
  console.log(`[SupabaseDebug:${source}] 1 process.env.EXPO_PUBLIC_SUPABASE_URL =`, envUrl);
  console.log(
    `[SupabaseDebug:${source}] 1b typeof/length URL =`,
    typeof envUrl,
    envUrl == null ? 'nullish' : String(envUrl).length,
  );
  console.log(`[SupabaseDebug:${source}] 2 process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY =`, envKey);
  console.log(
    `[SupabaseDebug:${source}] 2b typeof/length KEY =`,
    typeof envKey,
    envKey == null ? 'nullish' : String(envKey).length,
  );
  console.log(`[SupabaseDebug:${source}] 3 Constants.expoConfig?.extra =`, extra);
  console.log(`[SupabaseDebug:${source}] 3b extra.supabaseUrl =`, (extra as SupabaseExtra | undefined)?.supabaseUrl);
  console.log(
    `[SupabaseDebug:${source}] 3c extra.supabaseAnonKey =`,
    (extra as SupabaseExtra | undefined)?.supabaseAnonKey,
  );
  console.log(`[SupabaseDebug:${source}] 4 resolveSupabaseUrl() =`, resolvedUrl);
  console.log(`[SupabaseDebug:${source}] 5 resolveSupabaseAnonKey() =`, resolvedKey);
  console.log(`[SupabaseDebug:${source}] 6 isSupabaseConfigured() =`, configured);
  console.log(
    `[SupabaseDebug:${source}] 7 getSupabaseClient() =`,
    client ? `SupabaseClient(ok) urlHost=${(() => {
      try {
        return resolvedUrl ? new URL(resolvedUrl).host : 'n/a';
      } catch {
        return 'invalid-url';
      }
    })()}` : null,
  );
  console.log(`[SupabaseDebug:${source}] ========== END ==========`);
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
