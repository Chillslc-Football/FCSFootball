import { useCallback, useEffect, useRef, useState } from 'react';

import {
  formatAdminSignInError,
  logAdminAuthFailureDev,
} from '@/data/media/adminAuthErrors';
import { checkIsAppAdmin } from '@/data/media/mediaAdminApi';
import {
  getSupabaseClient,
  getSupabaseUrl,
  isSupabaseConfigured,
} from '@/data/notifications/supabaseClient';

export type AdminAuthState = {
  loaded: boolean;
  configured: boolean;
  email: string | null;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

function resolveSupabaseHost(): string | null {
  const url = getSupabaseUrl();
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/**
 * Minimal admin auth: Supabase email/password + server-side allowlist check.
 * Non-allowlisted accounts are signed out immediately.
 */
export function useAdminAuth(): AdminAuthState {
  const [loaded, setLoaded] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const configured = isSupabaseConfigured();
  const signInInFlightRef = useRef(false);

  const refresh = useCallback(async () => {
    const client = getSupabaseClient();
    if (!client) {
      setEmail(null);
      setIsAdmin(false);
      setLoaded(true);
      return;
    }

    try {
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
    } catch (error) {
      logAdminAuthFailureDev({
        phase: 'unknown',
        error,
        supabaseHost: resolveSupabaseHost(),
      });
      setEmail(null);
      setIsAdmin(false);
      setLoaded(true);
    }
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
    if (signInInFlightRef.current) {
      return { ok: false as const, error: 'Sign-in already in progress.' };
    }

    const client = getSupabaseClient();
    if (!client) {
      return {
        ok: false as const,
        error: formatAdminSignInError(null, 'not_configured'),
      };
    }
    const normalizedEmail = rawEmail.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      return {
        ok: false as const,
        error: formatAdminSignInError(null, 'validation'),
      };
    }

    signInInFlightRef.current = true;
    try {
      const { error } = await client.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (error) {
        logAdminAuthFailureDev({
          phase: 'sign_in',
          error,
          supabaseHost: resolveSupabaseHost(),
        });
        // Ensure no half-open session sticks around after a failed attempt.
        try {
          await client.auth.signOut();
        } catch {
          // ignore
        }
        setEmail(null);
        setIsAdmin(false);
        return {
          ok: false as const,
          error: formatAdminSignInError(error, 'sign_in'),
        };
      }

      let admin = false;
      try {
        admin = await checkIsAppAdmin();
      } catch (adminError) {
        logAdminAuthFailureDev({
          phase: 'admin_check',
          error: adminError,
          supabaseHost: resolveSupabaseHost(),
        });
        try {
          await client.auth.signOut();
        } catch {
          // ignore
        }
        setEmail(null);
        setIsAdmin(false);
        return {
          ok: false as const,
          error: formatAdminSignInError(adminError, 'sign_in'),
        };
      }

      if (!admin) {
        await client.auth.signOut();
        setEmail(null);
        setIsAdmin(false);
        return {
          ok: false as const,
          error: formatAdminSignInError(null, 'admin_check'),
        };
      }

      setEmail(normalizedEmail);
      setIsAdmin(true);
      return { ok: true as const };
    } catch (error) {
      // Thrown TypeError / AuthRetryableFetchError ("Network request failed")
      logAdminAuthFailureDev({
        phase: 'sign_in',
        error,
        supabaseHost: resolveSupabaseHost(),
      });
      try {
        await client.auth.signOut();
      } catch {
        // ignore
      }
      setEmail(null);
      setIsAdmin(false);
      return {
        ok: false as const,
        error: formatAdminSignInError(error, 'sign_in'),
      };
    } finally {
      signInInFlightRef.current = false;
    }
  }, []);

  const signOut = useCallback(async () => {
    const client = getSupabaseClient();
    if (client) {
      try {
        await client.auth.signOut();
      } catch (error) {
        logAdminAuthFailureDev({
          phase: 'unknown',
          error,
          supabaseHost: resolveSupabaseHost(),
        });
      }
    }
    setEmail(null);
    setIsAdmin(false);
  }, []);

  return { loaded, configured, email, isAdmin, signIn, signOut, refresh };
}
