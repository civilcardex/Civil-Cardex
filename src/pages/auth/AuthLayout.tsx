import React from 'react';
import Navbar from '../../components/Navbar.tsx';

interface AuthLayoutProps {
  /** JSON-LD opcional de la página (login/registro lo inyectan). */
  jsonld?: object;
  /** Registro necesita respiro vertical extra (form más alto). */
  py12?: boolean;
  /** Dos spans del título: p.ej. CIVIL + CARDEX, RESTABLECER + CONTRASEÑA. */
  titulo: [string, string];
  subtitulo: React.ReactNode;
  subtituloColor: string;
  children: React.ReactNode;
}

/** Shell compartido de las 3 pantallas de auth: fondo landing, navbar, rejilla + blur,
 *  tarjeta con logo, título CIVIL CARDEX y subtítulo. Los hijos van dentro de la tarjeta
 *  (form + pie de enlaces, que difieren por página). */
export default function AuthLayout({
  jsonld,
  py12 = false,
  titulo,
  subtitulo,
  subtituloColor,
  children,
}: AuthLayoutProps): React.JSX.Element {
  return (
    <div
      className="landing-root min-h-screen flex flex-col"
      style={{ background: '#0a0e14', color: '#e2e2e8' }}
    >
      {jsonld ? <script type="application/ld+json">{JSON.stringify(jsonld)}</script> : null}
      <Navbar />

      <div
        className={`flex-1 flex items-center justify-center relative pt-16${py12 ? ' py-12' : ''}`}
      >
        <div className="absolute inset-0 login-grid pointer-events-none" />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full blur-[100px] pointer-events-none"
          style={{ background: 'rgba(0,170,255,0.06)' }}
        />

        <div className="relative z-10 w-full max-w-[420px] mx-4">
          <div
            className="border border-outline-variant"
            style={{ background: 'rgba(10,14,20,0.8)', backdropFilter: 'blur(16px)' }}
          >
            <div className="px-8 pt-10 pb-6 text-center">
              <div className="flex justify-center mb-5">
                <img
                  src="/logos/civilCardexlogo-v2.webp"
                  alt="CivilCardex"
                  className="w-24 h-24 object-contain"
                  style={{ filter: 'drop-shadow(0 0 20px rgba(0,170,255,0.25))' }}
                  width={96}
                  height={96}
                  loading="lazy"
                />
              </div>
              <h1
                className="text-2xl font-black tracking-tight uppercase mb-1"
                style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}
              >
                <span style={{ color: '#dce3ea' }}>{titulo[0]}</span>
                <span style={{ color: '#e8c84a' }}>{titulo[1]}</span>
              </h1>
              <p
                className="text-xs uppercase tracking-widest"
                style={{ color: subtituloColor, fontFamily: 'Geist, monospace', fontWeight: 600 }}
              >
                {subtitulo}
              </p>
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
