import { useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from './Navbar.tsx';

const MODULE_NAMES: Record<string, string> = {
  civilflow: 'Civil Flow',
  civilstructure: 'Civil Structure',
  civilterrain: 'Civil Terrain',
  civilmanager: 'Civil Manager',
  civilroads: 'Civil Roads',
};

interface ModulePageLayoutProps {
  title: string;
  children: React.ReactNode;
  mainClassName?: string;
  /** Id del módulo (flow/manage/...) para fijar el color de acento por CSS. */
  moduleId?: string;
  /** Ajusta el main al hueco EXACTO entre navbar y footer (sin scroll de página). Para
   *  pantallas de una vista (p. ej. «En construcción»); el footer mide ~5.5rem fijos. */
  fitViewport?: boolean;
}

/** Esqueleto de las páginas de módulo: Navbar + footer + JSON-LD BreadcrumbList (Inicio > Módulo) y enlace "saltar al contenido" (a11y). */
export default function ModulePageLayout({
  title: _title,
  children,
  mainClassName = '',
  moduleId,
  fitViewport = false,
}: ModulePageLayoutProps) {
  const loc = useLocation();
  const breadRef = useRef<HTMLScriptElement>(null);

  const path = loc.pathname.replace(/^\//, '').split('/')[0];
  const moduleName = MODULE_NAMES[path] || _title;

  useEffect(() => {
    if (!breadRef.current) return;
    breadRef.current.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Inicio', item: 'https://civilcardex.com/' },
        {
          '@type': 'ListItem',
          position: 2,
          name: moduleName,
          item: `https://civilcardex.com/${path}`,
        },
      ],
    });
  }, [moduleName, path]);

  return (
    <>
      <a
        href="#main-content"
        className="font-geist-mono sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-on-primary focus:rounded"
      >
        Saltar al contenido principal
      </a>
      <script ref={breadRef} type="application/ld+json" />
      <Navbar />
      <main
        id="main-content"
        data-module={moduleId}
        className={`module-main flex-grow pt-16 ${fitViewport ? 'module-main-fit' : ''} ${mainClassName}`}
      >
        {children}
      </main>
      <footer className="module-footer border-t border-outline-variant">
        <div className="flex flex-col md:flex-row justify-between items-center px-6 lg:px-8 py-8 w-full gap-4">
          <span className="font-geist-mono text-[11px] tracking-[0.08em] font-bold uppercase">
            <span className="ccx-silver">Civil</span>
            <span className="ccx-gold"> Cardex</span>
          </span>
          <span className="font-geist-mono text-[13px] text-on-surface-variant uppercase">
            © 2026 Civil Cardex. Todos los derechos reservados.
          </span>
        </div>
      </footer>
    </>
  );
}
