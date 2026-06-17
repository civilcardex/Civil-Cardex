import { useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import MobileOnlyMessage from './MobileOnlyMessage';

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
      <MobileOnlyMessage />
      <main id="main-content" className={`flex-grow pt-16 ${mainClassName}`} style={{ background: '#111317', minHeight: '100vh' }}>
        {children}
      </main>
      <Footer />
    </>
  );
}
