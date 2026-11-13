import React from 'react';
import Navbar from '../components/Navbar.tsx';

/** Shell común de las páginas legales: fondo landing, navbar y columna de lectura con
 *  título + subtítulo; el contenido (h2/p/li + pie de enlaces) lo pone cada página.
 *  Las clases de tipografía viven en src/styles/legal.css. */
export default function LegalShell({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string;
  subtitulo: React.ReactNode;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="landing-root min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 pt-24 pb-16">
        <h1 className="legal-title text-2xl font-black tracking-tight uppercase mb-1">{titulo}</h1>
        <p className="legal-subtitle text-xs uppercase tracking-widest mb-8">{subtitulo}</p>
        {children}
      </main>
    </div>
  );
}
