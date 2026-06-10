import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export function ProtectedRoute() {
  const [user, setUser] = useState<any>(undefined);

  useEffect(() => {
    if (!supabase) { setUser(null); return; }
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
  }, []);

  if (user === undefined) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--on-surface)' }}>Verificando acceso...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}
