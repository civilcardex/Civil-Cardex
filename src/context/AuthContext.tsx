import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';

interface User {
  id: string;
  email?: string;
  user_metadata?: Record<string, string>;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>['data']>;
  signUp: (email: string, password: string, options?: { data?: Record<string, string> }) => Promise<Awaited<ReturnType<typeof supabase.auth.signUp>>['data']>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;

    const initAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
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

  const value = useMemo(() => ({
    user,
    loading,
    signIn: async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data;
    },
    signUp: async (email: string, password: string, options?: { data?: Record<string, string> }) => {
      const { data, error } = await supabase.auth.signUp({ email, password, options });
      if (error) throw error;
      return data;
    },
  }), [user, loading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}