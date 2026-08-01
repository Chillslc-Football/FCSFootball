import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { checkIsAppAdmin } from './lib/api';
import { getSupabase, isSupabaseConfigured } from './lib/supabase';

type AuthState = {
  loaded: boolean;
  configured: boolean;
  email: string | null;
  isAdmin: boolean;
  unauthorized: boolean;
  signIn: (email: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);
  const configured = isSupabaseConfigured();

  const refresh = useCallback(async () => {
    if (!configured) {
      setEmail(null);
      setIsAdmin(false);
      setUnauthorized(false);
      setLoaded(true);
      return;
    }
    const client = getSupabase();
    const { data } = await client.auth.getSession();
    const sessionEmail = data.session?.user?.email?.trim().toLowerCase() ?? null;
    if (!sessionEmail) {
      setEmail(null);
      setIsAdmin(false);
      setUnauthorized(false);
      setLoaded(true);
      return;
    }
    const admin = await checkIsAppAdmin();
    if (!admin) {
      await client.auth.signOut();
      setEmail(null);
      setIsAdmin(false);
      setUnauthorized(true);
      setLoaded(true);
      return;
    }
    setEmail(sessionEmail);
    setIsAdmin(true);
    setUnauthorized(false);
    setLoaded(true);
  }, [configured]);

  useEffect(() => {
    void refresh();
    if (!configured) return;
    const client = getSupabase();
    const { data } = client.auth.onAuthStateChange(() => {
      void refresh();
    });
    return () => data.subscription.unsubscribe();
  }, [configured, refresh]);

  const signIn = useCallback(async (rawEmail: string, password: string) => {
    if (!configured) return { ok: false as const, error: 'Supabase is not configured.' };
    const normalized = rawEmail.trim().toLowerCase();
    if (!normalized || !password) {
      return { ok: false as const, error: 'Email and password are required.' };
    }
    const client = getSupabase();
    const { error } = await client.auth.signInWithPassword({
      email: normalized,
      password,
    });
    if (error) return { ok: false as const, error: error.message };

    const admin = await checkIsAppAdmin();
    if (!admin) {
      await client.auth.signOut();
      setUnauthorized(true);
      return {
        ok: false as const,
        error: 'This account is not authorized for Media Admin access.',
      };
    }
    setEmail(normalized);
    setIsAdmin(true);
    setUnauthorized(false);
    return { ok: true as const };
  }, [configured]);

  const signOut = useCallback(async () => {
    if (configured) await getSupabase().auth.signOut();
    setEmail(null);
    setIsAdmin(false);
  }, [configured]);

  const value = useMemo(
    () => ({ loaded, configured, email, isAdmin, unauthorized, signIn, signOut }),
    [loaded, configured, email, isAdmin, unauthorized, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth requires AuthProvider');
  return ctx;
}
