import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export function ProtectedRoute() {
  const [user, setUser] = useState<any>(() => {
    if (!supabase) return null;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
          const val = localStorage.getItem(key);
          if (val) {
            const parsed = JSON.parse(val);
            if (parsed && parsed.user) return parsed.user;
          }
        }
      }
    } catch {
      // ignore
    }
    return null;
  });

  useEffect(() => {
    if (!supabase) return;
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user ?? null);
    })();
  }, []);

  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}
