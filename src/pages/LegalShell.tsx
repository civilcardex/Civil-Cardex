import React from 'react';
import Navbar from '../components/Navbar.tsx';

/** Estilos de contenido legal compartidos por las 3 páginas (Términos/Privacidad/Cookies). */
export const LEGAL_H2: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: '#dce3ea',
  fontFamily: 'Geist, monospace',
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  margin: '28px 0 8px',
};
/** Párrafo legal (13px, gris claro, interlineado 1.7). */
export const LEGAL_P: React.CSSProperties = {
  fontSize: 13,
  lineHeight: 1.7,
  color: '#b9caca',
  margin: '0 0 10px',
};
/** Ítem de lista legal, indentado como el párrafo. */
export const LEGAL_LI: React.CSSProperties = {
  fontSize: 13,
  lineHeight: 1.7,
  color: '#b9caca',
  margin: '0 0 6px 18px',
};

/** Shell común de las páginas legales: fondo landing, navbar y columna de lectura con
 *  título + subtítulo; el contenido (h2/p/li + pie de enlaces) lo pone cada página. */
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
    <div
      className="landing-root min-h-screen flex flex-col"
      style={{ background: '#0a0e14', color: '#e2e2e8' }}
    >
      <Navbar />
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 pt-24 pb-16">
        <h1
          className="text-2xl font-black tracking-tight uppercase mb-1"
          style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}
        >
          <span style={{ color: '#dce3ea' }}>{titulo}</span>
        </h1>
        <p
          className="text-xs uppercase tracking-widest mb-8"
          style={{ color: '#6b8cae', fontFamily: 'Geist, monospace', fontWeight: 600 }}
        >
          {subtitulo}
        </p>
        {children}
      </main>
    </div>
  );
}
