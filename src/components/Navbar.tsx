import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { useAyudaContext } from './help/helpContext.ts';
import AyudaPanel from './help/HelpPanel.tsx';
const NAV_LINKS = [
  { to: '/', label: 'INICIO' },
  { to: '/pricing', label: 'PRECIOS' },
  { to: '/docs', label: 'DOCUMENTACIÓN' },
];

/** Barra superior pública: logo, enlaces, botón AYUDA contextual (guía de la pestaña activa) e INGRESAR/perfil según sesión. Con scroll cambia de fondo. */
function Navbar() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const path = location.pathname;
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [prevPath, setPrevPath] = useState(path);
  // Ayuda contextual (orig. usuario): las áreas de trabajo reportan su módulo/pestaña y el
  // botón abre el panel in-place junto al perfil — sin redirigir.
  const ayudaCtx = useAyudaContext();
  const [ayudaOpen, setAyudaOpen] = useState(false);
  // Estable (useCallback): el efecto de foco/Escape del panel no se remonta en cada
  // scroll de la navbar (la navbar se re-renderiza con setScrollY en cada wheel).
  const cerrarAyuda = useCallback(() => setAyudaOpen(false), []);
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

  const isLandingTop = path === '/' && scrollY < 50;

  return (
    <>
      <nav
        className={`navbar-gold fixed top-0 w-full z-50 flex justify-between items-center px-4 lg:px-6 transition-all duration-500 ease-in-out ${isLandingTop ? 'navbar-top h-20' : 'navbar-scrolled h-14 border-b border-outline-variant'}`}
      >
        <div className="flex items-center gap-4 md:gap-6">
          <button
            type="button"
            className="md:hidden text-on-surface-variant p-1"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Menú"
            aria-expanded={menuOpen}
          >
            <span aria-hidden="true" className="material-symbols-outlined text-xl!">
              {menuOpen ? 'close' : 'menu'}
            </span>
          </button>
          <Link to="/" className="flex items-center gap-2">
            <img
              src="/logos/civilCardexlogo-v2.webp"
              alt="CivilCardex"
              className="h-10 w-10 md:h-14 md:w-14 object-contain"
              width={40}
              height={40}
              loading="lazy"
            />
            <span className="navbar-brand font-bold text-xl md:text-2xl tracking-tighter uppercase">
              <span className="navbar-brand-a">Civil </span>
              <span className="navbar-brand-b">Cardex</span>
            </span>
          </Link>
          <ul className="navbar-links hidden md:flex gap-4 items-center h-full">
            {NAV_LINKS.map((l) => (
              <li key={l.to}>
                <Link
                  to={l.to}
                  className={`navbar-mono ${path === l.to ? active : inactive}`}
                  aria-current={path === l.to ? 'page' : undefined}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex gap-3 items-center">
          {ayudaCtx && (
            <button
              type="button"
              onClick={() => setAyudaOpen(true)}
              aria-haspopup="dialog"
              aria-label={`Ayuda: ${ayudaCtx.modulo} — ${ayudaCtx.seccion}`}
              className="navbar-chip flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all hover:bg-white/5 cursor-pointer"
            >
              <span aria-hidden="true" className="navbar-help-icon material-symbols-outlined">
                help
              </span>
              <span className="navbar-mono hidden sm:inline text-xs font-semibold text-on-surface-variant">
                AYUDA
              </span>
            </button>
          )}
          {loading ? (
            <span className="text-on-surface-variant text-xs font-mono">...</span>
          ) : user ? (
            <Link
              to="/perfil"
              className="navbar-chip flex items-center gap-2 px-3 py-1.5 rounded-md transition-all hover:bg-white/5"
            >
              <div className="navbar-avatar">
                {(user.user_metadata?.name || user.email || '?')[0].toUpperCase()}
              </div>
              <span className="navbar-mono text-xs font-semibold text-on-surface-variant hidden sm:inline">
                {user.user_metadata?.name || (user.email?.split('@') || [''])[0] || user.email}
              </span>
            </Link>
          ) : (
            <Link
              to="/login"
              className="navbar-login bg-primary-container text-on-primary-container px-3 md:px-4 py-1.5 uppercase text-[10px] md:text-xs tracking-[0.08em] font-bold border border-primary hover:bg-primary hover:text-on-primary transition-all"
            >
              INGRESAR
            </Link>
          )}
        </div>

        {menuOpen && (
          <div className="navbar-menu absolute top-14 left-0 right-0 border-b border-outline-variant md:hidden">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                aria-current={path === l.to ? 'page' : undefined}
                className={`navbar-mono block px-6 py-3 text-xs tracking-[0.08em] font-bold uppercase border-b border-outline-variant ${path === l.to ? 'text-primary' : 'text-on-surface-variant hover:text-primary'}`}
              >
                {l.label}
              </Link>
            ))}
          </div>
        )}
      </nav>
      {ayudaOpen && ayudaCtx && <AyudaPanel ctx={ayudaCtx} onClose={cerrarAyuda} />}
    </>
  );
}

export default Navbar;
