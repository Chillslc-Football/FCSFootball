import { useCallback, useEffect, useState } from 'react';

import { checkIsAppAdmin } from '@/data/media/mediaAdminApi';
import { getSupabaseClient, isSupabaseConfigured } from '@/data/notifications/supabaseClient';

export type AdminAuthState = {
  loaded: boolean;
  configured: boolean;
  email: string | null;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

/**
 * Minimal admin auth: Supabase email/password + server-side allowlist check.
 * Non-allowlisted accounts are signed out immediately.
 */
export function useAdminAuth(): AdminAuthState {
  const [loaded, setLoaded] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const configured = isSupabaseConfigured();

  const refresh = useCallback(async () => {
    const client = getSupabaseClient();
    if (!client) {
      setEmail(null);
      setIsAdmin(false);
      setLoaded(true);
      return;
    }

    const { data } = await client.auth.getSession();
    const sessionEmail = data.session?.user?.email?.trim().toLowerCase() ?? null;
    if (!sessionEmail) {
      setEmail(null);
      setIsAdmin(false);
      setLoaded(true);
      return;
    }

    const admin = await checkIsAppAdmin();
    if (!admin) {
      await client.auth.signOut();
      setEmail(null);
      setIsAdmin(false);
      setLoaded(true);
      return;
    }

    setEmail(sessionEmail);
    setIsAdmin(true);
    setLoaded(true);
  }, []);

  useEffect(() => {
    void refresh();
    const client = getSupabaseClient();
    if (!client) return;
    const { data: subscription } = client.auth.onAuthStateChange(() => {
      void refresh();
    });
    return () => {
      subscription.subscription.unsubscribe();
    };
  }, [refresh]);

  const signIn = useCallback(async (rawEmail: string, password: string) => {
    const client = getSupabaseClient();
    if (!client) {
      return { ok: false as const, error: 'Supabase is not configured.' };
    }
    const normalizedEmail = rawEmail.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      return { ok: false as const, error: 'Email and password are required.' };
    }

    const { error } = await client.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });
    if (error) {
      return { ok: false as const, error: error.message };
    }

    const admin = await checkIsAppAdmin();
    if (!admin) {
      await client.auth.signOut();
      return {
        ok: false as const,
        error: 'This account is not authorized for administrator access.',
      };
    }

    setEmail(normalizedEmail);
    setIsAdmin(true);
    return { ok: true as const };
  }, []);

  const signOut = useCallback(async () => {
    const client = getSupabaseClient();
    if (client) await client.auth.signOut();
    setEmail(null);
    setIsAdmin(false);
  }, []);

  return { loaded, configured, email, isAdmin, signIn, signOut, refresh };
}
