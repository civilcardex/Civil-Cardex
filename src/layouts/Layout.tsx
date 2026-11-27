import { Outlet } from 'react-router';
import Navbar from '../components/Navbar.tsx';

/** Esqueleto de páginas con Navbar: skip-link de accesibilidad y un main con scroll propio (el workarea usa h-full y scrollea interno, no aquí). */
function Layout() {
  return (
    <>
      {/* visible solo con :focus (index.css .skip-link) — sin JS. */}
      <a href="#main-content" className="skip-link">
        Saltar al contenido principal
      </a>
      <div className="h-dvh overflow-hidden bg-surface-bg flex flex-col">
        {/* header landmark: la navbar es fixed (fuera de flujo), el wrapper no altera el layout. */}
        <header>
          <Navbar />
        </header>
        <div className="flex flex-1 min-h-0 overflow-hidden pt-14">
          {/* overflow-y auto: las páginas altas (perfil, módulos) scrollean aquí; el workarea
              no desborda (usa h-full + scroll interno propio), así que no cambia para él. */}
          <main id="main-content" className="flex-1 flex flex-col min-h-0 min-w-0 overflow-y-auto">
            {/* min-h-0: sin él este divisor crece con el contenido y el MAIN scrollea entero —
             *  en isometría el pedido es que NO haya scroll de página y que recorte el propio
             *  workarea (el scroll interno queda en cada vista). Las páginas altas siguen
             *  scrolleando aquí: su contenido desborda el divisor igual que antes. */}
            <div className="flex-1 min-h-0">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </>
  );
}

export default Layout;
