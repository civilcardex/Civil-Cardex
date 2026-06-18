import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';

function Navbar() {
  const location = useLocation();
  const path = location.pathname;
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

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

  useEffect(() => { setMenuOpen(false); }, [path]);

  const active = 'text-primary border-b border-primary pb-1 uppercase text-xs tracking-[0.08em] font-bold cursor-pointer active-nav-glow transition-all';
  const inactive = 'text-on-surface-variant uppercase text-xs tracking-[0.08em] font-bold hover:text-primary transition-colors px-3 py-1';

  const navLinks = [
    { to: '/', label: 'INICIO' },
    { to: '/pricing', label: 'PRECIOS' },
    { to: '/docs', label: 'DOCUMENTACIÓN' },
  ];

  return (
    <nav className="fixed top-0 w-full z-50 border-b border-outline-variant flex justify-between items-center h-14 px-4 lg:px-6"
      style={{ background: '#111317' }}>
      <div className="flex items-center gap-4 md:gap-6">
<button className="md:hidden text-on-surface-variant p-1" 
          onClick={() => setMenuOpen(o => !o)} aria-label="Menú" aria-expanded={menuOpen}>
          <span className="material-symbols-outlined text-xl">{menuOpen ? 'close' : 'menu'}</span>
        </button>
        <Link to="/" className="flex items-center gap-2">
          <img src="/logos/civilCorelogo.webp" alt="CivilCore" className="h-9 w-9 md:h-12 md:w-12 object-contain"  width={36} height={36} loading="lazy" />
          <span className="font-bold text-xl md:text-2xl tracking-tighter uppercase text-primary" style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}>CivilCore</span>
        </Link>
        <div className="hidden md:flex gap-4 items-center h-full">
          {navLinks.map(l => (
            <Link key={l.to} to={l.to} className={path === l.to ? active : inactive} aria-current={path === l.to ? 'page' : undefined} style={{ fontFamily: 'Geist, monospace' }}>{l.label}</Link>
          ))}
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
          <Link to="/login" className="bg-primary-container text-on-primary-container px-3 md:px-4 py-1.5 uppercase text-[10px] md:text-xs tracking-[0.08em] font-bold border border-primary hover:bg-primary hover:text-on-primary transition-all" style={{ fontFamily: 'Geist, monospace', boxShadow: '0 0 10px rgba(0,245,255,0.1)' }}>
            INGRESAR
          </Link>
        )}
      </div>

      {menuOpen && (
        <div className="absolute top-14 left-0 right-0 border-b border-outline-variant md:hidden"
          style={{ background: '#111317' }}>
          {navLinks.map(l => (
            <Link key={l.to} to={l.to} aria-current={path === l.to ? 'page' : undefined}
              className={`block px-6 py-3 text-xs tracking-[0.08em] font-bold uppercase border-b border-outline-variant ${path === l.to ? 'text-primary' : 'text-on-surface-variant hover:text-primary'}`}
              style={{ fontFamily: 'Geist, monospace' }}>
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}

export default Navbar;
