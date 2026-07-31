import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
const Navbar_S1: React.CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: '50%',
  background: 'linear-gradient(135deg,var(--acc2),var(--acc3))',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  color: '#fff',
  fontSize: 12,
  fontWeight: 700,
  fontFamily: 'Geist, monospace',
};
const Navbar_navLinks = [
  { to: '/', label: 'INICIO' },
  { to: '/pricing', label: 'PRECIOS' },
  { to: '/docs', label: 'DOCUMENTACIÓN' },
];

function Navbar() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const path = location.pathname;
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [prevPath, setPrevPath] = useState(path);
  if (path !== prevPath) {
    setPrevPath(path);
    setMenuOpen(false);
  }

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const active =
    'text-primary border-b border-primary pb-1 uppercase text-xs tracking-[0.08em] font-bold cursor-pointer active-nav-glow transition-all';
  const inactive =
    'text-on-surface-variant uppercase text-xs tracking-[0.08em] font-bold hover:text-primary transition-colors px-3 py-1';

  const navLinks = Navbar_navLinks;

  const isLandingTop = path === '/' && scrollY < 50;

  return (
    <>
      <style>{`.navbar-gold{--acc:#e8c84a;--acc2:#f5d668;--acc3:#c8a84e;--glow:rgba(245,214,104,0.3)}`}</style>
      <nav
        className={`navbar-gold fixed top-0 w-full z-50 flex justify-between items-center px-4 lg:px-6 transition-all duration-500 ease-in-out ${isLandingTop ? 'h-20' : 'h-14 border-b border-outline-variant'}`}
        style={{
          background: isLandingTop ? 'transparent' : 'rgba(17,19,23,0.85)',
          backdropFilter: isLandingTop ? 'none' : 'blur(12px)',
        }}
      >
        <div className="flex items-center gap-4 md:gap-6">
          <button
            type="button"
            className="md:hidden text-on-surface-variant p-1"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Menú"
            aria-expanded={menuOpen}
          >
            <span aria-hidden="true" className="material-symbols-outlined text-xl">
              {menuOpen ? 'close' : 'menu'}
            </span>
          </button>
          <Link to="/" className="flex items-center gap-2">
            <img
              src="/logos/civilCardexlogo.webp"
              alt="CivilCardex"
              className="h-10 w-10 md:h-14 md:w-14 object-contain"
              width={40}
              height={40}
              loading="lazy"
            />
            <span
              className="font-bold text-xl md:text-2xl tracking-tighter uppercase"
              style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}
            >
              <span style={{ color: '#dce3ea' }}>Civil </span>
              <span style={{ color: 'var(--acc)' }}>Cardex</span>
            </span>
          </Link>
          <ul
            className="hidden md:flex gap-4 items-center h-full"
            style={{ listStyle: 'none', margin: 0, padding: 0 }}
          >
            {navLinks.map((l) => (
              <li key={l.to}>
                <Link
                  to={l.to}
                  className={path === l.to ? active : inactive}
                  aria-current={path === l.to ? 'page' : undefined}
                  style={{ fontFamily: 'Geist, monospace' }}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex gap-3 items-center">
          {loading ? (
            <span className="text-on-surface-variant text-xs font-mono">...</span>
          ) : user ? (
            <Link
              to="/perfil"
              className="flex items-center gap-2 px-3 py-1.5 rounded-md transition-all hover:bg-white/5"
              style={{
                border: '1px solid var(--glow)',
                background: 'rgba(245,214,104,0.06)',
              }}
            >
              <div style={Navbar_S1}>
                {(user.user_metadata?.name || user.email || '?')[0].toUpperCase()}
              </div>
              <span
                className="text-xs font-semibold text-on-surface-variant hidden sm:inline"
                style={{ fontFamily: 'Geist, monospace' }}
              >
                {user.user_metadata?.name || (user.email?.split('@') || [''])[0] || user.email}
              </span>
            </Link>
          ) : (
            <Link
              to="/login"
              className="bg-primary-container text-on-primary-container px-3 md:px-4 py-1.5 uppercase text-[10px] md:text-xs tracking-[0.08em] font-bold border border-primary hover:bg-primary hover:text-on-primary transition-all"
              style={{ fontFamily: 'Geist, monospace', boxShadow: '0 0 10px var(--glow)' }}
            >
              INGRESAR
            </Link>
          )}
        </div>

        {menuOpen && (
          <div
            className="absolute top-14 left-0 right-0 border-b border-outline-variant md:hidden"
            style={{ background: '#111317' }}
          >
            {navLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                aria-current={path === l.to ? 'page' : undefined}
                className={`block px-6 py-3 text-xs tracking-[0.08em] font-bold uppercase border-b border-outline-variant ${path === l.to ? 'text-primary' : 'text-on-surface-variant hover:text-primary'}`}
                style={{ fontFamily: 'Geist, monospace' }}
              >
                {l.label}
              </Link>
            ))}
          </div>
        )}
      </nav>
    </>
  );
}

export default Navbar;
