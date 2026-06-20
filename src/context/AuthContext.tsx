import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface User {
  id: string;
  email?: string;
  user_metadata?: Record<string, string>;
  [key: string]: any;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<any>;
  signUp: (email: string, password: string, options?: { data?: Record<string, string> }) => Promise<any>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;

    const initAuth = async () => {
      const { supabase } = await import('../lib/supabase');
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

  const signIn = async (email: string, password: string) => {
    const { supabase } = await import('../lib/supabase');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const signUp = async (email: string, password: string, options?: { data?: Record<string, string> }) => {
    const { supabase } = await import('../lib/supabase');
    const { data, error } = await supabase.auth.signUp({ email, password, options });
    if (error) throw error;
    return data;
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

export function getCurrentUser() {
  return import('../lib/supabase').then(({ supabase }) =>
    supabase.auth.getUser().then(({ data: { user } }) => user)
  );
}