import { useRef, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import Navbar from './Navbar';

const MODULE_NAMES: Record<string, string> = {
  civilflow: 'CivilFlow',
  civilstructure: 'Estructuras',
  civilterrain: 'Terreno',
  civilbim: 'BIM',
  civilmanage: 'Gesti\u00f3n',
  civilmep: 'MEP',
  civilroads: 'V\u00edas',
};

interface ModulePageLayoutProps {
  title: string;
  description: string;
  children: React.ReactNode;
  mainClassName?: string;
}

export default function ModulePageLayout({ title: _title, description: _description, children, mainClassName = '' }: ModulePageLayoutProps) {
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
        { '@type': 'ListItem', position: 1, name: 'Inicio', item: 'https://civilcore.app/' },
        { '@type': 'ListItem', position: 2, name: moduleName, item: `https://civilcore.app/${path}` },
      ],
    });
  }, [moduleName, path]);

  return (
    <>
      <script ref={breadRef} type="application/ld+json" />
      <Navbar />
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background p-4 lg:hidden" style={{ background: '#0c0e12' }}>
        <div className="text-center">
          <span className="material-symbols-outlined text-4xl mb-4 text-on-surface" aria-hidden="true">desktop_windows</span>
          <p className="text-lg font-semibold text-on-surface" style={{ fontFamily: 'Geist, sans-serif' }}>Disponible solo en escritorio</p>
          <p className="text-sm text-on-surface-variant mt-2" style={{ fontFamily: 'Geist, sans-serif' }}>Para una experiencia completa, accede desde tu computador</p>
        </div>
      </div>
      <main id="main-content" className={`flex-grow pt-16 ${mainClassName}`} style={{ background: '#111317', minHeight: '100vh' }}>
        {children}
      </main>
      <footer className="border-t border-outline-variant" style={{ background: '#0c0e12' }}>
        <div className="flex flex-col md:flex-row justify-between items-center px-6 lg:px-8 py-8 w-full gap-4">
          <span className="text-[11px] tracking-[0.08em] font-bold text-primary uppercase" style={{ fontFamily: 'Geist, monospace' }}>CivilCore</span>
          <div className="flex flex-wrap items-center justify-center gap-6">
            <Link to="/docs" className="text-[11px] tracking-[0.08em] font-bold text-on-surface-variant hover:text-primary uppercase transition-colors" style={{ fontFamily: 'Geist, monospace' }}>API</Link>
            <Link to="/docs" className="text-[11px] tracking-[0.08em] font-bold text-on-surface-variant hover:text-primary uppercase transition-colors" style={{ fontFamily: 'Geist, monospace' }}>SDK</Link>
          </div>
          <span className="text-[13px] text-on-surface-variant uppercase" style={{ fontFamily: 'Geist, monospace' }}>© 2026 CivilCore Engineering. Todos los derechos reservados.</span>
        </div>
      </footer>
    </>
  );
}
