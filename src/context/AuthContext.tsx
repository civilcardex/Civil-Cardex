import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';

interface User {
  id: string;
  email?: string;
  user_metadata?: Record<string, string>;
}

/** Estado de sesión (Supabase auth): usuario actual + signIn/signUp. Ej: `const { user } = useAuth()`. */
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
  /** Envía el correo de restablecimiento; el link vuelve a /restablecer con una sesión
   *  recovery (sesión especial de un solo uso que solo sirve para cambiar la contraseña). */
  resetPassword: (email: string) => Promise<void>;
  /** Cambia la contraseña del usuario con sesión activa (flujo recovery) y CIERRA la sesión:
   *  la sesión de recovery nace de un link de un solo uso y no debe sobrevivir al cambio —
   *  el usuario vuelve a /login con la nueva credencial. */
  updatePassword: (password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

/** Provee la sesión a la app: lee el usuario al montar y escucha cambios de auth. */
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

    // "Recordarme" del login (LoginPage): DESMARCADO deja la marca `civilflow_no_recordar`
    // y al cerrar la pestaña/navegador se cierra la sesión (best-effort: el navegador no da
    // una señal de cierre confiable; pagehide + visibilitychange la emulan). MARCADO (default)
    // = la sesión persiste en localStorage como siempre.
    const cerrarSiNoRecordar = () => {
      try {
        if (localStorage.getItem('civilflow_no_recordar') === '1') void supabase.auth.signOut();
      } catch {
        /* storage bloqueado: ignorar */
      }
    };
    // Solo pagehide: NO usar visibilitychange (cambiar de pestaña dispararía el cierre).
    window.addEventListener('pagehide', cerrarSiNoRecordar);

    return () => {
      subscription?.unsubscribe();
      window.removeEventListener('pagehide', cerrarSiNoRecordar);
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
      resetPassword: async (email: string) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/restablecer`,
        });
        if (error) throw error;
      },
      /** Cambia la contraseña del usuario con sesión activa (flujo recovery) y CIERRA la sesión:
       *  la sesión de recovery nace de un link de un solo uso y no debe sobrevivir al cambio —
       *  el usuario vuelve a /login con la nueva credencial. */
      updatePassword: async (password: string) => {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        await supabase.auth.signOut().catch(() => {
          /* sesión puede quedar viva ante fallo de red; el cambio de contraseña ya ocurrió */
        });
      },
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Lee la sesión (user/loading/signIn/signUp). Ej: `const { user } = useAuth()`. Falla fuera de AuthProvider. */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
