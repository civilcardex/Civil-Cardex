import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';

interface User {
  id: string;
  email?: string;
  user_metadata?: Record<string, string>;
}

/** Auth state API — current user, loading flag, and signIn/signUp methods backed by Supabase auth. */
interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (
    email: string,
    password: string,
  ) => Promise<Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>['data']>;
  signUp: (
    email: string,
    password: string,
    options?: { data?: Record<string, string> },
  ) => Promise<Awaited<ReturnType<typeof supabase.auth.signUp>>['data']>;
}

const AuthContext = createContext<AuthContextType | null>(null);

/** Wraps children with Supabase auth state — fetches current user on mount, listens to auth state changes, exposes user/loading/signIn/signUp via context. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;

    const initAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user as User | null);
      setLoading(false);

      subscription = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user as User | null);
      }).data.subscription;
    };

    initAuth();

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      signIn: async (email: string, password: string) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return data;
      },
      signUp: async (
        email: string,
        password: string,
        options?: { data?: Record<string, string> },
      ) => {
        const { data, error } = await supabase.auth.signUp({ email, password, options });
        if (error) throw error;
        return data;
      },
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Consumer hook for AuthContext — returns {user, loading, signIn, signUp}. Throws if used outside AuthProvider. */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
