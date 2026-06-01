import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';

function Navbar() {
  const location = useLocation();
  const path = location.pathname;
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription?.unsubscribe();
  }, []);

  const active = 'text-primary border-b border-primary pb-1 uppercase text-xs tracking-[0.08em] font-bold cursor-pointer active-nav-glow transition-all';
  const inactive = 'text-on-surface-variant uppercase text-xs tracking-[0.08em] font-bold hover:text-primary transition-colors px-3 py-1';

  return (
    <nav className="fixed top-0 w-full z-50 border-b border-outline-variant flex justify-between items-center h-14 px-4 lg:px-6"
      style={{ background: '#111317' }}>
      <div className="flex items-center gap-6">
        <Link to="/" className="flex items-center gap-2">
          <img src="/logos/civilCorelogo.webp" alt="CivilCore" className="h-12 w-12 object-contain" />
          <span className="font-bold text-2xl tracking-tighter uppercase text-primary" style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}>CIVILCORE</span>
        </Link>
        <div className="hidden md:flex gap-4 items-center h-full">
          <Link to="/" className={path === '/' ? active : inactive} style={{ fontFamily: 'Geist, monospace' }}>INICIO</Link>
          <Link to="/pricing" className={path === '/pricing' ? active : inactive} style={{ fontFamily: 'Geist, monospace' }}>PRECIOS</Link>
          <Link to="/docs" className={path === '/docs' ? active : inactive} style={{ fontFamily: 'Geist, monospace' }}>DOCUMENTACIÓN</Link>
        </div>
      </div>
      <div className="flex gap-3 items-center">
        {loading ? (
          <span className="text-on-surface-variant text-xs font-mono">...</span>
        ) : user ? (
          <Link to="/perfil" className="flex items-center gap-2 px-3 py-1.5 rounded-md transition-all hover:bg-white/5"
            style={{ border: '1px solid rgba(59,130,246,0.25)', background: 'rgba(59,130,246,0.06)' }}>
            <div style={{
              width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg,#3B82F6,#1D4ED8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              color: '#fff', fontSize: 11, fontWeight: 700, fontFamily: 'Geist, monospace',
            }}>
              {(user.user_metadata?.name || user.email || '?')[0].toUpperCase()}
            </div>
            <span className="text-xs font-semibold text-on-surface-variant hidden sm:inline" style={{ fontFamily: 'Geist, monospace' }}>
              {user.user_metadata?.name || (user.email?.split('@') || [''])[0] || user.email}
            </span>
          </Link>
        ) : (
          <Link to="/login" className="bg-primary-container text-on-primary-container px-4 py-1.5 uppercase text-xs tracking-[0.08em] font-bold border border-primary hover:bg-primary hover:text-on-primary transition-all" style={{ fontFamily: 'Geist, monospace', boxShadow: '0 0 10px rgba(0,245,255,0.1)' }}>
            INGRESAR
          </Link>
        )}
      </div>
    </nav>
  );
}

export default Navbar;
