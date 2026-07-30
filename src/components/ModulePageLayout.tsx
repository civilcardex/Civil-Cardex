import { useRef, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import Navbar from './Navbar';

const MODULE_NAMES: Record<string, string> = {
  civilflow: 'CivilFlow',
  civilstructure: 'Estructuras',
  civilterrain: 'Terreno',
  civilbim: 'BIM',
  civilmanage: 'Gestión',
  civilmep: 'MEP',
  civilroads: 'Vías',
};

interface ModulePageLayoutProps {
  title: string;
  children: React.ReactNode;
  mainClassName?: string;
}

export default function ModulePageLayout({
  title: _title,
  children,
  mainClassName = '',
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
        { '@type': 'ListItem', position: 1, name: 'Inicio', item: 'https://civilcardex.app/' },
        {
          '@type': 'ListItem',
          position: 2,
          name: moduleName,
          item: `https://civilcardex.app/${path}`,
        },
      ],
    });
  }, [moduleName, path]);

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-on-primary focus:rounded"
        style={{ fontFamily: 'Geist, monospace' }}
      >
        Saltar al contenido principal
      </a>
      <script ref={breadRef} type="application/ld+json" />
      <Navbar />
      <main
        id="main-content"
        className={`flex-grow pt-16 ${mainClassName}`}
        style={{ background: '#111317', minHeight: '100vh' }}
      >
        {children}
      </main>
      <footer className="border-t border-outline-variant" style={{ background: '#0c0e12' }}>
        <div className="flex flex-col md:flex-row justify-between items-center px-6 lg:px-8 py-8 w-full gap-4">
          <span
            className="text-[11px] tracking-[0.08em] font-bold text-primary uppercase"
            style={{ fontFamily: 'Geist, monospace' }}
          >
            CivilCardex
          </span>
          <div className="flex flex-wrap items-center justify-center gap-6">
            <Link
              to="/docs"
              className="text-[11px] tracking-[0.08em] font-bold text-on-surface-variant hover:text-primary uppercase transition-colors"
              style={{ fontFamily: 'Geist, monospace' }}
            >
              API
            </Link>
            <Link
              to="/docs"
              className="text-[11px] tracking-[0.08em] font-bold text-on-surface-variant hover:text-primary uppercase transition-colors"
              style={{ fontFamily: 'Geist, monospace' }}
            >
              SDK
            </Link>
          </div>
          <span
            className="text-[13px] text-on-surface-variant uppercase"
            style={{ fontFamily: 'Geist, monospace' }}
          >
            © 2026 CivilCardex Engineering. Todos los derechos reservados.
          </span>
        </div>
      </footer>
    </>
  );
}
