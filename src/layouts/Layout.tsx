import { Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar.tsx';

/** Esqueleto de páginas con Navbar: skip-link de accesibilidad y un main con scroll propio (el workarea usa h-full y scrollea interno, no aquí). */
function Layout() {
  return (
    <>
      {/* visible solo con :focus (index.css .skip-link) — sin JS. */}
      <a href="#main-content" className="skip-link">
        Saltar al contenido principal
      </a>
      <div className="h-screen overflow-hidden bg-surface-bg flex flex-col">
        <Navbar />
        <div className="flex flex-1 overflow-hidden pt-14">
          {/* overflow-y auto: las páginas altas (perfil, módulos) scrollean aquí; el workarea
              no desborda (usa h-full + scroll interno propio), así que no cambia para él. */}
          <main id="main-content" className="flex-1 flex flex-col min-w-0 overflow-y-auto">
            <div className="flex-1">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </>
  );
}

export default Layout;
